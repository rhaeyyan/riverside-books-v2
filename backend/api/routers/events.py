from fastapi import APIRouter, Depends

from backend.api.core.repositories import EventRepository
from backend.api.deps import get_event_repo
from backend.api.models import Event

router = APIRouter()


@router.get("", response_model=list[Event])
def get_events(repo: EventRepository = Depends(get_event_repo)):
    events = repo.get_all()
    events.sort(key=lambda x: x.starts_at)
    return events
