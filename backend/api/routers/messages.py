from fastapi import APIRouter, Depends

from backend.api.core.repositories import MessageRepository
from backend.api.deps import get_message_repo
from backend.api.models import Message

router = APIRouter()


@router.get("", response_model=list[Message])
def get_messages(
    status: str | None = None, repo: MessageRepository = Depends(get_message_repo)
):
    return repo.get_all(status=status)
