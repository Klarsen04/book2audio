# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Book2Audio converts uploaded documents (PDF, EPUB, DOCX, TXT) into audiobooks with chapter-aware playback. It has three clients: a Next.js web frontend, a React Native (Expo) mobile app, and a FastAPI backend.

## Architecture

**Backend** (`backend/`) — Python 3.11, FastAPI + uvicorn. SQLite database (WAL mode). TTS via edge-tts or gTTS (selected by `TTS_PROVIDER` env var; defaults to `polly` which maps to AWS Polly, but the deployed config uses `edge`). Audio processing with pydub (requires ffmpeg). Conversions run in background threads with in-memory progress tracking.

**Frontend** (`frontend/`) — Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS. Uses route groups: `(app)` for authenticated pages (library, player, convert, settings), `(auth)` for login/register. API calls proxy through Next.js rewrites to the backend (`/api/:path*` → backend:8000). Auth uses HTTP-only cookies with JWT + refresh tokens.

**Mobile** (`mobile/`) — Expo 57, React Native 0.86, React Navigation. Talks to the same backend API.

## Development Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # dev server on :3000
npm run build        # production build
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

### Docker (full stack)
```bash
docker-compose up --build    # backend :8000, frontend :3000
```

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `TTS_PROVIDER` | `edge` or `polly` — selects TTS engine |
| `FORCE_EDGE_TTS` | Set `true` to use edge-tts instead of gTTS fallback |
| `JWT_SECRET` | Signs auth tokens |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `FRONTEND_URL` | Used by backend for OAuth redirects |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `DATABASE_PATH` | SQLite file location |
| `BACKEND_URL` | Used by frontend's Next.js rewrites (default: `http://backend:8000`) |

## Backend Module Structure

- `app/main.py` — FastAPI app, upload/convert/status/download endpoints
- `app/auth/` — JWT auth, Google OAuth, password hashing, route protection
- `app/parsers/extractor.py` — Document parsing (PDF, EPUB, DOCX, TXT) → `BookContent` with chapters
- `app/tts/` — TTS provider abstraction: `edge.py` (edge-tts + gTTS fallback), `polly.py` (AWS Polly)
- `app/library/router.py` — User's document library CRUD
- `app/playback/router.py` — Playback position sync
- `app/database.py` — SQLite connection management + schema init

## Deployment

- **Render** — configured via `render.yaml` (backend as Python web service with persistent disk)
- **Docker** — `docker-compose.yml` for self-hosting; backend requires ffmpeg
- **Vercel** — `frontend/vercel.json` exists for frontend-only deployment
