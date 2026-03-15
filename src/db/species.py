"""Species database helpers.

Supports a self-referential parent/subspecies relationship: a species row with
a non-NULL ``parent_species_id`` is considered a subspecies of that parent.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from src.db.connection import get_db_connection


def init_species_table() -> None:
    """Create the species table if it doesn't exist."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS species (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                name              TEXT NOT NULL,
                common_name       TEXT,
                notes             TEXT,
                parent_species_id INTEGER REFERENCES species(id) ON DELETE SET NULL,
                main_media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
                created_at        TEXT NOT NULL
            )
            """
        )
        # Migrate: add main_media_id column if it doesn't exist yet
        existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(species)").fetchall()}
        if "main_media_id" not in existing_cols:
            conn.execute(
                "ALTER TABLE species ADD COLUMN main_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL"
            )
        conn.commit()


def insert_species(
    name: str,
    common_name: Optional[str] = None,
    notes: Optional[str] = None,
    parent_species_id: Optional[int] = None,
    main_media_id: Optional[int] = None,
) -> int:
    """Insert a new species (or subspecies) record.

    Args:
        name: Scientific name of the species.
        common_name: Optional human-readable name.
        notes: Optional markdown notes text.
        parent_species_id: ID of the parent species if this is a subspecies.
        main_media_id: Optional media id used as the species thumbnail photo.

    Returns:
        The row id of the newly inserted species.
    """
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO species (name, common_name, notes, parent_species_id, main_media_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, common_name, notes, parent_species_id, main_media_id, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_species_by_id(species_id: int) -> Optional[dict]:
    """Retrieve a species record by id.

    Args:
        species_id: Primary key of the species row.

    Returns:
        A dict of column values, or ``None`` if not found.
    """
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT
                s.*,
                (
                    SELECT COUNT(*)
                    FROM plants p
                    WHERE p.species_id = s.id AND p.deleted_at IS NULL
                ) AS plant_count
            FROM species s
            WHERE s.id = ?
            """,
            (species_id,),
        ).fetchone()
        return dict(row) if row else None


def get_subspecies(parent_species_id: int) -> list[dict]:
    """Return all direct subspecies for a given parent species.

    Args:
        parent_species_id: The id of the parent species row.

    Returns:
        A list of species dicts whose ``parent_species_id`` matches.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                s.*,
                (
                    SELECT COUNT(*)
                    FROM plants p
                    WHERE p.species_id = s.id AND p.deleted_at IS NULL
                ) AS plant_count
            FROM species s
            WHERE s.parent_species_id = ?
            """,
            (parent_species_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_species(limit: int, offset: int) -> list[dict]:
    """Return lightweight species rows for list views."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                s.id,
                s.name,
                s.common_name,
                s.main_media_id,
                (
                    SELECT COUNT(*)
                    FROM plants p
                    WHERE p.species_id = s.id AND p.deleted_at IS NULL
                ) AS plant_count
            FROM species s
            ORDER BY s.name
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def query_species(
    name_contains: str | None,
    common_name_contains: str | None,
    parent_species_id: int | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Return species rows with optional filters and pagination."""
    clauses: list[str] = []
    params: list[Any] = []

    if name_contains:
        clauses.append("s.name LIKE ?")
        params.append(f"%{name_contains}%")
    if common_name_contains:
        clauses.append("s.common_name LIKE ?")
        params.append(f"%{common_name_contains}%")
    if parent_species_id is not None:
        clauses.append("s.parent_species_id = ?")
        params.append(parent_species_id)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                s.*,
                (
                    SELECT COUNT(*)
                    FROM plants p
                    WHERE p.species_id = s.id AND p.deleted_at IS NULL
                ) AS plant_count
            FROM species s
            {where_sql}
            ORDER BY s.name
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def update_species(
    species_id: int,
    *,
    name: str | None,
    common_name: str | None,
    notes: str | None,
    parent_species_id: int | None | object,
    main_media_id: int | None | object,
    unset_sentinel: object,
) -> bool:
    """Update mutable species fields by id."""
    current = get_species_by_id(species_id)
    if current is None:
        return False

    resolved_parent_species_id = (
        current["parent_species_id"]
        if parent_species_id is unset_sentinel
        else parent_species_id
    )

    resolved_main_media_id = (
        current.get("main_media_id")
        if main_media_id is unset_sentinel
        else main_media_id
    )

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE species
            SET name = ?, common_name = ?, notes = ?, parent_species_id = ?, main_media_id = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current["name"],
                common_name if common_name is not None else current["common_name"],
                notes if notes is not None else current["notes"],
                resolved_parent_species_id,
                resolved_main_media_id,
                species_id,
            ),
        )
        conn.commit()
        return True


def delete_species(species_id: int) -> bool:
    """Delete a species record by id.

    Raises ``ValueError`` if the species has any direct subspecies, to prevent
    orphaning child records.  Reassign or delete subspecies first.

    Args:
        species_id: Primary key of the species to delete.

    Returns:
        ``True`` if a row was deleted, ``False`` if not found.

    Raises:
        ValueError: If the species still has existing subspecies.
    """
    with get_db_connection() as conn:
        subspecies_count = conn.execute(
            "SELECT COUNT(*) FROM species WHERE parent_species_id = ?",
            (species_id,),
        ).fetchone()[0]
        if subspecies_count > 0:
            raise ValueError(
                f"Cannot delete species {species_id}: it has {subspecies_count} "
                "subspecies. Reassign or delete them first."
            )
        cur = conn.execute("DELETE FROM species WHERE id = ?", (species_id,))
        conn.commit()
        return cur.rowcount > 0
