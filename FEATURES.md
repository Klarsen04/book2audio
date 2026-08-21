# Book2Audio — Feature Reference

Every user-facing feature, how it actually works end to end, which API endpoints
and third-party services it uses, and where its data lives.

This is the **feature-oriented** companion to [`DOCUMENTATION.md`](./DOCUMENTATION.md)
(which is organised by file/module) and [`CLAUDE.md`](./CLAUDE.md) (build/run).
Written against `main` as of **2026-08-21** (after the end-to-end bug sweep, PR #55).

---

## Contents

1. [The mental model](#1-the-mental-model)
2. [Identity: no-login restore-key sessions](#2-identity-no-login-restore-key-sessions)
3. [Getting content in: file, URL, pasted text](#3-getting-content-in-file-url-pasted-text)
4. [Chapter detection](#4-chapter-detection)
5. [Summaries and the spoken intro](#5-summaries-and-the-spoken-intro)
6. [Conversion: queue, splitting, synthesis, assembly](#6-conversion-queue-splitting-synthesis-assembly)
7. [Voices and voice preview](#7-voices-and-voice-preview)
8. [Playback: the web player](#8-playback-the-web-player)
9. [Reader view and study tools](#9-reader-view-and-study-tools)
10. [The library](#10-the-library)
11. [Export and download](#11-export-and-download)
12. [Private podcast feed](#12-private-podcast-feed)
13. [Mobile app](#13-mobile-app)
14. [PWA / install](#14-pwa--install)
15. [Storage architecture](#15-storage-architecture)
16. [Data model](#16-data-model)
17. [Limits, quotas, and rate limits](#17-limits-quotas-and-rate-limits)
18. [Third-party APIs used](#18-third-party-apis-used)
19. [Complete endpoint reference](#19-complete-endpoint-reference)
20. [Failure modes and recovery](#20-failure-modes-and-recovery)

---

## 1. The mental model

A **document** is the unit of everything. You add a document (file, URL, or pasted
text), the backend parses it into **chapters** with text, and that row lives in the
`documents` table with `status = uploaded`. Converting it synthesizes speech per
chapter, concatenates the result into **one MP3 per document**, and flips the row to
`completed` with an `audio_duration` and per-chapter `start_time`s. Everything
downstream — the player, chapter navigation, the reader, the podcast feed, export —
reads from that one MP3 plus `chapters_json`.

```
add ──▶ documents(status=uploaded, chapters_json=[{title,text}])
convert ──▶ queued ──▶ converting ──▶ completed(audio + start_times)   or ──▶ error
```

Three clients (web, mobile, podcast apps) talk to one FastAPI backend. There are no
accounts — a **restore key** is the identity.

**Status values:** `uploaded` · `queued` · `converting` · `completed` · `error`.
These strings appear in the DB, in `GET /api/status/{id}`, in `GET /api/library`, and
drive nearly every UI state, so they're worth memorising.

---

## 2. Identity: no-login restore-key sessions

**What the user sees.** No sign-up, no email, no password. The first time you convert
something you get a key like `PAGE-7F3K-9Q2M-XR4T` and a banner telling you to save
it. Paste that key on any device (or after clearing cookies) and your library comes
back. "Sign out" just detaches the current device; the library is untouched.

**How it works.**

- `app/session.py:35` `generate_restore_key()` builds `PAGE-` + three 4-character
  groups. The `PAGE` prefix is branding, not entropy.
- Only the **SHA-256 hash** of the key is stored (`users.restore_key_hash`, UNIQUE).
  The plaintext key is shown exactly once and never persisted server-side — if the
  user loses it, that library is unreachable by design.
- A **session token** (JWT signed with `JWT_SECRET`) identifies the device. It is sent
  as an HTTP-only cookie (`session`) for the web app, or as
  `Authorization: Bearer <token>` for mobile (React Native has no cookie jar).
  `_token_from_request()` accepts either, so every endpoint works for both clients.
- Two FastAPI dependencies enforce the minting rules:
  - `get_session` — used on **write** endpoints (upload, convert). Mints a guest user
    if there isn't one, stashing the new token/key on `request.state`.
  - `optional_session` — used on **read** endpoints. **Never mints**; returns an
    anonymous stub that owns nothing. (This matters: a read endpoint that minted a
    session used to race the real cookie and make a restored library look empty.)
- The `attach_new_session` HTTP middleware (`main.py:72`) turns a freshly minted
  identity into a `Set-Cookie` plus two response headers: `X-Session-Token` and
  `X-Restore-Key`. Both are listed in the CORS `expose_headers`.
- Guest rows get a placeholder `email = guest:<uuid>` because the legacy `email`
  column is UNIQUE/NOT NULL.
- `_touch_last_active()` bumps `users.last_active_at` (throttled to about once a day).
  `cleanup_abandoned_sessions()` deletes sessions idle longer than `SESSION_TTL_DAYS`
  (default 30) **and their audio blobs**, run daily by a background thread.

**Frontend.** `contexts/SessionContext.tsx` wraps the app; an axios response
interceptor in `lib/api.ts` captures `x-restore-key` / `x-session-token` from **any**
response (including 4xx) and stores the key locally. `SaveKeyBanner` shows until the
user confirms they've saved it; `RestoreDialog` posts a pasted key; `NavBar` shows the
key and a sign-out confirmation.

**APIs:** `GET /api/session` (is there a library, how many docs),
`POST /api/session/restore` (`{key}` → sets cookie, returns `{session_token}`),
`POST /api/session/signout`. Keys are normalised (whitespace stripped, upper-cased)
before hashing, so formatting mistakes don't matter.

---

## 3. Getting content in: file, URL, pasted text

Three tabs in `FileUpload.tsx`, three endpoints. All are rate-limited
(`RATE_LIMIT_UPLOADS_PER_HOUR`, default 30/hour per IP) and size-capped
(`MAX_UPLOAD_MB`, default 25 MB). All three mint a session if needed and return
`{job_id, title, chapters, total_word_count}` — `job_id` is the document id.

### 3.1 File upload — `POST /api/upload`

Accepts **PDF, EPUB, DOCX, TXT**, dispatched by extension in
`parsers/extractor.py:312`.

| Format | Library | Notes |
|---|---|---|
| PDF | `pdfplumber` | strips running headers/footers and page numbers; uses the PDF outline for chapters; OCR fallback |
| EPUB | `zipfile` + OPF spine parsing | real spine order, `BeautifulSoup` for text |
| DOCX | `python-docx` | heading styles become chapters |
| TXT | stdlib | chapter-pattern split; untitled files are named from the filename |

**PDF cleanup** is the part that most affects listening quality:
`_page_lines()` groups words into visual lines with a representative font size;
`_find_running_lines()` flags any line in the top/bottom two lines of a page that
recurs on ≥40% of pages (minimum 3) as boilerplate and drops it; `_PAGE_NUMBER_RE`
strips standalone page numbers (arabic and roman, including `- 12 -` and `Page 7`
forms). Without this, the narrator reads the book title and a page number on every
page.

**OCR fallback.** If a PDF yields no extractable text (a scan or image-only export)
and `OCR_SPACE_API_KEY` is set, `_ocr_space_pdf()` posts the bytes to the OCR.Space
API (engine 2, scaling on) and uses the recognised text instead. Without the key, the
upload fails with a clear message rather than producing an empty book.

### 3.2 URL — `POST /api/upload-url`

Body `{url}`. Fetches the page and converts it to chapters.

- **SSRF protection** is layered and deliberate: `_url_is_public()` rejects
  non-http(s) schemes and any host resolving to a private, loopback, link-local,
  reserved, multicast, or unspecified address (this is what blocks
  `169.254.169.254` cloud-metadata pivots). `_get_public_url()` then follows
  redirects **manually**, re-validating **every hop**, and connects to the
  already-verified IP with an explicit `Host` header and SNI hostname so DNS
  rebinding can't swap the address between validation and connection.
- Each hop is **streamed**: redirect bodies are discarded unread and the final body
  is read incrementally against `MAX_UPLOAD_BYTES`, so an enormous page is rejected
  with 413 instead of being buffered into memory first.
- Browser-like headers (`_BROWSER_HEADERS`) are sent so ordinary sites don't 403.
- **Firecrawl fallback:** if the direct fetch yields nothing usable and
  `FIRECRAWL_API_KEY` is set, `_firecrawl_scrape()` requests clean markdown from the
  Firecrawl API — this is what makes JavaScript-rendered and bot-protected pages
  work. `_strip_markdown()` then removes `#`, `**`, links and images so the narrator
  doesn't read punctuation aloud.
- A PDF served at a URL is detected and routed through the PDF parser; otherwise the
  page is parsed as HTML. Stored `format` is `html` (or `pdf`).

### 3.3 Pasted text — `POST /api/upload-text`

Body `{text, title}`. Split on chapter patterns when present, otherwise a single
"Full Text" chapter. Same size cap applies to the pasted string.

---

## 4. Chapter detection

Chapters are the backbone of navigation, the reader, and the auto-split. Detection is
per-format: **PDF** uses the outline/TOC when present plus a font-size heuristic;
**EPUB** uses the OPF spine; **DOCX** uses heading styles; **TXT/pasted text** uses
regex chapter patterns. When nothing is detectable you get one chapter titled
"Full Text" — still fully playable.

Every chapter is stored in `documents.chapters_json` as
`{title, word_count, text}`, and gains a fourth field `start_time` (seconds into the
MP3) when conversion completes. That contract is written identically by upload,
summarisation, intro injection, and part-splitting, which is what lets the reader,
chapter list, and seek behaviour all agree.

---

## 5. Summaries and the spoken intro

Chosen in `ConversionPanel.tsx` and passed to `POST /api/convert/{id}` as
`audio_type` and `intro`.

**`audio_type`** — `full` (default) · `long_summary` · `short_summary`.

Two-tier implementation in `app/summarizer.py`:

1. **LLM rewrite (preferred).** `_gemini_generate()` calls the Google AI Studio
   Gemini API (`GEMINI_API_KEY`, model `GEMINI_MODEL`, default `gemini-2.0-flash`);
   if that returns nothing, `_openrouter_generate()` calls OpenRouter
   (`OPENROUTER_API_KEY`, default model `meta-llama/llama-3.3-70b-instruct:free`).
   Both share `_summary_prompt()`, which asks for plain spoken narration with no
   markdown or lists — important, because the output goes straight to TTS. Input is
   capped at 40,000 characters per call.
2. **Extractive fallback (always available).** `_summarize()` scores sentences and
   keeps the top slice in original order: **35%** for long, **12%** for short, with
   floors of 2 and 1 sentences. It is guaranteed to return strictly fewer sentences
   than the input, so the setting always visibly does something even with no API key
   and no network.

The frontend mirrors those ratios so it can show an "estimated after summarising"
word count before you commit.

**`intro=true`** prepends a skippable ~1-minute spoken overview as a chapter titled
"Summary" (via `summarize_intro()`, max ~150 words), then plays the full selection.
The intro chapter carries real `text`, so the reader shows it rather than
"chapter text not available".

Summaries persist: after transforming, the reduced chapters and `total_word_count`
are written back to the DB so the library and reader reflect what was actually
narrated. The whole transform runs in a worker thread (`asyncio.to_thread`) so
minutes of LLM calls can't block status polls or the health check.

---

## 6. Conversion: queue, splitting, synthesis, assembly

`POST /api/convert/{doc_id}?voice=&audio_type=&intro=` — the most involved feature in
the product. In order:

1. **Rate limit** (`RATE_LIMIT_CONVERSIONS_PER_HOUR`, default 10/hour per IP) and
   **ownership check**.
2. **Quota check.** If the session's stored audio is at or over `USER_QUOTA_MB`
   (default 500), respond **413** with
   `{code: "quota_exceeded", message, usage_bytes, limit_bytes}`. The frontend turns
   this into an "export your library, then clear it" flow rather than a dead end.
3. **Conflict check.** Already `queued` or `converting` (in the DB *or* in live
   progress) → **409**.
4. **Base content.** Uses the pristine in-memory copy if present, otherwise
   `_content_from_db()` rebuilds `BookContent` from `chapters_json` — the full text
   was persisted at upload. This is what makes Convert survive restarts and
   redeploys, and what allows re-converting a `completed` document with a different
   voice. Retries always derive from the **original** content, so a failed summary
   conversion can't summarise the summary or stack a second intro.
5. **Transform** (summary / intro), off the event loop.
6. **Oversize protection.** `_split_oversized_chapters()` first breaks any *single*
   chapter longer than `MAX_CONVERT_WORDS` into sequential sub-chapters
   ("Full Text (1/3)"…), splitting on paragraph, then sentence, then word
   boundaries. Then `_split_chapters_into_parts()` packs chapters into sibling
   documents of at most `MAX_CONVERT_WORDS` words (default 20,000) each, preserving
   chapter boundaries. Parts are titled **"… — Part k of n"** and linked by
   `part_group` + `part_index`. The convert response reports
   `{split, total_parts, part_ids}`.
7. **Enqueue.** Every job goes on **its own session's queue**
   (`_enqueue_conversion`). Within a session, conversions run strictly one at a time;
   different sessions run in parallel, bounded globally by a semaphore of
   `MAX_CONCURRENT_CONVERSIONS` (default 2). So one person's ten-part book doesn't
   block anyone else, and a small instance is never overwhelmed. Rows flip to
   `queued`.
8. **`_run_conversion()`** (per job, on that session's worker thread):
   - Synthesize each chapter, up to `TTS_CONCURRENCY` (default 4) chapters in
     parallel, each to its own temp file.
   - Track exact cumulative durations to build `chapter_start_times`; empty chapters
     are skipped but keep the start-time list aligned with `chapters_json`.
   - `concat_mp3()` joins chapter MP3s with ffmpeg's concat demuxer using stream
     **copy** (low memory). It probes every input's codec/sample-rate/channels first
     and forces a re-encode when they differ — mixing engines (edge at one sample
     rate, gTTS at another) with `-c copy` would otherwise produce audio with
     drifting timestamps.
   - `storage.save_audio()` writes the blob (local disk or bucket); on cloud storage
     the local staging file is then deleted.
   - Write `status='completed'`, `audio_path`, `audio_duration`, `audio_bytes`, and
     the updated `chapters_json` (now with `start_time`s). If the document was
     deleted mid-conversion, the just-uploaded blob is removed instead of being
     orphaned forever.
   - On failure: `status='error'` and the message persisted to `documents.error`.

**Progress.** `GET /api/status/{doc_id}` returns
`{status, progress, current_chapter, total_chapters, error, queue_ahead}`.
`queue_ahead` is how many of *your own* jobs are ahead of this one. Live progress
comes from the in-memory `conversion_progress` dict; when that entry is gone
(restart, or pruned after 6 hours) the endpoint falls back to the DB row **including
the stored error message**, so an errored document still explains itself.

**Restart behaviour.** On startup, any row left `converting` or `queued` is reset to
`error` with the message *"Interrupted by a server restart — press Convert to
retry."* Because content is rebuilt from the DB, pressing Convert actually works.

---

## 7. Voices and voice preview

`GET /api/voices` returns the active provider's voice list. With the default
`edge` provider that's **19 named neural voices** across six accents:

| Accent | Voices |
|---|---|
| US (10) | Matthew, Joanna, Ruth, Stephen, Danielle, Gregory, Ava, Andrew, Emma, Roger |
| UK (3) | Amy, Brian, Libby |
| Australia (2) | Natasha, William |
| Canada (1) | Clara |
| Ireland (1) | Emily |
| India (2) | Neerja, Prabhat |

Friendly names map to Microsoft voice ids (e.g. `Joanna` → `en-US-JennyNeural`).

**Provider selection** (`app/tts/provider.py`): `TTS_PROVIDER` is `edge` (default),
`openai`, or `polly`. `edge` is the default precisely because it needs no
credentials and has a keyless fallback.

**Synthesis pipeline** (`app/tts/edge.py`): text is split into ≤5,000-character
chunks on sentence boundaries; each chunk is synthesized with up to **4 attempts**
and exponential backoff, streaming to disk. When `FORCE_EDGE_TTS=true`, edge-tts
(Microsoft neural) is tried first with a per-chunk timeout (`EDGE_CHUNK_TIMEOUT`,
default 90s), falling back to **gTTS** (Google Translate TTS — free, no key, but
voice-agnostic). A chunk that fails every attempt now **raises** rather than being
silently dropped: an honest error beats an audiobook with missing paragraphs.

> **Note:** gTTS ignores the voice selection. If `FORCE_EDGE_TTS` is not `true`,
> every voice produces the same gTTS narration.

**Preview** — `GET /api/voices/preview/{voice_id}?text=`. Streams a short sample
through the **same provider and fallback chain** as real conversions (so what you
preview is what you get), is rate-limited, and 404s on a voice the active provider
doesn't offer.

---

## 8. Playback: the web player

`/(app)/player/[docId]` + `components/AudioPlayer.tsx`. A native `<audio>` element
streaming from `GET /api/download/{docId}`, so range requests and instant seeking
work without downloading the whole file.

| Feature | How it works |
|---|---|
| Play/pause, ±30s skip | skip clamps against the element's live `duration` |
| Speed | 0.5×–3×, persisted in `playback_speed`; also applied to previews; responds to a `speed-change` event from the command palette |
| Volume + mute | persisted in `playback_volume` |
| Scrubbing | click/drag with a hover time tooltip |
| Chapter navigation | jumps to each chapter's exact `start_time`; falls back to a word-count estimate for older documents |
| A–B loop | set points A and B and the segment repeats |
| Sleep timer | fades out and pauses after a chosen interval |
| Bookmarks | timestamped, per document |
| Media Session | lock-screen / headphone controls with metadata, play/pause and ±30s seek |
| Keyboard | `Space` play/pause, `←`/`→` skip, `↑`/`↓` volume, `M` mute |
| Download | `?download=1` serves the MP3 as an attachment |
| Error state | a failed audio load shows a visible message with Retry (rather than a silently dead play button) |

**Position sync.** `GET /api/playback/{docId}/position` on load;
`PUT /api/playback/{docId}/position` every ~5 seconds while playing, on
`visibilitychange`, and on unload (via `fetch(..., {keepalive: true})` — `sendBeacon`
can't issue PUT). Stored server-side in `playback_positions` keyed by
`(user_id, document_id)`, so resume works across devices. A `?t=` timestamp in a
shared link takes precedence over the saved position.

**Multi-part books.** The player recognises `part_group`/`part_index` siblings, shows
a part navigator, and can autoplay into the next part when it exists. The library
list is refreshed on window focus and before each autoplay decision, so a part that
finishes converting while you listen becomes navigable without a reload.

**Not-yet-converted documents.** Opening a document that isn't `completed` shows its
real state, polls `/api/status` every few seconds, offers **Convert now** / **Retry
conversion**, and opens the player automatically once it completes.

A persistent **Now Playing** bar (`NowPlaying.tsx`) follows you across pages while
audio is active and clears when the player unmounts. `FloatingUpload` lifts itself
above the bar so it never sits underneath it.

---

## 9. Reader view and study tools

`ReaderView.tsx` shows the same text that is being narrated, and everything in this
section is **browser-local** (`localStorage`) — none of it is sent to the backend.

| Tool | Storage key | Behaviour |
|---|---|---|
| Reader | — | chapter text with the current chapter highlighted; optional auto-scroll (honours the `auto_scroll` setting); dyslexia-friendly font option; cross-chapter search |
| Play from here | — | select text → jump playback to that point |
| Highlights | `highlights_${docId}` | select text → **Highlight**; panel lists them; changes broadcast via a `highlights-changed` event |
| Notes | `notes_${docId}` | free-text notes per document, auto-saved |
| Flashcards | `flashcards_${docId}` | question/answer cards with a review flow |
| Bookmarks | `bookmarks_${docId}` | timestamped positions |
| Study timer | — | Pomodoro-style focus timer |

**Implication of local storage:** these travel with the *browser*, not the restore
key. Restoring a library on a new device brings back the audiobooks and playback
positions, but not the notes, flashcards, highlights or bookmarks.

---

## 10. The library

`/(app)/library` — `GET /api/library` (parts ordered by `part_group`/`part_index`),
`GET /api/library/{id}`, `DELETE /api/library/{id}` (also deletes the audio blob),
`DELETE /api/library` (clear all).

- **Grid and list views.** Both show format, word count, duration and status. Status
  labels are explicit: **Queued**, **Converting**, **Completed**, **Failed** —
  queued documents show as queued rather than as failures.
- **Collections** (`book2audio_collections`) — user-created groupings; stale document
  ids are pruned automatically after documents load.
- **Favourites** (`favorites`) and **manual ordering** (`doc_order`, drag to
  reorder) — both browser-local.
- **Filters**: by file type (PDF / EPUB / DOCX / TXT / Web article → `html`) and by
  status (In Progress covers `queued` + `converting`, plus Completed and Failed).
- **Sorting**: newest, title, and **recently played** (backed by a `last_played`
  timestamp the player records).
- **Queue awareness**: a count of your converting/queued jobs.
- **Error recovery**: failed documents expose **Retry** in both views, linking to
  `/convert?doc={id}`.
- **Honest failure states**: a backend outage shows "couldn't reach the server" with
  a Retry button, not an empty library.

---

## 11. Export and download

- **One book** — `GET /api/download/{id}?download=1` → the MP3 as an attachment.
- **Whole library** — `GET /api/export` → a single `.zip`, one MP3 per completed
  book named by title (illegal characters stripped, duplicate titles de-duplicated as
  `Title (2).mp3`). Built with `ZIP_STORED` (MP3 is already compressed, so deflate
  would burn CPU for nothing) and streamed chunk-by-chunk through a temp file that is
  cleaned up afterwards, so it stays inside free-tier RAM even at the storage quota.
  An empty library returns a clear 400 that the UI surfaces.

Export is also the escape hatch in the **quota flow**: hit the storage cap → export
to keep everything → clear the library → keep converting.

---

## 12. Private podcast feed

Listen in Overcast / Apple Podcasts / Pocket Casts without any app-specific work.

- Each session gets a random `users.feed_token`, minted on demand with a guarded
  `UPDATE ... WHERE feed_token IS NULL` (so concurrent requests can't hand out two
  different tokens).
- `GET /api/session/feed` returns this session's feed URL (shown in Settings).
- `GET /api/feed/{token}.xml` serves **RSS 2.0** listing every completed audiobook —
  the token *is* the authentication, because podcast apps send no cookies. XML is
  escaped, durations formatted, and `pubDate` falls back gracefully.
- `GET /api/feed/{token}/audio/{doc_id}.mp3` **302-redirects to a freshly minted
  audio URL on every request**, so a feed cached by a podcast app never goes stale
  when presigned URLs expire.
- Absolute links use `PUBLIC_API_URL` when set, otherwise the request host.

---

## 13. Mobile app

`mobile/` — Expo 57 / React Native 0.86 with React Navigation, talking to the same
API. Four screens: **Library**, **Upload**, **Player**, **Settings**.

- **Auth:** stores the session token from `X-Session-Token` in `expo-secure-store`
  and sends `Authorization: Bearer` on every request (including audio streaming);
  captures the token even from error responses. Restore keys are normalised before
  sending.
- **Upload → convert:** picks a document, uploads (300s timeout — parsing large PDFs
  takes a while), then polls status. It reads `part_ids` from the convert response
  and only reports "ready" once **every** part has completed, showing
  "Converting part X of N". Transient poll failures are tolerated (three consecutive
  misses before giving up), and polling stops on unmount.
- **Player:** streams `GET /api/download/{id}` with the Bearer header, tracks the
  current chapter, seeks by chapter, and syncs playback position with the backend
  (resume works across web and mobile). Audio unloads when you leave the screen, and
  the Android hardware back button returns to the library.
- **Library:** only completed documents open the player; `error`/`uploaded` rows offer
  **Convert**, converting rows report their state. Fetch failures show a retry, not a
  fake empty library.
- **Config:** `EXPO_PUBLIC_API_URL` selects the backend; the app logs which base URL
  it is using and warns loudly when it falls back to production.

---

## 14. PWA / install

The web app is installable. `frontend/public/manifest.json` plus the Next.js metadata
API (`appleWebApp`, `icons`, `viewport.themeColor`) provide editorial-themed icons
(192/512, maskable, apple-touch, favicon) and `start_url: "/"`.
`components/home/GetTheApp.tsx` renders a QR code of `window.location.origin` at
runtime (the `qrcode` package is imported dynamically to keep it off the main
bundle), with iOS and Android install steps; Android gets a real
`beforeinstallprompt` button, iOS gets a dismissable add-to-home-screen hint
(`b2a_a2hs_dismissed`).

> The Docker image must copy `public/` into the standalone output or the manifest and
> icons 404 — this is wired in `frontend/Dockerfile`.

---

## 15. Storage architecture

Everything is env-driven and storage-agnostic; with nothing configured the whole app
runs on local SQLite plus local files.

### Metadata — `app/database.py`

- **Default:** SQLite (WAL mode) at `DATABASE_PATH` (default
  `./data/book2audio.db`).
- **Production:** set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` for hosted
  libSQL (Turso). A shim (`_LibsqlConnection` / `_LibsqlCursor` / `_LibsqlRow`) makes
  the libSQL client behave like `sqlite3` — row access by name, `dict(row)`,
  iteration, `executescript` — so the raw-SQL call sites work unchanged. It also
  heals Turso "stream not found" errors by transparently reopening the connection
  once.
- `get_db()` is a context manager: commit on success, rollback on error, always
  close. `init_db()` creates tables and runs **idempotent** `ALTER TABLE`
  migrations (`restore_key_hash`, `last_active_at`, `feed_token`, `audio_bytes`,
  `part_group`, `part_index`, `error`).

### Audio blobs — `app/storage.py`

- **Default:** local files — `AUDIO_OUTPUT_DIR`, else `/app/output` under Docker,
  else `./output`.
- **Cloud:** set `AUDIO_BUCKET` + `AUDIO_S3_*` for **Backblaze B2** or
  **Cloudflare R2** via the S3 API (boto3).
- API: `save_audio`, `exists`, `open_stream`, `delete_audio`, `local_path`,
  `presigned_url()` (24h direct URL for streaming/seek), `public_url()` (Cloudflare
  CDN URL when `AUDIO_PUBLIC_BASE_URL` is set → $0 egress).
- `_safe_doc_id()` validates the id is a UUID before it is used in a path or key.
- Playback prefers CDN → presigned → proxied stream; downloads use a presigned URL so
  the attachment filename survives.

### Browser / device

`localStorage` holds preferences and study data: `playback_speed`,
`playback_volume`, `default_voice`, `auto_scroll`, `autoplay_next`, `doc_order`,
`favorites`, `book2audio_collections`, `last_played`, `b2a_a2hs_dismissed`, plus
per-document `notes_*`, `flashcards_*`, `bookmarks_*`, `highlights_*`. Mobile keeps
the session token in `expo-secure-store`.

### Where each kind of state lives

| State | Location | Survives redeploy? | Survives new device? |
|---|---|---|---|
| Documents, chapters, status | DB (SQLite or Turso) | Turso only | yes (with restore key) |
| Audio MP3s | local disk or B2/R2 | bucket only | yes |
| Playback positions | DB | Turso only | yes |
| Restore key hash | DB | Turso only | — |
| Conversion progress + queue | process memory | **no** | — |
| Notes, flashcards, bookmarks, highlights, collections, favourites, order | browser `localStorage` | yes | **no** |

---

## 16. Data model

**users** — `id`, `email` (placeholder `guest:<uuid>`), `password_hash`, `name`,
`avatar_url`, `auth_provider` (default `guest`), `google_id`, `restore_key_hash`
(UNIQUE), `last_active_at`, `feed_token` (UNIQUE), `created_at`, `updated_at`.
*(`password_hash`, `name`, `avatar_url`, `google_id` are inert remnants of the
removed account system.)*

**documents** — `id`, `user_id` (→ users, ON DELETE CASCADE), `filename`, `title`,
`file_size`, `format`, `chapters_json`, `total_word_count`, `status`, `voice`,
`audio_path`, `audio_duration`, `audio_bytes`, `part_group`, `part_index`, `error`,
`created_at`, `converted_at`. Indexed on `user_id`.

**playback_positions** — `(user_id, document_id)` primary key, `position` (seconds),
`updated_at`.

`chapters_json` is a JSON array of `{title, word_count, text}`, gaining
`start_time` (seconds) once converted.

---

## 17. Limits, quotas, and rate limits

All configured in `app/limits.py`, all overridable by env var.

| Limit | Env var | Default | Effect when hit |
|---|---|---|---|
| Upload size | `MAX_UPLOAD_MB` | 25 MB | 413 `{code: "file_too_large", message}` |
| Stored audio per session | `USER_QUOTA_MB` | 500 MB | 413 `quota_exceeded` → export & clear flow |
| Uploads per hour per IP | `RATE_LIMIT_UPLOADS_PER_HOUR` | 30 | 429 with `Retry-After` |
| Conversions per hour per IP | `RATE_LIMIT_CONVERSIONS_PER_HOUR` | 10 | 429 with `Retry-After` |
| Auto-split threshold | `MAX_CONVERT_WORDS` | 20,000 words | document splits into parts |
| Global parallel conversions | `MAX_CONCURRENT_CONVERSIONS` | 2 | extra jobs wait |
| Chapters synthesized in parallel | `TTS_CONCURRENCY` | 4 | — |
| Per-chunk TTS timeout | `EDGE_CHUNK_TIMEOUT` | 90s | retry, then gTTS fallback |
| Idle session lifetime | `SESSION_TTL_DAYS` | 30 days | session + audio deleted (0 disables) |

A multi-part book counts as **one** conversion against the hourly limit — parts are
queued from a single convert call.

`app/ratelimit.py` is an in-memory sliding-window limiter keyed by client IP; it
fails open on error and is single-instance only (fine for one uvicorn worker, which
is also required by the in-memory progress dict).

Two error-body shapes exist and clients handle both: structured
`{"detail": {"code", "message", ...}}` for size/quota errors, and a plain string
`detail` for others.

---

## 18. Third-party APIs used

| Service | Used for | Env var(s) | Required? |
|---|---|---|---|
| **edge-tts** (Microsoft neural voices) | primary speech synthesis | `TTS_PROVIDER=edge`, `FORCE_EDGE_TTS=true` | no key needed |
| **gTTS** (Google Translate TTS) | keyless fallback synthesis | — | automatic |
| **OpenAI TTS** | optional paid voices | `OPENAI_API_KEY`, `OPENAI_TTS_MODEL` | optional |
| **AWS Polly** | optional paid voices | AWS credentials | optional |
| **Google AI Studio (Gemini)** | LLM summaries / intro | `GEMINI_API_KEY`, `GEMINI_MODEL` | optional |
| **OpenRouter** | second LLM summariser | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | optional |
| **OCR.Space** | OCR for scanned PDFs | `OCR_SPACE_API_KEY` | optional |
| **Firecrawl** | fetch JS/bot-protected pages | `FIRECRAWL_API_KEY` | optional |
| **Turso (libSQL)** | persistent metadata DB | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | recommended in prod |
| **Backblaze B2 / Cloudflare R2** | audio blob storage (S3 API) | `AUDIO_BUCKET`, `AUDIO_S3_*` | recommended in prod |
| **Cloudflare CDN** | $0-egress audio delivery | `AUDIO_PUBLIC_BASE_URL` | optional |
| **Sentry** | error monitoring | `SENTRY_DSN` | optional |
| **healthchecks.io** | dead-man's-switch ping after daily cleanup | `HEALTHCHECK_URL` | optional |
| **Umami** | privacy-friendly analytics | `NEXT_PUBLIC_UMAMI_ID`, `NEXT_PUBLIC_UMAMI_SRC` | optional |
| **Vercel Web Analytics** | frontend analytics | — (Vercel) | optional |

Every optional integration degrades gracefully: no key means the feature falls back
(extractive summaries, gTTS voices, direct page fetch) rather than failing.
Full variable reference and per-service wiring steps are in
[`DOCUMENTATION.md`](./DOCUMENTATION.md) §7–8 and
[`DEPLOYMENT_PERSISTENCE.md`](./DEPLOYMENT_PERSISTENCE.md).

---

## 19. Complete endpoint reference

Auth column: **write** = mints a guest session if needed (`get_session`);
**read** = never mints (`optional_session`); **token** = feed token; **—** = none.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/upload` | write | Upload a PDF/EPUB/DOCX/TXT file |
| POST | `/api/upload-url` | write | Fetch and parse a URL (Firecrawl fallback) |
| POST | `/api/upload-text` | write | Pasted text |
| POST | `/api/convert/{doc_id}` | write | Start conversion (`voice`, `audio_type`, `intro`); splits + queues |
| GET | `/api/status/{doc_id}` | read | `{status, progress, current_chapter, total_chapters, error, queue_ahead}` |
| GET | `/api/download/{doc_id}` | read | Stream inline; `?download=1` for an attachment |
| GET | `/api/export` | read | Whole library as one `.zip` |
| GET | `/api/voices` | — | Active provider's voice list |
| GET | `/api/voices/preview/{voice_id}` | — | Short sample (`?text=`), rate-limited |
| GET | `/api/library` | read | List documents (parts ordered) |
| GET | `/api/library/{doc_id}` | read | One document incl. chapters |
| DELETE | `/api/library/{doc_id}` | read | Delete document + audio blob |
| DELETE | `/api/library` | read | Clear the whole library |
| GET | `/api/playback/{doc_id}/position` | read | Saved position |
| PUT | `/api/playback/{doc_id}/position` | read | Save position |
| GET | `/api/session` | read | Session state + document count |
| POST | `/api/session/restore` | — | Restore from a pasted key |
| POST | `/api/session/signout` | — | Detach this device |
| GET | `/api/session/feed` | read | This session's podcast feed URL |
| GET | `/api/feed/{token}.xml` | token | RSS 2.0 feed |
| GET | `/api/feed/{token}/audio/{doc_id}.mp3` | token | 302 to a fresh audio URL |
| GET | `/api/health` | — | `{status, has_gtts, use_edge, queue: {converting, queued}}` |

Ownership is enforced with a `user_id` predicate on every document-scoped query, so
one session can never read or delete another's documents.

---

## 20. Failure modes and recovery

| Situation | What happens | Recovery |
|---|---|---|
| Backend restarts mid-conversion | Row reset to `error` with "Interrupted by a server restart — press Convert to retry." | Press **Convert** — content is rebuilt from `chapters_json` |
| In-memory progress lost | `/api/status` falls back to the DB row and its stored error | Automatic |
| edge-tts unreachable | 4 attempts with backoff, then gTTS (voice-agnostic) | Automatic |
| A chunk fails every attempt | Conversion fails with an explicit error | Retry; no silent audio gaps |
| LLM key missing / provider errors | Extractive summary used instead | Automatic |
| Scanned PDF with no text layer | OCR.Space when configured, else a clear error | Set `OCR_SPACE_API_KEY` |
| URL blocked / JS-rendered | Firecrawl when configured, else a clear error | Set `FIRECRAWL_API_KEY` |
| Storage quota reached | 413 `quota_exceeded` | Export the library, then clear it |
| Rate limit reached | 429 with `Retry-After` | Wait, or raise the env limit |
| Document deleted mid-conversion | Uploaded blob is deleted rather than orphaned | Automatic |
| Free-tier deploy with no Turso/B2 | Ephemeral disk is wiped: libraries and restore keys are lost | Set `TURSO_*` and `AUDIO_BUCKET`/`AUDIO_S3_*` |

**Known constraints.** The in-memory queue and progress dict mean the backend must
run a **single uvicorn worker** (all deploy configs do). Render's free tier sleeps
after ~15 minutes idle (~30–50s cold start; a keep-alive ping to `/api/health`
avoids it) and has no persistent disk. Conversions are network-bound on edge-tts, not
CPU-bound. Study data (notes, flashcards, highlights, bookmarks) lives in the browser
and does not travel with a restore key.
