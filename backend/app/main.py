import uuid
import json
import os
from pathlib import Path
from threading import Thread

import httpx
from fastapi import FastAPI, UploadFile, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.database import init_db, get_db
from app.parsers.extractor import extract_text, extract_from_pdf, extract_from_txt, BookContent, Chapter
from app.tts.provider import get_synthesize_fn, get_voices_fn
from app import storage
from app.session import get_session, optional_session, set_session_cookie
from app.session_router import router as session_router
from app.library.router import router as library_router
from app.playback.router import router as playback_router

app = FastAPI(title="Book2Audio API")

allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Restore-Key"],
)


@app.middleware("http")
async def attach_new_session(request: Request, call_next):
    """
    When get_session() mints a brand-new guest identity mid-request, persist it:
    set the session cookie and surface the one-time restore key via a response
    header so the frontend can show the "save your key" banner.
    """
    response = await call_next(request)
    token = getattr(request.state, "new_session_token", None)
    if token:
        set_session_cookie(response, token)
        key = getattr(request.state, "new_restore_key", None)
        if key:
            response.headers["X-Restore-Key"] = key
    return response

# Where generated audio is stored. Must live on persistent storage in
# production (e.g. Render's mounted disk) or files are lost on every deploy.
# Priority: explicit AUDIO_OUTPUT_DIR env var > Docker volume > local ./output.
if os.environ.get("AUDIO_OUTPUT_DIR"):
    OUTPUT_DIR = Path(os.environ["AUDIO_OUTPUT_DIR"])
elif os.environ.get("DOCKER"):
    OUTPUT_DIR = Path("/app/output")
else:
    OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory progress tracking (not persisted — only for active conversions)
conversion_progress: dict[str, dict] = {}

