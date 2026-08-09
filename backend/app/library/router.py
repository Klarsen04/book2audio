import json

from fastapi import APIRouter, Depends, HTTPException

from app.session import optional_session
from app import storage
from app.database import get_db

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("")
async def list_documents(user: dict = Depends(optional_session)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, filename, title, format, chapters_json, total_word_count, status, voice, audio_duration, created_at, converted_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()

    documents = []
    for row in rows:
        doc = dict(row)
        chapters = json.loads(doc.pop("chapters_json"))
        doc["chapters"] = [{"title": ch["title"], "word_count": ch.get("word_count", 0)} for ch in chapters]
        documents.append(doc)

    return {"documents": documents}


@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(optional_session)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, filename, title, format, chapters_json, total_word_count, status, voice, audio_duration, created_at, converted_at FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = dict(row)
    doc["chapters"] = json.loads(doc.pop("chapters_json"))
    return {"document": doc}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(optional_session)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user["id"]),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))

    # Remove the audio blob (local file or cloud object).
    storage.delete_audio(doc_id)

    return {"ok": True}
