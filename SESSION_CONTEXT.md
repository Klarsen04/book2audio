# Session Context — 2026-08-09

A record of the changes, decisions, and open items from this working session.
This is a session log, not build instructions — see `CLAUDE.md` for how to build/run the project.
(Earlier session log for 2026-08-05 is preserved further down this file.)

---

## Summary of what changed (2026-08-09)

| # | Area | Change | Branch / commit |
|---|------|--------|-----------------|
| 1 | Homepage redesign | Replaced generic purple/glass "AI SaaS" landing with an editorial, scroll-driven cinematic homepage (PAGE ⇄ WAVEFORM). GSAP + ScrollTrigger + Lenis. | `feat/editorial-homepage-motion` → merged to `main` |
| 2 | Editorial system everywhere | Applied the editorial design system (Playfair / Source Serif 4 / JetBrains Mono; warm ink + paper + burgundy + gold) to all product pages + components. Library list view + player chapter TOC now structured "chapter rows". | merged to `main` |
| 3 | Bug fix | "Try a voice" Play did nothing — it POSTed (endpoint is GET) and never played the streamed audio. Now GETs with the on-screen text, plays it, applies speed, shows loading/stop/error. | merged to `main` |
| 4 | Bug fix | Sign out went to `/login`; now returns to the animated homepage `/`. | merged to `main` |
| 5 | No-login sessions | Removed accounts (login/register/Google OAuth). Anonymous "restore key" sessions (`PAGE-XXXX-XXXX-XXXX`); paste key to return to library. Storage-agnostic: local today, Turso + B2/R2 via env. Downloads: per-book MP3, whole-library `.b2a` export, copy key. | `feat/no-login-sessions` → merged to `main` |
| 6 | Feature + bug fix | New "Start with a spoken summary" toggle (preread): prepends a ~1-min spoken overview as a skippable "Summary" chapter, then plays the full selection. Fixed summaries dropping chapter `text` (reader showed "Chapter text not available"). | `feat/spoken-summary-intro` → merged to `main` |
| 7 | Mobile app | Revived the stale Expo/React Native app: removed login, wired to no-login restore-key sessions via `Authorization: Bearer` (RN has no cookie jar), fixed Player to real endpoints (`/api/download/{id}`, chapters from `/api/library/{id}`), added convert+intro flow, editorial theme. Backend now also accepts the session token via Bearer header + surfaces it as `X-Session-Token`. | `feat/mobile-app` (NOT merged) |
| 8 | Installable PWA | Polished PWA: new editorial icons (192/512 + maskable + apple-touch + favicon), fixed manifest (editorial colors, `start_url:"/"`), Next metadata API for apple-web-app/manifest. New homepage "Get the app" section with a runtime QR of `window.location.origin` + iOS/Android install steps + Android `beforeinstallprompt` button + dismissable iOS A2HS hint. | `feat/pwa-install` (NOT merged) |

