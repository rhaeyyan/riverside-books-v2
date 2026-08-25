from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import MessageRepository
from backend.api.deps import get_message_repo
from backend.api.models import Message

router = APIRouter()


class MessageUpdate(BaseModel):
    status: str


@router.get("", response_model=list[Message])
def get_messages(
    status: str | None = None, repo: MessageRepository = Depends(get_message_repo)
):
    return repo.get_all(status=status)


@router.patch("/{message_id}/status", response_model=Message)
def update_message_status(
    message_id: str,
    payload: MessageUpdate,
    repo: MessageRepository = Depends(get_message_repo),
):
    msg = repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.status = payload.status
    repo.update(msg)
    return msg
