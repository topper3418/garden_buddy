"""Service-layer operations for plant types."""

from src.db.plant_type import (
    delete_plant_type,
    get_plant_type_by_id as db_get_plant_type_by_id,
    insert_plant_type,
    list_plant_types as db_list_plant_types,
    query_plant_types as db_query_plant_types,
    update_plant_type as db_update_plant_type,
)
from src.models.plant_type import (
    PlantType,
    PlantTypeCreate,
    PlantTypeListItem,
    PlantTypeListResponse,
)
from src.services.common import ensure_tables, normalize_pagination


def _to_plant_type_model(row: dict) -> PlantType:
    return PlantType.model_validate(row)


def list_plant_types(limit: int = 50, offset: int = 0) -> PlantTypeListResponse:
    """Return lightweight plant type records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_plant_types(limit, offset)
    items = [PlantTypeListItem.model_validate(row) for row in rows]
    return PlantTypeListResponse(items=items, limit=limit, offset=offset)


def query_plant_types(
    name_contains: str | None = None,
    notes_contains: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PlantType]:
    """Return plant types with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_plant_types(
        name_contains=name_contains,
        notes_contains=notes_contains,
        limit=limit,
        offset=offset,
    )
    return [_to_plant_type_model(r) for r in rows]


def get_plant_type_by_id(plant_type_id: int) -> PlantType | None:
    """Return a plant type by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_plant_type_by_id(plant_type_id)
    return _to_plant_type_model(row) if row else None


def create_plant_type(payload: PlantTypeCreate) -> PlantType:
    """Create and return a plant type record."""
    ensure_tables()
    plant_type_id = insert_plant_type(name=payload.name, notes=payload.notes)
    plant_type = get_plant_type_by_id(plant_type_id)
    if not plant_type:
        raise ValueError("Created plant type could not be retrieved.")
    return plant_type


def update_plant_type(
    plant_type_id: int,
    *,
    name: str | None = None,
    notes: str | None = None,
) -> PlantType | None:
    """Update mutable fields and return updated plant type."""
    ensure_tables()
    updated = db_update_plant_type(plant_type_id, name=name, notes=notes)
    if not updated:
        return None
    return get_plant_type_by_id(plant_type_id)


def delete_plant_type_by_id(plant_type_id: int) -> bool:
    """Delete a plant type by id."""
    ensure_tables()
    return delete_plant_type(plant_type_id)
