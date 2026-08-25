import logging

from fastapi import Depends

from backend.api.core.datastore import JsonDatastore
from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    EventRepository,
    MessageRepository,
    OrderRepository,
    StoreInfoRepository,
)
from backend.config import settings

logger = logging.getLogger(__name__)

datastore = JsonDatastore(data_dir=settings.data_dir)


def get_book_repo() -> BookRepository:
    return BookRepository(datastore)


def get_customer_repo() -> CustomerRepository:
    return CustomerRepository(datastore)


def get_order_repo() -> OrderRepository:
    return OrderRepository(datastore)


def get_event_repo() -> EventRepository:
    return EventRepository(datastore)


def get_store_info_repo() -> StoreInfoRepository:
    return StoreInfoRepository(datastore)


def get_message_repo() -> MessageRepository:
    return MessageRepository(datastore)


def release_expired_holds(
    order_repo: OrderRepository = Depends(get_order_repo),
    book_repo: BookRepository = Depends(get_book_repo),
):
    """Dependency that lazily releases expired holds on orders and updates inventory."""
    expired = order_repo.get_expired_pending_orders()
    for order in expired:
        try:
            # Order first, then the reservation. The reverse would be worse:
            # `adjust_reserved_count` does not clamp at zero, so an order left
            # `pending` after a partial release would be swept again on the next
            # read and decrement twice, inventing stock the shop does not have.
            #
            # Neither ordering is actually correct — the two writes need to be
            # one transaction, which the JSON store cannot express. See PRD R2;
            # this is one of the nine sites that has to be rewritten as a real
            # transaction when the database lands.
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
