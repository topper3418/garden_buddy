"""Pydantic models for plants."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from pydantic import Field

from src.models.common import ListResponse
from src.models.plant_type import PlantType
from src.models.species import Species


class PlantCreate(BaseModel):
    """Input schema for creating a plant.

    Attributes:
        name: Display name of the plant.
        notes: Markdown-formatted notes. Newlines and formatting are preserved
            as-is; no processing is applied at the model layer.
        species_id: Optional FK reference to a species record.
        plant_type_ids: IDs of plant types to associate via the join table.
    """

    name: str
    notes: Optional[str] = None
    species_id: Optional[int] = None
    plant_type_ids: list[int] = Field(default_factory=list)


class Plant(PlantCreate):
    """Full plant record, including resolved relationships.

    Inherits ``name``, ``notes``, ``species_id``, and ``plant_type_ids`` from
    ``PlantCreate`` and adds the auto-assigned fields and resolved objects.

    Attributes:
        id: Auto-assigned primary key.
        species: Resolved species object, if set.
        plant_types: List of resolved plant type objects assigned to this plant.
        created_at: ISO-8601 UTC timestamp of insertion.
    """

    id: int
    species: Optional[Species] = None
    plant_types: list[PlantType] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class PlantListItem(BaseModel):
    """Lightweight plant representation for list endpoints."""

    id: int
    name: str
    species_id: int | None = None


class PlantListResponse(ListResponse[PlantListItem]):
    """List envelope for plant list endpoints."""
