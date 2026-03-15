"""Service-layer operations for species."""

from src.db.species import (
    delete_species,
    get_species_by_id as db_get_species_by_id,
    get_subspecies,
    insert_species,
    list_species as db_list_species,
    query_species as db_query_species,
    update_species as db_update_species,
)
from src.models.species import Species, SpeciesCreate, SpeciesListItem, SpeciesListResponse
from src.services.common import ensure_tables, normalize_pagination

_UNSET = object()


def _to_species_model(row: dict) -> Species:
    return Species.model_validate(row)


def list_species(limit: int = 50, offset: int = 0) -> SpeciesListResponse:
    """Return lightweight species records for list views."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_list_species(limit, offset)
    items = [SpeciesListItem.model_validate(row) for row in rows]
    return SpeciesListResponse(items=items, limit=limit, offset=offset)


def query_species(
    name_contains: str | None = None,
    common_name_contains: str | None = None,
    parent_species_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Species]:
    """Return species with optional filters and pagination."""
    ensure_tables()
    limit, offset = normalize_pagination(limit, offset)
    rows = db_query_species(
        name_contains=name_contains,
        common_name_contains=common_name_contains,
        parent_species_id=parent_species_id,
        limit=limit,
        offset=offset,
    )
    return [_to_species_model(r) for r in rows]


def get_species_by_id(species_id: int) -> Species | None:
    """Return a species by id, or ``None`` if not found."""
    ensure_tables()
    row = db_get_species_by_id(species_id)
    return _to_species_model(row) if row else None


def create_species(payload: SpeciesCreate) -> Species:
    """Create and return a species record."""
    ensure_tables()
    species_id = insert_species(
        name=payload.name,
        common_name=payload.common_name,
        notes=payload.notes,
        parent_species_id=payload.parent_species_id,
        main_media_id=payload.main_media_id,
    )
    species = get_species_by_id(species_id)
    if not species:
        raise ValueError("Created species could not be retrieved.")
    return species


def update_species(
    species_id: int,
    *,
    name: str | None = None,
    common_name: str | None = None,
    notes: str | None = None,
    parent_species_id: int | None | object = _UNSET,
    main_media_id: int | None | object = _UNSET,
) -> Species | None:
    """Update mutable fields and return the updated species."""
    ensure_tables()
    updated = db_update_species(
        species_id,
        name=name,
        common_name=common_name,
        notes=notes,
        parent_species_id=parent_species_id,
        main_media_id=main_media_id,
        unset_sentinel=_UNSET,
    )
    if not updated:
        return None
    return get_species_by_id(species_id)


def delete_species_by_id(species_id: int) -> bool:
    """Delete species by id.

    Raises:
        ValueError: If species has subspecies (enforced in db helper).
    """
    ensure_tables()
    return delete_species(species_id)


def list_subspecies(parent_species_id: int) -> list[Species]:
    """Return direct subspecies for the provided parent species id."""
    ensure_tables()
    rows = get_subspecies(parent_species_id)
    return [_to_species_model(r) for r in rows]
