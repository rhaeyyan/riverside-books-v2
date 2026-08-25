import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    OrderRepository,
)
from backend.api.deps import (
    get_book_repo,
    get_customer_repo,
    get_order_repo,
    release_expired_holds,
)
from backend.api.models import Order, OrderItem

logger = logging.getLogger(__name__)

router = APIRouter()


class OrderItemInput(BaseModel):
    isbn: str
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: str
    items: list[OrderItemInput]
    notes: str | None = ""


class OrderStatusUpdate(BaseModel):
    status: str


@router.post("", response_model=Order)
def create_order(
    payload: OrderCreate,
    order_repo: OrderRepository = Depends(get_order_repo),
    book_repo: BookRepository = Depends(get_book_repo),
    customer_repo: CustomerRepository = Depends(get_customer_repo),
):
    customer = customer_repo.get_by_id(payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    items_map = {}
    for item in payload.items:
        items_map[item.isbn] = items_map.get(item.isbn, 0) + item.quantity

    items = []
    total_cents = 0

    # but we will check stock first.
    for isbn, quantity in items_map.items():
        book = book_repo.get_by_isbn(isbn)
        if not book:
            raise HTTPException(status_code=404, detail=f"Book not found: {isbn}")

        if book.available_count < quantity:
            raise HTTPException(
                status_code=409, detail=f"Not enough available stock for {isbn}"
            )

        total_cents += book.price_cents * quantity
        items.append(OrderItem(isbn=isbn, quantity=quantity))

    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=48)

    order = Order(
        order_id=f"order_{uuid4().hex[:8]}",
        customer_id=payload.customer_id,
        items=items,
        status="pending",
        created_at=now.isoformat().replace("+00:00", "Z"),
        hold_expires_at=expires_at.isoformat().replace("+00:00", "Z"),
        total_cents=total_cents,
        notes=payload.notes or "",
    )

    created_order = order_repo.create(order)

    for item in items:
        book_repo.adjust_reserved_count(item.isbn, item.quantity)

    return created_order


@router.get(
    "", response_model=list[Order], dependencies=[Depends(release_expired_holds)]
)
def get_orders(
    status: str | None = None, order_repo: OrderRepository = Depends(get_order_repo)
):
    orders = order_repo.get_all(status=status)
    return orders


@router.patch("/{order_id}/status", response_model=Order)
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    order_repo: OrderRepository = Depends(get_order_repo),
    book_repo: BookRepository = Depends(get_book_repo),
    customer_repo: CustomerRepository = Depends(get_customer_repo),
):
    order = order_repo.get_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = order.status
    new_status = payload.status

    if current_status in ("completed", "cancelled", "expired"):
        raise HTTPException(status_code=400, detail="Terminal status cannot be changed")

    valid_transitions = {
        "pending": ["ready_for_pickup", "cancelled"],
        "ready_for_pickup": ["completed", "cancelled"],
    }

    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from {current_status} to {new_status}",
        )

    # Process completion
    if new_status == "completed":
        customer = customer_repo.get_by_id(order.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Completing an order decrements both reserved_count and stock_count.
        # This runs before the stamps write below so a rejected stock update
        # (e.g. stale reserved_count data) never leaves stamps granted for an
        # order that didn't actually complete.
        for item in order.items:
            book = book_repo.get_by_isbn(item.isbn)
            if book:
                book_repo.update_stock(book.isbn, book.stock_count - item.quantity)
                book_repo.adjust_reserved_count(book.isbn, -item.quantity)

        total_books = sum(item.quantity for item in order.items)
        new_stamps = customer.stamps + total_books
        rewards_earned = new_stamps // 10
        remaining_stamps = new_stamps % 10

        customer_repo.update_loyalty(
            customer.customer_id,
            remaining_stamps,
            customer.rewards_available + rewards_earned,
        )

    elif new_status == "cancelled":
        # cancelling an order releases the reservation immediately
        for item in order.items:
            book_repo.adjust_reserved_count(item.isbn, -item.quantity)

    updated_order = order_repo.update_status(order_id, new_status)
    return updated_order


class ReleaseExpiredResponse(BaseModel):
    released_count: int


@router.post("/release-expired", response_model=ReleaseExpiredResponse)
def force_release_expired(
    order_repo: OrderRepository = Depends(get_order_repo),
    book_repo: BookRepository = Depends(get_book_repo),
):
    expired = order_repo.get_expired_pending_orders()
    count = len(expired)

    for order in expired:
        try:
            order_repo.update_status(order.order_id, "expired")
            for item in order.items:
                try:
                    book_repo.adjust_reserved_count(item.isbn, -item.quantity)
                except Exception:
                    logger.exception(
                        "Failed to release stock for %s in order %s",
                        item.isbn,
                        order.order_id,
                    )
        except Exception:
            logger.exception(
                "Failed to expire order %s; stock not released",
                order.order_id,
            )

    return ReleaseExpiredResponse(released_count=count)
