"""Session endpoints: inspect the current session, restore by key, sign out."""

from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.session import (
    get_session,
    hash_key,
    normalize_key,
    create_session_token,
    set_session_cookie,
    clear_session_cookie,
    verify_session_token,
    SESSION_COOKIE,
)

router = APIRouter(prefix="/api/session", tags=["session"])


@router.get("")
async def current_session(request: Request):
    """
    Report the current session WITHOUT minting a new one. Returns whether the
    visitor already has a library (so the homepage can decide where to send them).
    The restore key itself is never returned here — it's only shown once, at
    creation time, via the X-Restore-Key header.
    """
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return {"active": False}
    user_id = verify_session_token(token)
    if not user_id:
        return {"active": False}
    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return {"active": False}
        count = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE user_id = ?", (user_id,)
        ).fetchone()["n"]
    return {"active": True, "document_count": count}


class RestoreRequest(BaseModel):
    key: str


@router.post("/restore")
async def restore_session(req: RestoreRequest, response: Response):
    """Paste a restore key to re-attach to that library on this device."""
    key = normalize_key(req.key)
    if not key:
        raise HTTPException(status_code=400, detail="Enter your restore key")
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE restore_key_hash = ?", (hash_key(key),)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="That key doesn't match any saved library")

    token = create_session_token(row["id"])
    set_session_cookie(response, token)
    # Also return the token so native mobile (no cookie jar) can store it.
    return {"ok": True, "session_token": token}


@router.post("/signout")
async def signout(response: Response):
    """Detach this device from the session. The library is untouched and can be
    restored again with the key."""
    clear_session_cookie(response)
    return {"ok": True}
