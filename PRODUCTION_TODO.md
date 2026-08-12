# Production Readiness TODO

Goal: get Book2Audio **working end-to-end in production** (persistence on) and
**safe to run for real, anonymous, no-login users** without unbounded storage
growth or abuse. Grouped by priority. See `DEPLOYMENT_PERSISTENCE.md` for the
storage setup and `CLAUDE.md` for architecture.

Context: the app has **no accounts** — an anonymous session is a `users` row
keyed by `restore_key_hash`; the restore key *is* the identity (see
`app/session.py`, `app/session_router.py`). This is convenient but means there
is no way to identify, recover, or expire an abandoned "account" unless we add
the mechanisms below.

---

## P0 — Make it work in production (in progress)

- [ ] **Turso (metadata persistence).** Set `TURSO_DATABASE_URL` +
      `TURSO_AUTH_TOKEN` on Render. The libSQL row-adapter fix
      (`app/database.py`) is required and is already on `main` — without it the
      app crashes on startup. Verified against a real Turso DB.
- [ ] **Object storage (audio persistence). DECISION: Backblaze B2** (see
      "Storage decision" below). Set `AUDIO_BUCKET` + `AUDIO_S3_*` — S3-compatible,
      **zero code change** with the existing backend-proxy download flow. No card
      for the free 10 GB. Validate creds against `app/storage.py` before deploying.
      Egress is free up to 3× stored bytes/mo, then $0.01/GB — fine for a trial.
- [ ] **Verify the restore key survives a redeploy** (the whole point):
      convert a doc → save key → redeploy → paste key → library **and** audio
      come back.
- [ ] **Set `ALLOWED_ORIGINS`** to the real frontend origin(s) (currently
      `sync: false` in `render.yaml`).
- [ ] Note for users: **docs converted before persistence was enabled won't
      retro-persist** — their audio only exists on the old ephemeral disk.
      Re-convert them.

---

## P1 — Prevent unbounded storage growth & abuse (needed before "real" use)

The free object-storage tiers are ~10 GB (≈ 60 full-length audiobooks). With
no-login sessions, three things quietly eat that space:

### 1. Abandoned / orphaned sessions never get reclaimed
A visitor who converts once and leaves — or loses their key — leaves audio in
storage **forever**. Nobody can ever delete it (no login to reach it).

**What to do:**
- Add `last_active_at` to the `users` table; bump it in `optional_session` /
  `get_session` on each request.
- Add a scheduled cleanup job (Render Cron Job, or an APScheduler task on
  startup) that deletes sessions idle for > N days (suggest **90 days**), which
  cascades to their `documents` (FK `ON DELETE CASCADE`) **and** deletes each
  doc's audio blob via `storage.delete_audio` (the cascade does NOT touch object
  storage — must iterate the user's docs first).
- Make the TTL generous and clearly communicate "sessions are temporary — save
  your key" so this never surprises an active user.

### 2. No per-user quota or max upload size
One user (or a bot) can upload arbitrarily large files and unlimited docs.

**What to do:**
- Enforce a **max upload size** (suggest 25 MB) in `upload_file` / `upload_url`
  / `upload_text` (`app/main.py`) — reject early with a clear 413.
- Track per-user total stored bytes (store audio byte size on the `documents`
  row at conversion time) and enforce a **per-key cap** (suggest 500 MB); block
  new conversions past it with an actionable message.

### 3. No rate limiting — guests are minted automatically on write
`get_session` mints a new guest on any upload/convert, so abuse is cheap.

**What to do:**
- Add lightweight rate limiting (e.g. `slowapi`) on `/api/upload*` and
  `/api/convert` keyed by IP + session (suggest N conversions/hour).

### 4. Restore-key UX = data-loss prevention (fixes the problem at the source)
Fewer orphaned libraries if fewer people lose their key.

**What to do:**
- Strengthen the "save your key" moment: require an explicit acknowledgement,
  offer "download key as file" / "copy", and warn before sign-out. (Frontend:
  `SaveKeyBanner.tsx`, `SessionContext.tsx`.)

---

## P2 — Reliability & quality follow-ups

