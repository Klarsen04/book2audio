from fastapi import Request, HTTPException

from app.auth.jwt import verify_access_token
from app.database import get_db


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    with get_db() as conn:
        row = conn.execute("SELECT id, email, name, avatar_url FROM users WHERE id = ?", (user_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    return dict(row)
