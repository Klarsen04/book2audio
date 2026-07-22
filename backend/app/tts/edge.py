import io
import os
import logging
from pydub import AudioSegment

logger = logging.getLogger(__name__)

VOICES = {
    "Matthew": {"id": "en-US-GuyNeural", "gender": "Male", "engine": "edge"},
    "Joanna": {"id": "en-US-JennyNeural", "gender": "Female", "engine": "edge"},
    "Amy": {"id": "en-GB-SoniaNeural", "gender": "Female", "engine": "edge"},
    "Brian": {"id": "en-GB-RyanNeural", "gender": "Male", "engine": "edge"},
    "Ruth": {"id": "en-US-AriaNeural", "gender": "Female", "engine": "edge"},
    "Stephen": {"id": "en-US-DavisNeural", "gender": "Male", "engine": "edge"},
    "Danielle": {"id": "en-US-NancyNeural", "gender": "Female", "engine": "edge"},
    "Gregory": {"id": "en-US-TonyNeural", "gender": "Male", "engine": "edge"},
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
    voice_info = VOICES.get(voice, VOICES["Joanna"])
    voice_id = voice_info["id"]
    chunks = _split_text(text)
    combined = AudioSegment.empty()

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
            segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            combined += segment

        if on_progress:
            on_progress(i + 1, len(chunks))

    output = io.BytesIO()
    combined.export(output, format="mp3", bitrate="192k")
    return output.getvalue()


def list_voices() -> list[dict]:
    return [
        {"id": k, "gender": v["gender"], "engine": v["engine"]}
        for k, v in VOICES.items()
    ]
