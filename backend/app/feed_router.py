"""
Private podcast RSS feed. Each session gets a random `feed_token`; pasting the
feed URL into a podcast app (Overcast, Apple Podcasts, Pocket Casts, …) lets the
user listen to their completed audiobooks there — background play, offline,
car integration, etc.

Podcast apps send no cookies, so the token in the URL *is* the auth:
  GET /api/feed/{token}.xml                      -> RSS listing
  GET /api/feed/{token}/audio/{doc_id}.mp3       -> 302 to a fresh audio URL

The audio endpoint mints a fresh (presigned/CDN) URL on each request, so the
enclosure links in a long-cached feed never go stale.
"""

import os
import secrets
from email.utils import formatdate
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, RedirectResponse, StreamingResponse

from app.database import get_db
from app.session import optional_session
from app import storage

router = APIRouter(tags=["feed"])


def _public_base(request: Request) -> str:
    """Absolute base URL for building feed + enclosure links. PUBLIC_API_URL
    wins (set it to the deployed backend URL); else derive from the request."""
    base = os.environ.get("PUBLIC_API_URL")
    if base:
        return base.rstrip("/")
    return str(request.base_url).rstrip("/")


def _ensure_feed_token(user_id: str) -> str:
    with get_db() as conn:
        row = conn.execute("SELECT feed_token FROM users WHERE id = ?", (user_id,)).fetchone()
        token = row["feed_token"] if row else None
        if not token:
            # Two concurrent mints must not clobber each other (the loser's URL
            # would 404 forever): only the first UPDATE lands, then re-read the
            # winning token.
            candidate = secrets.token_urlsafe(24)
            conn.execute(
                "UPDATE users SET feed_token = ? WHERE id = ? AND feed_token IS NULL",
                (candidate, user_id),
            )
            row = conn.execute(
                "SELECT feed_token FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            token = (row["feed_token"] if row else None) or candidate
    return token


@router.get("/api/session/feed")
async def get_feed_url(request: Request, user: dict = Depends(optional_session)):
    """Return this session's private podcast feed URL (minting the token if needed)."""
    if user["id"] == "anonymous":
        raise HTTPException(status_code=401, detail="No session yet — convert something first.")
    token = _ensure_feed_token(user["id"])
    return {"feed_url": f"{_public_base(request)}/api/feed/{token}.xml"}


def _fmt_duration(seconds) -> str:
    s = int(seconds or 0)
    return f"{s // 3600:d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


@router.get("/api/feed/{token}.xml")
async def podcast_feed(token: str, request: Request):
    with get_db() as conn:
        u = conn.execute("SELECT id FROM users WHERE feed_token = ?", (token,)).fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="Feed not found")
        docs = conn.execute(
            "SELECT id, title, audio_duration, audio_bytes, converted_at "
            "FROM documents WHERE user_id = ? AND status = 'completed' "
            "ORDER BY converted_at DESC",
            (u["id"],),
        ).fetchall()

    base = _public_base(request)
    self_url = f"{base}/api/feed/{token}.xml"
    items = []
    for d in docs:
        audio_url = f"{base}/api/feed/{token}/audio/{d['id']}.mp3"
        try:
            pub = formatdate(
                datetime.strptime(d["converted_at"], "%Y-%m-%d %H:%M:%S")
                .replace(tzinfo=timezone.utc).timestamp()
            )
        except (TypeError, ValueError):
            pub = formatdate()
        items.append(
            f"""    <item>
      <title>{escape(d['title'] or 'Audiobook')}</title>
      <guid isPermaLink="false">{d['id']}</guid>
      <pubDate>{pub}</pubDate>
      <enclosure url="{escape(audio_url)}" length="{int(d['audio_bytes'] or 0)}" type="audio/mpeg"/>
      <itunes:duration>{_fmt_duration(d['audio_duration'])}</itunes:duration>
    </item>"""
        )

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>My Book2Audio Library</title>
    <link>{escape(base)}</link>
    <description>Your converted audiobooks, as a private podcast feed.</description>
    <language>en</language>
    <itunes:author>Book2Audio</itunes:author>
    <atom:link href="{escape(self_url)}" rel="self" type="application/rss+xml"/>
{chr(10).join(items)}
  </channel>
</rss>"""
    return Response(content=rss, media_type="application/rss+xml")


@router.get("/api/feed/{token}/audio/{doc_id}.mp3")
async def feed_audio(token: str, doc_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT d.id FROM documents d JOIN users u ON u.id = d.user_id "
            "WHERE u.feed_token = ? AND d.id = ? AND d.status = 'completed'",
            (token, doc_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Episode not found")
    if not storage.exists(doc_id):
        raise HTTPException(status_code=404, detail="Audio not found")

    # Redirect to a public CDN URL or a fresh presigned URL; stream as a fallback.
    url = storage.public_url(doc_id) or storage.presigned_url(doc_id)
    if url:
        return RedirectResponse(url, status_code=302)

    def iter_audio():
        with storage.open_stream(doc_id) as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    return StreamingResponse(iter_audio(), media_type="audio/mpeg")
