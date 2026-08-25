"""Repository pattern implementation encapsulating JSON datastore operations.

Provides domain-level data access, filtering, search, pagination, and atomic mutations
for Books, Customers, Orders, Events, StoreInfo, and Messages.
"""

from backend.api.core.datastore import JsonDatastore
from backend.api.models import (
    Book,
    Customer,
    Event,
    Message,
    Order,
    StoreInfo,
    normalize_isbn,
    normalize_phone,
)


class BookRepository:
    """Repository encapsulating book catalog and inventory operations."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "inventory.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for the book inventory collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_all(
        self,
        query: str | None = None,
        in_stock_only: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Book]:
        """Query books with optional search filtering, stock filtering, and pagination.

        Args:
            query: Substring search term against title, author, or ISBN.
            in_stock_only: If True, returns only books with available_count > 0.
            limit: Maximum number of books to return.
            offset: Number of items to skip for pagination.

        Returns:
            List of Book domain models matching criteria.
        """
        raw_data = self.datastore.load(self.collection_name)
        books = [Book.model_validate(item) for item in raw_data]

        if query:
            q = query.strip().lower()
            q_norm = normalize_isbn(q)
            books = [
                b
                for b in books
                if q in b.title.lower()
                or q in b.author.lower()
                or q in b.isbn.lower()
                or (q_norm and q_norm in normalize_isbn(b.isbn))
            ]

        if in_stock_only:
            books = [b for b in books if b.available_count > 0]

        if offset > 0:
            books = books[offset:]

        if limit is not None:
            books = books[:limit]

        return books

    def get_by_isbn(self, isbn: str) -> Book | None:
        """Retrieve a single book by exact or normalized ISBN.

        Args:
            isbn: Raw or formatted ISBN-10/13.

        Returns:
            Matching Book domain model, or None if not found.
        """
        target_isbn = normalize_isbn(isbn)
        raw_data = self.datastore.load(self.collection_name)
        for item in raw_data:
            if normalize_isbn(item.get("isbn", "")) == target_isbn:
                return Book.model_validate(item)
        return None

    def create(self, book: Book) -> Book:
        """Persist a new book record into the datastore.

        Args:
            book: Book domain model instance to persist.

        Returns:
            The created Book instance.

        Raises:
            ValueError: If a book with the same ISBN already exists.
        """
        target_isbn = normalize_isbn(book.isbn)
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if normalize_isbn(item.get("isbn", "")) == target_isbn:
                    raise ValueError(
                        f"Book with ISBN '{book.isbn}' already exists in inventory."
                    )
            raw_data.append(book.model_dump())
            self.datastore.save(self.collection_name, raw_data)
            return book

    def update_stock(self, isbn: str, stock_count: int) -> Book:
        """Update on-hand stock count for a book.

        Args:
            isbn: ISBN of book to update.
            stock_count: New on-hand stock quantity.

        Returns:
            Updated Book domain model.

        Raises:
            KeyError: If book is not found.
        """
        target_isbn = normalize_isbn(isbn)
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            found_idx = -1
            for idx, item in enumerate(raw_data):
                if normalize_isbn(item.get("isbn", "")) == target_isbn:
                    found_idx = idx
                    break

            if found_idx == -1:
                raise KeyError(f"Book with ISBN '{isbn}' not found.")

            raw_data[found_idx]["stock_count"] = stock_count
            updated_book = Book.model_validate(raw_data[found_idx])
            self.datastore.save(self.collection_name, raw_data)
            return updated_book

    def adjust_reserved_count(self, isbn: str, delta: int) -> Book:
        """Increment or decrement the reserved copy count for a book.

        Args:
            isbn: ISBN of book to adjust.
            delta: Integer change to apply to reserved_count (positive or negative).

        Returns:
            Updated Book domain model.

        Raises:
            KeyError: If book is not found.
        """
        target_isbn = normalize_isbn(isbn)
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            found_idx = -1
            for idx, item in enumerate(raw_data):
                if normalize_isbn(item.get("isbn", "")) == target_isbn:
                    found_idx = idx
                    break

            if found_idx == -1:
                raise KeyError(f"Book with ISBN '{isbn}' not found.")

            current_reserved = raw_data[found_idx].get("reserved_count", 0)
            raw_data[found_idx]["reserved_count"] = current_reserved + delta
            updated_book = Book.model_validate(raw_data[found_idx])
            self.datastore.save(self.collection_name, raw_data)
            return updated_book


class CustomerRepository:
    """Repository encapsulating customer profiles and loyalty card operations."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "customers.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for the customer collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_all(self) -> list[Customer]:
        """Retrieve all customer records.

        Returns:
            List of Customer domain models.
        """
        raw_data = self.datastore.load(self.collection_name)
        return [Customer.model_validate(item) for item in raw_data]

    def get_by_id(self, customer_id: str) -> Customer | None:
        """Retrieve a single customer by their unique customer_id.

        Args:
            customer_id: Unique customer ID (e.g. 'cust_001').

        Returns:
            Customer domain model, or None if not found.
        """
        raw_data = self.datastore.load(self.collection_name)
        for item in raw_data:
            if item.get("customer_id") == customer_id:
                return Customer.model_validate(item)
        return None

    def get_by_phone(self, phone: str) -> Customer | None:
        """Retrieve a customer by matching normalized phone number digits.

        Args:
            phone: Phone number in any formatting.

        Returns:
            Customer domain model, or None if not found.
        """
        norm_phone = normalize_phone(phone)
        raw_data = self.datastore.load(self.collection_name)
        for item in raw_data:
            if normalize_phone(item.get("phone", "")) == norm_phone:
                return Customer.model_validate(item)
        return None

    def create(self, customer: Customer) -> Customer:
        """Persist a new customer record into the datastore.

        Args:
            customer: Customer domain model instance to persist.

        Returns:
            The created Customer instance.

        Raises:
            ValueError: If a customer with the same phone or customer_id exists.
        """
        norm_phone = normalize_phone(customer.phone)
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if normalize_phone(item.get("phone", "")) == norm_phone:
                    raise ValueError(
                        f"Customer with phone '{customer.phone}' already exists."
                    )
                if item.get("customer_id") == customer.customer_id:
                    raise ValueError(
                        f"Customer with ID '{customer.customer_id}' already exists."
                    )
            raw_data.append(customer.model_dump())
            self.datastore.save(self.collection_name, raw_data)
            return customer

    def update_loyalty(
        self, customer_id: str, stamps: int, rewards_available: int
    ) -> Customer:
        """Update stamps and rewards count for a customer.

        Args:
            customer_id: Unique customer identifier.
            stamps: Current number of accumulated loyalty stamps (0-9).
            rewards_available: Number of earned free book rewards.

        Returns:
            Updated Customer domain model.

        Raises:
            KeyError: If customer is not found.
        """
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            found_idx = -1
            for idx, item in enumerate(raw_data):
                if item.get("customer_id") == customer_id:
                    found_idx = idx
                    break

            if found_idx == -1:
                raise KeyError(f"Customer with ID '{customer_id}' not found.")

            raw_data[found_idx]["stamps"] = stamps
            raw_data[found_idx]["rewards_available"] = rewards_available
            updated_customer = Customer.model_validate(raw_data[found_idx])
            self.datastore.save(self.collection_name, raw_data)
            return updated_customer


