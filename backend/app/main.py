import uuid
import os
from pathlib import Path
from threading import Thread

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.parsers.extractor import extract_text, BookContent
from app.tts.polly import synthesize_chapter, list_voices

app = FastAPI(title="Book2Audio API")

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("/app/output") if os.environ.get("DOCKER") else Path("./output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

jobs: dict[str, dict] = {}


@app.get("/api/voices")
async def get_voices():
    return {"voices": list_voices()}


@app.post("/api/upload")
async def upload_file(file: UploadFile):
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

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "uploaded",
        "filename": file.filename,
        "content": content,
        "progress": 0,
        "current_chapter": 0,
        "total_chapters": len(content.chapters),
        "output_path": None,
    }

    return {
        "job_id": job_id,
        "title": content.title,
        "chapters": [{"title": ch.title, "word_count": len(ch.text.split())} for ch in content.chapters],
        "total_word_count": content.word_count,
    }


@app.post("/api/convert/{job_id}")
async def start_conversion(job_id: str, voice: str = "Joanna"):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] == "converting":
        raise HTTPException(status_code=409, detail="Conversion already in progress")

    job["status"] = "converting"
    job["progress"] = 0

    thread = Thread(target=_run_conversion, args=(job_id, voice))
    thread.start()

    return {"status": "converting", "job_id": job_id}


def _run_conversion(job_id: str, voice: str):
    job = jobs[job_id]
    content: BookContent = job["content"]

    try:
        from pydub import AudioSegment
        import io

        full_audio = AudioSegment.empty()
        total_chapters = len(content.chapters)

        for i, chapter in enumerate(content.chapters):
            job["current_chapter"] = i + 1

            def on_chunk_progress(current, total):
                chapter_progress = (current / total) * 100
                overall = ((i * 100) + chapter_progress) / total_chapters
                job["progress"] = int(overall)

            audio_bytes = synthesize_chapter(chapter.text, voice, on_progress=on_chunk_progress)
            segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            full_audio += segment

        output_path = OUTPUT_DIR / f"{job_id}.mp3"
        full_audio.export(str(output_path), format="mp3", bitrate="192k")

        job["status"] = "completed"
        job["progress"] = 100
        job["output_path"] = str(output_path)

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "status": job["status"],
        "progress": job["progress"],
        "current_chapter": job.get("current_chapter", 0),
        "total_chapters": job.get("total_chapters", 0),
        "error": job.get("error"),
    }


@app.get("/api/download/{job_id}")
async def download_audio(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Conversion not complete")

    output_path = job["output_path"]
    if not output_path or not Path(output_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    filename = Path(job["filename"]).stem + ".mp3"
    return FileResponse(output_path, media_type="audio/mpeg", filename=filename)
