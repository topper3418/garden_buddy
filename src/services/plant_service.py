"""Service-layer operations for plants."""

from typing import Any

from src.db.plant import (
    add_tag_to_plant,
    delete_plant,
    get_plant_by_id as db_get_plant_by_id,
    get_tags_for_plant,
    insert_plant,
    list_plants as db_list_plants,
    query_plants as db_query_plants,
    remove_tag_from_plant,
    update_plant as db_update_plant,
)
from src.db.species import get_species_by_id as db_get_species_by_id
from src.models.plant import Plant, PlantCreate, PlantListItem, PlantListResponse
from src.models.tag import Tag
from src.models.species import Species
from src.services.common import ensure_tables, normalize_pagination

_UNSET = object()


def _get_species_for_plant(species_id: int | None) -> Species | None:
    if species_id is None:
        return None
    row = db_get_species_by_id(species_id)
    return Species.model_validate(row) if row else None


def _get_tags_for_plant(plant_id: int) -> list[Tag]:
    rows = get_tags_for_plant(plant_id)
    return [Tag.model_validate(r) for r in rows]


def _to_plant_model(row: dict[str, Any]) -> Plant:
    plant_id = row["id"]
    species_id = row.get("species_id")
    resolved_species = _get_species_for_plant(species_id)
    tags = _get_tags_for_plant(plant_id)

    return Plant.model_validate(
        {
            **row,
            "species": resolved_species.model_dump() if resolved_species else None,
            "tags": [tag.model_dump() for tag in tags],
            "tag_ids": [tag.id for tag in tags],
        }
    )


def list_plants(limit: int = 50, offset: int = 0, archived: bool = False) -> PlantListResponse:
    """Return lightweight plant records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_plants(limit, offset, archived=archived)
    items = [PlantListItem.model_validate(row) for row in rows]
    return PlantListResponse(items=items, limit=limit, offset=offset)


def query_plants(
    name_contains: str | None = None,
    species_ids: list[int] | None = None,
    tag_id: int | None = None,
    archived: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[Plant]:
    """Return plants with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_plants(
        name_contains=name_contains,
        species_ids=species_ids,
        tag_id=tag_id,
        archived=archived,
        limit=limit,
        offset=offset,
    )
    return [_to_plant_model(r) for r in rows]


def get_plant_by_id(plant_id: int, *, include_deleted: bool = False) -> Plant | None:
    """Return a plant by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_plant_by_id(plant_id, include_deleted=include_deleted)
    return _to_plant_model(row) if row else None


def create_plant(payload: PlantCreate) -> Plant:
    """Create and return a plant record including tag associations."""
    ensure_tables()
    plant_id = insert_plant(
        name=payload.name,
        notes=payload.notes,
        species_id=payload.species_id,
        main_media_id=payload.main_media_id,
    )
    for tag_id in payload.tag_ids:
        add_tag_to_plant(plant_id, tag_id)

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
    tag_ids: list[int] | object = _UNSET,
    main_media_id: int | None | object = _UNSET,
) -> Plant | None:
    """Update mutable fields and optional tag associations."""
    ensure_tables()
    updated = db_update_plant(
        plant_id,
        name=name,
        notes=notes,
        species_id=species_id,
        tag_ids=tag_ids,
        main_media_id=main_media_id,
        unset_sentinel=_UNSET,
    )
    if not updated:
        return None
    return get_plant_by_id(plant_id)


def delete_plant_by_id(plant_id: int) -> bool:
    """Delete a plant by id (join rows are removed via cascade)."""
    ensure_tables()
    return delete_plant(plant_id)


def add_tag_to_plant_by_id(plant_id: int, tag_id: int) -> Plant | None:
    """Attach a tag to a plant and return updated plant."""
    ensure_tables()
    if not get_plant_by_id(plant_id):
        return None
    add_tag_to_plant(plant_id, tag_id)
    return get_plant_by_id(plant_id)


def remove_tag_from_plant_by_id(plant_id: int, tag_id: int) -> Plant | None:
    """Detach a tag from a plant and return updated plant."""
    ensure_tables()
    if not get_plant_by_id(plant_id):
        return None
    remove_tag_from_plant(plant_id, tag_id)
    return get_plant_by_id(plant_id)
