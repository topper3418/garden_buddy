"""Shared SQLite connection helper for all db modules."""

import sqlite3
from pathlib import Path

from src.settings import settings


def _get_db_path() -> Path:
    return settings.database_path


def get_db_connection() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory set to sqlite3.Row.

    The database file is read from ``settings.database_path``.  The parent
    directory is created automatically if it does not yet exist.

    Returns:
        An open ``sqlite3.Connection`` instance.
    """
    db_path = _get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
