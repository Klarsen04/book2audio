# Book2Audio — Architecture & Setup

The single source of truth for how Book2Audio is built, what every file does, every
environment variable, and how to wire up each service. For a quick build/run, see
`CLAUDE.md`; for the storage-persistence walkthrough, see `DEPLOYMENT_PERSISTENCE.md`;
for the roadmap, see `PRODUCTION_TODO.md`.

---

## 1. What it is

Book2Audio turns documents (PDF, EPUB, DOCX, TXT, a URL, or pasted text) into
chapter-aware audiobooks you can listen to in-app, download as a `.zip`, or
subscribe to as a **private podcast feed**. There are **no accounts** — an
anonymous "restore key" is the identity.

Three clients, one API:
- **Frontend** — Next.js 15 (App Router) on **Vercel**.
- **Backend** — FastAPI (Python 3.11) on **Render**.
- **Mobile** — Expo/React Native (talks to the same API; not the focus here).

```
Browser / PWA ──HTTPS──▶ Vercel (Next.js)
                              │  /api/* rewrite (vercel.json → Render)
                              ▼
                         Render (FastAPI)
        ┌─────────────────────┼───────────────────────┐
        ▼                     ▼                         ▼
   Turso (libSQL)        Backblaze B2            edge-tts / OpenAI
   metadata DB           audio blobs             (speech synthesis)
        ▲                     ▲
        └── restore-key ──────┘  (podcast apps fetch /api/feed/… directly)
```

---

## 2. Repository layout

```
backend/                 FastAPI service
  app/
    main.py              app, endpoints, conversion pipeline, queue, startup
    database.py          SQLite / Turso(libSQL) connection + schema/migrations
    session.py           no-login restore-key sessions + cleanup
    session_router.py    /api/session, /restore, /signout
    feed_router.py       private podcast RSS feed
    storage.py           audio blob layer (local / B2 / R2 / CDN)
    audio_utils.py       ffmpeg concat + ffprobe duration
    summarizer.py        LLM (Gemini→OpenRouter) + extractive summaries
    limits.py            env-configurable limits + quota helper
    ratelimit.py         in-memory per-IP rate limiter
    models.py            a couple of Pydantic response models
    parsers/extractor.py document → chapters (+ OCR fallback)
    tts/                 provider.py (factory), edge.py, openai_tts.py, polly.py
    library/router.py    /api/library CRUD + clear-all
    playback/router.py   /api/playback position sync
  requirements.txt       Python deps
  Dockerfile             python:3.11-slim + ffmpeg
  runtime.txt            python-3.11.9 (Render native runtime pin)
frontend/                Next.js app
  src/app/               routes (see §5)
  src/components/         UI components
  src/contexts/SessionContext.tsx  no-login session state
  src/lib/api.ts          axios client (captures session headers)
  next.config.js          /api/* → BACKEND_URL rewrite
  vercel.json             /api/* → Render rewrite (production)
render.yaml              Render blueprint (env var declarations)
docker-compose.yml       self-host (backend + frontend)
```

---

## 3. Backend — every module

### `app/main.py`
The FastAPI app and the heart of the system.
- **Endpoints:** `POST /api/upload` (file), `POST /api/upload-url`, `POST /api/upload-text`,
  `POST /api/convert/{doc_id}`, `GET /api/status/{doc_id}`, `GET /api/download/{doc_id}`,
  `GET /api/export`, `GET /api/voices`, `GET /api/voices/preview/{voice_id}`, `GET /api/health`.
- **Sentry init** (top of file, if `SENTRY_DSN`) + `_capture_exception()`.
- **CORS** (from `ALLOWED_ORIGINS`) and the **session-attach middleware** that sets the
  session cookie + `X-Restore-Key` / `X-Session-Token` headers when a guest is minted.
