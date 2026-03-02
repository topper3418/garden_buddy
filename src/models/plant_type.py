"""Pydantic models for plant types."""

from datetime import datetime

from pydantic import BaseModel

from src.models.common import ListResponse


class PlantTypeCreate(BaseModel):
    """Input schema for creating a plant type.

    Attributes:
        name: Unique label for the type (e.g. ``"perennial"``, ``"succulent"``).
        notes: Optional markdown notes text.
    """

    name: str
    notes: str | None = None


class PlantType(PlantTypeCreate):
    """Full plant type record as stored in the database.

    Attributes:
        id: Auto-assigned primary key.
        created_at: ISO-8601 UTC timestamp of insertion.
    """

    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlantTypeListItem(BaseModel):
    """Lightweight plant-type representation for list endpoints."""

    id: int
    name: str


class PlantTypeListResponse(ListResponse[PlantTypeListItem]):
    """List envelope for plant type list endpoints."""
