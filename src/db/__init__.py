"""Database package initialisation.

Tables are initialized explicitly via ``init_all_tables()``. Module imports do
not perform schema creation side effects.
"""

from src.db.media import init_media_table
from src.db.plant import init_plant_tables
from src.db.plant_type import init_plant_types_table
from src.db.species import init_species_table


def init_all_tables() -> None:
    """Create all database tables in dependency order.

    Safe to call multiple times; each underlying statement uses
    ``CREATE TABLE IF NOT EXISTS``.
    """
    init_species_table()
    init_plant_types_table()
    init_media_table()
    init_plant_tables()  # depends on species and plant_types