- **Conversion pipeline** `_run_conversion()`: synthesizes each chapter (parallel, bounded
  by `TTS_CONCURRENCY`) to a temp file, concatenates with ffmpeg, uploads via `storage`,
  writes `audio_bytes` + per-chapter `start_time` back to the DB. Skips empty chapters;
  raises a clear error if nothing synthesizes.
- **Per-session queue:** `_enqueue_conversion()` / `_session_worker()` — one conversion at a
  time *within* a session, parallel *across* sessions, globally capped by a semaphore
  (`MAX_CONCURRENT_CONVERSIONS`). `_queue_counts()` / `_jobs_ahead_of()` power the UI.
- **Auto-split** `_split_chapters_into_parts()`: books over `MAX_CONVERT_WORDS` become
  sibling documents ("… — Part k of n"), each queued separately.
- **Paste-URL** helpers: `_url_is_public()` (SSRF guard), browser headers, `_firecrawl_scrape()`
  fallback for JS/bot-protected pages, `_content_from_markdown()`.
- **Startup:** `init_db()`, reset any doc stuck `converting`/`queued` (lost to a restart) →
  `error`, start the daily cleanup thread (which also pings `HEALTHCHECK_URL`).

### `app/database.py`
Connection management for **SQLite** (local dev) or **Turso/libSQL** (production, when
`TURSO_DATABASE_URL` is set).
- `_LibsqlConnection`/`_LibsqlCursor`/`_LibsqlRow`: a shim that makes the libSQL client
  behave like `sqlite3` (row-by-name access, `dict(row)`), and **heals Turso "stream not
  found" errors** by transparently re-opening the connection once.
- `get_db()`: context manager (commit/rollback/close).
- `init_db()`: creates tables and runs **idempotent migrations** — adds `users.restore_key_hash`,
  `users.last_active_at`, `users.feed_token`, `documents.audio_bytes`,
  `documents.part_group` / `part_index`.

### `app/session.py`
The no-login model. The **restore key** (`PAGE-XXXX-XXXX-XXXX`) is the identity; only its
SHA-256 hash is stored (`users.restore_key_hash`).
- `get_session` — dependency for **write** endpoints; mints a guest if needed (surfaced via
  `request.state` for the middleware to persist).
- `optional_session` — dependency for **read** endpoints; never mints (returns an anonymous
  stub owning nothing).
- Token via cookie **or** `Authorization: Bearer` (mobile has no cookie jar).
- `_touch_last_active()` bumps activity (throttled to ~1/day).
- `cleanup_abandoned_sessions()` — deletes sessions idle > `SESSION_TTL_DAYS` and their audio
  blobs (run daily from `main._cleanup_loop`).

### `app/session_router.py`
`GET /api/session` (is there a library? how many docs), `POST /api/session/restore` (paste a
key), `POST /api/session/signout` (detach this device — library untouched).

### `app/feed_router.py`
Private podcast feed. Each session gets a random `users.feed_token`.
- `GET /api/session/feed` → the feed URL for the current session (mints the token).
- `GET /api/feed/{token}.xml` → RSS 2.0 of completed audiobooks (token = auth, since podcast
  apps send no cookies).
- `GET /api/feed/{token}/audio/{doc_id}.mp3` → 302 to a fresh audio URL each request (so a
  cached feed never goes stale). Uses `PUBLIC_API_URL` for absolute links.

### `app/storage.py`
Storage-agnostic audio blob layer.
- **Local** files (`./output`, or `AUDIO_OUTPUT_DIR`, or `/app/output` in Docker) by default.
- **B2 / R2** via the S3 API (boto3) when `AUDIO_BUCKET` + `AUDIO_S3_*` are set.
- `save_audio`, `exists`, `open_stream`, `read_bytes`, `delete_audio`, `local_path`.
- `presigned_url()` — short-lived (24h) direct URL for streaming/seek off the backend.
- `public_url()` — a Cloudflare-CDN URL when `AUDIO_PUBLIC_BASE_URL` is set ($0 egress).
- `_safe_doc_id()` validates the id is a UUID (guards path/key building).

