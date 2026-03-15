from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx
import pytest

from src.models.plant import Plant
from src.models.species import Species
from src.models.tag import Tag
from src.services import ai_service


def test_chat_completions_url_normalizes_base_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_service.settings, "openai_api_endpoint", "https://example.test/v1/")
    assert ai_service._chat_completions_url() == "https://example.test/v1/chat/completions"

    monkeypatch.setattr(
        ai_service.settings,
        "openai_api_endpoint",
        "https://example.test/v1/chat/completions",
    )
    assert ai_service._chat_completions_url() == "https://example.test/v1/chat/completions"


def test_extract_json_object_handles_embedded_json() -> None:
    payload = ai_service._extract_json_object("prefix text {\"k\": \"v\"} suffix")
    assert payload == {"k": "v"}


def test_validate_ai_config_rejects_placeholder_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_service.settings, "openai_api_key", "change-me")
    monkeypatch.setattr(ai_service.settings, "openai_api_endpoint", "https://example.invalid")
    monkeypatch.setattr(ai_service.settings, "openai_api_model", "your_openai_api_model")

    with pytest.raises(ValueError, match="Missing AI configuration"):
        ai_service._validate_ai_config()


def test_run_chat_completion_success_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_service, "_validate_ai_config", lambda: None)
    monkeypatch.setattr(ai_service, "_chat_completions_url", lambda: "https://example.test/v1/chat/completions")

    calls: list[tuple[str, dict, dict]] = []

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 60.0

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def post(self, url: str, json: dict, headers: dict) -> httpx.Response:
            calls.append((url, json, headers))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "hello world"}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr(ai_service.httpx, "Client", FakeClient)

    result = ai_service._run_chat_completion(
        system_prompt="sys",
        user_prompt="usr",
        temperature=0.2,
        max_tokens=128,
    )

    assert result == "hello world"
    assert calls[0][0] == "https://example.test/v1/chat/completions"
    assert calls[0][1]["model"] == ai_service.settings.openai_api_model


def test_generate_species_draft_parses_json_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = {
        "name": "Solanum lycopersicum",
        "common_name": "Tomato",
        "notes": "## Sunlight\nFull sun\n\n## Watering\nKeep soil evenly moist.",
    }
    monkeypatch.setattr(ai_service, "_run_chat_completion", lambda **_: json.dumps(fake))

    result = ai_service.generate_species_draft("Solanum lycopersicum")

    assert result["name"] == "Solanum lycopersicum"
    assert result["common_name"] == "Tomato"
    assert "## Sunlight" in (result["notes"] or "")


def test_answer_species_question_returns_note_suggestion(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = {
        "answer_markdown": "Water deeply once the top inch dries.",
        "suggested_note_update_markdown": "## Watering update\nMonitor top-inch soil dryness before watering.",
    }
    monkeypatch.setattr(ai_service, "_run_chat_completion", lambda **_: json.dumps(fake))

    species = Species.model_validate(
        {
            "id": 1,
            "name": "Mentha spicata",
            "common_name": "Spearmint",
            "notes": "Existing notes",
            "parent_species_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "plant_count": 1,
        }
    )

    result = ai_service.answer_species_question(species, "How often should I water?")

    assert "Water deeply" in result["answer_markdown"]
    assert result["suggested_note_update_markdown"] is not None


def test_answer_plant_question_includes_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = {
        "answer_markdown": "Prune lower leaves to improve airflow.",
        "suggested_note_update_markdown": "## Pruning\nRemove lower leaves weekly for airflow.",
    }
    monkeypatch.setattr(ai_service, "_run_chat_completion", lambda **_: json.dumps(fake))

    tag = Tag.model_validate(
        {
            "id": 7,
            "name": "Outdoor",
            "notes": None,
            "main_media_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    species = Species.model_validate(
        {
            "id": 11,
            "name": "Solanum lycopersicum",
            "common_name": "Tomato",
            "notes": "Species notes",
            "parent_species_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "plant_count": 1,
        }
    )
    plant = Plant.model_validate(
        {
            "id": 3,
            "name": "Backyard Cherry",
            "notes": "Plant notes",
            "species_id": species.id,
            "tag_ids": [tag.id],
            "main_media_id": None,
            "species": species.model_dump(),
            "tags": [tag.model_dump()],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    result = ai_service.answer_plant_question(plant, "How should I prune this week?")

    assert "airflow" in result["answer_markdown"].lower()
    assert result["suggested_note_update_markdown"] is not None
