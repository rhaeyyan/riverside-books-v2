import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import BookRepository, EventRepository
from backend.api.deps import get_book_repo, get_event_repo
from backend.config import settings
from backend.marketing.gemini_service import (
    generate_book_post_gemini,
    generate_event_post_gemini,
)
from backend.marketing.service import (
    generate_book_post,
    generate_event_post,
    get_available_tones,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateRequest(BaseModel):
    subject_type: str
    subject_id: str
    tone: str
    variant: int | None = 0
    use_ai: bool | None = False


@router.get("/tones")
def get_tones():
    return get_available_tones()


@router.post("/generate")
def generate_marketing(
    payload: GenerateRequest,
    book_repo: BookRepository = Depends(get_book_repo),
    event_repo: EventRepository = Depends(get_event_repo),
):
    variant = payload.variant or 0
    if payload.subject_type == "book":
        book = book_repo.get_by_isbn(payload.subject_id)
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        if payload.use_ai and settings.gemini_api_key:
            try:
                return generate_book_post_gemini(book, payload.tone, variant)
            except Exception as e:
                logger.warning(
                    "Gemini generation failed; falling back to templates: %s",
                    e,
                )

        try:
            return generate_book_post(book, payload.tone, variant)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    elif payload.subject_type == "event":
        event = event_repo.get_by_id(payload.subject_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        if payload.use_ai and settings.gemini_api_key:
            try:
                return generate_event_post_gemini(event, payload.tone, variant)
            except Exception as e:
                logger.warning(
                    "Gemini generation failed; falling back to templates: %s",
                    e,
                )

        try:
            return generate_event_post(event, payload.tone, variant)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    else:
        raise HTTPException(status_code=400, detail="Invalid subject_type")
