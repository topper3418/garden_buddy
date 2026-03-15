"""Service-layer operations for media metadata."""

from pathlib import Path

from src.db.media import (
    delete_media_by_filename,
    delete_media_by_id as db_delete_media_by_id,
    get_media_by_filename as db_get_media_by_filename,
    get_media_by_id as db_get_media_by_id,
    insert_media,
    list_media as db_list_media,
    query_media as db_query_media,
    update_media as db_update_media,
)
from src.models.media import Media, MediaCreate, MediaListItem, MediaListResponse
from src.services.common import ensure_tables, normalize_pagination
from src.settings import settings

_UNSET = object()


def _to_media_model(row: dict, include_file_path: bool = False) -> Media:
    payload = dict(row)
    payload["file_path"] = _build_file_path(payload["filename"]) if include_file_path else None
    return Media.model_validate(payload)


def _build_file_path(filename: str) -> str:
    return str(Path(settings.media_path) / filename)


def list_media(
    limit: int = 50,
    offset: int = 0,
    *,
    include_file_path: bool = False,
) -> MediaListResponse:
    """Return lightweight media records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_media(limit, offset)
    items = [
        MediaListItem.model_validate(
            {
                **row,
                "file_path": _build_file_path(row["filename"]) if include_file_path else None,
            }
        )
        for row in rows
    ]
    return MediaListResponse(items=items, limit=limit, offset=offset)


def query_media(
    name_contains: str | None = None,
    title_contains: str | None = None,
    mime_type: str | None = None,
    plant_id: int | None = None,
    species_ids: list[int] | None = None,
    tag_id: int | None = None,
    min_size: int | None = None,
    max_size: int | None = None,
    limit: int = 50,
    offset: int = 0,
    *,
    include_file_path: bool = False,
) -> list[Media]:
    """Return media with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_media(
        name_contains=name_contains,
        title_contains=title_contains,
        mime_type=mime_type,
        plant_id=plant_id,
        species_ids=species_ids,
        tag_id=tag_id,
        min_size=min_size,
        max_size=max_size,
        limit=limit,
        offset=offset,
    )
    return [_to_media_model(r, include_file_path=include_file_path) for r in rows]


def get_media_by_id(media_id: int, *, include_file_path: bool = False) -> Media | None:
    """Return a media record by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_media_by_id(media_id)
    return _to_media_model(row, include_file_path=include_file_path) if row else None


def get_media_by_filename(filename: str, *, include_file_path: bool = False) -> Media | None:
    """Return a media record by filename, or ``None`` if not found."""
    ensure_tables()
    row = db_get_media_by_filename(filename)
    return _to_media_model(row, include_file_path=include_file_path) if row else None


def create_media(payload: MediaCreate) -> Media:
    """Create and return a media metadata record."""
    ensure_tables()
    media_id = insert_media(
        filename=payload.filename,
        mime_type=payload.mime_type,
        size=payload.size,
        title=payload.title,
        plant_id=payload.plant_id,
        tag_id=payload.tag_id,
    )
    media = get_media_by_id(media_id)
    if not media:
        raise ValueError("Created media could not be retrieved.")
    return media


def update_media(
    media_id: int,
    *,
    title: str | None | object = _UNSET,
    mime_type: str | None | object = _UNSET,
    size: int | None | object = _UNSET,
    plant_id: int | None | object = _UNSET,
    tag_id: int | None | object = _UNSET,
) -> Media | None:
    """Update mutable metadata fields and return updated media."""
    ensure_tables()
    db_kwargs: dict = {}
    if title is not _UNSET:
        db_kwargs["title"] = title
    if mime_type is not _UNSET:
        db_kwargs["mime_type"] = mime_type
    if size is not _UNSET:
        db_kwargs["size"] = size
    if plant_id is not _UNSET:
        db_kwargs["plant_id"] = plant_id
    if tag_id is not _UNSET:
        db_kwargs["tag_id"] = tag_id

    updated = db_update_media(
        media_id,
        **db_kwargs,
    )
    if not updated:
        return None
    return get_media_by_id(media_id)


def delete_media_by_id(media_id: int) -> bool:
    """Delete a media record by id."""
    ensure_tables()
    return db_delete_media_by_id(media_id)


def delete_media_by_filename_key(filename: str) -> bool:
    """Delete a media record by filename."""
    ensure_tables()
    return delete_media_by_filename(filename)
