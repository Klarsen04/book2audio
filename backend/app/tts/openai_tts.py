"""
OpenAI Text-to-Speech provider (optional, paid).

Pattern adapted from p0n1/epub_to_audiobook (MIT): a provider that plugs into
the same interface as edge/polly (`synthesize_chapter`, `list_voices`) and is
selected via TTS_PROVIDER=openai. This is the "fast + reliable + high quality"
option that doesn't rate-limit like the free gTTS/edge endpoints — the trade-off
is cost (billed per character) and needing an OPENAI_API_KEY.

Kept consistent with the rest of the app: the `openai` SDK is imported lazily
(so the module loads fine without it unless actually used), and chunks are
streamed to disk + joined with ffmpeg so a big chapter never sits in memory.
"""

import os
import re
import time
import logging

logger = logging.getLogger(__name__)

# Model + input limits. gpt-4o-mini-tts is the cheapest current model; OpenAI's
# TTS input cap is 4096 chars, so keep chunks comfortably under it.
MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
MAX_CHARS = 3800
MAX_RETRIES = 4

# Map the app's friendly voice names to OpenAI voices so the existing voice
# picker keeps working when this provider is selected.
VOICES = {
    "Matthew": "onyx",
    "Joanna": "nova",
    "Amy": "shimmer",
    "Brian": "echo",
    "Ruth": "alloy",
    "Stephen": "ash",
    "Danielle": "coral",
    "Gregory": "fable",
}

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI  # lazy: only needed when this provider is used

        # Reads OPENAI_API_KEY from the environment. The SDK also retries.
        _client = OpenAI(max_retries=2)
    return _client


def _split_text(text: str) -> list[str]:
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


def _synthesize_chunk(voice_id: str, text: str) -> bytes:
    """One chunk with retry + exponential backoff (pattern from epub_to_audiobook)."""
    client = _get_client()
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.audio.speech.create(
                model=MODEL, voice=voice_id, input=text, response_format="mp3"
            )
            data = resp.content
            if data:
                return data
        except Exception as e:
            logger.warning(f"OpenAI TTS chunk failed (attempt {attempt + 1}): {e}")
        if attempt < MAX_RETRIES - 1:
            time.sleep(min(30, 2 ** attempt))
    return b""


def synthesize_chapter(text: str, voice: str = "Joanna", on_progress=None) -> bytes:
    import tempfile
    import shutil
    from app.audio_utils import concat_mp3

    voice_id = VOICES.get(voice, "nova")
    chunks = _split_text(text)
    if not chunks:
        return b""

    tmpdir = tempfile.mkdtemp(prefix="b2a-oai-")
    chunk_files = []
    try:
        for i, chunk in enumerate(chunks):
            data = _synthesize_chunk(voice_id, chunk)
            if data:
                cp = os.path.join(tmpdir, f"chunk_{i:05d}.mp3")
                with open(cp, "wb") as f:
                    f.write(data)
                chunk_files.append(cp)
            if on_progress:
                on_progress(i + 1, len(chunks))

        if not chunk_files:
            raise RuntimeError(
                "OpenAI TTS returned no audio (check OPENAI_API_KEY / billing)."
            )

        out_path = os.path.join(tmpdir, "chapter.mp3")
        concat_mp3(chunk_files, out_path)
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def list_voices() -> list[dict]:
    return [{"id": name, "gender": "", "engine": "openai"} for name in VOICES]