### Key architectural notes
- **Design system**: `frontend/tailwind.config.ts` + `globals.css` define editorial tokens (`paper`, `ink`, `burgundy`, `gold`, `label-mono`, `paper-panel`). Old `.glass`/`.gradient-text` were re-skinned, not deleted, so nothing broke.
- **Motion**: `src/lib/gsap.ts` (single SSR-safe plugin registration), `components/motion/{SmoothScroll,WaveCanvas,ManuscriptPage}`, `components/home/{TransformStage,ArtifactScene}`. Local GSAP at `/Users/larkirs/GSAP` is the full Club bundle, but npm `gsap@3.13+` ships all plugins free. Reduced-motion → static hero; RestoreDialog uses a React **portal** to avoid GSAP-pin DOM conflicts (`insertBefore` crash).
- **Sessions**: `backend/app/session.py` — `get_session` mints a guest on WRITE endpoints (upload/convert); `optional_session` is READ-ONLY and MUST NOT mint (a read minting a guest raced the real cookie → restored library looked empty; fixed). Key returned via `X-Restore-Key` header + Set-Cookie in an http middleware. Guests use placeholder `email = guest:<uuid>` (old `email` col is UNIQUE/NOT NULL). Frontend `SessionContext` (replaced `AuthContext`).
- **Storage**: `backend/app/storage.py` — local files by default; `AUDIO_BUCKET` + `AUDIO_S3_*` → B2/R2 via boto3 S3 API (no new dep). `database.py` — `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` → hosted libSQL, else local sqlite3. Setup steps in `DEPLOYMENT_PERSISTENCE.md`.
- **Spoken intro**: `summarizer.summarize_intro()`; `/api/convert` takes `intro=bool`; prepends a "Summary" chapter (with `text`) to audio + `chapters_json`.
- **Mobile (Expo)**: `mobile/` — `src/lib/api.ts` stores the session token (`X-Session-Token`) in `expo-secure-store` and sends it as `Authorization: Bearer` (no cookie jar in RN); `src/lib/theme.ts` mirrors the web palette. Player streams `/api/download/{id}` with the Bearer header. Run: `cd mobile && npm install && npx expo start` (point at a local backend with `EXPO_PUBLIC_API_URL`; see `mobile/README.md`). `tsc --noEmit` passes.
- **PWA**: icons authored from `frontend/public/icon-source.svg` / `icon-maskable-source.svg` via `rsvg-convert`. `GetTheApp` imports `qrcode` dynamically (off main bundle) and encodes `window.location.origin`. `InstallHint` shows only on iOS Safari, not standalone, once (localStorage). Layout uses the Next metadata API (`appleWebApp`, `icons`, `viewport.themeColor`) instead of hand-rolled `<head>` tags.

