"""Plant API routes."""

from fastapi import APIRouter, HTTPException, Query, status

from src.api.schemas import PlantUpdate
from src.models.plant import Plant, PlantCreate, PlantListResponse
from src.services.plant_service import (
    add_type_to_plant,
    create_plant,
    delete_plant_by_id,
    get_plant_by_id,
    list_plants,
    query_plants,
    remove_type_from_plant,
    update_plant,
)

router = APIRouter(prefix="/plants", tags=["plants"])


@router.get("", response_model=PlantListResponse)
def list_plants_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PlantListResponse:
    return list_plants(limit=limit, offset=offset)


@router.get("/query", response_model=list[Plant])
def query_plants_endpoint(
    name_contains: str | None = None,
    species_id: int | None = None,
    plant_type_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[Plant]:
    return query_plants(
        name_contains=name_contains,
        species_id=species_id,
        plant_type_id=plant_type_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{plant_id}", response_model=Plant)
def get_plant_endpoint(plant_id: int) -> Plant:
    record = get_plant_by_id(plant_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return record


@router.post("", response_model=Plant, status_code=status.HTTP_201_CREATED)
def create_plant_endpoint(payload: PlantCreate) -> Plant:
    return create_plant(payload)


@router.patch("/{plant_id}", response_model=Plant)
def update_plant_endpoint(plant_id: int, payload: PlantUpdate) -> Plant:
    kwargs: dict = {}
    if "name" in payload.model_fields_set:
        kwargs["name"] = payload.name
    if "notes" in payload.model_fields_set:
        kwargs["notes"] = payload.notes
    if "species_id" in payload.model_fields_set:
        kwargs["species_id"] = payload.species_id
    if "plant_type_ids" in payload.model_fields_set:
        kwargs["plant_type_ids"] = payload.plant_type_ids

    updated = update_plant(plant_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return updated


@router.put("/{plant_id}/types/{plant_type_id}", response_model=Plant)
def add_type_to_plant_endpoint(plant_id: int, plant_type_id: int) -> Plant:
    updated = add_type_to_plant(plant_id, plant_type_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return updated


@router.delete("/{plant_id}/types/{plant_type_id}", response_model=Plant)
def remove_type_from_plant_endpoint(plant_id: int, plant_type_id: int) -> Plant:
    updated = remove_type_from_plant(plant_id, plant_type_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return updated


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant_endpoint(plant_id: int) -> None:
    deleted = delete_plant_by_id(plant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
