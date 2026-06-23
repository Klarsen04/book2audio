from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import PlaybackPositionRequest

router = APIRouter(prefix="/api/playback", tags=["playback"])


@router.get("/{doc_id}/position")
async def get_position(doc_id: str, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT position FROM playback_positions WHERE user_id = ? AND document_id = ?",
            (user["id"], doc_id),
        ).fetchone()

    return {"position": row["position"] if row else 0}


@router.put("/{doc_id}/position")
async def save_position(doc_id: str, req: PlaybackPositionRequest, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        doc = conn.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?", (doc_id, user["id"])
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        conn.execute(
            """INSERT INTO playback_positions (user_id, document_id, position, updated_at)
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, document_id)
               DO UPDATE SET position = excluded.position, updated_at = datetime('now')""",
            (user["id"], doc_id, req.position),
        )

    return {"ok": True}