### `app/audio_utils.py`
- `mp3_duration()` — duration via `ffprobe` (no full decode).
- `concat_mp3()` — joins chapter MP3s with ffmpeg's concat demuxer (stream **copy**, low
  memory; re-encode fallback), dropping any missing/0-byte inputs.

### `app/summarizer.py`
- **LLM path:** `_gemini_generate()` → `_openrouter_generate()` (shared `_summary_prompt`),
  used by `summarize_long/short/intro`.
- **Fallback:** an offline **extractive** summarizer (`_summarize`) always works when no LLM
  key is set or the provider errors/rate-limits.

### `app/limits.py`
Env-configurable guardrails: `MAX_UPLOAD_MB`, `USER_QUOTA_MB`, `RATE_LIMIT_*_PER_HOUR`,
`TTS_CONCURRENCY`, `MAX_CONVERT_WORDS`, `MAX_CONCURRENT_CONVERSIONS`, `SESSION_TTL_DAYS`,
plus `user_audio_bytes()` (per-session stored bytes for the quota).

### `app/ratelimit.py`
`check_rate_limit()` — in-memory sliding-window limiter keyed by client IP (fails open on
error). Single-instance only.

### `app/parsers/extractor.py`
Document → `BookContent(title, chapters=[Chapter(title,text)], word_count)`:
- **PDF** (pdfplumber): strips running headers/footers + page numbers, uses the PDF outline
  for chapter breaks; `_ocr_space_pdf()` OCR fallback (OCR.Space) when a scanned PDF yields
  no text.
- **EPUB** (zip/OPF spine), **DOCX** (python-docx), **TXT** (chapter-pattern split).
- `extract_text()` dispatches by extension and names untitled `.txt` by filename.

### `app/tts/`
- `provider.py` — `get_synthesize_fn()` / `get_voices_fn()` select the engine by `TTS_PROVIDER`.
- `edge.py` — **edge-tts** (Microsoft neural voices) with **gTTS** fallback; 19 named voices
  (US/UK/AU/CA/IE/IN); per-chunk retry + exponential backoff + `EDGE_CHUNK_TIMEOUT`; streams
  chunks to disk. `USE_EDGE` gated on `FORCE_EDGE_TTS`.
- `openai_tts.py` — optional paid OpenAI TTS (`TTS_PROVIDER=openai`).
- `polly.py` — optional AWS Polly.

