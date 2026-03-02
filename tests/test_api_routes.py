from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.settings import settings


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(settings, "base_dir", tmp_path)
    (tmp_path / "data" / "media").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "logs").mkdir(parents=True, exist_ok=True)

    app = create_app()
    with TestClient(app) as api_client:
        yield api_client


def test_healthcheck(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_species_crud_query_and_subspecies_guard(client: TestClient) -> None:
    parent_resp = client.post(
        "/species",
        json={"name": "Rosa rubiginosa", "common_name": "Sweet briar", "notes": "parent"},
    )
    assert parent_resp.status_code == 201
    parent = parent_resp.json()

    child_resp = client.post(
        "/species",
        json={
            "name": "Rosa rubiginosa var. australis",
            "common_name": "Sweet briar var.",
            "notes": "child",
            "parent_species_id": parent["id"],
        },
    )
    assert child_resp.status_code == 201
    child = child_resp.json()

    list_resp = client.get("/species", params={"limit": 10, "offset": 0})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 2

    query_resp = client.get("/species/query", params={"name_contains": "rubiginosa"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 2

    subspecies_resp = client.get(f"/species/{parent['id']}/subspecies")
    assert subspecies_resp.status_code == 200
    assert len(subspecies_resp.json()) == 1

    blocked_delete = client.delete(f"/species/{parent['id']}")
    assert blocked_delete.status_code == 409

    delete_child = client.delete(f"/species/{child['id']}")
    assert delete_child.status_code == 204

    delete_parent = client.delete(f"/species/{parent['id']}")
    assert delete_parent.status_code == 204


def test_plant_type_crud_and_query(client: TestClient) -> None:
    create_resp = client.post(
        "/plant-types",
        json={"name": "perennial", "notes": "comes back every year"},
    )
    assert create_resp.status_code == 201
    plant_type = create_resp.json()

    get_resp = client.get(f"/plant-types/{plant_type['id']}")
    assert get_resp.status_code == 200

    list_resp = client.get("/plant-types", params={"limit": 10, "offset": 0})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1

    query_resp = client.get("/plant-types/query", params={"notes_contains": "year"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    patch_resp = client.patch(
        f"/plant-types/{plant_type['id']}",
        json={"name": "hardy perennial"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "hardy perennial"

    delete_resp = client.delete(f"/plant-types/{plant_type['id']}")
    assert delete_resp.status_code == 204


def test_plants_crud_query_and_type_links(client: TestClient) -> None:
    species = client.post(
        "/species",
        json={"name": "Solanum lycopersicum", "common_name": "Tomato"},
    ).json()

    type_1 = client.post("/plant-types", json={"name": "annual", "notes": "one season"}).json()
    type_2 = client.post("/plant-types", json={"name": "edible", "notes": "food"}).json()

    create_resp = client.post(
        "/plants",
        json={
            "name": "Cherry Tomato",
            "notes": "Planted in raised bed",
            "species_id": species["id"],
            "plant_type_ids": [type_1["id"], type_2["id"]],
        },
    )
    assert create_resp.status_code == 201
    plant = create_resp.json()
    assert len(plant["plant_types"]) == 2

    list_resp = client.get("/plants", params={"limit": 10, "offset": 0})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1

    query_resp = client.get(
        "/plants/query",
        params={"name_contains": "Cherry", "plant_type_id": type_1["id"]},
    )
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    patch_resp = client.patch(
        f"/plants/{plant['id']}",
        json={"notes": "Updated note", "plant_type_ids": [type_1["id"]]},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["notes"] == "Updated note"
    assert len(patch_resp.json()["plant_types"]) == 1

    add_type_resp = client.put(f"/plants/{plant['id']}/types/{type_2['id']}")
    assert add_type_resp.status_code == 200
    assert len(add_type_resp.json()["plant_types"]) == 2

    remove_type_resp = client.delete(f"/plants/{plant['id']}/types/{type_2['id']}")
    assert remove_type_resp.status_code == 200
    assert len(remove_type_resp.json()["plant_types"]) == 1

    delete_resp = client.delete(f"/plants/{plant['id']}")
    assert delete_resp.status_code == 204


def test_media_upload_query_file_and_delete_by_id(client: TestClient) -> None:
    upload_resp = client.post(
        "/media",
        files={"file": ("leaf.jpg", b"\xff\xd8\xff\xe0testjpeg", "image/jpeg")},
        data={"title": "Leaf Closeup"},
    )
    assert upload_resp.status_code == 201
    media = upload_resp.json()

    media_file = settings.media_path / media["filename"]
    assert media_file.exists()

    list_resp = client.get("/media", params={"include_file_path": True})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1
    assert list_resp.json()["items"][0]["file_path"]

    query_resp = client.get("/media/query", params={"mime_type": "image/jpeg"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    file_resp = client.get(f"/media/{media['id']}/file")
    assert file_resp.status_code == 200

    patch_resp = client.patch(f"/media/{media['id']}", json={"title": "Updated Leaf"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Updated Leaf"

    delete_resp = client.delete(f"/media/{media['id']}")
    assert delete_resp.status_code == 204

    assert not media_file.exists()

    get_deleted = client.get(f"/media/{media['id']}")
    assert get_deleted.status_code == 404


def test_media_delete_by_filename_endpoint(client: TestClient) -> None:
    upload_resp = client.post(
        "/media",
        files={"file": ("flower.jpg", b"\xff\xd8\xff\xe0flowerjpeg", "image/jpeg")},
        data={"title": "Flower"},
    )
    assert upload_resp.status_code == 201
    media = upload_resp.json()

    delete_resp = client.delete(f"/media/by-filename/{media['filename']}")
    assert delete_resp.status_code == 204

    get_deleted = client.get(f"/media/{media['id']}")
    assert get_deleted.status_code == 404
