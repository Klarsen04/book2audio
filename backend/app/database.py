import os
import sqlite3
from contextlib import contextmanager

DATABASE_PATH = os.environ.get("DATABASE_PATH", "./data/book2audio.db")

# When TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN are set, the DB is a
# hosted libSQL (Turso) instance — persistent across free-tier redeploys. The
# libsql client mirrors the sqlite3 API (Row factory, execute, executescript),
# so the ~75 raw-SQL call sites keep working unchanged. Without them, we use a
# local sqlite3 file exactly as before.
TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
USE_TURSO = bool(TURSO_URL)


# --- libSQL (Turso) compatibility shim ---------------------------------------
# The installed libsql_experimental client does NOT support
# `connection.row_factory = sqlite3.Row`, and its cursors return plain tuples.
# The rest of the codebase accesses columns by name (`row["col"]`) and builds
# dicts (`dict(row)`), which only works with sqlite3.Row. These thin wrappers
# give the libSQL connection the same row-by-name behaviour, using the
# DB-API `cursor.description` for column names. The local sqlite3 path is
# unchanged (it uses the native sqlite3.Row).


class _LibsqlRow:
    """A tuple-backed row that indexes by column name OR position, and supports
    dict(row) / row.keys() like sqlite3.Row."""

    __slots__ = ("_cols", "_vals")

    def __init__(self, cols, vals):
        self._cols = cols
        self._vals = vals

    def keys(self):
        return list(self._cols)

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._vals[key]
        try:
            return self._vals[self._cols.index(key)]
        except ValueError:
            raise KeyError(key)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)

    def __repr__(self):
        return f"_LibsqlRow({dict(zip(self._cols, self._vals))!r})"


class _LibsqlCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def _cols(self):
        desc = self._cursor.description
        return [c[0] for c in desc] if desc else []

    def execute(self, *args, **kwargs):
        self._cursor.execute(*args, **kwargs)
        return self

    def executemany(self, *args, **kwargs):
        self._cursor.executemany(*args, **kwargs)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return None if row is None else _LibsqlRow(self._cols(), row)

    def fetchall(self):
        cols = self._cols()
        return [_LibsqlRow(cols, r) for r in self._cursor.fetchall()]

    def fetchmany(self, size=None):
        cols = self._cols()
        rows = self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()
        return [_LibsqlRow(cols, r) for r in rows]

    def __iter__(self):
        cols = self._cols()
        for r in self._cursor:
            yield _LibsqlRow(cols, r)

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description

    def close(self):
        return self._cursor.close()


# libSQL/Turso can invalidate a connection's underlying "stream" between calls
# (idle timeout, brief network blip). The next call then raises a Hrana error
# like `stream not found`. These are safe to retry once with a fresh underlying
# connection — the caller sees a clean call.
_STALE_STREAM_MARKERS = ("stream not found", "stream is closed", "stream expired")


def _is_stale_stream_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(m in msg for m in _STALE_STREAM_MARKERS)


def _reopen_libsql():
    import libsql_experimental as libsql
    fresh = libsql.connect(database=TURSO_URL, auth_token=TURSO_TOKEN)
    fresh.execute("PRAGMA foreign_keys=ON")
    return fresh


class _LibsqlConnection:
    """Wraps a libsql connection so it quacks like sqlite3 (row-by-name), and
    heals from Turso 'stream not found' errors with one silent re-open."""

    def __init__(self, conn):
        self._conn = conn
        # Accept assignment for API parity; the wrapper always yields _LibsqlRow.
        self.row_factory = None

    def _call(self, method_name, *args, **kwargs):
        try:
            return getattr(self._conn, method_name)(*args, **kwargs)
        except Exception as e:
            if not _is_stale_stream_error(e):
                raise
            # The underlying stream has been closed by the server — reconnect
            # once and retry. The retry only re-executes the current call, so
            # any prior in-flight transaction is lost (matches how the caller
            # would have observed the error anyway).
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = _reopen_libsql()
            return getattr(self._conn, method_name)(*args, **kwargs)

    def execute(self, *args, **kwargs):
        return _LibsqlCursor(self._call("execute", *args, **kwargs))

    def executemany(self, *args, **kwargs):
        return _LibsqlCursor(self._call("executemany", *args, **kwargs))

    def executescript(self, *args, **kwargs):
        self._call("executescript", *args, **kwargs)
        return self

    def cursor(self):
        return _LibsqlCursor(self._call("cursor"))

    def commit(self):
        return self._call("commit")

    def rollback(self):
        try:
            return self._conn.rollback()
        except Exception as e:
            if _is_stale_stream_error(e):
                # Nothing to roll back on a dead stream; treat as a no-op.
                return None
            raise

    def close(self):
        return self._conn.close()


def get_connection():
    if USE_TURSO:
        import libsql_experimental as libsql

        conn = _LibsqlConnection(libsql.connect(database=TURSO_URL, auth_token=TURSO_TOKEN))
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            # If rollback itself fails (e.g. the stream was closed under us),
            # don't let that mask the original exception.
            pass
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                name TEXT,
                avatar_url TEXT,
                auth_provider TEXT NOT NULL DEFAULT 'guest',
                google_id TEXT UNIQUE,
                restore_key_hash TEXT UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                title TEXT NOT NULL,
                file_size INTEGER,
                format TEXT NOT NULL,
                chapters_json TEXT NOT NULL,
                total_word_count INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploaded',
                voice TEXT,
                audio_path TEXT,
                audio_duration REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                converted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS playback_positions (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                position REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, document_id)
            );

            CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        """)

        # --- Lightweight migrations for pre-existing databases ---
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "restore_key_hash" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN restore_key_hash TEXT")
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_restore_key ON users(restore_key_hash)"
            )
        if "last_active_at" not in cols:
            # Tracks session activity for abandoned-session cleanup. Backfill to
            # now so existing sessions get a full grace window (not reaped at once).
            conn.execute("ALTER TABLE users ADD COLUMN last_active_at TEXT")
            conn.execute("UPDATE users SET last_active_at = datetime('now') WHERE last_active_at IS NULL")

        doc_cols = {r["name"] for r in conn.execute("PRAGMA table_info(documents)").fetchall()}
        if "audio_bytes" not in doc_cols:
            # Size of the stored audio, used for the per-session storage quota.
            conn.execute("ALTER TABLE documents ADD COLUMN audio_bytes INTEGER NOT NULL DEFAULT 0")
        if "part_group" not in doc_cols:
            # When a large book is auto-split, all its parts share a part_group
            # and carry a 1-based part_index so the library and player can order
            # and chain them (Part 1 → 2 → 3 …) regardless of created_at.
            conn.execute("ALTER TABLE documents ADD COLUMN part_group TEXT")
            conn.execute("ALTER TABLE documents ADD COLUMN part_index INTEGER")
