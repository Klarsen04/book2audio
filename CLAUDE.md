# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 📖 **Full architecture, per-file explanations, the complete env-var reference, and
> service wiring live in [`DOCUMENTATION.md`](./DOCUMENTATION.md).** Also see
> [`DEPLOYMENT_PERSISTENCE.md`](./DEPLOYMENT_PERSISTENCE.md) (Turso + B2 setup) and
> [`PRODUCTION_TODO.md`](./PRODUCTION_TODO.md) (roadmap).

## Project Overview

Book2Audio converts uploaded documents (PDF, EPUB, DOCX, TXT) into audiobooks with chapter-aware playback. It has three clients: a Next.js web frontend, a React Native (Expo) mobile app, and a FastAPI backend.

## Architecture

**Backend** (`backend/`) — Python 3.11, FastAPI + uvicorn. SQLite database (WAL mode). TTS via edge-tts or gTTS (selected by `TTS_PROVIDER` env var; defaults to `polly` which maps to AWS Polly, but the deployed config uses `edge`). Audio processing with pydub (requires ffmpeg). Conversions run in background threads with in-memory progress tracking.

**Frontend** (`frontend/`) — Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS. Route group `(app)` holds the product pages (library, player, convert, settings). API calls proxy through Next.js rewrites to the backend (`/api/:path*` → backend:8000). **No login** — the app uses anonymous "restore key" sessions (see below); there is no `(auth)` route group.

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
| `JWT_SECRET` | Signs the session cookie (keep stable across deploys) |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `DATABASE_PATH` | Local SQLite file location |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Optional: persistent libSQL DB (see `DEPLOYMENT_PERSISTENCE.md`) |
| `AUDIO_BUCKET` / `AUDIO_S3_*` | Optional: store audio in B2/R2 instead of local disk |
| `BACKEND_URL` | Used by frontend's Next.js rewrites (default: `http://backend:8000`) |

## Sessions (no login)

No accounts. On the first upload the backend mints a **restore key** (a `users`
row keyed by `restore_key_hash`); the key is the identity. `app/session.py` has
two dependencies: `get_session` (mints a guest on write endpoints — upload,
convert) and `optional_session` (read-only endpoints — never mints). The one-time
key is returned via the `X-Restore-Key` response header and captured by
`SessionContext` on the frontend. Persistence for the key to survive redeploys is
documented in `DEPLOYMENT_PERSISTENCE.md`.

## Backend Module Structure

- `app/main.py` — FastAPI app, upload/convert/status/download/export endpoints
- `app/session.py` — anonymous restore-key sessions (`get_session`, `optional_session`)
- `app/session_router.py` — `/api/session`, `/api/session/restore`, `/api/session/signout`
- `app/storage.py` — audio blob layer: local files, or B2/R2 via S3 API when configured
- `app/parsers/extractor.py` — Document parsing (PDF, EPUB, DOCX, TXT) → `BookContent` with chapters
- `app/tts/` — TTS provider abstraction: `edge.py` (edge-tts + gTTS fallback), `polly.py` (AWS Polly)
- `app/library/router.py` — User's document library CRUD
- `app/playback/router.py` — Playback position sync
- `app/database.py` — SQLite connection management + schema init

## Deployment

- **Render** — configured via `render.yaml` (backend as Python web service with persistent disk)
- **Docker** — `docker-compose.yml` for self-hosting; backend requires ffmpeg
- **Vercel** — `frontend/vercel.json` exists for frontend-only deployment