app.include_router(session_router)
app.include_router(library_router)
app.include_router(playback_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
async def health_check():
    has_gtts = False
    try:
        import gtts
        has_gtts = True
    except ImportError:
        pass
    from app.tts.edge import USE_EDGE
    return {"status": "ok", "has_gtts": has_gtts, "use_edge": USE_EDGE}


@app.get("/api/voices")
async def get_voices():
    return {"voices": get_voices_fn()()}


@app.get("/api/voices/preview/{voice_id}")
async def preview_voice(voice_id: str, text: str | None = None):
    import io
    import edge_tts
    from app.tts.edge import VOICES

    voice_info = VOICES.get(voice_id, VOICES.get("Joanna"))
    if not voice_info:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_id}' not found")

    # Read the caller-supplied excerpt when provided (capped to keep previews
    # short), otherwise fall back to a generic line.
    if text and text.strip():
        sample_text = text.strip()[:400]
    else:
        sample_text = "Here's a quick preview of how I sound reading your documents."
    try:
        communicate = edge_tts.Communicate(sample_text, voice_info["id"])
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        if not audio_data:
            raise HTTPException(status_code=500, detail="No audio generated")
        return StreamingResponse(io.BytesIO(audio_data), media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@app.post("/api/upload")
async def upload_file(file: UploadFile, user: dict = Depends(get_session)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_extensions = {".pdf", ".epub", ".docx", ".txt"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {ext}. Supported: {', '.join(allowed_extensions)}",
        )

    file_bytes = await file.read()
    try:
        content = extract_text(file.filename, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {str(e)}")

    doc_id = str(uuid.uuid4())
    chapters_data = [{"title": ch.title, "word_count": len(ch.text.split()), "text": ch.text} for ch in content.chapters]
    chapters_meta = [{"title": ch.title, "word_count": len(ch.text.split())} for ch in content.chapters]

    with get_db() as conn:
        conn.execute(
            """INSERT INTO documents (id, user_id, filename, title, file_size, format, chapters_json, total_word_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                doc_id,
                user["id"],
                file.filename,
                content.title,
                len(file_bytes),
                ext.lstrip("."),
                json.dumps(chapters_data),
                content.word_count,
                "uploaded",
            ),
        )

    # Store parsed content in memory for the conversion step
    conversion_progress[doc_id] = {
        "content": content,
        "status": "uploaded",
        "progress": 0,
        "current_chapter": 0,
        "total_chapters": len(content.chapters),
    }

    return {
        "job_id": doc_id,
        "title": content.title,
        "chapters": chapters_meta,
        "total_word_count": content.word_count,
    }


class UploadUrlRequest(BaseModel):
    url: str


class UploadTextRequest(BaseModel):
    text: str
    title: str = "Pasted text"


@app.post("/api/upload-url")
async def upload_url(body: UploadUrlRequest, user: dict = Depends(get_session)):
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            resp = await client.get(body.url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")

    content_type = resp.headers.get("content-type", "")
    raw_bytes = resp.content

    try:
        if "application/pdf" in content_type or body.url.lower().endswith(".pdf"):
            content = extract_from_pdf(raw_bytes)
        else:
            # Treat as HTML: extract text from paragraphs
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(raw_bytes, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else "Untitled"
            paragraphs = soup.find_all("p")
            text = "\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))
            if not text.strip():
                # Fallback: get all visible text
                text = soup.get_text(separator="\n", strip=True)
            content = BookContent(
                title=title,
                chapters=[Chapter(title="Full Text", text=text.strip())],
                word_count=len(text.split()),
            )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse content: {str(e)}")

    doc_id = str(uuid.uuid4())
    fmt = "pdf" if ("application/pdf" in content_type or body.url.lower().endswith(".pdf")) else "html"
    chapters_data = [{"title": ch.title, "word_count": len(ch.text.split()), "text": ch.text} for ch in content.chapters]
    chapters_meta = [{"title": ch.title, "word_count": len(ch.text.split())} for ch in content.chapters]

    with get_db() as conn:
        conn.execute(
            """INSERT INTO documents (id, user_id, filename, title, file_size, format, chapters_json, total_word_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                doc_id,
                user["id"],
                body.url,
                content.title,
                len(raw_bytes),
                fmt,
                json.dumps(chapters_data),
                content.word_count,
                "uploaded",
            ),
        )

    conversion_progress[doc_id] = {
        "content": content,
        "status": "uploaded",
        "progress": 0,
        "current_chapter": 0,
        "total_chapters": len(content.chapters),
    }

    return {
        "job_id": doc_id,
        "title": content.title,
        "chapters": chapters_meta,
        "total_word_count": content.word_count,
    }


@app.post("/api/upload-text")
async def upload_text(body: UploadTextRequest, user: dict = Depends(get_session)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    try:
        content = extract_from_txt(body.text.encode("utf-8"))
        # Override the title with the user-provided one
        content = BookContent(title=body.title, chapters=content.chapters, word_count=content.word_count)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse text: {str(e)}")

    doc_id = str(uuid.uuid4())
    chapters_data = [{"title": ch.title, "word_count": len(ch.text.split()), "text": ch.text} for ch in content.chapters]
    chapters_meta = [{"title": ch.title, "word_count": len(ch.text.split())} for ch in content.chapters]

    with get_db() as conn:
        conn.execute(
            """INSERT INTO documents (id, user_id, filename, title, file_size, format, chapters_json, total_word_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                doc_id,
                user["id"],
                f"{body.title}.txt",
                content.title,
                len(body.text.encode("utf-8")),
                "txt",
                json.dumps(chapters_data),
                content.word_count,
                "uploaded",
            ),
        )

    conversion_progress[doc_id] = {
        "content": content,
        "status": "uploaded",
        "progress": 0,
        "current_chapter": 0,
        "total_chapters": len(content.chapters),
    }

    return {
        "job_id": doc_id,
        "title": content.title,
        "chapters": chapters_meta,
        "total_word_count": content.word_count,
    }


@app.post("/api/convert/{doc_id}")
async def start_conversion(
    doc_id: str,
    voice: str = "Joanna",
    audio_type: str = "full",
    intro: bool = False,
    user: dict = Depends(get_session),
):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, status FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc_id not in conversion_progress:
        raise HTTPException(status_code=400, detail="Document content expired. Please re-upload.")

    if conversion_progress[doc_id]["status"] == "converting":
        raise HTTPException(status_code=409, detail="Conversion already in progress")

    from app.parsers.extractor import Chapter, BookContent

    # Apply summarization if needed (this REPLACES the read content).
    if audio_type in ("long_summary", "short_summary"):
        from app.summarizer import summarize_long, summarize_short
        content = conversion_progress[doc_id]["content"]
        summarize_fn = summarize_long if audio_type == "long_summary" else summarize_short
        summarized_chapters = []
        for ch in content.chapters:
            summary_text = summarize_fn(ch.text)
            summarized_chapters.append(Chapter(title=ch.title, text=summary_text))
        # Replace content with summarized version
        summarized_content = BookContent(
            title=content.title,
            chapters=summarized_chapters,
            word_count=sum(len(ch.text.split()) for ch in summarized_chapters),
        )
        conversion_progress[doc_id]["content"] = summarized_content
        conversion_progress[doc_id]["total_chapters"] = len(summarized_chapters)

        # Persist the reduced word counts AND text so the reader view reflects
        # the summary (must keep `text`, or the reader shows "text not available").
        summarized_meta = [
            {"title": ch.title, "word_count": len(ch.text.split()), "text": ch.text}
            for ch in summarized_chapters
        ]
        with get_db() as conn:
            conn.execute(
                "UPDATE documents SET chapters_json = ?, total_word_count = ? WHERE id = ?",
                (json.dumps(summarized_meta), summarized_content.word_count, doc_id),
            )

    # Optional spoken "preread": prepend a short summary chapter read at the very
    # start, WITHOUT shortening the main content. Built from whatever will be read
    # (full text, or the summary above), so it previews the actual audio.
    if intro:
        from app.summarizer import summarize_intro
        content = conversion_progress[doc_id]["content"]
        whole_text = "\n\n".join(ch.text for ch in content.chapters)
        overview = summarize_intro(whole_text)
        if overview.strip():
            intro_text = (
                f"Summary. Here's a quick overview of {content.title}. "
                f"{overview} Now, the full text begins."
            )
            intro_chapter = Chapter(title="Summary", text=intro_text)
            new_content = BookContent(
                title=content.title,
                chapters=[intro_chapter, *content.chapters],
                word_count=content.word_count + len(intro_text.split()),
            )
            conversion_progress[doc_id]["content"] = new_content
            conversion_progress[doc_id]["total_chapters"] = len(new_content.chapters)

            # Prepend the intro to the stored chapter list so it shows as a
            # navigable "Summary" chapter at 0:00 in the player.
            with get_db() as conn:
                cj = conn.execute(
                    "SELECT chapters_json, total_word_count FROM documents WHERE id = ?",
                    (doc_id,),
                ).fetchone()
                chapters_meta = json.loads(cj[0])
                chapters_meta.insert(
                    0,
                    {
                        "title": "Summary",
                        "word_count": len(intro_text.split()),
                        "text": intro_text,
                    },
                )
                conn.execute(
                    "UPDATE documents SET chapters_json = ?, total_word_count = ? WHERE id = ?",
                    (json.dumps(chapters_meta), (cj[1] or 0) + len(intro_text.split()), doc_id),
                )

    conversion_progress[doc_id]["status"] = "converting"
    conversion_progress[doc_id]["progress"] = 0

    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET status = 'converting', voice = ? WHERE id = ?",
            (voice, doc_id),
        )

    thread = Thread(target=_run_conversion, args=(doc_id, voice))
    thread.start()

    return {"status": "converting", "job_id": doc_id}


def _run_conversion(doc_id: str, voice: str):
    progress = conversion_progress[doc_id]
    content = progress["content"]

    try:
        from pydub import AudioSegment
        import io

        full_audio = AudioSegment.empty()
        total_chapters = len(content.chapters)
        chapter_start_times = []  # exact start time in seconds for each chapter

        for i, chapter in enumerate(content.chapters):
            progress["current_chapter"] = i + 1

            # Record this chapter's start time before appending
            chapter_start_times.append(len(full_audio) / 1000.0)

            def on_chunk_progress(current, total):
                chapter_progress = (current / total) * 100
                overall = ((i * 100) + chapter_progress) / total_chapters
                progress["progress"] = int(overall)

            audio_bytes = get_synthesize_fn()(chapter.text, voice, on_progress=on_chunk_progress)
            segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            full_audio += segment

        # Write locally first, then hand off to the storage layer (local dir in
        # dev; uploaded to B2/R2 and removed locally when cloud is configured).
        output_path = storage.local_path(doc_id)
        full_audio.export(str(output_path), format="mp3", bitrate="192k")
        audio_ref = storage.save_audio(doc_id, output_path)

        duration = len(full_audio) / 1000.0

        # Inject exact start times into the stored chapters_json
        with get_db() as conn:
            row = conn.execute("SELECT chapters_json FROM documents WHERE id = ?", (doc_id,)).fetchone()
            chapters = json.loads(row[0])
            for i, ch in enumerate(chapters):
                ch["start_time"] = chapter_start_times[i]
            conn.execute(
                "UPDATE documents SET status = 'completed', audio_path = ?, audio_duration = ?, chapters_json = ?, converted_at = datetime('now') WHERE id = ?",
                (audio_ref, duration, json.dumps(chapters), doc_id),
            )

        progress["status"] = "completed"
        progress["progress"] = 100
        # Clean up parsed content to free memory
        del progress["content"]

    except Exception as e:
        with get_db() as conn:
            conn.execute("UPDATE documents SET status = 'error' WHERE id = ?", (doc_id,))
        progress["status"] = "error"
        progress["error"] = str(e)


@app.get("/api/status/{doc_id}")
async def get_status(doc_id: str, user: dict = Depends(optional_session)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    progress = conversion_progress.get(doc_id)
    if not progress:
        with get_db() as conn:
            doc = conn.execute("SELECT status FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return {
            "status": doc["status"] if doc else "unknown",
            "progress": 100 if doc and doc["status"] == "completed" else 0,
            "current_chapter": 0,
            "total_chapters": 0,
            "error": None,
        }

    return {
        "status": progress["status"],
        "progress": progress["progress"],
        "current_chapter": progress.get("current_chapter", 0),
        "total_chapters": progress.get("total_chapters", 0),
        "error": progress.get("error"),
    }


@app.get("/api/download/{doc_id}")
async def download_audio(doc_id: str, user: dict = Depends(optional_session)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT filename, status FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if row["status"] != "completed":
        raise HTTPException(status_code=400, detail="Conversion not complete")
    if not storage.exists(doc_id):
        raise HTTPException(status_code=404, detail="Audio file not found")

    filename = Path(row["filename"]).stem + ".mp3"
    # Serve the local file directly when possible (supports range/seek); stream
    # from object storage otherwise.
    if not storage.use_cloud():
        return FileResponse(str(storage.local_path(doc_id)), media_type="audio/mpeg", filename=filename)
    return StreamingResponse(
        storage.open_stream(doc_id),
        media_type="audio/mpeg",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.get("/api/export")
async def export_library(user: dict = Depends(optional_session)):
    """
    Bundle all of this session's completed audiobooks + a JSON manifest into a
    single .b2a (zip) file the user can keep offline and re-import later.
    """
    import io
    import zipfile

    with get_db() as conn:
        docs = conn.execute(
            """SELECT id, filename, title, format, chapters_json, total_word_count,
                      status, voice, audio_duration, created_at, converted_at
               FROM documents WHERE user_id = ? ORDER BY created_at""",
            (user["id"],),
        ).fetchall()

    manifest = {"version": 1, "exported_documents": [], "books": []}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in docs:
            book = {
                "id": d["id"],
                "filename": d["filename"],
                "title": d["title"],
                "format": d["format"],
                "chapters": json.loads(d["chapters_json"]),
                "total_word_count": d["total_word_count"],
                "status": d["status"],
                "voice": d["voice"],
                "audio_duration": d["audio_duration"],
                "created_at": d["created_at"],
                "converted_at": d["converted_at"],
            }
            manifest["books"].append(book)
            if d["status"] == "completed" and storage.exists(d["id"]):
                zf.writestr(f"audio/{d['id']}.mp3", storage.read_bytes(d["id"]))
                manifest["exported_documents"].append(d["id"])
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="book2audio-library.b2a"'},
    )
