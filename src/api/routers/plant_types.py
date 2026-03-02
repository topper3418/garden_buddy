"""Plant type API routes."""

from fastapi import APIRouter, HTTPException, Query, status

from src.api.schemas import PlantTypeUpdate
from src.models.plant_type import PlantType, PlantTypeCreate, PlantTypeListResponse
from src.services.plant_type_service import (
    create_plant_type,
    delete_plant_type_by_id,
    get_plant_type_by_id,
    list_plant_types,
    query_plant_types,
    update_plant_type,
)

router = APIRouter(prefix="/plant-types", tags=["plant-types"])


@router.get("", response_model=PlantTypeListResponse)
def list_plant_types_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PlantTypeListResponse:
    return list_plant_types(limit=limit, offset=offset)


@router.get("/query", response_model=list[PlantType])
def query_plant_types_endpoint(
    name_contains: str | None = None,
    notes_contains: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[PlantType]:
    return query_plant_types(
        name_contains=name_contains,
        notes_contains=notes_contains,
        limit=limit,
        offset=offset,
    )


@router.get("/{plant_type_id}", response_model=PlantType)
def get_plant_type_endpoint(plant_type_id: int) -> PlantType:
    record = get_plant_type_by_id(plant_type_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant type not found")
    return record


@router.post("", response_model=PlantType, status_code=status.HTTP_201_CREATED)
def create_plant_type_endpoint(payload: PlantTypeCreate) -> PlantType:
    return create_plant_type(payload)


@router.patch("/{plant_type_id}", response_model=PlantType)
def update_plant_type_endpoint(plant_type_id: int, payload: PlantTypeUpdate) -> PlantType:
    kwargs: dict = {}
    if "name" in payload.model_fields_set:
        kwargs["name"] = payload.name
    if "notes" in payload.model_fields_set:
        kwargs["notes"] = payload.notes

    updated = update_plant_type(plant_type_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant type not found")
    return updated


@router.delete("/{plant_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant_type_endpoint(plant_type_id: int) -> None:
    deleted = delete_plant_type_by_id(plant_type_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant type not found")
