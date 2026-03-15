"""Service-layer operations for tags."""

from src.db.tag import (
    delete_tag,
    get_tag_by_id as db_get_tag_by_id,
    insert_tag,
    list_tags as db_list_tags,
    query_tags as db_query_tags,
    update_tag as db_update_tag,
)
from src.models.tag import (
    Tag,
    TagCreate,
    TagListItem,
    TagListResponse,
)
from src.services.common import ensure_tables, normalize_pagination

_UNSET = object()


def _to_tag_model(row: dict) -> Tag:
    return Tag.model_validate(row)


def list_tags(limit: int = 50, offset: int = 0) -> TagListResponse:
    """Return lightweight tag records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_tags(limit, offset)
    items = [TagListItem.model_validate(row) for row in rows]
    return TagListResponse(items=items, limit=limit, offset=offset)


def query_tags(
    name_contains: str | None = None,
    notes_contains: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Tag]:
    """Return tags with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_tags(
        name_contains=name_contains,
        notes_contains=notes_contains,
        limit=limit,
        offset=offset,
    )
    return [_to_tag_model(r) for r in rows]


def get_tag_by_id(tag_id: int) -> Tag | None:
    """Return a tag by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_tag_by_id(tag_id)
    return _to_tag_model(row) if row else None


def create_tag(payload: TagCreate) -> Tag:
    """Create and return a tag record."""
    ensure_tables()
    tag_id = insert_tag(
        name=payload.name,
        notes=payload.notes,
        main_media_id=payload.main_media_id,
    )
    tag = get_tag_by_id(tag_id)
    if not tag:
        raise ValueError("Created tag could not be retrieved.")
    return tag


def update_tag(
    tag_id: int,
    *,
    name: str | None = None,
    notes: str | None = None,
    main_media_id: int | None | object = _UNSET,
) -> Tag | None:
    """Update mutable fields and return updated tag."""
    ensure_tables()
    updated = db_update_tag(
        tag_id,
        name=name,
        notes=notes,
        main_media_id=main_media_id,
        unset_sentinel=_UNSET,
    )
    if not updated:
        return None
    return get_tag_by_id(tag_id)


def delete_tag_by_id(tag_id: int) -> bool:
    """Delete a tag by id."""
    ensure_tables()
    return delete_tag(tag_id)
