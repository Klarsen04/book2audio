import os
import sqlite3
from contextlib import contextmanager

DATABASE_PATH = os.environ.get("DATABASE_PATH", "./data/book2audio.db")


def get_connection() -> sqlite3.Connection:
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
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                name TEXT,
                avatar_url TEXT,
                auth_provider TEXT NOT NULL DEFAULT 'email',
                google_id TEXT UNIQUE,
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
