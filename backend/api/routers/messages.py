from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import MessageRepository, StoreInfoRepository
from backend.api.deps import get_message_repo, get_store_info_repo
from backend.api.models import Message
from backend.messages.gemini_reply import generate_draft_reply


class DraftReplyResponse(BaseModel):
    draft_text: str


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


@router.post("/{message_id}/draft-reply", response_model=DraftReplyResponse)
def draft_reply(
    message_id: str,
    repo: MessageRepository = Depends(get_message_repo),
    store_repo: StoreInfoRepository = Depends(get_store_info_repo),
):
    msg = repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    store_info = store_repo.get_store_info()

    try:
        draft = generate_draft_reply(msg, store_info)
        return DraftReplyResponse(draft_text=draft)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=500, detail="Failed to generate draft from Gemini"
        )
