"""Common service-layer utilities."""

from src.db import init_all_tables

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def normalize_pagination(limit: int = DEFAULT_LIMIT, offset: int = 0) -> tuple[int, int]:
    """Return safe pagination values.

    Args:
        limit: Requested page size.
        offset: Requested starting offset.

    Returns:
        Tuple of ``(limit, offset)`` clamped to safe bounds.
    """
    if limit <= 0:
        limit = DEFAULT_LIMIT
    if limit > MAX_LIMIT:
        limit = MAX_LIMIT
    if offset < 0:
        offset = 0
    return limit, offset


def ensure_tables() -> None:
    """Initialize all DB tables in dependency-safe order."""
    init_all_tables()
