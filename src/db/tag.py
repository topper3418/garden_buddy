"""Tag lookup-table helpers.

Tags are simple, distinct labels (e.g. "annual", "edible", "drought
tolerant") that can be applied to many plants via the join table managed in
``src/db/plant.py``.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from src.db.connection import get_db_connection


def init_tags_table() -> None:
    """Create the tags table if it doesn't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tags (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL UNIQUE,
                notes         TEXT,
                main_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
                created_at    TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_tag(
    name: str,
    notes: Optional[str] = None,
    main_media_id: Optional[int] = None,
) -> int:
    """Insert a new tag and return its row id.

    Args:
        name: Unique label for the tag.
        notes: Optional markdown notes text.
        main_media_id: Optional FK to the media table for thumbnail use.

    Returns:
        The row id of the newly inserted tag.

    Raises:
        sqlite3.IntegrityError: If a tag with the same name already exists.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            "INSERT INTO tags (name, notes, main_media_id, created_at) VALUES (?, ?, ?, ?)",
            (name, notes, main_media_id, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_tag_by_id(tag_id: int) -> Optional[dict]:
    """Retrieve a tag by id.

    Args:
        tag_id: Primary key of the tag row.

    Returns:
        A dict of column values, or ``None`` if not found.
    """
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tags WHERE id = ?", (tag_id,)
        ).fetchone()
        return dict(row) if row else None


def get_all_tags() -> list[dict]:
    """Return all tag records ordered by name.

    Returns:
        A list of tag dicts.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM tags ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]


def list_tags(limit: int, offset: int) -> list[dict]:
    """Return lightweight tag rows for list views."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, main_media_id
            FROM tags
            ORDER BY name
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_tags(
    name_contains: str | None,
    notes_contains: str | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return tag rows with optional filters and pagination."""
    clauses: list[str] = []
    params: list[Any] = []

    if name_contains:
        clauses.append("name LIKE ?")
        params.append(f"%{name_contains}%")
    if notes_contains:
        clauses.append("notes LIKE ?")
        params.append(f"%{notes_contains}%")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM tags
            {where_sql}
            ORDER BY name
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_tag(
    tag_id: int,
    *,
    name: str | None,
    notes: str | None,
    main_media_id: int | None | object,
    unset_sentinel: object,
) -> bool:
    """Update mutable tag fields by id."""
    current = get_tag_by_id(tag_id)
    if current is None:
        return False

    resolved_main_media_id = (
        current["main_media_id"]
        if main_media_id is unset_sentinel
        else main_media_id
    )

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE tags
            SET name = ?, notes = ?, main_media_id = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current["name"],
                notes if notes is not None else current["notes"],
                resolved_main_media_id,
                tag_id,
            ),
        )
        conn.commit()
        return True


def delete_tag(tag_id: int) -> bool:
    """Delete a tag by id.

    Args:
        tag_id: Primary key of the tag to delete.

    Returns:
        ``True`` if deleted, ``False`` if not found.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM tags WHERE id = ?", (tag_id,)
        )
        conn.commit()
        return cur.rowcount > 0
