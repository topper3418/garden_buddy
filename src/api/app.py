"""FastAPI application assembly."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers.ai import router as ai_router
from src.api.routers.media import router as media_router
from src.api.routers.plants import router as plants_router
from src.api.routers.tags import router as tags_router
from src.api.routers.species import router as species_router
from src.db import init_all_tables
from src.settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_all_tables()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Garden Buddy API",
        version="0.1.0",
        lifespan=lifespan,
    )

    if settings.dev_mode:
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/health", tags=["system"])
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(species_router)
    app.include_router(tags_router)
    app.include_router(plants_router)
    app.include_router(media_router)
    app.include_router(ai_router)
    return app


app = create_app()
