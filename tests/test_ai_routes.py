from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.settings import settings
import src.api.routers.ai as ai_router


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(settings, "base_dir", tmp_path)
    (tmp_path / "data" / "media").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "logs").mkdir(parents=True, exist_ok=True)

    app = create_app()
    with TestClient(app) as api_client:
        yield api_client


def test_ai_species_draft_route_success(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ai_router,
        "generate_species_draft",
        lambda official_name: {
            "name": official_name,
            "common_name": "Tomato",
            "notes": "## Sunlight\nFull sun\n\n## Watering\nDeep watering.",
        },
    )

    response = client.post("/ai/species/draft", json={"official_name": "Solanum lycopersicum"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Solanum lycopersicum"
    assert "## Sunlight" in payload["notes"]


def test_ai_species_draft_route_config_error_maps_to_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(_: str) -> dict[str, str]:
        raise ValueError("Missing AI configuration: GB_OPENAI_API_KEY")

    monkeypatch.setattr(ai_router, "generate_species_draft", _raise)

    response = client.post("/ai/species/draft", json={"official_name": "Lavandula angustifolia"})

    assert response.status_code == 503
    assert "Missing AI configuration" in response.json()["detail"]


def test_ai_plant_question_route_success(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    species = client.post(
        "/species",
        json={"name": "Ocimum basilicum", "common_name": "Basil"},
    ).json()
    plant = client.post(
        "/plants",
        json={"name": "Kitchen Basil", "notes": "Existing plant note", "species_id": species["id"], "tag_ids": []},
    ).json()

    monkeypatch.setattr(
        ai_router,
        "answer_plant_question",
        lambda _plant, _question: {
            "answer_markdown": "Use bright light and avoid soggy soil.",
            "suggested_note_update_markdown": "## AI Addendum\nWater when top inch dries.",
        },
    )

    response = client.post(
        f"/ai/plants/{plant['id']}/ask",
        json={"question": "How should I water this week?"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "bright light" in payload["answer_markdown"]
    assert "AI Addendum" in payload["suggested_note_update_markdown"]


def test_ai_plant_question_route_404_for_missing_plant(client: TestClient) -> None:
    response = client.post("/ai/plants/9999/ask", json={"question": "Any tips?"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Plant not found"


def test_ai_species_question_route_success(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    species = client.post(
        "/species",
        json={"name": "Lavandula angustifolia", "common_name": "Lavender"},
    ).json()

    monkeypatch.setattr(
        ai_router,
        "answer_species_question",
        lambda _species, _question: {
            "answer_markdown": "Lavender prefers full sun and lighter watering.",
            "suggested_note_update_markdown": "## AI Addendum\nFull sun; avoid overwatering.",
        },
    )

    response = client.post(
        f"/ai/species/{species['id']}/ask",
        json={"question": "What are care basics?"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "full sun" in payload["answer_markdown"].lower()
    assert payload["suggested_note_update_markdown"]
