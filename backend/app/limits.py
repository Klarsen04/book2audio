"""
Usage limits (all env-configurable) for the no-login, anonymous model.

Because anyone can mint a guest session and there is no account to hold people
accountable, these guardrails keep storage and compute bounded:

- MAX_UPLOAD_MB          reject oversized uploads/pasted text/URLs
- USER_QUOTA_MB          cap total stored audio per session (restore key)
- RATE_LIMIT_*_PER_HOUR  cap uploads/conversions per client IP
- SESSION_TTL_DAYS       reclaim audio from sessions idle this long (0 = off)
"""

import os


def _int(name: str, default: int) -> int:
    try:
        return int(float(os.environ.get(name, default)))
    except (TypeError, ValueError):
        return default


MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 25)
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

USER_QUOTA_MB = _int("USER_QUOTA_MB", 500)
USER_QUOTA_BYTES = USER_QUOTA_MB * 1024 * 1024

RATE_LIMIT_UPLOADS_PER_HOUR = _int("RATE_LIMIT_UPLOADS_PER_HOUR", 30)
RATE_LIMIT_CONVERSIONS_PER_HOUR = _int("RATE_LIMIT_CONVERSIONS_PER_HOUR", 10)

# How many chapters to synthesize at once. Synthesis is network-bound (waiting
# on the TTS service), so a few in parallel is a near-linear speedup. Keep it
# modest so free TTS endpoints (edge-tts) don't throttle; set to 1 to disable.
TTS_CONCURRENCY = max(1, _int("TTS_CONCURRENCY", 4))

SESSION_TTL_DAYS = _int("SESSION_TTL_DAYS", 90)


def user_audio_bytes(conn, user_id: str) -> int:
    """Total bytes of stored audio for a user (sum of documents.audio_bytes)."""
    row = conn.execute(
        "SELECT COALESCE(SUM(audio_bytes), 0) AS total FROM documents WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    # libSQL rows index by name via the adapter; fall back to positional.
    try:
        return int(row["total"] or 0)
    except (KeyError, TypeError):
        return int(row[0] or 0)
