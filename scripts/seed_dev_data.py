"""Wipe and seed local development data from JSON documents in ``seed_data/``."""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from sqlite3 import Cursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.db import init_all_tables
from src.db.connection import get_db_connection
from src.settings import settings

SEED_DATA_DIR = PROJECT_ROOT / "seed_data"
SEED_IMAGES_DIR = SEED_DATA_DIR / "images"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_lastrowid(cursor: Cursor) -> int:
    if cursor.lastrowid is None:
        raise RuntimeError("Expected SQLite lastrowid after insert")
    return int(cursor.lastrowid)


def read_seed_json(filename: str) -> list[dict]:
    with (SEED_DATA_DIR / filename).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def wipe_database_and_media() -> None:
    db_path = settings.database_path
    if db_path.exists():
        db_path.unlink()

    settings.media_path.mkdir(parents=True, exist_ok=True)
    for item in settings.media_path.iterdir():
        if item.is_file():
            item.unlink()


def seed_all() -> None:
    species_seed = read_seed_json("species.json")
    tags_seed = read_seed_json("tags.json")
    plants_seed = read_seed_json("plants.json")
    media_seed = read_seed_json("media.json")

    init_all_tables()

    with get_db_connection() as conn:
        species_ids_by_name: dict[str, int] = {}
        for record in species_seed:
            parent_name = record.get("parent_name")
            parent_id = species_ids_by_name[parent_name] if parent_name else None
            cur = conn.execute(
                """
                INSERT INTO species (name, common_name, notes, parent_species_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record["name"],
                    record.get("common_name"),
                    record.get("notes"),
                    parent_id,
                    utc_now_iso(),
                ),
            )
            species_ids_by_name[record["name"]] = require_lastrowid(cur)

        tag_ids_by_name: dict[str, int] = {}
        tag_main_media_by_name: dict[str, str] = {}
        for record in tags_seed:
            cur = conn.execute(
                """
                INSERT INTO tags (name, notes, main_media_id, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    record["name"],
                    record.get("notes"),
                    None,
                    utc_now_iso(),
                ),
            )
            tag_name = record["name"]
            tag_ids_by_name[tag_name] = require_lastrowid(cur)
            if record.get("main_media_filename"):
                tag_main_media_by_name[tag_name] = record["main_media_filename"]

        plant_ids_by_name: dict[str, int] = {}
        plant_main_media_by_name: dict[str, str] = {}
        for record in plants_seed:
            cur = conn.execute(
                """
                INSERT INTO plants (name, notes, species_id, main_media_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record["name"],
                    record.get("notes"),
                    species_ids_by_name[record["species_name"]],
                    None,
                    utc_now_iso(),
                ),
            )
            plant_id = require_lastrowid(cur)
            plant_name = record["name"]
            plant_ids_by_name[plant_name] = plant_id
            if record.get("main_media_filename"):
                plant_main_media_by_name[plant_name] = record["main_media_filename"]

            for tag_name in record.get("tag_names", []):
                conn.execute(
                    """
                    INSERT INTO plant_tags (plant_id, tag_id)
                    VALUES (?, ?)
                    """,
                    (plant_id, tag_ids_by_name[tag_name]),
                )

        media_ids_by_filename: dict[str, int] = {}
        settings.media_path.mkdir(parents=True, exist_ok=True)
        for record in media_seed:
            source_image = SEED_IMAGES_DIR / record["filename"]
            destination_image = settings.media_path / record["filename"]
            if not source_image.exists():
                raise FileNotFoundError(f"Missing seed image file: {source_image}")

            shutil.copy2(source_image, destination_image)

            plant_id = None
            if record.get("plant_name"):
                plant_id = plant_ids_by_name[record["plant_name"]]

            tag_id = None
            if record.get("tag_name"):
                tag_id = tag_ids_by_name[record["tag_name"]]

            cur = conn.execute(
                """
                INSERT INTO media (filename, title, mime_type, size, plant_id, tag_id, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["filename"],
                    record.get("title"),
                    record.get("mime_type", "image/jpeg"),
                    destination_image.stat().st_size,
                    plant_id,
                    tag_id,
                    utc_now_iso(),
                ),
            )
            media_ids_by_filename[record["filename"]] = require_lastrowid(cur)

        for plant_name, filename in plant_main_media_by_name.items():
            conn.execute(
                "UPDATE plants SET main_media_id = ? WHERE id = ?",
                (media_ids_by_filename[filename], plant_ids_by_name[plant_name]),
            )

        for tag_name, filename in tag_main_media_by_name.items():
            conn.execute(
                "UPDATE tags SET main_media_id = ? WHERE id = ?",
                (media_ids_by_filename[filename], tag_ids_by_name[tag_name]),
            )

        conn.commit()


def print_counts() -> None:
    with get_db_connection() as conn:
        species_count = conn.execute("SELECT COUNT(*) FROM species").fetchone()[0]
        type_count = conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
        plants_count = conn.execute("SELECT COUNT(*) FROM plants").fetchone()[0]
        media_count = conn.execute("SELECT COUNT(*) FROM media").fetchone()[0]

    print(f"species: {species_count}")
    print(f"tags: {type_count}")
    print(f"plants: {plants_count}")
    print(f"media: {media_count}")


def main() -> None:
    wipe_database_and_media()
    seed_all()
    print("Wipe + reseed complete.")
    print_counts()


if __name__ == "__main__":
    main()
