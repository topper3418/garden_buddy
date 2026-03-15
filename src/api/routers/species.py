"""Species API routes."""

from fastapi import APIRouter, HTTPException, Query, status

from src.api.schemas import SpeciesUpdate
from src.models.species import Species, SpeciesCreate, SpeciesListResponse
from src.services.species_service import (
    create_species,
    delete_species_by_id,
    get_species_by_id,
    list_species,
    list_subspecies,
    query_species,
    update_species,
)

router = APIRouter(prefix="/species", tags=["species"])


@router.get("", response_model=SpeciesListResponse)
def list_species_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> SpeciesListResponse:
    return list_species(limit=limit, offset=offset)


@router.get("/query", response_model=list[Species])
def query_species_endpoint(
    name_contains: str | None = None,
    common_name_contains: str | None = None,
    parent_species_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[Species]:
    return query_species(
        name_contains=name_contains,
        common_name_contains=common_name_contains,
        parent_species_id=parent_species_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{species_id}", response_model=Species)
def get_species_endpoint(species_id: int) -> Species:
    record = get_species_by_id(species_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")
    return record


@router.get("/{species_id}/subspecies", response_model=list[Species])
def list_subspecies_endpoint(species_id: int) -> list[Species]:
    return list_subspecies(species_id)


@router.post("", response_model=Species, status_code=status.HTTP_201_CREATED)
def create_species_endpoint(payload: SpeciesCreate) -> Species:
    return create_species(payload)


@router.patch("/{species_id}", response_model=Species)
def update_species_endpoint(species_id: int, payload: SpeciesUpdate) -> Species:
    kwargs: dict = {}
    if "name" in payload.model_fields_set:
        kwargs["name"] = payload.name
    if "common_name" in payload.model_fields_set:
        kwargs["common_name"] = payload.common_name
    if "notes" in payload.model_fields_set:
        kwargs["notes"] = payload.notes
    if "parent_species_id" in payload.model_fields_set:
        kwargs["parent_species_id"] = payload.parent_species_id
    if "main_media_id" in payload.model_fields_set:
        kwargs["main_media_id"] = payload.main_media_id

    updated = update_species(species_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")
    return updated


@router.delete("/{species_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_species_endpoint(species_id: int) -> None:
    try:
        deleted = delete_species_by_id(species_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")