### `app/library/router.py`
`GET /api/library` (list, parts ordered), `GET /api/library/{id}`, `DELETE /api/library/{id}`
(also deletes the audio blob), `DELETE /api/library` (clear all — the "export then start
fresh" flow).

### `app/playback/router.py`
`GET/PUT /api/playback/{doc_id}/position` — resume position sync.

### `app/models.py`
`DocumentResponse` / `PlaybackPositionRequest` Pydantic models.

---

## 4. Data model (DB)

- **users**: `id`, `email` (placeholder `guest:<uuid>` for guests), `restore_key_hash`
  (UNIQUE), `last_active_at`, `feed_token` (UNIQUE), timestamps.
- **documents**: `id`, `user_id`, `filename`, `title`, `format`, `chapters_json`
  (title/word_count/text/start_time per chapter), `total_word_count`, `status`
  (`uploaded`/`queued`/`converting`/`completed`/`error`), `voice`, `audio_path`,
  `audio_duration`, `audio_bytes`, `part_group`, `part_index`, timestamps.
- **playback_positions**: `(user_id, document_id)` → `position`.

Same schema on SQLite and Turso; `init_db()` migrations are idempotent.

---

## 5. Frontend

**Routes** (`src/app/`):
- `page.tsx` — editorial marketing homepage (GSAP/Lenis motion).
- `(app)/library/page.tsx` — the library (grid, filters, collections, export, queue count).
- `(app)/convert/page.tsx` — upload → `ConversionPanel`; also opens a converting doc's progress.
- `(app)/player/[docId]/page.tsx` — the player page (audio + reader/notes/flashcards, chapter
  nav, multi-part navigator, up-next).
- `(app)/settings/page.tsx` — preferences, "Your data" (30-day retention), "Listen in a
  podcast app" (feed URL).
- `layout.tsx` — root layout: fonts, metadata/OG cards, Umami analytics (env-gated),
  `SessionProvider`.

**Key components** (`src/components/`):
- `FileUpload.tsx` — upload / paste-URL / paste-text tabs.
- `ConversionPanel.tsx` — voice + audio-type + intro selection, conversion progress, queue
  position, quota "export & clear" flow, split notice.
- `AudioPlayer.tsx` — native `<audio>` streaming (range/seek), speed, volume, A-B loop,
  bookmarks/sleep hooks, position save, download.
- `ReaderView.tsx` — synced reader with cross-chapter search; `LibraryCard.tsx` — a library
  tile; `NavBar.tsx` — nav + restore-key + sign-out confirm; `SaveKeyBanner.tsx` /
  `RestoreDialog.tsx` — key capture/restore; `Bookmarks/Highlights/NotesPanel/Flashcards/
  StudyTimer/SleepTimer/PlaybackSpeed/NowPlaying` — player features; `home/*`, `motion/*`,
  and various visual helpers.

**State/lib:**
- `contexts/SessionContext.tsx` — captures `X-Restore-Key`/`X-Session-Token` from responses,
  stores the key locally, exposes `restore()` / `signOut()` / `keySaved`.
- `lib/api.ts` — axios instance + a response interceptor that captures the session headers.

---

## 6. Conversion pipeline (end to end)

1. **Upload** (`/api/upload*`) → rate-limited, size-capped → `extractor` → `BookContent` →
   a `documents` row (`uploaded`) + parsed content cached in memory (`conversion_progress`).
2. **Convert** (`/api/convert/{id}`) → rate-limited, quota-checked → optional summarize/intro →
   if over `MAX_CONVERT_WORDS`, **split** into part documents → **enqueue** on the session's
   queue (status `queued`).
3. **Worker** (`_session_worker`, bounded by the global semaphore) runs `_run_conversion`:
   synthesize chapters in parallel → ffmpeg concat → `storage.save_audio` → DB `completed`
   with `audio_bytes` + chapter `start_time`s.
4. **Play/Download** (`/api/download/{id}`): on cloud storage → 302 to a **CDN** URL
   (if `AUDIO_PUBLIC_BASE_URL`) or a **presigned** URL; `?download=1` serves an attachment.
5. **Listen anywhere:** the same completed audio is exposed via the **podcast feed**.

Progress lives only in memory; a restart resets stuck jobs to `error` (retry to recover).

---

## 7. Environment variables

`R` = required for that feature, `O` = optional.

### Backend (Render service)

| Var | Req | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | R | dev value | Signs the session cookie/token. **Keep stable across deploys** (Render `generateValue` is fine). |
| `ALLOWED_ORIGINS` | R | `http://localhost:3000` | CORS — comma-separated frontend origin(s). |
| `TTS_PROVIDER` | R | `polly` | `edge` (used in prod), `openai`, or `polly`. |
| `FORCE_EDGE_TTS` | R (prod) | unset | `true` → use edge-tts neural voices for conversions (else gTTS). |
| `PUBLIC_API_URL` | R (feed) | request URL | Absolute base for podcast feed/episode URLs. Set to the backend URL. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | O | local SQLite | Persistent hosted DB. Both required together. |
| `DATABASE_PATH` | O | `./data/book2audio.db` | Local SQLite path (when no Turso). |
| `AUDIO_BUCKET` | O | local disk | Enables cloud audio storage. |
| `AUDIO_S3_ENDPOINT` | O | — | S3 endpoint (B2: `https://s3.<region>.backblazeb2.com`; R2: `https://<acct>.r2.cloudflarestorage.com`). |
| `AUDIO_S3_KEY_ID` / `AUDIO_S3_SECRET_KEY` | O | — | Bucket credentials. |
| `AUDIO_S3_REGION` | O | `auto` | Bucket region. |
| `AUDIO_PUBLIC_BASE_URL` | O | unset | Cloudflare CDN base in front of the bucket → $0 egress; playback redirects here. |
| `AUDIO_OUTPUT_DIR` | O | `./output` | Local audio dir override. |
| `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`) | O | unset | LLM summaries (Google AI Studio). |
| `GEMINI_MODEL` | O | `gemini-2.0-flash` | Gemini model. |
| `OPENROUTER_API_KEY` | O | unset | Second LLM summarizer (tried after Gemini). |
| `OPENROUTER_MODEL` | O | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter model. |
| `OCR_SPACE_API_KEY` | O | unset | OCR for scanned PDFs (OCR.Space). |
| `FIRECRAWL_API_KEY` | O | unset | Paste-URL fallback for JS/bot-protected pages. |
| `SENTRY_DSN` | O | unset | Error monitoring. |
| `HEALTHCHECK_URL` | O | unset | Dead-man's-switch ping after the daily cleanup. |
| `MAX_CONVERT_WORDS` | O | `20000` | Split books larger than this into parts. |
| `MAX_CONCURRENT_CONVERSIONS` | O | `2` | Global parallel-conversion cap (1 = strict serial). |
| `TTS_CONCURRENCY` | O | `4` | Chapters synthesized in parallel per conversion. |
| `EDGE_CHUNK_TIMEOUT` | O | `90` | Per-chunk edge-tts timeout (seconds). |
| `MAX_UPLOAD_MB` | O | `25` | Upload size cap. |
| `USER_QUOTA_MB` | O | `500` | Per-session stored-audio cap. |
| `RATE_LIMIT_UPLOADS_PER_HOUR` | O | `30` | Per-IP upload cap. |
| `RATE_LIMIT_CONVERSIONS_PER_HOUR` | O | `10` | Per-IP conversion cap. |
| `SESSION_TTL_DAYS` | O | `30` | Delete sessions + audio after this many idle days (0 = off). |
| `OPENAI_API_KEY` / `OPENAI_TTS_MODEL` | O | — | Only if `TTS_PROVIDER=openai`. |

