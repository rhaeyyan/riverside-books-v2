from fastapi import APIRouter

router = APIRouter()


@router.get("/tones")
def get_tones():
    return {}


@router.post("/generate")
def generate_marketing():
    return {}
