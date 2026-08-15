import os

# Default to edge: it needs no credentials (and falls back to gTTS), whereas
# polly requires AWS credentials and fails every conversion without them.
TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "edge").lower()


def get_synthesize_fn():
    if TTS_PROVIDER == "edge":
        from app.tts.edge import synthesize_chapter
    elif TTS_PROVIDER == "openai":
        from app.tts.openai_tts import synthesize_chapter
    else:
        from app.tts.polly import synthesize_chapter
    return synthesize_chapter


def get_voices_fn():
    if TTS_PROVIDER == "edge":
        from app.tts.edge import list_voices
    elif TTS_PROVIDER == "openai":
        from app.tts.openai_tts import list_voices
    else:
        from app.tts.polly import list_voices
    return list_voices
