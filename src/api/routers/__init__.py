"""Router package for API endpoints."""

from src.api.routers.media import router as media_router
from src.api.routers.plants import router as plants_router
from src.api.routers.plant_types import router as plant_types_router
from src.api.routers.species import router as species_router

__all__ = [
    "species_router",
    "plant_types_router",
    "plants_router",
    "media_router",
]
