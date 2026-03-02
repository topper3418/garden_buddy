"""Service-layer operations for plants."""

from typing import Any

from src.db.plant import (
    add_plant_type_to_plant,
    delete_plant,
    get_plant_by_id as db_get_plant_by_id,
    get_plant_types_for_plant,
    insert_plant,
    list_plants as db_list_plants,
    query_plants as db_query_plants,
    remove_plant_type_from_plant,
    update_plant as db_update_plant,
)
from src.db.species import get_species_by_id as db_get_species_by_id
from src.models.plant import Plant, PlantCreate, PlantListItem, PlantListResponse
from src.models.plant_type import PlantType
from src.models.species import Species
from src.services.common import ensure_tables, normalize_pagination

_UNSET = object()


def _get_species_for_plant(species_id: int | None) -> Species | None:
    if species_id is None:
        return None
    row = db_get_species_by_id(species_id)
    return Species.model_validate(row) if row else None


def _get_plant_types_for_plant(plant_id: int) -> list[PlantType]:
    rows = get_plant_types_for_plant(plant_id)
    return [PlantType.model_validate(r) for r in rows]


def _to_plant_model(row: dict[str, Any]) -> Plant:
    plant_id = row["id"]
    species_id = row.get("species_id")
    resolved_species = _get_species_for_plant(species_id)
    plant_types = _get_plant_types_for_plant(plant_id)

    return Plant.model_validate(
        {
            **row,
            "species": resolved_species.model_dump() if resolved_species else None,
            "plant_types": [plant_type.model_dump() for plant_type in plant_types],
            "plant_type_ids": [plant_type.id for plant_type in plant_types],
        }
    )


def list_plants(limit: int = 50, offset: int = 0) -> PlantListResponse:
    """Return lightweight plant records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_plants(limit, offset)
    items = [PlantListItem.model_validate(row) for row in rows]
    return PlantListResponse(items=items, limit=limit, offset=offset)


def query_plants(
    name_contains: str | None = None,
    species_id: int | None = None,
    plant_type_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Plant]:
    """Return plants with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_plants(
        name_contains=name_contains,
        species_id=species_id,
        plant_type_id=plant_type_id,
        limit=limit,
        offset=offset,
    )
    return [_to_plant_model(r) for r in rows]


def get_plant_by_id(plant_id: int) -> Plant | None:
    """Return a plant by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_plant_by_id(plant_id)
    return _to_plant_model(row) if row else None


def create_plant(payload: PlantCreate) -> Plant:
    """Create and return a plant record including type associations."""
    ensure_tables()
    plant_id = insert_plant(name=payload.name, notes=payload.notes, species_id=payload.species_id)
    for plant_type_id in payload.plant_type_ids:
        add_plant_type_to_plant(plant_id, plant_type_id)

    created = get_plant_by_id(plant_id)
    if not created:
        raise ValueError("Created plant could not be retrieved.")
    return created


def update_plant(
    plant_id: int,
    *,
    name: str | None = None,
    notes: str | None = None,
    species_id: int | None | object = _UNSET,
    plant_type_ids: list[int] | object = _UNSET,
) -> Plant | None:
    """Update mutable fields and optional type associations."""
    ensure_tables()
    updated = db_update_plant(
        plant_id,
        name=name,
        notes=notes,
        species_id=species_id,
        plant_type_ids=plant_type_ids,
        unset_sentinel=_UNSET,
    )
    if not updated:
        return None
    return get_plant_by_id(plant_id)


def delete_plant_by_id(plant_id: int) -> bool:
    """Delete a plant by id (join rows are removed via cascade)."""
    ensure_tables()
    return delete_plant(plant_id)


def add_type_to_plant(plant_id: int, plant_type_id: int) -> Plant | None:
    """Attach a plant type to a plant and return updated plant."""
    ensure_tables()
    add_plant_type_to_plant(plant_id, plant_type_id)
    return get_plant_by_id(plant_id)


def remove_type_from_plant(plant_id: int, plant_type_id: int) -> Plant | None:
    """Detach a plant type from a plant and return updated plant."""
    ensure_tables()
    remove_plant_type_from_plant(plant_id, plant_type_id)
    return get_plant_by_id(plant_id)
