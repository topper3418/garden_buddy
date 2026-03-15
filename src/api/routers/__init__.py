"""Router package for API endpoints."""

from src.api.routers.ai import router as ai_router
from src.api.routers.media import router as media_router
from src.api.routers.plants import router as plants_router
from src.api.routers.tags import router as tags_router
from src.api.routers.species import router as species_router

__all__ = [
    "ai_router",
    "species_router",
    "tags_router",
    "plants_router",
    "media_router",
]
