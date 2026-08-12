"""
Tiny in-memory sliding-window rate limiter.

Keyed by client IP. Adequate for the single free-tier instance this app runs on
(state is per-process; if you scale to multiple instances, move this to Redis or
the DB). Fails open on any internal error — never blocks a legitimate user
because of a limiter bug.
"""

import time
import threading

from fastapi import Request, HTTPException

_WINDOW_SECONDS = 3600
_hits: dict[str, list[float]] = {}
_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    # Behind Render's proxy the real client is the first X-Forwarded-For hop.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request, bucket: str, max_per_hour: int) -> None:
    """Raise 429 if this IP has exceeded `max_per_hour` for `bucket`."""
    if max_per_hour <= 0:
        return
    try:
        key = f"{bucket}:{_client_ip(request)}"
        now = time.time()
        cutoff = now - _WINDOW_SECONDS
        with _lock:
            hits = [t for t in _hits.get(key, []) if t > cutoff]
            if len(hits) >= max_per_hour:
                retry_after = int(hits[0] + _WINDOW_SECONDS - now) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit reached ({max_per_hour}/hour). Try again in about {max(retry_after // 60, 1)} min.",
                    headers={"Retry-After": str(max(retry_after, 1))},
                )
            hits.append(now)
            _hits[key] = hits
    except HTTPException:
        raise
    except Exception:
        # Never block a real user due to a limiter fault.
        return
