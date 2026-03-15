from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

from src.models.species import Species
from src.services.ai_service import answer_species_question, generate_species_draft
from src.settings import settings

pytestmark = pytest.mark.ai_live


def _run_live_tests() -> bool:
    value = os.getenv("GB_RUN_AI_LIVE_TESTS", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _has_real_ai_config() -> bool:
    return (
        bool(settings.openai_api_key)
        and bool(settings.openai_api_model)
        and bool(settings.openai_api_endpoint)
        and not settings.openai_api_key.startswith("your_openai_")
        and not settings.openai_api_model.startswith("your_openai_")
        and not settings.openai_api_endpoint.startswith("your_openai_")
    )


@pytest.mark.skipif(not _run_live_tests(), reason="Set GB_RUN_AI_LIVE_TESTS=true to run live AI tests")
def test_live_generate_species_draft() -> None:
    if not _has_real_ai_config():
        pytest.skip("Real AI configuration is not present")

    draft = generate_species_draft("Solanum lycopersicum")

    assert draft["name"]
    assert draft["notes"]
    lowered = (draft["notes"] or "").lower()
    assert "water" in lowered
    assert "sun" in lowered


@pytest.mark.skipif(not _run_live_tests(), reason="Set GB_RUN_AI_LIVE_TESTS=true to run live AI tests")
def test_live_species_question_answer() -> None:
    if not _has_real_ai_config():
        pytest.skip("Real AI configuration is not present")

    species = Species.model_validate(
        {
            "id": 1,
            "name": "Mentha spicata",
            "common_name": "Spearmint",
            "notes": "Grows in a container in partial sun.",
            "parent_species_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "plant_count": 1,
        }
    )

    result = answer_species_question(species, "How should I water this during hot weeks?")

    assert result["answer_markdown"]
    assert len(result["answer_markdown"]) > 40
