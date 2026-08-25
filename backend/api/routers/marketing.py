
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import BookRepository, EventRepository
from backend.api.deps import get_book_repo, get_event_repo
from backend.marketing.service import (
    generate_book_post,
    generate_event_post,
    get_available_tones,
)

router = APIRouter()


class GenerateRequest(BaseModel):
    subject_type: str
    subject_id: str
    tone: str
    variant: int | None = 0


@router.get("/tones")
def get_tones():
    return get_available_tones()


@router.post("/generate")
def generate_marketing(
    payload: GenerateRequest,
    book_repo: BookRepository = Depends(get_book_repo),
    event_repo: EventRepository = Depends(get_event_repo),
):
    if payload.subject_type == "book":
        book = book_repo.get_by_isbn(payload.subject_id)
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        try:
            return generate_book_post(book, payload.tone, payload.variant)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    elif payload.subject_type == "event":
        event = event_repo.get_by_id(payload.subject_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        try:
            return generate_event_post(event, payload.tone, payload.variant)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    else:
        raise HTTPException(status_code=400, detail="Invalid subject_type")
