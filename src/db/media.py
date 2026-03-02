"""Media metadata database helpers."""

from datetime import datetime, timezone
from typing import Any, Optional

from src.db.connection import get_db_connection


def init_media_table():
    """Create the media table if it doesn't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                title TEXT,
                mime_type TEXT,
                size INTEGER,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_media(filename: str, mime_type: str, size: int, title: Optional[str] = None) -> int:
    """Insert a new media record and return its row id."""
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO media (filename, title, mime_type, size, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (filename, title, mime_type, size, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        if not cur.lastrowid:
            raise ValueError("Failed to insert media record.")
        return cur.lastrowid


def get_media_by_filename(filename: str) -> Optional[dict]:
    """Retrieve a media record by filename."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM media WHERE filename = ?",
            (filename,)
        ).fetchone()
        return dict(row) if row else None


def get_media_by_id(media_id: int) -> Optional[dict]:
    """Retrieve a media record by id."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM media WHERE id = ?", (media_id,)).fetchone()
        return dict(row) if row else None


def list_media(limit: int, offset: int) -> list[dict]:
    """Return lightweight media records for list views."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, filename, title, mime_type
            FROM media
            ORDER BY uploaded_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_media(
    title_contains: str | None,
    mime_type: str | None,
    min_size: int | None,
    max_size: int | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return media rows with optional filters and pagination."""
    clauses: list[str] = []
    params: list[Any] = []

    if title_contains:
        clauses.append("title LIKE ?")
        params.append(f"%{title_contains}%")
    if mime_type:
        clauses.append("mime_type = ?")
        params.append(mime_type)
    if min_size is not None:
        clauses.append("size >= ?")
        params.append(min_size)
    if max_size is not None:
        clauses.append("size <= ?")
        params.append(max_size)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM media
            {where_sql}
            ORDER BY uploaded_at DESC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_media(
    media_id: int,
    *,
    title: str | None,
    mime_type: str | None,
    size: int | None,
) -> bool:
    """Update mutable media fields by id."""
    current = get_media_by_id(media_id)
    if current is None:
        return False

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE media
            SET title = ?, mime_type = ?, size = ?
            WHERE id = ?
            """,
            (
                title if title is not None else current["title"],
                mime_type if mime_type is not None else current["mime_type"],
                size if size is not None else current["size"],
                media_id,
            ),
        )
        conn.commit()
        return True


def delete_media_by_id(media_id: int) -> bool:
    """Delete a media record by id. Returns True if deleted."""
    with get_db_connection() as conn:
        cur = conn.execute("DELETE FROM media WHERE id = ?", (media_id,))
        conn.commit()
        return cur.rowcount > 0


def delete_media_by_filename(filename: str) -> bool:
    """Delete a media record by filename. Returns True if deleted."""
    with get_db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM media WHERE filename = ?",
            (filename,)
        )
        conn.commit()
        return cur.rowcount > 0
