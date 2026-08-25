from fastapi import APIRouter, Depends

from backend.api.core.repositories import StoreInfoRepository
from backend.api.deps import get_store_info_repo
from backend.api.models import StoreInfo

router = APIRouter()


@router.get("", response_model=StoreInfo)
def get_store_info(repo: StoreInfoRepository = Depends(get_store_info_repo)):
    return repo.get_store_info()
