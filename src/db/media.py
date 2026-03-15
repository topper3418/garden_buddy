"""Media metadata database helpers."""

from datetime import datetime, timezone
from typing import Any, Optional

from src.db.connection import get_db_connection

_UNSET = object()


def init_media_table() -> None:
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
                plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
                tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_media(
    filename: str,
    mime_type: str,
    size: int,
    title: Optional[str] = None,
    plant_id: int | None = None,
    tag_id: int | None = None,
) -> int:
    """Insert a new media record and return its row id."""
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO media (filename, title, mime_type, size, plant_id, tag_id, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                filename,
                title,
                mime_type,
                size,
                plant_id,
                tag_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        if not cur.lastrowid:
            raise ValueError("Failed to insert media record.")
        return cur.lastrowid


def get_media_by_filename(filename: str) -> Optional[dict]:
    """Retrieve a media record by filename."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM media WHERE filename = ?", (filename,)).fetchone()
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
            SELECT id, filename, title, mime_type, plant_id, tag_id
            FROM media
            ORDER BY uploaded_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_media(
    name_contains: str | None,
    title_contains: str | None,
    mime_type: str | None,
    plant_id: int | None,
    species_ids: list[int] | None,
    tag_id: int | None,
    min_size: int | None,
    max_size: int | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return media rows with optional filters and pagination."""
    joins: list[str] = []
    clauses: list[str] = []
    params: list[Any] = []

    needs_plant_join = bool(name_contains or species_ids)
    if needs_plant_join:
        joins.append("INNER JOIN plants p ON p.id = m.plant_id")
        clauses.append("p.deleted_at IS NULL")

    if name_contains:
        clauses.append("p.name LIKE ?")
        params.append(f"%{name_contains}%")

    if species_ids:
        placeholders = ", ".join("?" for _ in species_ids)
        clauses.append(f"p.species_id IN ({placeholders})")
        params.extend(species_ids)

    if title_contains:
        clauses.append("m.title LIKE ?")
        params.append(f"%{title_contains}%")

    if mime_type:
        clauses.append("m.mime_type = ?")
        params.append(mime_type)

    if plant_id is not None:
        clauses.append("m.plant_id = ?")
        params.append(plant_id)

    if tag_id is not None:
        clauses.append(
            """
            (
                m.tag_id = ?
                OR EXISTS (
                    SELECT 1
                    FROM plants p2
                    JOIN plant_tags pt ON pt.plant_id = p2.id
                    WHERE p2.id = m.plant_id
                      AND p2.deleted_at IS NULL
                      AND pt.tag_id = ?
                )
            )
            """
        )
        params.extend([tag_id, tag_id])

    if min_size is not None:
        clauses.append("m.size >= ?")
        params.append(min_size)

    if max_size is not None:
        clauses.append("m.size <= ?")
        params.append(max_size)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    join_sql = "\n".join(joins)

    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT m.*
            FROM media m
            {join_sql}
            {where_sql}
            ORDER BY m.uploaded_at DESC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_media(
    media_id: int,
    *,
    title: str | None | object = _UNSET,
    mime_type: str | None | object = _UNSET,
    size: int | None | object = _UNSET,
    plant_id: int | None | object = _UNSET,
    tag_id: int | None | object = _UNSET,
) -> bool:
    """Update mutable media fields by id."""
    current = get_media_by_id(media_id)
    if current is None:
        return False

    next_title = current["title"] if title is _UNSET else title
    next_mime_type = current["mime_type"] if mime_type is _UNSET else mime_type
    next_size = current["size"] if size is _UNSET else size
    next_plant_id = current.get("plant_id") if plant_id is _UNSET else plant_id
    next_tag_id = current.get("tag_id") if tag_id is _UNSET else tag_id

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE media
            SET title = ?, mime_type = ?, size = ?, plant_id = ?, tag_id = ?
            WHERE id = ?
            """,
            (
                next_title,
                next_mime_type,
                next_size,
                next_plant_id,
                next_tag_id,
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
        cur = conn.execute("DELETE FROM media WHERE filename = ?", (filename,))
        conn.commit()
        return cur.rowcount > 0
