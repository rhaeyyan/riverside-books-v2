from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import (
    BookRepository,
    EventRepository,
    MessageRepository,
    StoreInfoRepository,
)
from backend.api.deps import (
    get_book_repo,
    get_event_repo,
    get_message_repo,
    get_store_info_repo,
)
from backend.api.models import Message
from backend.chatbot.service import get_node, handle_stock_query
from backend.chatbot.tree import CHAT_TREE

router = APIRouter()


class ChatMessageRequest(BaseModel):
    node_id: str
    input: str | None = ""


class EscalateRequest(BaseModel):
    name: str
    contact: str
    body: str


@router.get("/tree")
def get_chat_tree(
    store_repo: StoreInfoRepository = Depends(get_store_info_repo),
    event_repo: EventRepository = Depends(get_event_repo),
):
    store = store_repo.get_store_info()
    events = event_repo.get_all()
    # Return all nodes but resolved
    tree = {}
    for node_id in CHAT_TREE:
        tree[node_id] = get_node(node_id, store, events)
    return tree


@router.post("/message")
def post_chat_message(
    payload: ChatMessageRequest,
    store_repo: StoreInfoRepository = Depends(get_store_info_repo),
    event_repo: EventRepository = Depends(get_event_repo),
    book_repo: BookRepository = Depends(get_book_repo),
):
    if payload.node_id == "check_stock" and payload.input:
        store = store_repo.get_store_info()
        books = book_repo.get_all()
        return handle_stock_query(payload.input, books, store)

    store = store_repo.get_store_info()
    events = event_repo.get_all()
    try:
        return get_node(payload.node_id, store, events)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/escalate", response_model=Message)
def post_chat_escalate(
    payload: EscalateRequest, msg_repo: MessageRepository = Depends(get_message_repo)
):
    msg = Message(
        message_id=f"msg_{uuid4().hex[:8]}",
        name=payload.name,
        contact=payload.contact,
        body=payload.body,
        created_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        status="new",
    )
    return msg_repo.create(msg)
