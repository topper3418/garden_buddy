"""AI feature API routes."""

from fastapi import APIRouter, HTTPException, status

from src.api.schemas import (
    AIQuestionRequest,
    AIQuestionResponse,
    SpeciesDraftRequest,
    SpeciesDraftResponse,
)
from src.services.ai_service import (
    answer_plant_question,
    answer_species_question,
    generate_species_draft,
)
from src.services.plant_service import get_plant_by_id
from src.services.species_service import get_species_by_id

router = APIRouter(prefix="/ai", tags=["ai"])


def _raise_ai_error(exc: ValueError) -> None:
    message = str(exc)
    if message.startswith("Missing AI configuration"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message) from exc
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message) from exc


@router.post("/species/draft", response_model=SpeciesDraftResponse)
def generate_species_draft_endpoint(payload: SpeciesDraftRequest) -> SpeciesDraftResponse:
    try:
        generated = generate_species_draft(payload.official_name)
    except ValueError as exc:
        _raise_ai_error(exc)
    return SpeciesDraftResponse.model_validate(generated)


@router.post("/plants/{plant_id}/ask", response_model=AIQuestionResponse)
def ask_plant_question_endpoint(plant_id: int, payload: AIQuestionRequest) -> AIQuestionResponse:
    plant = get_plant_by_id(plant_id, include_deleted=True)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    try:
        answer = answer_plant_question(plant, payload.question)
    except ValueError as exc:
        _raise_ai_error(exc)

    return AIQuestionResponse.model_validate(answer)


@router.post("/species/{species_id}/ask", response_model=AIQuestionResponse)
def ask_species_question_endpoint(species_id: int, payload: AIQuestionRequest) -> AIQuestionResponse:
    species = get_species_by_id(species_id)
    if not species:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")

    try:
        answer = answer_species_question(species, payload.question)
    except ValueError as exc:
        _raise_ai_error(exc)

    return AIQuestionResponse.model_validate(answer)
