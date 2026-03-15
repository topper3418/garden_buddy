"""Pydantic models for tags."""

from datetime import datetime

from pydantic import BaseModel

from src.models.common import ListResponse


class TagCreate(BaseModel):
    """Input schema for creating a tag.

    Attributes:
        name: Unique label for the tag (e.g. ``"perennial"``, ``"edible"``).
        notes: Optional markdown notes text.
        main_media_id: Optional media id used as the tag thumbnail photo.
    """

    name: str
    notes: str | None = None
    main_media_id: int | None = None


class Tag(TagCreate):
    """Full tag record as stored in the database.

    Attributes:
        id: Auto-assigned primary key.
        created_at: ISO-8601 UTC timestamp of insertion.
    """

    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TagListItem(BaseModel):
    """Lightweight plant-type representation for list endpoints."""

    id: int
    name: str
    main_media_id: int | None = None


class TagListResponse(ListResponse[TagListItem]):
    """List envelope for tag list endpoints."""
