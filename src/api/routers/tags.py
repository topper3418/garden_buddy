"""Tag API routes."""

from fastapi import APIRouter, HTTPException, Query, status

from src.api.schemas import TagUpdate
from src.models.tag import Tag, TagCreate, TagListResponse
from src.services.tag_service import (
    create_tag,
    delete_tag_by_id,
    get_tag_by_id,
    list_tags,
    query_tags,
    update_tag,
)

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=TagListResponse)
def list_tags_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> TagListResponse:
    return list_tags(limit=limit, offset=offset)


@router.get("/query", response_model=list[Tag])
def query_tags_endpoint(
    name_contains: str | None = None,
    notes_contains: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[Tag]:
    return query_tags(
        name_contains=name_contains,
        notes_contains=notes_contains,
        limit=limit,
        offset=offset,
    )


@router.get("/{tag_id}", response_model=Tag)
def get_tag_endpoint(tag_id: int) -> Tag:
    record = get_tag_by_id(tag_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return record


@router.post("", response_model=Tag, status_code=status.HTTP_201_CREATED)
def create_tag_endpoint(payload: TagCreate) -> Tag:
    return create_tag(payload)


@router.patch("/{tag_id}", response_model=Tag)
def update_tag_endpoint(tag_id: int, payload: TagUpdate) -> Tag:
    kwargs: dict = {}
    if "name" in payload.model_fields_set:
        kwargs["name"] = payload.name
    if "notes" in payload.model_fields_set:
        kwargs["notes"] = payload.notes
    if "main_media_id" in payload.model_fields_set:
        kwargs["main_media_id"] = payload.main_media_id

    updated = update_tag(tag_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return updated


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag_endpoint(tag_id: int) -> None:
    deleted = delete_tag_by_id(tag_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
