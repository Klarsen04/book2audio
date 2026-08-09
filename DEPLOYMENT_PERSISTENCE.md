# No-login sessions + persistent storage

This app has **no accounts**. A visitor starts using it immediately; on their first
upload the backend mints a **restore key** (e.g. `PAGE-7F3K-9Q2M-XR4T`) that is
their identity. Pasting that key later re-attaches them to the same library
(documents, chapters, playback positions). "Sign out" just detaches the device —
the library is untouched and can be restored again with the key.

For the restore key to actually bring data back **after a redeploy**, the data must
live off Render's ephemeral free-tier disk. The code is already storage-agnostic:
it runs on local SQLite + local files today, and switches to the cloud below purely
by setting environment variables — no code changes.

## What persists where

| Data | Local (dev / no env) | Production (env set) |
|------|----------------------|----------------------|
| Metadata (docs, chapters, positions, keys) | SQLite file `./data/book2audio.db` | **Turso** (hosted libSQL) |
| Audio MP3s | `./output/*.mp3` | **Backblaze B2** or **Cloudflare R2** (S3 API) |

Until you set the env vars, everything works locally exactly as before — the cloud
is opt-in.

## 1. Turso (persistent database) — free, no card

1. Create an account at https://turso.tech and install the CLI, or use the web UI.
2. Create a database, then grab its URL and an auth token:
   ```
   turso db create book2audio
   turso db show book2audio --url        # -> libsql://book2audio-<org>.turso.io
   turso db tokens create book2audio     # -> a long token
   ```
3. Set on the Render service:
   ```
   TURSO_DATABASE_URL = libsql://book2audio-<org>.turso.io
   TURSO_AUTH_TOKEN   = <token>
   ```
The schema auto-creates on startup (`init_db()` runs against Turso the same way it
does against SQLite). The Python client `libsql-experimental` is already in
`requirements.txt` and is only imported when `TURSO_DATABASE_URL` is set.

## 2. Object storage for audio — free, no card (Backblaze B2)

1. Create an account at https://www.backblaze.com/cloud-storage, make a **private**
   bucket (e.g. `book2audio-audio`).
2. Create an **application key** scoped to that bucket → note the keyID + key.
3. Find your S3 endpoint in the bucket details (e.g. `s3.us-west-004.backblazeb2.com`).
4. Set on Render:
   ```
   AUDIO_BUCKET        = book2audio-audio
   AUDIO_S3_ENDPOINT   = https://s3.us-west-004.backblazeb2.com
   AUDIO_S3_KEY_ID     = <keyID>
   AUDIO_S3_SECRET_KEY = <applicationKey>
   AUDIO_S3_REGION     = us-west-004        # optional; "auto" works for most
   ```

### Cloudflare R2 instead (10 GB free, needs a card)
Same variables, but:
```
AUDIO_S3_ENDPOINT = https://<accountid>.r2.cloudflarestorage.com
AUDIO_S3_REGION   = auto
```
R2 has no egress fees; B2 has a small egress cost but needs no card. Either works —
the code uses boto3's S3 client for both (no new dependency).

## Environment variable reference

| Variable | Purpose | Unset behavior |
|----------|---------|----------------|
| `TURSO_DATABASE_URL` | libSQL URL → use Turso for the DB | local SQLite file |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |
| `AUDIO_BUCKET` | bucket name → store audio in cloud | local `./output` |
| `AUDIO_S3_ENDPOINT` | S3-compatible endpoint (B2/R2) | — |
| `AUDIO_S3_KEY_ID` / `AUDIO_S3_SECRET_KEY` | credentials | — |
| `AUDIO_S3_REGION` | region (default `auto`) | `auto` |
| `JWT_SECRET` | signs the session cookie (keep stable across deploys!) | dev default |

> **Important:** set a fixed `JWT_SECRET` in production. If it rotates on each
> deploy, existing session **cookies** are invalidated (users just re-paste their
> restore key — the key itself keeps working since it's hashed in the DB).

## Export / download (works regardless of storage backend)

- **Per book:** download button on each completed library card / the player → the
  book's MP3.
- **Whole library:** the **Export** button → a `book2audio-library.b2a` file (a zip
  of all MP3s + a `manifest.json`) the user can keep offline.
- **Restore key:** copyable in the nav and in the save-your-key banner.
