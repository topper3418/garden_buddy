"""AI-assisted content generation and Q&A helpers."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from src.models.plant import Plant
from src.models.species import Species
from src.settings import settings


def _is_missing_or_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return True
    if normalized.startswith("your_openai_"):
        return True
    if normalized in {"change-me", "changeme", "replace-me"}:
        return True
    if "example.invalid" in normalized:
        return True
    return False


def _validate_ai_config() -> None:
    missing: list[str] = []

    if _is_missing_or_placeholder(settings.openai_api_key):
        missing.append("GB_OPENAI_API_KEY")
    if _is_missing_or_placeholder(settings.openai_api_model):
        missing.append("GB_OPENAI_API_MODEL")
    if _is_missing_or_placeholder(settings.openai_api_endpoint):
        missing.append("GB_OPENAI_API_ENDPOINT")

    if missing:
        raise ValueError(f"Missing AI configuration: {', '.join(missing)}")


def _chat_completions_url() -> str:
    endpoint = settings.openai_api_endpoint.strip().rstrip("/")
    if endpoint.endswith("/chat/completions"):
        return endpoint
    return f"{endpoint}/chat/completions"


def _extract_json_object(text: str) -> dict[str, Any]:
    candidates = [text.strip()]
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        candidates.append(match.group(0))

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            continue

    raise ValueError("AI response was not valid JSON.")


def _run_chat_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    _validate_ai_config()

    payload = {
        "model": settings.openai_api_model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    url = _chat_completions_url()

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else str(exc)
        raise ValueError(f"AI provider rejected request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise ValueError(f"AI provider call failed: {exc}") from exc

    data = response.json()
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("AI provider returned no choices.")

    message = choices[0].get("message", {})
    content = message.get("content")

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        content = "\n".join(parts)

    if not isinstance(content, str) or not content.strip():
        raise ValueError("AI provider returned empty content.")

    return content.strip()


def generate_species_draft(official_name: str) -> dict[str, str | None]:
    """Generate species fields from official scientific name."""
    system_prompt = (
        "You are an expert horticulture assistant. Return only valid JSON with keys "
        "name, common_name, notes. The notes must be markdown, practical, and around "
        "140-260 words with concise sections for gardeners."
    )

    user_prompt = (
        "Build a species draft for this official scientific name:\n"
        f"{official_name}\n\n"
        "Requirements:\n"
        "- Keep name as the scientific name (correct obvious formatting only).\n"
        "- Include a likely common_name.\n"
        "- notes must be markdown with sections: Overview, Sunlight, Watering, Soil, "
        "Feeding, Common Problems, Seasonal Tips.\n"
        "- Avoid unsafe claims; use generally accepted gardening best practices.\n"
    )

    raw = _run_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.4,
        max_tokens=700,
    )
    payload = _extract_json_object(raw)

    name = str(payload.get("name") or official_name).strip()
    common_name_raw = payload.get("common_name")
    common_name = str(common_name_raw).strip() if isinstance(common_name_raw, str) and common_name_raw.strip() else None
    notes_raw = payload.get("notes")
    notes = str(notes_raw).strip() if isinstance(notes_raw, str) else ""

    if not notes:
        notes = (
            "## Overview\n"
            "Reference entry generated for this species.\n\n"
            "## Sunlight\n"
            "Use full sun to partial sun depending on local climate.\n\n"
            "## Watering\n"
            "Water deeply when the top soil begins to dry; avoid chronic overwatering.\n\n"
            "## Soil\n"
            "Prefer well-draining soil enriched with compost.\n\n"
            "## Feeding\n"
            "Apply balanced fertilizer during active growth per label rates.\n\n"
            "## Common Problems\n"
            "Watch for stress, pest pressure, and fungal issues during humid periods.\n\n"
            "## Seasonal Tips\n"
            "Adjust watering and feeding to temperature and growth stage."
        )

    return {
        "name": name,
        "common_name": common_name,
        "notes": notes,
    }


def answer_species_question(species: Species, question: str) -> dict[str, str | None]:
    """Answer species questions using notes plus best-practice context."""
    system_prompt = (
        "You are a practical gardening assistant. Return only valid JSON with keys "
        "answer_markdown and suggested_note_update_markdown."
    )

    user_prompt = (
        "Species context:\n"
        f"- Scientific name: {species.name}\n"
        f"- Common name: {species.common_name or 'Unknown'}\n"
        f"- Current notes: {species.notes or 'None'}\n\n"
        f"Question: {question}\n\n"
        "Requirements:\n"
        "- answer_markdown should be concise, practical, and mention uncertainty when relevant.\n"
        "- Use species notes first, then general best practices.\n"
        "- suggested_note_update_markdown should be a short markdown addendum that can be appended to notes.\n"
        "- If no note update is needed, return an empty string for suggested_note_update_markdown.\n"
    )

    raw = _run_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3,
        max_tokens=700,
    )
    payload = _extract_json_object(raw)

    answer = str(payload.get("answer_markdown") or "").strip()
    suggestion = str(payload.get("suggested_note_update_markdown") or "").strip()

    if not answer:
        answer = "I could not generate an answer right now. Please try again with a more specific question."

    return {
        "answer_markdown": answer,
        "suggested_note_update_markdown": suggestion or None,
    }


def answer_plant_question(plant: Plant, question: str) -> dict[str, str | None]:
    """Answer plant-level questions using plant and species notes."""
    species_name = plant.species.name if plant.species else "Unknown"
    species_notes = plant.species.notes if plant.species and plant.species.notes else "None"
    tag_list = ", ".join(tag.name for tag in plant.tags) if plant.tags else "None"

    system_prompt = (
        "You are a practical gardening assistant. Return only valid JSON with keys "
        "answer_markdown and suggested_note_update_markdown."
    )

    user_prompt = (
        "Plant context:\n"
        f"- Plant name: {plant.name}\n"
        f"- Species: {species_name}\n"
        f"- Tags: {tag_list}\n"
        f"- Plant notes: {plant.notes or 'None'}\n"
        f"- Species notes: {species_notes}\n\n"
        f"Question: {question}\n\n"
        "Requirements:\n"
        "- answer_markdown should prioritize plant notes, then species notes, then best practices.\n"
        "- Keep it useful for a home gardener and include actionable next steps.\n"
        "- suggested_note_update_markdown should be a short markdown addendum the user may append.\n"
        "- If no note update is needed, return an empty string for suggested_note_update_markdown.\n"
    )

    raw = _run_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3,
        max_tokens=700,
    )
    payload = _extract_json_object(raw)

    answer = str(payload.get("answer_markdown") or "").strip()
    suggestion = str(payload.get("suggested_note_update_markdown") or "").strip()

    if not answer:
        answer = "I could not generate an answer right now. Please try again with a more specific question."

    return {
        "answer_markdown": answer,
        "suggested_note_update_markdown": suggestion or None,
    }