### Environment / deploy
- Runs on **Homebrew Python 3.11** (`/opt/homebrew/bin/python3.11`), NOT system 3.9 (3.9 chokes on `str | None` annotations at def time).
- Keep `JWT_SECRET` **stable** across deploys or session cookies invalidate (users re-paste key; key itself still works since it's hashed).
- All secrets live in gitignored `.env*` / Render env vars. `.env.example` holds placeholders only. `backend/data/` (SQLite) is gitignored.

### Open items / notes
- **Deploy from `main`** for the fixes to reach production (deployed site was running old code — cause of the "Not authenticated" and "Chapter text not available" reports).
- **Already-converted docs won't retro-fix**: the text fix applies to conversions run *after* deploy — re-convert old documents.
- To make sessions persist across free-tier redeploys, set the Turso + B2/R2 env vars (`DEPLOYMENT_PERSISTENCE.md`).
- **Unmerged branches to review/merge next**: `feat/mobile-app` (also carries the backend Bearer-token change → redeploy backend when merged), `feat/pwa-install`, `docs/session-context-2026-08-09` (this log).
- Merged branches still on origin: `feat/editorial-homepage-motion`, `feat/no-login-sessions`, `feat/spoken-summary-intro` (safe to delete).
- QR in the "Get the app" section encodes the live origin automatically — it shows `localhost:3000` only in dev.

---

# Session Context — 2026-08-05

A record of the changes, decisions, and open items from this working session.
This is a session log, not build instructions — see `CLAUDE.md` for how to build/run the project.

---

## Summary of what changed

| # | Area | Change | Commit |
|---|------|--------|--------|
| 1 | Summaries | Fixed summarizer so it always reduces text; persist reduced word counts; show reduction preview in UI | `0f496bd` |
| 2 | UI cleanup | Removed dead "Additional Context" toggle; fixed inaccurate audio-type descriptions | `0f496bd` |
| 3 | UI fix | Floating upload/convert button lifts above the "Now Playing" bar so it isn't covered | `0f496bd` |
| 4 | Deploy (reverted) | Added Render persistent disk + audio path — later reverted (invalid on free tier) | `65ab0e8`, `e550502`, `82f4178` |
| 5 | PDF parsing | Strip running headers/footers + page numbers; use PDF outline/TOC for chapters | `f1a767d` |

---

## 1. Summary feature (Full / Long / Short)

**Problem reported:** Selecting Long/Short Summary "did nothing."

**Root cause:** `backend/app/summarizer.py` returned the *full text unchanged* for short
documents (≤5 sentences for Long, ≤3 for Short), so test uploads came out identical.
The reduction was also invisible — the UI never showed the shorter word counts.

**Fix:**
- `backend/app/summarizer.py` — rewrote around a shared `_summarize(text, ratio, floor)`
  helper that **always** returns strictly fewer sentences (Long ≈ 35%, Short ≈ 12%),
  down to a floor of 1 sentence.
- `backend/app/main.py` (`start_conversion`) — after summarizing, persist the reduced
  `chapters_json` + `total_word_count` to the DB so the library/player reflect the summary.
- `frontend/src/components/ConversionPanel.tsx` — added `SUMMARY_RATIOS` (kept in sync with
  the backend) and a live "Estimated after summarizing" preview; corrected the misleading
  "Full Text" blurb (it never actually stripped tables/figures/junk).

**Known limitation:** This is *extractive* summarization (picks existing high-scoring
sentences), not true rewriting. For genuine narrated summaries it would need an LLM
(e.g. Claude via Bedrock or the Anthropic API). Deferred — user chose to keep it free/offline.

## 2. Removed dead "Additional Context" toggle

The toggle sent `additional_context` to the backend but it was **never used**. Removed:
the UI toggle + state in `ConversionPanel.tsx`, the query param in the convert request,
and the `additional_context` parameter on the `start_conversion` endpoint.

## 3. Floating button vs. "Now Playing" bar overlap

The floating upload/convert button (`bottom-6 right-6`) was covered by the full-width
`NowPlayingBar` (`bottom-0`). Added a shared subscription in `NowPlaying.tsx`
(`useNowPlayingActive`) so `FloatingUpload` shifts to `bottom-24` whenever the bar is
showing and drops back to `bottom-6` when it's dismissed.

## 5. Improved PDF extraction (`backend/app/parsers/extractor.py`)

**Problem:** `extract_from_pdf` detected chapters only by font size > 16 and did nothing
about running headers/footers or page numbers — so those got narrated on every page.

**Fix** (technique borrowed from pdf-narrator (MIT); reimplemented in existing
pdfplumber/pdfminer, **no new dependency**):
- `_page_lines()` — groups words into visual lines with a representative font size.
- `_find_running_lines()` — flags lines in the top/bottom 2 lines of a page that recur on
  ≥40% of pages (min 3) as boilerplate headers/footers and drops them.
- `_PAGE_NUMBER_RE` — strips standalone page-number lines (arabic + roman numerals,
  optionally wrapped like `- 12 -` / `Page 7`). Verified it does NOT match real sentences.
- `_pdf_outline_titles()` — reads the PDF outline/TOC (`pdf.doc.get_outlines()`, wrapped in
  try/except) and uses those titles as chapter breaks in addition to the font-size heuristic.

**Verification:** helper functions unit-tested (page-number regex, running-header detection);
module imports cleanly. NOT yet tested against a real PDF (no reportlab/sample PDF in repo) —
**validate by uploading an actual PDF with headers/footers/page numbers.**

---

## Deep research run: open-source repos to borrow from

Ran the `deep-research` workflow (93 agents, 25 claims verified 3-0, 1 refuted). Question:
best OSS GitHub repos for document→audiobook TTS whose features/code could be integrated
into book2audio. Full transcript under the session's `subagents/workflows/` dir.

**License gate:** book2audio is not GPL, so only **MIT / Apache-2.0** code can be lifted.

Permissive candidates worth borrowing from:
- **epub_to_audiobook** (MIT) — clean pluggable multi-provider TTS abstraction (pattern to
  copy for generalizing edge/gTTS/Polly).
- **pdf-narrator** (MIT) — PDF header/footer/page-number stripping + PyMuPDF TOC chapters.
  (Technique already applied in change #5 above.)
- **kokoro-tts** (MIT, Python 3.11) — EPUB TOC / PDF-TOC chapter extraction, per-chapter split.
- **abogen** (MIT) — synced word/sentence highlighting + chapterized M4B with metadata.
- **audiblez** (MIT) — compact EPUB→M4B pipeline matching our pydub+ffmpeg approach.
- **ebook2audiobook** (Apache-2.0, ~19.6k stars) — most mature multi-format reference.

Reference-only (GPL-3.0, do NOT copy code): **Lue** (word-level highlighting),
**audiobook-creator** (LLM per-character voice attribution; note: it's a Gradio app, not
FastAPI — a "FastAPI app" claim was refuted).

**TTS upgrade note:** Kokoro-82M (Apache-2.0) is the standout engine, but it (and XTTS/Bark/
Orpheus) needs PyTorch + ideally a GPU. **edge-tts is the right choice for Render free tier**
(cloud, zero local compute). Defer heavier engines until/unless on a GPU host. XTTS v2 also has
non-commercial (Coqui CPML) licensing history — check before shipping voice cloning.

---

## Deployment investigation (important)

**Reported:** Converted documents "reset"/don't show up after deploying.

**Journey & findings:**
- First attributed it to audio files being written to `./output` (not persisted).
  Added a Render `disk:` block (`/data`, 10 GB) + `AUDIO_OUTPUT_DIR=/data/audio`.
- **Key discovery:** the service runs on Render's **free tier**, which **does not support
  persistent disks**. The `disk:` block is only valid on paid plans.
- Reverted the disk config in `82f4178` — back to default `./data` + `./output` paths so
  free-tier deploys are valid. User confirmed deploys work again.

**Current production reality (free tier):**
- There is **no persistent storage**. Both the SQLite DB and audio files live on an
  **ephemeral** filesystem and are wiped on every deploy (and on sleep/restart).
- `JWT_SECRET` uses `generateValue: true` — Render generates it once and keeps it, so it
  does not rotate per deploy.

## Diagnosis: what actually fills the disk / resets

- The **database** is tiny (~72 KB) — it is NOT what grows or causes scaling concerns.
- **Audio MP3s** are the large files (~10–100+ MB each) — the real storage driver.
- On free tier, data loss on redeploy is **inherent**, not a bug in the app code.

---

## Decisions made this session

- **Stay on Render** (free tier). Do not move the Python backend to Vercel — it can't run
  long ffmpeg conversion jobs / background threads / file writes.
- **Keep the Study Timer** (Pomodoro) as-is.
- **Do NOT pay** for a Render persistent disk.
- Summaries stay **extractive/offline** (no LLM) for now.

## Open items / future options (not yet done)

To make converted files **persist for free**, the data must move off the ephemeral disk:
1. **Database → Turso** (hosted libSQL/SQLite, free tier). Note: backend uses *raw* `sqlite3`
   (~75 `row["col"]`/`dict(row)` sites across 6 files, WAL pragmas, `executescript`), so this
   is a real data-layer rewrite — unlike the sibling `student-leadership-dashboard` project
   which uses Prisma + a clean libSQL adapter on Vercel.
2. **Audio files → Backblaze B2** (10 GB free, no card needed) or Cloudflare R2 (10 GB free,
   no egress fees, needs card). Upload MP3 on completion, store URL in DB, stream/redirect on
   download.
3. Backend can remain on Render free tier once it is stateless (note: free tier **sleeps after
   ~15 min idle** → ~30–50s cold start on the next request).

Free-tier-safe feature improvements borrowed from the research (pure Python, no GPU):
- **Pluggable TTS provider abstraction** — refactor edge/gTTS/Polly into a strategy interface
  (pattern from epub_to_audiobook). Low risk; sets up future engine swaps.
- **Real EPUB chapter titles** — read the EPUB TOC (NCX/nav) instead of falling back to
  "Chapter 1, 2, 3…" (pattern from kokoro-tts). Pure Python.
- Deferred (need GPU or word timestamps): Kokoro/XTTS TTS, M4B chapterized output, synced
  word/sentence highlighting.

Reference project (different stack, do not copy 1:1): `/Users/larkirs/student-leadership-dashboard`
— Next.js on Vercel + Prisma + Turso (libSQL). Its serverless model does not fit book2audio's
Python/ffmpeg backend.

---

## PROPOSAL (not built): No-login sessions + export / restore

**Idea (from user):** Turn the free-tier "no persistence" limitation into a *feature*.
Users don't sign in — they work in an anonymous session. Because free-tier data is wiped
on deploy/restart, they can **export** their library to keep it, and **restore** it next
session to continue. Framed positively: privacy-first, no sign-up friction, "you own your files".

### Current relevant state
- Every backend endpoint currently gates on `get_current_user` (JWT access-token cookie) —
  see `backend/app/auth/dependencies.py`. A guest model = issue a signed token for a temporary
  random user id; existing endpoints keep working unchanged.
- Audio lives in `./output/{doc_id}.mp3`; metadata + chapters/positions live in the ephemeral
  SQLite DB. Both vanish on restart (free tier, no disk).

### Two implementation shapes

**Option A — Portable file (no external services, $0, buildable today)**
- `GET /api/export` → zip of MP3s + a JSON manifest (titles, chapters, start_times, voice,
  playback positions). Download as one file (e.g. `library.b2a`).
- `POST /api/import` → unzip audio back into `./output`, re-insert DB rows for the new session.
- Trade-offs: user must remember to export or loses data; re-uploading large MP3 zips on free
  tier is slow; it's "sneakernet" (user carries the file), not automatic cross-device.

**Option B — Cloud DB + restore key (needs Turso + Backblaze B2, still $0)**
- User asked: "can we export to the database instead?" — the *current* DB is ephemeral, so
  this only works with a **persistent** external store: **Turso** (metadata) + **B2** (audio).
- Export saves the library to the cloud under a generated **restore key/code**; next session
  the user pastes the key and everything auto-restores (incl. playback positions). Nicer UX.
- Key realization: a restore-key IS effectively a password-less account (the key = identity),
  just with no email/password form. Valid design (magic-link / recovery-code style).
- Requires the Turso + B2 migration already noted in "Open items" (2 free accounts to set up).

### Open decisions before building
1. **Auth model:** guest-only (hide login) vs guest-default + optional login vs no-token
   (localStorage session id).
2. **Persistence:** portable file (A) vs cloud DB + restore key (B).
3. **Export scope:** audio + metadata (full restore, big file) vs metadata-only (tiny file,
   re-convert on import) vs let user choose.
4. **UX safety:** how to warn "session is temporary — export to keep" (banner, on-leave prompt,
   inactivity nudge) so users don't lose data by forgetting.

### Recommendation
- Fastest win / no dependencies: **Option A** (portable file, full audio+metadata).
- Best UX / future-proof: **Option B** (restore key) — but it's the Turso + B2 work, so do it
  only if committing to that migration. Both are $0.

---

## Key file map (touched this session)

- `backend/app/summarizer.py` — extractive summarizer (`summarize_long`, `summarize_short`).
- `backend/app/main.py` — `start_conversion` (summarization + DB persist), `_run_conversion`
  (audio synthesis → `OUTPUT_DIR`), status/download endpoints. `OUTPUT_DIR` honors
  `AUDIO_OUTPUT_DIR` env → Docker `/app/output` → local `./output`.
- `backend/app/database.py` — raw `sqlite3`, `DATABASE_PATH` env (default `./data/book2audio.db`).
- `backend/app/parsers/extractor.py` — document → `BookContent` (chapters). PDF path now strips
  running headers/footers + page numbers and uses the PDF outline/TOC for chapters.
- `frontend/src/components/ConversionPanel.tsx` — audio-type selector + reduction preview.
- `frontend/src/components/NowPlaying.tsx` — now-playing bar + `useNowPlayingActive` hook.
- `frontend/src/components/FloatingUpload.tsx` — floating button that dodges the bar.
- `render.yaml` — Render blueprint (free tier, no disk).
