from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.core.repositories import CustomerRepository, OrderRepository
from backend.api.deps import get_customer_repo, get_order_repo, release_expired_holds
from backend.api.models import Customer, Order, normalize_phone

router = APIRouter()


class CustomerLookup(BaseModel):
    phone: str


class CustomerRegister(BaseModel):
    phone: str
    name: str
    email: str | None = ""


class LoyaltyResponse(BaseModel):
    stamps: int
    rewards_available: int
    stamps_to_next_reward: int


@router.post("/lookup", response_model=Customer)
def lookup_customer(
    payload: CustomerLookup, repo: CustomerRepository = Depends(get_customer_repo)
):
    phone = normalize_phone(payload.phone)
    customer = repo.get_by_phone(phone)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("", response_model=Customer)
def register_customer(
    payload: CustomerRegister, repo: CustomerRepository = Depends(get_customer_repo)
):
    phone = normalize_phone(payload.phone)
    if len(phone) != 10:
        raise HTTPException(
            status_code=400, detail="Phone number must be 10 digits"
        )
    if repo.get_by_phone(phone):
        raise HTTPException(
            status_code=400, detail="Customer with this phone already exists"
        )

    # Simple ID generation
    customer_id = f"cust_{uuid4().hex[:8]}"
    now_str = datetime.now(UTC).strftime("%Y-%m-%d")

    new_customer = Customer(
        customer_id=customer_id,
        phone=phone,
        name=payload.name,
        email=payload.email or "",
        stamps=0,
        rewards_available=0,
        joined_date=now_str,
    )
    return repo.create(new_customer)


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
