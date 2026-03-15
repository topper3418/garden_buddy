"""Pydantic models for species."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from src.models.common import ListResponse


class SpeciesCreate(BaseModel):
    """Input schema for creating a species record.

    Attributes:
        name: Scientific / Latin name of the species.
        common_name: Optional everyday name (e.g. ``"Rose"``).
        notes: Optional markdown notes text.
        parent_species_id: If set, this record represents a subspecies of the
            given parent species id.
        main_media_id: Optional media id used as the species thumbnail photo.
    """

    name: str
    common_name: Optional[str] = None
    notes: Optional[str] = None
    parent_species_id: Optional[int] = None
    main_media_id: int | None = None


class Species(SpeciesCreate):
    """Full species record as stored in the database.

    Attributes:
        id: Auto-assigned primary key.
        created_at: ISO-8601 UTC timestamp of insertion.
    """

    id: int
    created_at: datetime
    plant_count: int = 0

    model_config = {"from_attributes": True}


class SpeciesListItem(BaseModel):
    """Lightweight species representation for list endpoints."""

    id: int
    name: str
    common_name: str | None = None
    plant_count: int = 0
    main_media_id: int | None = None


class SpeciesListResponse(ListResponse[SpeciesListItem]):
    """List envelope for species list endpoints."""
