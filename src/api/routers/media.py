"""Media API routes."""

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from src.api.schemas import MediaUpdate
from src.media.image import delete_image, retrieve_image, save_image
from src.models.media import Media, MediaCreate, MediaListResponse
from src.services.media_service import (
    create_media,
    delete_media_by_filename_key,
    delete_media_by_id,
    get_media_by_id,
    list_media,
    query_media,
    update_media,
)
from src.services.plant_service import get_plant_by_id as get_plant_record_by_id
from src.services.species_service import get_species_by_id as get_species_record_by_id
from src.services.tag_service import get_tag_by_id as get_tag_record_by_id
from src.settings import settings

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=MediaListResponse)
def list_media_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    include_file_path: bool = False,
) -> MediaListResponse:
    return list_media(limit=limit, offset=offset, include_file_path=include_file_path)


@router.get("/query", response_model=list[Media])
def query_media_endpoint(
    name_contains: str | None = None,
    title_contains: str | None = None,
    mime_type: str | None = None,
    plant_id: int | None = None,
    species_ids: list[int] | None = Query(default=None),
    tag_id: int | None = None,
    min_size: int | None = Query(default=None, ge=0),
    max_size: int | None = Query(default=None, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    include_file_path: bool = False,
) -> list[Media]:
    return query_media(
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
        include_file_path=include_file_path,
    )


@router.get("/{media_id}", response_model=Media)
def get_media_endpoint(media_id: int, include_file_path: bool = False) -> Media:
    record = get_media_by_id(media_id, include_file_path=include_file_path)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return record


@router.get("/{media_id}/file", response_class=FileResponse)
def get_media_file_endpoint(media_id: int) -> FileResponse:
    record = get_media_by_id(media_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return retrieve_image(record.filename)


@router.post("", response_model=Media, status_code=status.HTTP_201_CREATED)
async def upload_media_endpoint(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    plant_id: int | None = Form(default=None),
    tag_id: int | None = Form(default=None),
    species_id: int | None = Form(default=None),
) -> Media:
    if plant_id is not None and not get_plant_record_by_id(plant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    if tag_id is not None and not get_tag_record_by_id(tag_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    if species_id is not None and not get_species_record_by_id(species_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")

    unique_filename = await save_image(file)
    file_path = Path(settings.media_path) / unique_filename

    payload = MediaCreate(
        filename=unique_filename,
        title=title,
        mime_type=file.content_type or "application/octet-stream",
        size=file_path.stat().st_size,
        plant_id=plant_id,
        tag_id=tag_id,
        species_id=species_id,
    )
    return create_media(payload)


@router.patch("/{media_id}", response_model=Media)
def update_media_endpoint(media_id: int, payload: MediaUpdate) -> Media:
    kwargs: dict = {}
    if "title" in payload.model_fields_set:
        kwargs["title"] = payload.title
    if "mime_type" in payload.model_fields_set:
        kwargs["mime_type"] = payload.mime_type
    if "size" in payload.model_fields_set:
        kwargs["size"] = payload.size
    if "plant_id" in payload.model_fields_set:
        kwargs["plant_id"] = payload.plant_id
    if "tag_id" in payload.model_fields_set:
        kwargs["tag_id"] = payload.tag_id
    if "species_id" in payload.model_fields_set:
        kwargs["species_id"] = payload.species_id

    if "plant_id" in kwargs and kwargs["plant_id"] is not None and not get_plant_record_by_id(kwargs["plant_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    if "tag_id" in kwargs and kwargs["tag_id"] is not None and not get_tag_record_by_id(kwargs["tag_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    if "species_id" in kwargs and kwargs["species_id"] is not None and not get_species_record_by_id(kwargs["species_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")

    updated = update_media(media_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return updated


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media_endpoint(media_id: int) -> None:
    record = get_media_by_id(media_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    delete_image(record.filename)
    deleted = delete_media_by_id(media_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")


@router.delete("/by-filename/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media_by_filename_endpoint(filename: str) -> None:
    delete_image(filename)
    deleted = delete_media_by_filename_key(filename)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
