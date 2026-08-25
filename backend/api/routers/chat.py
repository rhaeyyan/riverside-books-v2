from fastapi import APIRouter

router = APIRouter()


@router.get("/tree")
def get_chat_tree():
    return {}


@router.post("/message")
def post_chat_message():
    return {}


@router.post("/escalate")
def post_chat_escalate():
    return {}
