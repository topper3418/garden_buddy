"""API request schemas for partial updates and AI endpoints."""

from pydantic import BaseModel, Field


class SpeciesUpdate(BaseModel):
    name: str | None = None
    common_name: str | None = None
    notes: str | None = None
    parent_species_id: int | None = None


class TagUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    main_media_id: int | None = None


class PlantUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    species_id: int | None = None
    tag_ids: list[int] | None = None
    main_media_id: int | None = None


class MediaUpdate(BaseModel):
    title: str | None = None
    mime_type: str | None = None
    size: int | None = Field(default=None, ge=0)
    plant_id: int | None = None
    tag_id: int | None = None


class SpeciesDraftRequest(BaseModel):
    official_name: str = Field(min_length=3, max_length=200)


class SpeciesDraftResponse(BaseModel):
    name: str
    common_name: str | None = None
    notes: str


class AIQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1200)


class AIQuestionResponse(BaseModel):
    answer_markdown: str
    suggested_note_update_markdown: str | None = None
