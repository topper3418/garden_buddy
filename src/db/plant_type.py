"""Plant type lookup-table helpers.

Plant types are simple, distinct labels (e.g. "annual", "perennial",
"succulent") that can be applied to many plants via the join table managed in
``src/db/plant.py``.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from src.db.connection import get_db_connection


def init_plant_types_table() -> None:
    """Create the plant_types table if it doesn't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plant_types (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                notes      TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_plant_type(name: str, notes: Optional[str] = None) -> int:
    """Insert a new plant type and return its row id.

    Args:
        name: Unique label for the plant type.
        notes: Optional markdown notes text.

    Returns:
        The row id of the newly inserted plant type.

    Raises:
        sqlite3.IntegrityError: If a plant type with the same name already exists.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            "INSERT INTO plant_types (name, notes, created_at) VALUES (?, ?, ?)",
            (name, notes, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_plant_type_by_id(plant_type_id: int) -> Optional[dict]:
    """Retrieve a plant type by id.

    Args:
        plant_type_id: Primary key of the plant type row.

    Returns:
        A dict of column values, or ``None`` if not found.
    """
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM plant_types WHERE id = ?", (plant_type_id,)
        ).fetchone()
        return dict(row) if row else None


def get_all_plant_types() -> list[dict]:
    """Return all plant type records ordered by name.

    Returns:
        A list of plant type dicts.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM plant_types ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]


def list_plant_types(limit: int, offset: int) -> list[dict]:
    """Return lightweight plant type rows for list views."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name
            FROM plant_types
            ORDER BY name
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_plant_types(
    name_contains: str | None,
    notes_contains: str | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return plant type rows with optional filters and pagination."""
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
            FROM plant_types
            {where_sql}
            ORDER BY name
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_plant_type(
    plant_type_id: int,
    *,
    name: str | None,
    notes: str | None,
) -> bool:
    """Update mutable plant type fields by id."""
    current = get_plant_type_by_id(plant_type_id)
    if current is None:
        return False

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE plant_types
            SET name = ?, notes = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current["name"],
                notes if notes is not None else current["notes"],
                plant_type_id,
            ),
        )
        conn.commit()
        return True


def delete_plant_type(plant_type_id: int) -> bool:
    """Delete a plant type by id.

    Args:
        plant_type_id: Primary key of the plant type to delete.

    Returns:
        ``True`` if deleted, ``False`` if not found.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            "DELETE FROM plant_types WHERE id = ?", (plant_type_id,)
        )
        conn.commit()
        return cur.rowcount > 0
