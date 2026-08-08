"""Database storage module using SQLite for authentication and shares."""

import sqlite3
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from fileforge.config import settings
from fileforge.security import hash_password, verify_password, generate_token


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or settings.db_path
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    created_at INTEGER,
                    expires_at INTEGER
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shares (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    password_hash TEXT,
                    salt_hex TEXT,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER,
                    hits INTEGER DEFAULT 0,
                    max_hits INTEGER
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS watch_progress (
                    path TEXT PRIMARY KEY,
                    position_seconds REAL NOT NULL,
                    duration_seconds REAL NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS watch_favorites (
                    path TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL
                )
            """)
            conn.commit()

    def set_config(self, key: str, value: str):
        with self.get_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value))
            conn.commit()

    def get_config(self, key: str) -> Optional[str]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT value FROM config WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else None

    # Auth Methods
    def set_admin_password(self, password: str):
        hash_hex, salt_hex = hash_password(password)
        self.set_config("admin_password_hash", hash_hex)
        self.set_config("admin_password_salt", salt_hex)
        self.set_config("auth_enabled", "true")

    def verify_admin_password(self, password: str) -> bool:
        hash_hex = self.get_config("admin_password_hash")
        salt_hex = self.get_config("admin_password_salt")
        if not hash_hex or not salt_hex:
            return False
        return verify_password(password, hash_hex, salt_hex)

    def is_auth_enabled(self) -> bool:
        return self.get_config("auth_enabled") == "true" or settings.auth_password is not None

    def create_session(self, expires_in_seconds: int = 86400 * 7) -> str:
        token = generate_token()
        now = int(time.time())
        expires_at = now + expires_in_seconds
        with self.get_connection() as conn:
            conn.execute(
                "INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)",
                (token, now, expires_at)
            )
            conn.commit()
        return token

    def validate_session(self, token: str) -> bool:
        if not token:
            return False
        now = int(time.time())
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT expires_at FROM sessions WHERE token = ?", (token,)
            ).fetchone()
            if not row:
                return False
            if row["expires_at"] and row["expires_at"] < now:
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                return False
            return True

    def delete_session(self, token: str):
        with self.get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()

    # Share Link Methods
    def create_share(
        self,
        path: str,
        password: Optional[str] = None,
        expires_in_seconds: Optional[int] = None,
        max_hits: Optional[int] = None
    ) -> Dict[str, Any]:
        share_id = generate_token()[:12]
        now = int(time.time())
        expires_at = now + expires_in_seconds if expires_in_seconds else None
        
        pwd_hash, salt_hex = None, None
        if password:
            pwd_hash, salt_hex = hash_password(password)

        with self.get_connection() as conn:
            conn.execute(
                """INSERT INTO shares (id, path, password_hash, salt_hex, created_at, expires_at, max_hits)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (share_id, path, pwd_hash, salt_hex, now, expires_at, max_hits)
            )
            conn.commit()

        return {
            "id": share_id,
            "path": path,
            "has_password": bool(password),
            "created_at": now,
            "expires_at": expires_at,
            "max_hits": max_hits,
            "hits": 0
        }

    def get_share(self, share_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM shares WHERE id = ?", (share_id,)).fetchone()
            if not row:
                return None
            
            d = dict(row)
            now = int(time.time())
            if d["expires_at"] and d["expires_at"] < now:
                return None
            if d["max_hits"] and d["hits"] >= d["max_hits"]:
                return None
            return d

    def increment_share_hits(self, share_id: str):
        with self.get_connection() as conn:
            conn.execute("UPDATE shares SET hits = hits + 1 WHERE id = ?", (share_id,))
            conn.commit()

    def list_shares(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM shares ORDER BY created_at DESC").fetchall()
            result = []
            for r in rows:
                d = dict(r)
                result.append({
                    "id": d["id"],
                    "path": d["path"],
                    "has_password": bool(d["password_hash"]),
                    "created_at": d["created_at"],
                    "expires_at": d["expires_at"],
                    "hits": d["hits"],
                    "max_hits": d["max_hits"]
                })
            return result

    def revoke_share(self, share_id: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM shares WHERE id = ?", (share_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Watch Progress & Favorites Methods
    def save_watch_progress(self, path: str, position_seconds: float, duration_seconds: float):
        now = int(time.time())
        with self.get_connection() as conn:
            conn.execute(
                """INSERT INTO watch_progress (path, position_seconds, duration_seconds, updated_at)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(path) DO UPDATE SET
                   position_seconds = excluded.position_seconds,
                   duration_seconds = excluded.duration_seconds,
                   updated_at = excluded.updated_at""",
                (path, float(position_seconds), float(duration_seconds), now)
            )
            conn.commit()

    def get_watch_progress(self, path: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM watch_progress WHERE path = ?", (path,)).fetchone()
            if not row:
                return None
            d = dict(row)
            percent = round((d["position_seconds"] / d["duration_seconds"]) * 100, 1) if d["duration_seconds"] > 0 else 0.0
            d["percent"] = min(100.0, max(0.0, percent))
            return d

    def list_watch_progress(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM watch_progress WHERE position_seconds > 3 ORDER BY updated_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            result = []
            for r in rows:
                d = dict(r)
                percent = round((d["position_seconds"] / d["duration_seconds"]) * 100, 1) if d["duration_seconds"] > 0 else 0.0
                d["percent"] = min(100.0, max(0.0, percent))
                if d["percent"] < 98.0:
                    result.append(d)
            return result

    def add_watch_favorite(self, path: str):
        now = int(time.time())
        with self.get_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO watch_favorites (path, created_at) VALUES (?, ?)", (path, now))
            conn.commit()

    def remove_watch_favorite(self, path: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.execute("DELETE FROM watch_favorites WHERE path = ?", (path,))
            conn.commit()
            return cursor.rowcount > 0

    def list_watch_favorites(self) -> List[str]:
        with self.get_connection() as conn:
            rows = conn.execute("SELECT path FROM watch_favorites ORDER BY created_at DESC").fetchall()
            return [r["path"] for r in rows]

    def is_watch_favorite(self, path: str) -> bool:
        with self.get_connection() as conn:
            row = conn.execute("SELECT path FROM watch_favorites WHERE path = ?", (path,)).fetchone()
            return bool(row)


db = Database()

