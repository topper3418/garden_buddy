"""Pydantic models for plants."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from pydantic import Field

from src.models.common import ListResponse
from src.models.tag import Tag
from src.models.species import Species


class PlantCreate(BaseModel):
    """Input schema for creating a plant.

    Attributes:
        name: Display name of the plant.
        notes: Markdown-formatted notes. Newlines and formatting are preserved
            as-is; no processing is applied at the model layer.
        species_id: Optional FK reference to a species record.
        tag_ids: IDs of tags to associate via the join table.
        main_media_id: Optional media id used as the plant thumbnail photo.
    """

    name: str
    notes: Optional[str] = None
    species_id: Optional[int] = None
    tag_ids: list[int] = Field(default_factory=list)
    main_media_id: int | None = None


class Plant(PlantCreate):
    """Full plant record, including resolved relationships.

    Inherits ``name``, ``notes``, ``species_id``, and ``tag_ids`` from
    ``PlantCreate`` and adds the auto-assigned fields and resolved objects.

    Attributes:
        id: Auto-assigned primary key.
        species: Resolved species object, if set.
        tags: List of resolved tag objects assigned to this plant.
        created_at: ISO-8601 UTC timestamp of insertion.
    """

    id: int
    species: Optional[Species] = None
    tags: list[Tag] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class PlantListItem(BaseModel):
    """Lightweight plant representation for list endpoints."""

    id: int
    name: str
    species_id: int | None = None
    main_media_id: int | None = None


class PlantListResponse(ListResponse[PlantListItem]):
    """List envelope for plant list endpoints."""
