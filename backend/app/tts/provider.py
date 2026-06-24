import os

TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "polly").lower()


def get_synthesize_fn():
    if TTS_PROVIDER == "edge":
        from app.tts.edge import synthesize_chapter
    else:
        from app.tts.polly import synthesize_chapter
    return synthesize_chapter


def get_voices_fn():
    if TTS_PROVIDER == "edge":
        from app.tts.edge import list_voices
    else:
        from app.tts.polly import list_voices
    return list_voices
