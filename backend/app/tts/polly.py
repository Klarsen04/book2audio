import io
import re
from pydub import AudioSegment
import boto3


VOICES = {
    "Matthew": {"id": "Matthew", "gender": "Male", "engine": "neural"},
    "Joanna": {"id": "Joanna", "gender": "Female", "engine": "neural"},
    "Amy": {"id": "Amy", "gender": "Female", "engine": "neural"},
    "Brian": {"id": "Brian", "gender": "Male", "engine": "neural"},
    "Ruth": {"id": "Ruth", "gender": "Female", "engine": "neural"},
    "Stephen": {"id": "Stephen", "gender": "Male", "engine": "neural"},
    "Danielle": {"id": "Danielle", "gender": "Female", "engine": "neural"},
    "Gregory": {"id": "Gregory", "gender": "Male", "engine": "neural"},
}

MAX_CHARS = 2900


def _split_text_into_chunks(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 1 > MAX_CHARS:
            if current_chunk:
                chunks.append(current_chunk.strip())
            if len(sentence) > MAX_CHARS:
                words = sentence.split()
                current_chunk = ""
                for word in words:
                    if len(current_chunk) + len(word) + 1 > MAX_CHARS:
                        chunks.append(current_chunk.strip())
                        current_chunk = word
                    else:
                        current_chunk += " " + word
            else:
                current_chunk = sentence
        else:
            current_chunk += " " + sentence

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def synthesize_text(text: str, voice: str = "Joanna") -> bytes:
    client = boto3.client("polly")
    voice_info = VOICES.get(voice, VOICES["Joanna"])
    engine = voice_info["engine"]

    chunks = _split_text_into_chunks(text)
    combined = AudioSegment.empty()

    for chunk in chunks:
        response = client.synthesize_speech(
            Text=chunk,
            OutputFormat="mp3",
            VoiceId=voice_info["id"],
            Engine=engine,
        )
        audio_stream = response["AudioStream"].read()
        segment = AudioSegment.from_mp3(io.BytesIO(audio_stream))
        combined += segment

    output = io.BytesIO()
    combined.export(output, format="mp3", bitrate="192k")
    return output.getvalue()


def synthesize_chapter(text: str, voice: str = "Joanna", on_progress=None) -> bytes:
    client = boto3.client("polly")
    voice_info = VOICES.get(voice, VOICES["Joanna"])
    engine = voice_info["engine"]

    chunks = _split_text_into_chunks(text)
    combined = AudioSegment.empty()

    for i, chunk in enumerate(chunks):
        response = client.synthesize_speech(
            Text=chunk,
            OutputFormat="mp3",
            VoiceId=voice_info["id"],
            Engine=engine,
        )
        audio_stream = response["AudioStream"].read()
        segment = AudioSegment.from_mp3(io.BytesIO(audio_stream))
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
