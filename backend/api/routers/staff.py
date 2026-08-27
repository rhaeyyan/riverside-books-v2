"""Staff login (§5.3, v0.5).

No registration endpoint -- accounts are provisioned by seed data only,
matching how a real store's manager hands out accounts rather than letting
staff self-sign-up.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.core.auth import verify_password
from backend.api.core.repositories import StaffRepository
from backend.api.deps import get_staff_repo
from backend.api.models import EMAIL_PATTERN, StaffMember

router = APIRouter()


class StaffLogin(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str


@router.post("/login", response_model=StaffMember)
def login_staff(payload: StaffLogin, repo: StaffRepository = Depends(get_staff_repo)):
    found = repo.get_password_hash(payload.email)
    if not found or not verify_password(payload.password, found[1]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    staff_id, _ = found
    staff = repo.get_by_email(payload.email)
    if not staff:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return staff
