"""
Anonymous, no-login sessions backed by a "restore key".

There are no accounts. The first time a visitor does something that needs to be
saved (upload/convert), we mint a guest user row and hand them a restore key.
That key IS their identity — pasting it later re-attaches them to the same
library (documents + playback positions), which is how a user "comes back" to a
session even though the free-tier disk is wiped on redeploy (the real data lives
in the external DB + object storage once configured).
"""

import os
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Request, Response, HTTPException

from app.database import get_db

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
ALGORITHM = "HS256"
SESSION_COOKIE = "session"
# Long-lived: the cookie is just a convenience; the restore key is the durable identity.
SESSION_EXPIRE_DAYS = 365

# Unambiguous alphabet — no 0/O/1/I/L so keys are easy to read aloud / retype.
_KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_KEY_GROUPS = 3
_KEY_GROUP_LEN = 4


def generate_restore_key() -> str:
    """e.g. 'PAGE-7F3K-9Q2M-XR4T'. The 'PAGE' prefix is branding, not entropy."""
    groups = [
        "".join(secrets.choice(_KEY_ALPHABET) for _ in range(_KEY_GROUP_LEN))
        for _ in range(_KEY_GROUPS)
    ]
    return "PAGE-" + "-".join(groups)


def normalize_key(key: str) -> str:
    return key.strip().upper().replace(" ", "")


def hash_key(key: str) -> str:
    return hashlib.sha256(normalize_key(key).encode()).hexdigest()


def create_session_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def verify_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def _create_guest_user() -> tuple[str, str]:
    """Create a guest user with a fresh restore key. Returns (user_id, restore_key)."""
    user_id = str(uuid.uuid4())
    # `email` is UNIQUE (and NOT NULL on pre-existing databases created by the old
    # account system). Guests have no email, so store a unique non-null placeholder
    # to satisfy both old and new schemas without a destructive migration.
    placeholder_email = f"guest:{user_id}"
    # Retry on the (astronomically unlikely) key collision.
    for _ in range(5):
        key = generate_restore_key()
        key_hash = hash_key(key)
        try:
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO users (id, email, auth_provider, restore_key_hash, last_active_at) "
                    "VALUES (?, ?, 'guest', ?, datetime('now'))",
                    (user_id, placeholder_email, key_hash),
                )
            return user_id, key
        except Exception:
            continue
    raise HTTPException(status_code=500, detail="Could not create session")


def _token_from_request(request: Request) -> str | None:
    """
    Session token from the cookie (web) OR an `Authorization: Bearer <token>`
    header (native mobile, where cookies aren't reliably persisted).
    """
    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie:
        return cookie
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def _touch_last_active(conn, user_id: str, last_active_at) -> None:
    """Bump the session's activity timestamp, throttled to ~once/day to avoid a
    DB write on every request (matters on a remote/metered DB like Turso)."""
    stale = True
    if last_active_at:
        try:
            last = datetime.strptime(str(last_active_at), "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=timezone.utc
            )
            stale = (datetime.now(timezone.utc) - last) > timedelta(days=1)
        except ValueError:
            stale = True
    if stale:
        conn.execute(
            "UPDATE users SET last_active_at = datetime('now') WHERE id = ?", (user_id,)
        )


def _resolve_existing(request: Request) -> dict | None:
    """Return the user for a valid session token, else None. Never mints."""
    token = _token_from_request(request)
    if not token:
        return None
    user_id = verify_session_token(token)
    if not user_id:
        return None
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name, last_active_at FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row:
            return None
        _touch_last_active(conn, row["id"], row["last_active_at"])
    request.state.session_user_id = row["id"]
    return {"id": row["id"], "name": row["name"]}


def get_session(request: Request) -> dict:
    """
    Dependency for endpoints that CREATE data (upload, convert). Resolves the
    existing session or mints a guest identity on the fly so the first action
    just works. The new cookie/key is surfaced via request.state for the
    middleware to attach (Set-Cookie + X-Restore-Key).

    IMPORTANT: only use this on write/create endpoints. Read-only endpoints must
    use `optional_session` so merely *viewing* an empty library never creates a
    throwaway guest (which would race the real session cookie).
    """
    existing = _resolve_existing(request)
    if existing:
        return existing

    user_id, restore_key = _create_guest_user()
    request.state.new_session_user_id = user_id
    request.state.new_session_token = create_session_token(user_id)
    request.state.new_restore_key = restore_key
    request.state.session_user_id = user_id
    return {"id": user_id, "name": None}


# Sentinel id that can never match a real (UUID) user, so ownership-scoped
# queries return empty for an anonymous read.
_ANON_ID = "anonymous"


def optional_session(request: Request) -> dict:
    """
    Dependency for READ-ONLY endpoints. Returns the existing user if there is a
    valid session, else an anonymous stub that owns nothing — WITHOUT minting.
    """
    existing = _resolve_existing(request)
    if existing:
        return existing
    return {"id": _ANON_ID, "name": None}


def cleanup_abandoned_sessions() -> int:
    """
    Delete sessions with no activity for longer than SESSION_TTL_DAYS, along with
    their documents, playback positions, and audio blobs, to reclaim storage.
    Returns the number of sessions removed. No-op if SESSION_TTL_DAYS <= 0.

    Deletes are explicit (not relying on FK cascade) and remove object-storage
    blobs, which a DB cascade never touches.
    """
    from app.limits import SESSION_TTL_DAYS

    if SESSION_TTL_DAYS <= 0:
        return 0

    from app import storage

    removed = 0
    with get_db() as conn:
        stale = conn.execute(
            "SELECT id FROM users WHERE last_active_at IS NOT NULL "
            "AND last_active_at < datetime('now', ?)",
            (f"-{SESSION_TTL_DAYS} days",),
        ).fetchall()

        for u in stale:
            uid = u["id"]
            doc_ids = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM documents WHERE user_id = ?", (uid,)
                ).fetchall()
            ]
            for did in doc_ids:
                try:
                    storage.delete_audio(did)
                except Exception:
                    pass
            conn.execute("DELETE FROM playback_positions WHERE user_id = ?", (uid,))
            conn.execute("DELETE FROM documents WHERE user_id = ?", (uid,))
            conn.execute("DELETE FROM users WHERE id = ?", (uid,))
            removed += 1

    return removed