- [ ] **Mirror the OOM streaming fix into `app/tts/polly.py`.** `edge.py` and
      `_run_conversion` now stream to disk + ffmpeg-concat, but `polly.py` still
      accumulates decoded PCM per chapter. Only bites if `TTS_PROVIDER=polly`;
      do it before ever switching providers.
- [ ] **Recover conversions interrupted by a redeploy/restart.** Progress lives
      in the in-memory `conversion_progress` dict and parsed content is
      in-memory too; a redeploy mid-conversion orphans the job and the doc can
      be stuck `status='converting'` forever. On startup, reset stuck
      `converting` docs to `error` (or re-queue) so the UI isn't misleading.
- [ ] **Cold starts.** Render free tier sleeps after ~15 min → 30–50s first
      request. Options: accept it, add a cheap keep-alive cron hitting
      `/api/health`, or upgrade the instance.
- [ ] **TTS quality in prod.** edge-tts is blocked on cloud hosts, so production
      falls back to **gTTS** (lower quality, `use_edge:false` at `/api/health`).
      If voice quality matters, evaluate AWS Polly (needs creds/cost) or a
      hosted neural engine. Note licensing before shipping voice cloning.
- [ ] **Offload audio streaming from the backend + free egress (Cloudflare).**
      Downloads currently proxy through the backend (`storage.open_stream` →
      Render → user), doubling bandwidth and counting against B2's 3× free-egress
      cap. Fix by having the download endpoint **redirect to a URL** instead of
      proxying — either B2 presigned GET URLs, or (for $0 egress) a **custom
      Cloudflare domain in front of B2** (Bandwidth Alliance). Note the Cloudflare
      path implies serving via an unlisted CDN URL (doc_id is an unguessable
      UUID) rather than a keyed private read — acceptable, but a real change to
      the download flow, not just env vars. Do this when egress actually matters.

---

## Storage decision & research (2026-08-12)

Ran a deep-research sweep (managed free tiers, self-hosted OSS, unconventional
options, GitHub projects, reliability/cost modeling) for storing 50–500 GB of
streamed audiobook MP3s via the boto3 S3 drop-in.

- **Chosen now: Backblaze B2** — cheapest storage (~$0.54/mo @100 GB,
  ~$2.94/mo @500 GB), no card for 10 GB free, most reliable track record, clean
  S3 API. Works today with zero code change.
- **Egress upgrade later: front B2 with a Cloudflare custom domain** → $0 egress
  (Bandwidth Alliance). Tracked in P2 above.
- **Top alternative: Cloudflare R2** — $0 egress out of the box, clean S3, needs
  a card. Since `storage.py` is env-var-only, switching B2↔R2 is a zero-code change.
- **Rejected:** Oracle *managed* Object Storage (free tier only ~20 GB + high
  reclamation risk); Storj/Wasabi (egress economics/policies break streaming);
  MinIO for new self-hosts (repo archived/unmaintained — use Garage/SeaweedFS);
  "creative free" stores (HuggingFace, Internet Archive, GitHub LFS, Drive/Telegram
  via rclone) — no real S3 API, force files public, or DMCA/ToS/ban exposure.

### OSS patterns worth borrowing (MIT/Apache — this project can't use GPL)
- [ ] **Resumable conversion checkpointing** — `aedocw/epub2tts` (Apache-2.0):
      checkpoint completed chapters so a redeploy mid-conversion resumes instead
      of re-synthesizing a whole book. Directly implements the
      "recover interrupted conversions" item above.
- [ ] **Chapter-per-file audio layout** — `santinic/audiblez` (MIT): store
      `audio/{doc_id}/ch_{n}.mp3` so playback can stream/seek/resume per chapter
      and re-synth is cheap. (Pairs well with the redirect-to-URL streaming change.)
- [ ] **Real range-streaming reads** — `piskvorky/smart_open` (MIT) /
      `drivendataorg/cloudpathlib` (MIT): replace `storage.read_bytes()`'s
      full-file load with seekable range reads for playback + lower memory.

---

## Notes
- Scaling past the free storage tier is cheap, not a wall: object storage is
  ~$0.025/GB/month (100 GB ≈ ~$2.50/mo). The levers above keep you on the free
  allowance longer; they don't require re-architecting.
- Keep `JWT_SECRET` stable across deploys (already `generateValue: true` on
  Render, which Render preserves) so session cookies don't invalidate.
