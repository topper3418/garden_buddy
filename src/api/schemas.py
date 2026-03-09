"""API request schemas for partial updates and query endpoints."""

from pydantic import BaseModel, Field


class SpeciesUpdate(BaseModel):
    name: str | None = None
    common_name: str | None = None
    notes: str | None = None
    parent_species_id: int | None = None


class PlantTypeUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None


class PlantUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    species_id: int | None = None
    plant_type_ids: list[int] | None = None


class MediaUpdate(BaseModel):
    title: str | None = None
    mime_type: str | None = None
    size: int | None = Field(default=None, ge=0)
    plant_id: int | None = None
