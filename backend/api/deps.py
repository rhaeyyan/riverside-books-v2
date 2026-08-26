"""FastAPI dependency injection wiring for database repositories and services."""

import logging

from fastapi import Depends

from backend.api.core import db
from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    EventRepository,
    MessageRepository,
    OrderRepository,
    StoreInfoRepository,
)

logger = logging.getLogger(__name__)


def get_book_repo() -> BookRepository:
    """Provide BookRepository instance backed by Postgres."""
    return BookRepository()


def get_customer_repo() -> CustomerRepository:
    """Provide CustomerRepository instance backed by Postgres."""
    return CustomerRepository()


def get_order_repo() -> OrderRepository:
    """Provide OrderRepository instance backed by Postgres."""
    return OrderRepository()


def get_event_repo() -> EventRepository:
    """Provide EventRepository instance backed by Postgres."""
    return EventRepository()


def get_store_info_repo() -> StoreInfoRepository:
    """Provide StoreInfoRepository instance backed by Postgres."""
    return StoreInfoRepository()


def get_message_repo() -> MessageRepository:
    """Provide MessageRepository instance backed by Postgres."""
    return MessageRepository()


def release_expired_holds(
    order_repo: OrderRepository = Depends(get_order_repo),
    book_repo: BookRepository = Depends(get_book_repo),
) -> None:
    """Dependency that lazily releases expired holds on orders and updates inventory.

    Executes order status update and stock release atomically inside a single
    PostgreSQL transaction, satisfying PRD R2.
    """
    expired = order_repo.get_expired_pending_orders()
    for order in expired:
        try:
            with db.transaction():
                order_repo.update_status(order.order_id, "expired")
                for item in order.items:
                    book_repo.adjust_reserved_count(item.isbn, -item.quantity)
        except Exception:
            logger.exception(
                "Failed to expire order %s and release inventory in transaction",
                order.order_id,
            )
