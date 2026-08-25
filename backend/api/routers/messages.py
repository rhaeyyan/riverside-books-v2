from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import MessageRepository
from backend.api.deps import get_message_repo
from backend.api.models import Message

router = APIRouter()


class MessageUpdate(BaseModel):
    status: Literal["new", "read"]


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
    try:
        return repo.update_status(message_id, payload.status)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
