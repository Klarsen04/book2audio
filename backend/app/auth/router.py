import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, Request, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.database import get_db
from app.models import RegisterRequest, LoginRequest, UserResponse
from app.auth.password import hash_password, verify_password
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    hash_token,
    set_auth_cookies,
    clear_auth_cookies,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.auth.google import get_google_auth_url, exchange_code_for_user
from app.auth.dependencies import get_current_user
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


@router.post("/register")
async def register(req: RegisterRequest, response: Response):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, password_hash, name, auth_provider) VALUES (?, ?, ?, ?, ?)",
            (user_id, req.email, hash_password(req.password), req.name, "email"),
        )

        access_token = create_access_token(user_id)
        refresh_raw, refresh_hash = create_refresh_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
        conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, refresh_hash, expires_at),
        )

    set_auth_cookies(response, access_token, refresh_raw)
    return {"user": {"id": user_id, "email": req.email, "name": req.name}}


@router.post("/login")
async def login(req: LoginRequest, response: Response):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, name, password_hash FROM users WHERE email = ?", (req.email,)
        ).fetchone()

    if not row or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = row["id"]
    access_token = create_access_token(user_id)
    refresh_raw, refresh_hash = create_refresh_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()

    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, refresh_hash, expires_at),
        )

    set_auth_cookies(response, access_token, refresh_raw)
    return {"user": {"id": user_id, "email": row["email"], "name": row["name"]}}


@router.post("/logout")
async def logout(response: Response, request: Request):
    refresh = request.cookies.get("refresh_token")
    if refresh:
        with get_db() as conn:
            conn.execute("DELETE FROM refresh_tokens WHERE token_hash = ?", (hash_token(refresh),))
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


class SetCookiesRequest(BaseModel):
    access_token: str
    refresh_token: str


@router.post("/set-cookies")
async def set_cookies(req: SetCookiesRequest, response: Response):
    """Used by cross-domain OAuth flow to set cookies from URL params."""
    set_auth_cookies(response, req.access_token, req.refresh_token)
    return {"ok": True}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    refresh_raw = request.cookies.get("refresh_token")
    if not refresh_raw:
        raise HTTPException(status_code=401, detail="No refresh token")

    token_hash = hash_token(refresh_raw)
    with get_db() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?", (token_hash,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        with get_db() as conn:
            conn.execute("DELETE FROM refresh_tokens WHERE token_hash = ?", (token_hash,))
        raise HTTPException(status_code=401, detail="Refresh token expired")

    access_token = create_access_token(row["user_id"])
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=3600,
        path="/",
    )
    return {"ok": True}


# In-memory state store for OAuth CSRF protection (expires after 10 min)
_oauth_states: dict[str, float] = {}


@router.get("/google")
async def google_login():
    import time
    state = uuid.uuid4().hex
    _oauth_states[state] = time.time()
    # Clean up old states
    cutoff = time.time() - 600
    expired = [k for k, v in _oauth_states.items() if v < cutoff]
    for k in expired:
        del _oauth_states[k]
    url = get_google_auth_url(state)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str, state: str, request: Request):
    import time
    if state not in _oauth_states:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    del _oauth_states[state]

    user_info = await exchange_code_for_user(code)
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

    google_id = user_info["id"]
    email = user_info.get("email", "")
    name = user_info.get("name", "")
    avatar_url = user_info.get("picture", "")

    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE google_id = ?", (google_id,)).fetchone()
        if row:
            user_id = row["id"]
            conn.execute(
                "UPDATE users SET name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?",
                (name, avatar_url, user_id),
            )
        else:
            existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if existing:
                user_id = existing["id"]
                conn.execute(
                    "UPDATE users SET google_id = ?, avatar_url = ?, auth_provider = 'google', updated_at = datetime('now') WHERE id = ?",
                    (google_id, avatar_url, user_id),
                )
            else:
                user_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO users (id, email, name, avatar_url, auth_provider, google_id) VALUES (?, ?, ?, ?, ?, ?)",
                    (user_id, email, name, avatar_url, "google", google_id),
                )

        access_token = create_access_token(user_id)
        refresh_raw, refresh_hash = create_refresh_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
        conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, refresh_hash, expires_at),
        )

    # Pass tokens as URL params since cross-domain cookies are blocked by browsers
    import urllib.parse
    params = urllib.parse.urlencode({
        "access_token": access_token,
        "refresh_token": refresh_raw,
    })
    response = RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?{params}")
    return response
