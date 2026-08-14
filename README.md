# Book2Audio

Turn documents into **audiobooks**. Upload a PDF, EPUB, DOCX, TXT, a URL, or pasted text —
Book2Audio detects chapters, strips the junk, and reads it aloud in a natural voice. Listen
in-app, download a `.zip`, or subscribe to your library as a **private podcast feed**. No
accounts — an anonymous "restore key" is your identity.

- **Frontend** — Next.js 15 (App Router) on Vercel
- **Backend** — FastAPI (Python 3.11) on Render
- **Mobile** — Expo / React Native (same API)

## 📖 Documentation
- **[DOCUMENTATION.md](./DOCUMENTATION.md)** — architecture, every file explained, the
  complete environment-variable reference, service wiring, deployment, and API endpoints.
- **[DEPLOYMENT_PERSISTENCE.md](./DEPLOYMENT_PERSISTENCE.md)** — Turso (DB) + Backblaze B2
  (audio) setup for persistence.
- **[CLAUDE.md](./CLAUDE.md)** — quick build/run + repo conventions.
- **[PRODUCTION_TODO.md](./PRODUCTION_TODO.md)** — roadmap and hardening notes.

## Quick start
```bash
# Backend
cd backend && pip install -r requirements.txt
TTS_PROVIDER=edge FORCE_EDGE_TTS=true uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install
BACKEND_URL=http://localhost:8000 npm run dev

# Or the full stack
docker-compose up --build
```

See [DOCUMENTATION.md §9](./DOCUMENTATION.md) for deployment and the env vars each service needs.
