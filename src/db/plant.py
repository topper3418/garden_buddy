"""Plant database helpers.

Manages the ``plants`` table and the ``plant_tags`` many-to-many join table
that links plants to their associated tags.
"""

from datetime import datetime, timezone
from typing import Any, Optional, cast

from src.db.connection import get_db_connection


def init_plant_tables() -> None:
    """Create the plants and plant_tags tables if they don't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                notes TEXT,
                species_id INTEGER REFERENCES species(id) ON DELETE SET NULL,
                main_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                deleted_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plant_tags (
                plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (plant_id, tag_id)
            )
            """
        )
        conn.commit()


def insert_plant(
    name: str,
    notes: Optional[str] = None,
    species_id: Optional[int] = None,
    main_media_id: Optional[int] = None,
) -> int:
    """Insert a new plant record and return its row id."""
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO plants (name, notes, species_id, main_media_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, notes, species_id, main_media_id, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_plant_by_id(plant_id: int, *, include_deleted: bool = False) -> Optional[dict]:
    """Retrieve a plant record by id."""
    with get_db_connection() as conn:
        if include_deleted:
            row = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM plants WHERE id = ? AND deleted_at IS NULL",
                (plant_id,),
            ).fetchone()
        return dict(row) if row else None


def get_tags_for_plant(plant_id: int) -> list[dict]:
    """Return all tags assigned to a given plant."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT t.* FROM tags t
            JOIN plant_tags pt ON pt.tag_id = t.id
            WHERE pt.plant_id = ?
            ORDER BY t.name
            """,
            (plant_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_plants(limit: int, offset: int, archived: bool = False) -> list[dict]:
    """Return lightweight plant rows for list views."""
    archived_clause = "deleted_at IS NOT NULL" if archived else "deleted_at IS NULL"
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, species_id, main_media_id
            FROM plants
            WHERE {archived_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """.format(archived_clause=archived_clause),
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_plants(
    name_contains: str | None,
    species_ids: list[int] | None,
    tag_id: int | None,
    archived: bool,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return plant rows with optional filters and pagination."""
    joins = ""
    clauses: list[str] = []
    params: list[Any] = []

    if tag_id is not None:
        joins += " INNER JOIN plant_tags pt ON pt.plant_id = p.id"
        clauses.append("pt.tag_id = ?")
        params.append(tag_id)

    if name_contains:
        clauses.append("p.name LIKE ?")
        params.append(f"%{name_contains}%")

    if species_ids:
        placeholders = ", ".join("?" for _ in species_ids)
        clauses.append(f"p.species_id IN ({placeholders})")
        params.extend(species_ids)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    deleted_clause = "p.deleted_at IS NOT NULL" if archived else "p.deleted_at IS NULL"
    where_sql = f"{where_sql} AND {deleted_clause}" if where_sql else f"WHERE {deleted_clause}"

    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT p.*
            FROM plants p
            {joins}
            {where_sql}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_plant(
    plant_id: int,
    *,
    name: str | None,
    notes: str | None,
    species_id: int | None | object,
    tag_ids: list[int] | object,
    main_media_id: int | None | object,
    unset_sentinel: object,
) -> bool:
    """Update mutable plant fields and optionally replace tag links."""
    current = get_plant_by_id(plant_id)
    if current is None:
        return False

    resolved_species_id = current["species_id"] if species_id is unset_sentinel else species_id
    resolved_main_media_id = current["main_media_id"] if main_media_id is unset_sentinel else main_media_id

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE plants
            SET name = ?, notes = ?, species_id = ?, main_media_id = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current["name"],
                notes if notes is not None else current["notes"],
                resolved_species_id,
                resolved_main_media_id,
                plant_id,
            ),
        )

        if tag_ids is not unset_sentinel:
            resolved_tag_ids = cast(list[int], tag_ids)
            conn.execute("DELETE FROM plant_tags WHERE plant_id = ?", (plant_id,))
            for tag_value in resolved_tag_ids:
                conn.execute(
                    "INSERT OR IGNORE INTO plant_tags (plant_id, tag_id) VALUES (?, ?)",
                    (plant_id, tag_value),
                )

        conn.commit()
        return True


def add_tag_to_plant(plant_id: int, tag_id: int) -> None:
    """Associate a tag with a plant."""
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO plant_tags (plant_id, tag_id)
            VALUES (?, ?)
            """,
            (plant_id, tag_id),
        )
        conn.commit()


def remove_tag_from_plant(plant_id: int, tag_id: int) -> bool:
    """Remove a tag association from a plant."""
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            DELETE FROM plant_tags
            WHERE plant_id = ? AND tag_id = ?
            """,
            (plant_id, tag_id),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_plant(plant_id: int) -> bool:
    """Soft-delete a plant by setting ``deleted_at``."""
    with get_db_connection() as conn:
        cur = conn.execute(
            "UPDATE plants SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
            (datetime.now(timezone.utc).isoformat(), plant_id),
        )
        conn.commit()
        return cur.rowcount > 0
