"""Plant database helpers.

Manages the ``plants`` table and the ``plant_plant_types`` many-to-many join
table that links plants to their associated plant types.

Notes field stores Markdown text; newlines and formatting are preserved as-is
since SQLite TEXT columns store arbitrary Unicode without modification.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from typing import cast

from src.db.connection import get_db_connection


def init_plant_tables() -> None:
    """Create the plants and plant_plant_types tables if they don't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plants (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                notes      TEXT,
                species_id INTEGER REFERENCES species(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plant_plant_types (
                plant_id      INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
                plant_type_id INTEGER NOT NULL REFERENCES plant_types(id) ON DELETE CASCADE,
                PRIMARY KEY (plant_id, plant_type_id)
            )
            """
        )
        conn.commit()


def insert_plant(
    name: str,
    notes: Optional[str] = None,
    species_id: Optional[int] = None,
) -> int:
    """Insert a new plant record and return its row id.

    Args:
        name: Display name of the plant.
        notes: Optional Markdown-formatted notes. Newlines are preserved.
        species_id: Optional FK to the species table.

    Returns:
        The row id of the newly inserted plant.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO plants (name, notes, species_id, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (name, notes, species_id, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_plant_by_id(plant_id: int) -> Optional[dict]:
    """Retrieve a plant record by id.

    Args:
        plant_id: Primary key of the plant row.

    Returns:
        A dict of column values, or ``None`` if not found.
    """
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM plants WHERE id = ?", (plant_id,)
        ).fetchone()
        return dict(row) if row else None


def get_plant_types_for_plant(plant_id: int) -> list[dict]:
    """Return all plant types assigned to a given plant.

    Args:
        plant_id: The plant to look up types for.

    Returns:
        A list of plant_type dicts joined from the plant_types table.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT pt.* FROM plant_types pt
            JOIN plant_plant_types ppt ON ppt.plant_type_id = pt.id
            WHERE ppt.plant_id = ?
            ORDER BY pt.name
            """,
            (plant_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_plants(limit: int, offset: int) -> list[dict]:
    """Return lightweight plant rows for list views."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, species_id
            FROM plants
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_plants(
    name_contains: str | None,
    species_id: int | None,
    plant_type_id: int | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return plant rows with optional filters and pagination."""
    joins = ""
    clauses: list[str] = []
    params: list[Any] = []

    if plant_type_id is not None:
        joins += " INNER JOIN plant_plant_types ppt ON ppt.plant_id = p.id"
        clauses.append("ppt.plant_type_id = ?")
        params.append(plant_type_id)

    if name_contains:
        clauses.append("p.name LIKE ?")
        params.append(f"%{name_contains}%")

    if species_id is not None:
        clauses.append("p.species_id = ?")
        params.append(species_id)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

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
    plant_type_ids: list[int] | object,
    unset_sentinel: object,
) -> bool:
    """Update mutable plant fields and optionally replace type links."""
    current = get_plant_by_id(plant_id)
    if current is None:
        return False

    resolved_species_id = (
        current["species_id"] if species_id is unset_sentinel else species_id
    )

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE plants
            SET name = ?, notes = ?, species_id = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current["name"],
                notes if notes is not None else current["notes"],
                resolved_species_id,
                plant_id,
            ),
        )

        if plant_type_ids is not unset_sentinel:
            resolved_plant_type_ids = cast(list[int], plant_type_ids)
            conn.execute("DELETE FROM plant_plant_types WHERE plant_id = ?", (plant_id,))
            for plant_type_id in resolved_plant_type_ids:
                conn.execute(
                    "INSERT OR IGNORE INTO plant_plant_types (plant_id, plant_type_id) VALUES (?, ?)",
                    (plant_id, plant_type_id),
                )

        conn.commit()
        return True


def add_plant_type_to_plant(plant_id: int, plant_type_id: int) -> None:
    """Associate a plant type with a plant (insert into the join table).

    Silently no-ops if the association already exists.

    Args:
        plant_id: The plant to update.
        plant_type_id: The plant type to attach.
    """
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO plant_plant_types (plant_id, plant_type_id)
            VALUES (?, ?)
            """,
            (plant_id, plant_type_id),
        )
        conn.commit()


def remove_plant_type_from_plant(plant_id: int, plant_type_id: int) -> bool:
    """Remove a plant type association from a plant.

    Args:
        plant_id: The plant to update.
        plant_type_id: The plant type to detach.

    Returns:
        ``True`` if the association was removed, ``False`` if it didn't exist.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            DELETE FROM plant_plant_types
            WHERE plant_id = ? AND plant_type_id = ?
            """,
            (plant_id, plant_type_id),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_plant(plant_id: int) -> bool:
    """Delete a plant and all its plant type associations.

    The ``plant_plant_types`` join rows are removed automatically via
    ``ON DELETE CASCADE`` (foreign keys are enforced per-connection in
    ``connection.py``).

    Args:
        plant_id: Primary key of the plant to delete.

    Returns:
        ``True`` if deleted, ``False`` if not found.
    """
    with get_db_connection() as conn:
        cur = conn.execute("DELETE FROM plants WHERE id = ?", (plant_id,))
        conn.commit()
        return cur.rowcount > 0
