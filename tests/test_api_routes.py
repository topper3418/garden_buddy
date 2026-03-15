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
    assert "plant_count" in list_resp.json()["items"][0]

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


def test_tag_crud_and_query(client: TestClient) -> None:
    create_resp = client.post(
        "/tags",
        json={"name": "perennial", "notes": "comes back every year"},
    )
    assert create_resp.status_code == 201
    tag = create_resp.json()

    get_resp = client.get(f"/tags/{tag['id']}")
    assert get_resp.status_code == 200

    list_resp = client.get("/tags", params={"limit": 10, "offset": 0})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1

    query_resp = client.get("/tags/query", params={"notes_contains": "year"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    patch_resp = client.patch(
        f"/tags/{tag['id']}",
        json={"name": "hardy perennial"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "hardy perennial"

    tag_media_resp = client.post(
        "/media",
        files={"file": ("tag-cover.jpg", b"\xff\xd8\xff\xe0tagcover", "image/jpeg")},
        data={"title": "Tag Cover", "tag_id": str(tag["id"])},
    )
    assert tag_media_resp.status_code == 201
    tag_media = tag_media_resp.json()
    assert tag_media["tag_id"] == tag["id"]

    patch_main_media_resp = client.patch(
        f"/tags/{tag['id']}",
        json={"main_media_id": tag_media["id"]},
    )
    assert patch_main_media_resp.status_code == 200
    assert patch_main_media_resp.json()["main_media_id"] == tag_media["id"]

    delete_resp = client.delete(f"/tags/{tag['id']}")
    assert delete_resp.status_code == 204


def test_plants_crud_query_and_tag_links(client: TestClient) -> None:
    species = client.post(
        "/species",
        json={"name": "Solanum lycopersicum", "common_name": "Tomato"},
    ).json()

    species_2 = client.post(
        "/species",
        json={"name": "Ocimum basilicum", "common_name": "Basil"},
    ).json()

    tag_1 = client.post("/tags", json={"name": "annual", "notes": "one season"}).json()
    tag_2 = client.post("/tags", json={"name": "edible", "notes": "food"}).json()

    create_resp = client.post(
        "/plants",
        json={
            "name": "Cherry Tomato",
            "notes": "Planted in raised bed",
            "species_id": species["id"],
            "tag_ids": [tag_1["id"], tag_2["id"]],
        },
    )
    assert create_resp.status_code == 201
    plant = create_resp.json()
    assert len(plant["tags"]) == 2

    list_resp = client.get("/plants", params={"limit": 10, "offset": 0})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1

    query_resp = client.get(
        "/plants/query",
        params={"name_contains": "Cherry", "tag_id": tag_1["id"]},
    )
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    second_plant_resp = client.post(
        "/plants",
        json={
            "name": "Kitchen Basil",
            "notes": "Countertop pot",
            "species_id": species_2["id"],
            "tag_ids": [tag_1["id"]],
        },
    )
    assert second_plant_resp.status_code == 201

    query_multi_species_resp = client.get(
        "/plants/query",
        params=[("species_ids", species["id"]), ("species_ids", species_2["id"])],
    )
    assert query_multi_species_resp.status_code == 200
    assert len(query_multi_species_resp.json()) == 2

    plant_media_resp = client.post(
        "/media",
        files={"file": ("plant-main.jpg", b"\xff\xd8\xff\xe0plantmain", "image/jpeg")},
        data={"title": "Plant Main", "plant_id": str(plant["id"])},
    )
    assert plant_media_resp.status_code == 201
    plant_media = plant_media_resp.json()

    patch_main_media_resp = client.patch(
        f"/plants/{plant['id']}",
        json={"main_media_id": plant_media["id"]},
    )
    assert patch_main_media_resp.status_code == 200
    assert patch_main_media_resp.json()["main_media_id"] == plant_media["id"]

    patch_resp = client.patch(
        f"/plants/{plant['id']}",
        json={"notes": "Updated note", "tag_ids": [tag_1["id"]]},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["notes"] == "Updated note"
    assert len(patch_resp.json()["tags"]) == 1
    assert patch_resp.json()["main_media_id"] == plant_media["id"]

    add_tag_resp = client.put(f"/plants/{plant['id']}/tags/{tag_2['id']}")
    assert add_tag_resp.status_code == 200
    assert len(add_tag_resp.json()["tags"]) == 2

    remove_tag_resp = client.delete(f"/plants/{plant['id']}/tags/{tag_2['id']}")
    assert remove_tag_resp.status_code == 200
    assert len(remove_tag_resp.json()["tags"]) == 1

    delete_resp = client.delete(f"/plants/{plant['id']}")
    assert delete_resp.status_code == 204

    get_deleted_resp = client.get(f"/plants/{plant['id']}")
    assert get_deleted_resp.status_code == 404

    remaining_list_resp = client.get("/plants", params={"limit": 10, "offset": 0})
    assert remaining_list_resp.status_code == 200
    assert len(remaining_list_resp.json()["items"]) == 1

    archived_list_resp = client.get("/plants", params={"limit": 10, "offset": 0, "archived": True})
    assert archived_list_resp.status_code == 200
    assert len(archived_list_resp.json()["items"]) == 1

    archived_query_resp = client.get("/plants/query", params={"archived": True, "limit": 10, "offset": 0})
    assert archived_query_resp.status_code == 200
    assert len(archived_query_resp.json()) == 1


def test_media_upload_query_file_and_delete_by_id(client: TestClient) -> None:
    species_resp = client.post(
        "/species",
        json={"name": "Media Species", "common_name": "Media Species Common"},
    )
    assert species_resp.status_code == 201
    species = species_resp.json()

    plant_resp = client.post(
        "/plants",
        json={"name": "Media Linked Plant", "notes": "", "species_id": species["id"], "tag_ids": []},
    )
    assert plant_resp.status_code == 201
    plant = plant_resp.json()

    tag_resp = client.post(
        "/tags",
        json={"name": "photo-target", "notes": "for media filter"},
    )
    assert tag_resp.status_code == 201
    tag_id = tag_resp.json()["id"]

    upload_resp = client.post(
        "/media",
        files={"file": ("leaf.jpg", b"\xff\xd8\xff\xe0testjpeg", "image/jpeg")},
        data={
            "title": "Leaf Closeup",
            "plant_id": str(plant["id"]),
            "tag_id": str(tag_id),
            "species_id": str(species["id"]),
        },
    )
    assert upload_resp.status_code == 201
    media = upload_resp.json()
    assert media["plant_id"] == plant["id"]
    assert media["tag_id"] == tag_id
    assert media["species_id"] == species["id"]

    media_file = settings.media_path / media["filename"]
    assert media_file.exists()

    list_resp = client.get("/media", params={"include_file_path": True})
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1
    assert list_resp.json()["items"][0]["file_path"]

    query_resp = client.get("/media/query", params={"mime_type": "image/jpeg"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()) == 1

    query_by_plant_resp = client.get("/media/query", params={"name_contains": "Media Linked"})
    assert query_by_plant_resp.status_code == 200
    assert len(query_by_plant_resp.json()) == 1

    query_by_species_resp = client.get("/media/query", params={"species_ids": species["id"]})
    assert query_by_species_resp.status_code == 200
    assert len(query_by_species_resp.json()) == 1

    query_by_tag_resp = client.get("/media/query", params={"tag_id": tag_id})
    assert query_by_tag_resp.status_code == 200
    assert len(query_by_tag_resp.json()) == 1

    patch_tag_main_media_resp = client.patch(f"/tags/{tag_id}", json={"main_media_id": media["id"]})
    assert patch_tag_main_media_resp.status_code == 200
    assert patch_tag_main_media_resp.json()["main_media_id"] == media["id"]

    patch_plant_main_media_resp = client.patch(f"/plants/{plant['id']}", json={"main_media_id": media["id"]})
    assert patch_plant_main_media_resp.status_code == 200
    assert patch_plant_main_media_resp.json()["main_media_id"] == media["id"]

    file_resp = client.get(f"/media/{media['id']}/file")
    assert file_resp.status_code == 200

    patch_resp = client.patch(
        f"/media/{media['id']}",
        json={"title": "Updated Leaf", "plant_id": None, "tag_id": None},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Updated Leaf"
    assert patch_resp.json()["plant_id"] is None
    assert patch_resp.json()["tag_id"] is None
    assert patch_resp.json()["species_id"] == species["id"]

    query_by_species_after_unlink_resp = client.get("/media/query", params={"species_ids": species["id"]})
    assert query_by_species_after_unlink_resp.status_code == 200
    assert len(query_by_species_after_unlink_resp.json()) == 1

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


def test_soft_delete_plant_preserves_attached_media(client: TestClient) -> None:
    plant_resp = client.post(
        "/plants",
        json={"name": "Archive Test Plant", "notes": "## Keep this note", "species_id": None, "tag_ids": []},
    )
    assert plant_resp.status_code == 201
    plant = plant_resp.json()

    media_resp = client.post(
        "/media",
        files={"file": ("archive.jpg", b"\xff\xd8\xff\xe0archive", "image/jpeg")},
        data={"title": "Archive Link", "plant_id": str(plant["id"])},
    )
    assert media_resp.status_code == 201
    media = media_resp.json()
    assert media["plant_id"] == plant["id"]

    delete_resp = client.delete(f"/plants/{plant['id']}")
    assert delete_resp.status_code == 204

    get_deleted_plant = client.get(f"/plants/{plant['id']}")
    assert get_deleted_plant.status_code == 404

    get_archived_plant = client.get(f"/plants/{plant['id']}", params={"include_deleted": True})
    assert get_archived_plant.status_code == 200
    assert get_archived_plant.json()["id"] == plant["id"]

    get_media_resp = client.get(f"/media/{media['id']}")
    assert get_media_resp.status_code == 200
    assert get_media_resp.json()["plant_id"] == plant["id"]
