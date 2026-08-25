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
            # First set to expired
            order_repo.update_status(order.order_id, "expired")
            # Then decrement reserved count
            for item in order.items:
                book_repo.adjust_reserved_count(item.isbn, -item.quantity)
        except Exception:
                        pass
