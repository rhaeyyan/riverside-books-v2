from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.core.auth import hash_password, verify_password
from backend.api.core.repositories import CustomerRepository, OrderRepository
from backend.api.deps import get_customer_repo, get_order_repo, release_expired_holds
from backend.api.models import EMAIL_PATTERN, Customer, Order

router = APIRouter()


class CustomerRegister(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8)
    name: str
    phone: str | None = None


class CustomerLogin(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str


class LoyaltyResponse(BaseModel):
    stamps: int
    rewards_available: int
    stamps_to_next_reward: int


@router.post("", response_model=Customer)
def register_customer(
    payload: CustomerRegister, repo: CustomerRepository = Depends(get_customer_repo)
):
    if repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=400, detail="An account with this email already exists"
        )

    customer_id = f"cust_{uuid4().hex[:8]}"
    now_str = datetime.now(UTC).strftime("%Y-%m-%d")

    new_customer = Customer(
        customer_id=customer_id,
        email=payload.email,
        name=payload.name,
        phone=payload.phone,
        stamps=0,
        rewards_available=0,
        joined_date=now_str,
    )
    return repo.create(new_customer, hash_password(payload.password))


@router.post("/login", response_model=Customer)
def login_customer(
    payload: CustomerLogin, repo: CustomerRepository = Depends(get_customer_repo)
):
    found = repo.get_password_hash(payload.email)
    if not found or not verify_password(payload.password, found[1]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    customer_id, _ = found
    customer = repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return customer


@router.get("/{customer_id}", response_model=Customer)
def get_customer(
    customer_id: str, repo: CustomerRepository = Depends(get_customer_repo)
):
    customer = repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/{customer_id}/loyalty", response_model=LoyaltyResponse)
def get_loyalty(
    customer_id: str, repo: CustomerRepository = Depends(get_customer_repo)
):
    customer = repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return LoyaltyResponse(
        stamps=customer.stamps,
        rewards_available=customer.rewards_available,
        stamps_to_next_reward=10 - customer.stamps,
    )


@router.post("/{customer_id}/rewards/redeem")
def redeem_reward(
    customer_id: str, repo: CustomerRepository = Depends(get_customer_repo)
):
    customer = repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.rewards_available < 1:
        raise HTTPException(status_code=400, detail="No rewards available")

    updated = repo.update_loyalty(
        customer_id, customer.stamps, customer.rewards_available - 1
    )
    return updated


@router.get(
    "/{customer_id}/orders",
    response_model=list[Order],
    dependencies=[Depends(release_expired_holds)],
)
def get_customer_orders(
    customer_id: str, repo: OrderRepository = Depends(get_order_repo)
):
    # The order statuses will be returned up to date because of the dependency
    orders = repo.get_by_customer_id(customer_id)
    # Return newest first
    orders.sort(key=lambda x: x.created_at, reverse=True)
    return orders