*Legacy/unused (safe to remove): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`.*

### Frontend (Vercel project)

| Var | Req | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | O | Absolute base for OG social-card images. Set to the live site URL. |
| `NEXT_PUBLIC_UMAMI_ID` | O | Umami analytics **website ID** (bare UUID, not the `<script>` tag). |
| `NEXT_PUBLIC_UMAMI_SRC` | O | Umami script URL (only if self-hosting; default is Umami Cloud). |
| `BACKEND_URL` | O | Next.js `/api/*` rewrite target (Docker/self-host; on Vercel `vercel.json` handles it). |

> `NEXT_PUBLIC_*` are compiled in at **build time** — set them in Vercel and **redeploy**.

---

## 8. Wiring each service

- **Turso (DB):** `turso db create book2audio` → set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
  Schema auto-creates on boot. (See `DEPLOYMENT_PERSISTENCE.md`.)
- **Backblaze B2 (audio):** create a **private** bucket + an R/W app key → set `AUDIO_BUCKET`,
  `AUDIO_S3_ENDPOINT` (`https://s3.<region>.backblazeb2.com`), `AUDIO_S3_KEY_ID`,
  `AUDIO_S3_SECRET_KEY`, `AUDIO_S3_REGION`.
- **Cloudflare CDN (optional, $0 egress):** put a Cloudflare custom domain in front of the
  bucket → set `AUDIO_PUBLIC_BASE_URL` so `…/audio/<id>.mp3` resolves. Playback then streams
  via the CDN; downloads still use presigned URLs.
- **edge-tts voices:** `TTS_PROVIDER=edge` + `FORCE_EDGE_TTS=true`. (gTTS is the automatic
  fallback; no key needed.)
- **Gemini summaries:** aistudio.google.com → `GEMINI_API_KEY`.
- **OpenRouter summaries:** openrouter.ai → key → `OPENROUTER_API_KEY` (falls back to Gemini,
  then extractive).
- **OCR.Space:** ocr.space/ocrapi → free key → `OCR_SPACE_API_KEY`.
- **Firecrawl:** firecrawl.dev → `fc-…` key → `FIRECRAWL_API_KEY`.
- **Sentry:** sentry.io (platform: FastAPI) → DSN → `SENTRY_DSN`.
- **Keep-alive (no cold starts):** cron-job.org / UptimeRobot → GET `…/api/health` every
  ~10 min.
- **healthchecks.io:** create a check → its ping URL → `HEALTHCHECK_URL`.
- **Umami analytics:** cloud.umami.is → website ID → `NEXT_PUBLIC_UMAMI_ID` **on Vercel** →
  redeploy frontend.
- **Podcast feed:** just set `PUBLIC_API_URL` on the backend; users get their URL in Settings.

---

## 9. Deployment

**Backend — Render** (Docker via `backend/Dockerfile`, pinned `python:3.11-slim`; `render.yaml`
declares env vars). Merging to `main` auto-deploys. Health at `/api/health` (returns
`use_edge` + live queue counts). `main` is protection-gated → changes go via PR.

**Frontend — Vercel** (Next.js). `vercel.json` rewrites `/api/*` to the Render backend, so no
`BACKEND_URL` needed there. Merging to `main` auto-deploys; `NEXT_PUBLIC_*` require a rebuild.

**Local dev:**
```bash
# backend
cd backend && pip install -r requirements.txt
TTS_PROVIDER=edge FORCE_EDGE_TTS=true uvicorn app.main:app --reload --port 8000
# frontend
cd frontend && npm install
BACKEND_URL=http://localhost:8000 npm run dev
```
**Docker (both):** `docker-compose up --build` (backend requires ffmpeg — included in the image).

**Constraints to know:** free-tier ~512 MB RAM / ~0.1 CPU; conversions are network-bound
(edge-tts); in-memory queue/progress is lost on restart; production synthesizes with edge-tts
(or gTTS if edge is unreachable).

---

## 10. Endpoint reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/upload` | write | Upload a file |
| POST | `/api/upload-url` | write | Fetch + parse a URL (Firecrawl fallback) |
| POST | `/api/upload-text` | write | Pasted text |
| POST | `/api/convert/{id}` | write | Start conversion (splits + queues) |
| GET | `/api/status/{id}` | read | Progress + `queue_ahead` |
| GET | `/api/download/{id}` | read | Play (inline) / `?download=1` attachment |
| GET | `/api/export` | read | Whole library as a `.zip` |
| GET | `/api/voices` · `/api/voices/preview/{id}` | — | Voice list / preview |
| GET | `/api/library` · `/api/library/{id}` | read | List / get |
| DELETE | `/api/library/{id}` · `/api/library` | read | Delete one / clear all |
| GET·PUT | `/api/playback/{id}/position` | read | Resume position |
| GET | `/api/session` · POST `/restore` · `/signout` | read | Session state |
| GET | `/api/session/feed` | read | This session's podcast feed URL |
| GET | `/api/feed/{token}.xml` · `/api/feed/{token}/audio/{id}.mp3` | token | Podcast feed + audio |
| GET | `/api/health` | — | Status + queue counts |

("write" endpoints mint a guest session on first use; "read" endpoints never do.)