class OrderRepository:
    """Repository encapsulating customer order and hold reservation operations."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "orders.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for the orders collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_all(self, status: str | None = None) -> list[Order]:
        """Retrieve orders with optional status filtering.

        Args:
            status: Optional order status filter (e.g. 'pending', 'completed').

        Returns:
            List of Order domain models.
        """
        raw_data = self.datastore.load(self.collection_name)
        orders = [Order.model_validate(item) for item in raw_data]
        if status is not None:
            orders = [o for o in orders if o.status == status]
        return orders

    def get_by_id(self, order_id: str) -> Order | None:
        """Retrieve an order by its unique order ID.

        Args:
            order_id: Unique order identifier.

        Returns:
            Order domain model, or None if not found.
        """
        raw_data = self.datastore.load(self.collection_name)
        for item in raw_data:
            if item.get("order_id") == order_id:
                return Order.model_validate(item)
        return None

    def get_by_customer_id(self, customer_id: str) -> list[Order]:
        """Retrieve all orders placed by a specific customer.

        Args:
            customer_id: Unique customer ID.

        Returns:
            List of Order domain models belonging to customer.
        """
        raw_data = self.datastore.load(self.collection_name)
        return [
            Order.model_validate(item)
            for item in raw_data
            if item.get("customer_id") == customer_id
        ]

    def create(self, order: Order) -> Order:
        """Persist a new order record into the datastore.

        Args:
            order: Order domain model instance to persist.

        Returns:
            The created Order instance.

        Raises:
            ValueError: If an order with the same order_id already exists.
        """
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if item.get("order_id") == order.order_id:
                    raise ValueError(
                        f"Order with ID '{order.order_id}' already exists."
                    )
            raw_data.append(order.model_dump())
            self.datastore.save(self.collection_name, raw_data)
            return order

    def update_status(self, order_id: str, new_status: str) -> Order:
        """Update the status of an existing order.

        Args:
            order_id: Unique order identifier.
            new_status: Target status value.

        Returns:
            Updated Order domain model.

        Raises:
            KeyError: If order is not found.
        """
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            found_idx = -1
            for idx, item in enumerate(raw_data):
                if item.get("order_id") == order_id:
                    found_idx = idx
                    break

            if found_idx == -1:
                raise KeyError(f"Order with ID '{order_id}' not found.")

            raw_data[found_idx]["status"] = new_status
            updated_order = Order.model_validate(raw_data[found_idx])
            self.datastore.save(self.collection_name, raw_data)
            return updated_order

    def get_expired_pending_orders(self) -> list[Order]:
        """Retrieve all pending orders whose hold reservation has expired.

        Returns:
            List of expired pending Order domain models.
        """
        pending_orders = self.get_all(status="pending")
        return [order for order in pending_orders if order.is_expired()]


class EventRepository:
    """Repository encapsulating store author events and workshops."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "events.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for the events collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_all(self) -> list[Event]:
        """Retrieve all upcoming store events.

        Returns:
            List of Event domain models.
        """
        raw_data = self.datastore.load(self.collection_name)
        return [Event.model_validate(item) for item in raw_data]

    def get_by_id(self, event_id: str) -> Event | None:
        """Retrieve a specific event by ID.

        Args:
            event_id: Unique event identifier.

        Returns:
            Event domain model, or None if not found.
        """
        raw_data = self.datastore.load(self.collection_name)
        for item in raw_data:
            if item.get("event_id") == event_id:
                return Event.model_validate(item)
        return None


