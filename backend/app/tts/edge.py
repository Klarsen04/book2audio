import io
import os
import logging

logger = logging.getLogger(__name__)

VOICES = {
    "Matthew": {"id": "en-US-GuyNeural", "gender": "Male", "engine": "edge"},
    "Joanna": {"id": "en-US-JennyNeural", "gender": "Female", "engine": "edge"},
    "Amy": {"id": "en-GB-SoniaNeural", "gender": "Female", "engine": "edge"},
    "Brian": {"id": "en-GB-RyanNeural", "gender": "Male", "engine": "edge"},
    "Ruth": {"id": "en-US-AriaNeural", "gender": "Female", "engine": "edge"},
    "Stephen": {"id": "en-US-ChristopherNeural", "gender": "Male", "engine": "edge"},
    "Danielle": {"id": "en-US-MichelleNeural", "gender": "Female", "engine": "edge"},
    "Gregory": {"id": "en-US-EricNeural", "gender": "Male", "engine": "edge"},
}

MAX_CHARS = 5000

# On cloud servers, edge-tts is blocked by Microsoft. Use gTTS by default.
USE_EDGE = os.environ.get("FORCE_EDGE_TTS", "").lower() == "true"


def _split_text(text: str) -> list[str]:
    import re
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks, current = [], ""
    for sentence in sentences:
        if len(current) + len(sentence) + 1 > MAX_CHARS:
            if current:
                chunks.append(current.strip())
            current = sentence
        else:
            current += " " + sentence
    if current.strip():
        chunks.append(current.strip())
    return chunks


def _synthesize_chunk_gtts(text: str) -> bytes:
    from gtts import gTTS
    tts = gTTS(text=text, lang='en')
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()


def _synthesize_chunk_edge(text: str, voice_id: str) -> bytes:
    import asyncio
    import edge_tts
    communicate = edge_tts.Communicate(text, voice_id)
    audio_data = b""

    async def _stream():
        nonlocal audio_data
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

    asyncio.run(_stream())
    return audio_data


def synthesize_chapter(text: str, voice: str = "Joanna", on_progress=None) -> bytes:
    import tempfile
    import shutil
    from app.audio_utils import concat_mp3

    voice_info = VOICES.get(voice, VOICES["Joanna"])
    voice_id = voice_info["id"]
    chunks = _split_text(text)

    # Write each synthesized chunk straight to disk and concatenate with ffmpeg
    # at the end, so a very long chapter never accumulates decoded PCM in memory.
    tmpdir = tempfile.mkdtemp(prefix="b2a-chap-")
    chunk_files = []
    try:
        for i, chunk in enumerate(chunks):
            audio_bytes = None

            if USE_EDGE:
                try:
                    audio_bytes = _synthesize_chunk_edge(chunk, voice_id)
                except Exception as e:
                    logger.warning(f"edge-tts failed, falling back to gTTS: {e}")

            if not audio_bytes:
                try:
                    audio_bytes = _synthesize_chunk_gtts(chunk)
                except Exception as e:
                    logger.error(f"gTTS also failed: {e}")

            if audio_bytes:
                cp = os.path.join(tmpdir, f"chunk_{i:05d}.mp3")
                with open(cp, "wb") as f:
                    f.write(audio_bytes)
                chunk_files.append(cp)

            if on_progress:
                on_progress(i + 1, len(chunks))

        if not chunk_files:
            return b""

        out_path = os.path.join(tmpdir, "chapter.mp3")
        concat_mp3(chunk_files, out_path)
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def list_voices() -> list[dict]:
    return [
        {"id": k, "gender": v["gender"], "engine": v["engine"]}
        for k, v in VOICES.items()
    ]
