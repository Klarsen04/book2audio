import uuid
import json
import os
from pathlib import Path
from threading import Thread

from fastapi import FastAPI, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import init_db, get_db
from app.parsers.extractor import extract_text
from app.tts.provider import get_synthesize_fn, get_voices_fn
from app.auth.dependencies import get_current_user
from app.auth.router import router as auth_router
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
)

OUTPUT_DIR = Path("/app/output") if os.environ.get("DOCKER") else Path("./output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory progress tracking (not persisted — only for active conversions)
conversion_progress: dict[str, dict] = {}

app.include_router(auth_router)
app.include_router(library_router)
app.include_router(playback_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/voices")
async def get_voices():
    return {"voices": get_voices_fn()()}


@app.post("/api/upload")
async def upload_file(file: UploadFile, user: dict = Depends(get_current_user)):
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


@app.post("/api/convert/{doc_id}")
async def start_conversion(doc_id: str, voice: str = "Joanna", user: dict = Depends(get_current_user)):
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

        output_path = OUTPUT_DIR / f"{doc_id}.mp3"
        full_audio.export(str(output_path), format="mp3", bitrate="192k")

        duration = len(full_audio) / 1000.0

        # Inject exact start times into the stored chapters_json
        with get_db() as conn:
            row = conn.execute("SELECT chapters_json FROM documents WHERE id = ?", (doc_id,)).fetchone()
            chapters = json.loads(row[0])
            for i, ch in enumerate(chapters):
                ch["start_time"] = chapter_start_times[i]
            conn.execute(
                "UPDATE documents SET status = 'completed', audio_path = ?, audio_duration = ?, chapters_json = ?, converted_at = datetime('now') WHERE id = ?",
                (str(output_path), duration, json.dumps(chapters), doc_id),
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
async def get_status(doc_id: str, user: dict = Depends(get_current_user)):
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
async def download_audio(doc_id: str, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT filename, audio_path, status FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if row["status"] != "completed":
        raise HTTPException(status_code=400, detail="Conversion not complete")

    audio_path = row["audio_path"]
    if not audio_path or not Path(audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    filename = Path(row["filename"]).stem + ".mp3"
    return FileResponse(audio_path, media_type="audio/mpeg", filename=filename)