class StoreInfoRepository:
    """Repository encapsulating store metadata, hours, policies, and FAQs."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "store_info.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for store info collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_store_info(self) -> StoreInfo:
        """Retrieve full store information, policies, hours, and FAQs.

        Returns:
            StoreInfo domain model.
        """
        raw_data = self.datastore.load(self.collection_name)
        return StoreInfo.model_validate(raw_data)


class MessageRepository:
    """Repository encapsulating customer support escalation messages."""

    def __init__(
        self, datastore: JsonDatastore, collection_name: str = "messages.json"
    ) -> None:
        """Initialize repository with datastore instance.

        Args:
            datastore: JsonDatastore instance for underlying file I/O.
            collection_name: File name for customer messages collection.
        """
        self.datastore = datastore
        self.collection_name = collection_name

    def get_all(self, status: str | None = None) -> list[Message]:
        """Retrieve all customer escalation messages.

        Args:
            status: Optional message status filter (e.g. 'new', 'read').

        Returns:
            List of Message domain models.
        """
        raw_data = self.datastore.load(self.collection_name)
        messages = [Message.model_validate(item) for item in raw_data]
        if status is not None:
            messages = [m for m in messages if m.status == status]
        return messages

    def create(self, message: Message) -> Message:
        """Persist a new escalation message into the datastore.

        Args:
            message: Message domain model to persist.

        Returns:
            The created Message instance.
        """
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            raw_data.append(message.model_dump())
            self.datastore.save(self.collection_name, raw_data)
            return message

    def update_status(self, message_id: str, new_status: str) -> Message:
        """Update status of a customer escalation message.

        Args:
            message_id: Unique message identifier.
            new_status: Target status value ('new', 'read', etc.).

        Returns:
            Updated Message domain model.

        Raises:
            KeyError: If message is not found.
        """
        with self.datastore.get_lock(self.collection_name):
            raw_data = self.datastore.load(self.collection_name)
            found_idx = -1
            for idx, item in enumerate(raw_data):
                if item.get("message_id") == message_id:
                    found_idx = idx
                    break

            if found_idx == -1:
                raise KeyError(f"Message with ID '{message_id}' not found.")

            raw_data[found_idx]["status"] = new_status
            updated_msg = Message.model_validate(raw_data[found_idx])
            self.datastore.save(self.collection_name, raw_data)
            return updated_msg
