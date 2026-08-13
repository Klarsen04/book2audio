import io
import os
import time
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


EDGE_CHUNK_TIMEOUT = int(os.environ.get("EDGE_CHUNK_TIMEOUT", "90"))


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

    # Bound each chunk: a hung edge-tts connection (throttling, dropped socket)
    # would otherwise block the whole conversion forever. On timeout this raises,
    # so _synthesize_chunk retries and then falls back to gTTS.
    asyncio.run(asyncio.wait_for(_stream(), timeout=EDGE_CHUNK_TIMEOUT))
    return audio_data


def _synthesize_chunk(text: str, voice_id: str, attempts: int = 4) -> bytes:
    """
    Synthesize one chunk, retrying transient failures with backoff. Tries
    edge-tts first when enabled, then gTTS. Returns b"" only after all attempts
    across both engines fail (e.g. a sustained rate-limit).
    """
    for attempt in range(attempts):
        if USE_EDGE:
            try:
                out = _synthesize_chunk_edge(text, voice_id)
                if out:
                    return out
            except Exception as e:
                logger.warning(f"edge-tts chunk failed (attempt {attempt + 1}): {e}")
        try:
            out = _synthesize_chunk_gtts(text)
            if out:
                return out
        except Exception as e:
            logger.warning(f"gTTS chunk failed (attempt {attempt + 1}): {e}")
        # Exponential backoff before retrying (pattern from epub_to_audiobook) —
        # rides out transient errors and light rate-limits.
        if attempt < attempts - 1:
            time.sleep(min(30, 2 ** attempt))
    return b""


def synthesize_chapter(text: str, voice: str = "Joanna", on_progress=None) -> bytes:
    import tempfile
    import shutil
    from app.audio_utils import concat_mp3

    voice_info = VOICES.get(voice, VOICES["Joanna"])
    voice_id = voice_info["id"]
    chunks = _split_text(text)
    # Genuinely empty/whitespace chapter (common EPUB cover/nav) → no audio.
    if not chunks:
        return b""

    # Write each synthesized chunk straight to disk and concatenate with ffmpeg
    # at the end, so a very long chapter never accumulates decoded PCM in memory.
    tmpdir = tempfile.mkdtemp(prefix="b2a-chap-")
    chunk_files = []
    try:
        for i, chunk in enumerate(chunks):
            audio_bytes = _synthesize_chunk(chunk, voice_id)
            if audio_bytes:
                cp = os.path.join(tmpdir, f"chunk_{i:05d}.mp3")
                with open(cp, "wb") as f:
                    f.write(audio_bytes)
                chunk_files.append(cp)
            if on_progress:
                on_progress(i + 1, len(chunks))

        # Text existed but nothing synthesized — surface a real error instead of
        # a silent empty chapter (which read as "no readable text"). This is
        # almost always the speech service being rate-limited/unavailable.
        if not chunk_files:
            raise RuntimeError(
                "The speech service didn't return any audio (it may be rate-limited "
                "or temporarily unavailable). Please try again in a few minutes."
            )

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
