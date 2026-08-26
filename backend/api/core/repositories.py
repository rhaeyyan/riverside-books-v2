"""Repository pattern implementation encapsulating JSON datastore operations.

Provides domain-level data access, filtering, search, pagination, and atomic mutations
for Books, Customers, Orders, Events, StoreInfo, and Messages.
"""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UniqueViolation

from backend.api.core import db
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
        self,
        datastore: JsonDatastore | None = None,
        collection_name: str = "inventory.json",
        conn: Connection | None = None,
    ) -> None:
        """Initialize repository with optional datastore or connection.

        Args:
            datastore: Optional JsonDatastore instance for backward compatibility.
            collection_name: Optional file name for backward compatibility.
            conn: Optional psycopg Connection instance. If omitted, queries use
                the active scoped connection or the connection pool.
        """
        self.datastore = datastore
        self.collection_name = collection_name
        self.conn = conn

    def _use_datastore(self) -> bool:
        return (
            self.datastore is not None
            and self.conn is None
            and db.get_current_connection() is None
        )

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
        if self._use_datastore():
            assert self.datastore is not None
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

        sql = """
            SELECT isbn, title, author, format, price_cents, stock_count,
                   reserved_count, low_stock_threshold, genre, blurb,
                   cover_image_url, publisher,
                   published_date::text AS published_date
            FROM books
        """
        clauses = []
        params: list[Any] = []

        if query:
            q = query.strip()
            q_lower = f"%{q.lower()}%"
            q_norm = normalize_isbn(q)
            if q_norm:
                q_norm_pattern = f"%{q_norm}%"
                clauses.append(
                    "(lower(title) LIKE %s OR lower(author) LIKE %s "
                    "OR lower(isbn) LIKE %s OR lower(isbn) LIKE %s)"
                )
                params.extend([q_lower, q_lower, q_lower, q_norm_pattern])
            else:
                clauses.append(
                    "(lower(title) LIKE %s OR lower(author) LIKE %s "
                    "OR lower(isbn) LIKE %s)"
                )
                params.extend([q_lower, q_lower, q_lower])

        if in_stock_only:
            clauses.append("(stock_count - reserved_count) > 0")

        if clauses:
            sql += " WHERE " + " AND ".join(clauses)

        sql += " ORDER BY title ASC, isbn ASC"

        if limit is not None:
            sql += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])
        elif offset > 0:
            sql += " OFFSET %s"
            params.append(offset)

        rows = db.fetch_all(sql, params, conn=self.conn)
        return [Book.model_validate(r) for r in rows]

    def get_by_isbn(self, isbn: str) -> Book | None:
        """Retrieve a single book by exact or normalized ISBN.

        Args:
            isbn: Raw or formatted ISBN-10/13.

        Returns:
            Matching Book domain model, or None if not found.
        """
        if self._use_datastore():
            assert self.datastore is not None
            target_isbn = normalize_isbn(isbn)
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if normalize_isbn(item.get("isbn", "")) == target_isbn:
                    return Book.model_validate(item)
            return None

        target_isbn = normalize_isbn(isbn) or isbn.strip()
        sql = """
            SELECT isbn, title, author, format, price_cents, stock_count,
                   reserved_count, low_stock_threshold, genre, blurb,
                   cover_image_url, publisher,
                   published_date::text AS published_date
            FROM books
            WHERE isbn = %s OR isbn = %s
        """
        row = db.fetch_one(sql, (target_isbn, isbn.strip()), conn=self.conn)
        return Book.model_validate(row) if row else None

    def create(self, book: Book) -> Book:
        """Persist a new book record into the database.

        Args:
            book: Book domain model instance to persist.

        Returns:
            The created Book instance.

        Raises:
            ValueError: If a book with the same ISBN already exists.
        """
        if self._use_datastore():
            assert self.datastore is not None
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

        target_isbn = normalize_isbn(book.isbn) or book.isbn
        if self.get_by_isbn(target_isbn) is not None:
            raise ValueError(
                f"Book with ISBN '{book.isbn}' already exists in inventory."
            )

        sql = """
            INSERT INTO books (
                isbn, title, author, format, price_cents, stock_count,
                reserved_count, low_stock_threshold, genre, blurb,
                cover_image_url, publisher, published_date
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        try:
            with db.transaction(self.conn) as conn:
                conn.execute(
                    sql,
                    (
                        target_isbn,
                        book.title,
                        book.author,
                        book.format,
                        book.price_cents,
                        book.stock_count,
                        book.reserved_count,
                        book.low_stock_threshold,
                        book.genre,
                        book.blurb,
                        book.cover_image_url,
                        book.publisher,
                        book.published_date,
                    ),
                )
        except UniqueViolation as err:
            raise ValueError(
                f"Book with ISBN '{book.isbn}' already exists in inventory."
            ) from err

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
            ValueError: If stock_count is negative.
        """
        if stock_count < 0:
            raise ValueError("stock_count cannot be negative.")

        if self._use_datastore():
            assert self.datastore is not None
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

        target_isbn = normalize_isbn(isbn) or isbn.strip()
        sql = """
            UPDATE books
            SET stock_count = %s
            WHERE isbn = %s
            RETURNING isbn, title, author, format, price_cents, stock_count,
                      reserved_count, low_stock_threshold, genre, blurb,
                      cover_image_url, publisher,
                      published_date::text AS published_date
        """
        with db.transaction(self.conn) as conn:
            cur = conn.execute(sql, (stock_count, target_isbn))
            row = cur.fetchone()
            if not row:
                raise KeyError(f"Book with ISBN '{isbn}' not found.")
            return Book.model_validate(row)

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
        if self._use_datastore():
            assert self.datastore is not None
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

        target_isbn = normalize_isbn(isbn) or isbn.strip()
        sql = """
            UPDATE books
            SET reserved_count = reserved_count + %s
            WHERE isbn = %s
            RETURNING isbn, title, author, format, price_cents, stock_count,
                      reserved_count, low_stock_threshold, genre, blurb,
                      cover_image_url, publisher,
                      published_date::text AS published_date
        """
        with db.transaction(self.conn) as conn:
            cur = conn.execute(sql, (delta, target_isbn))
            row = cur.fetchone()
            if not row:
                raise KeyError(f"Book with ISBN '{isbn}' not found.")
            return Book.model_validate(row)


class CustomerRepository:
    """Repository encapsulating customer profiles and loyalty card operations."""

    def __init__(
        self,
        datastore: JsonDatastore | None = None,
        collection_name: str = "customers.json",
        conn: Connection | None = None,
    ) -> None:
        """Initialize repository with optional datastore or connection.

        Args:
            datastore: Optional JsonDatastore instance for backward compatibility.
            collection_name: Optional file name for backward compatibility.
            conn: Optional psycopg Connection instance. If omitted, queries use
                the active scoped connection or the connection pool.
        """
        self.datastore = datastore
        self.collection_name = collection_name
        self.conn = conn

    def _use_datastore(self) -> bool:
        return (
            self.datastore is not None
            and self.conn is None
            and db.get_current_connection() is None
        )

    def get_all(self) -> list[Customer]:
        """Retrieve all customer records.

        Returns:
            List of Customer domain models.
        """
        if self._use_datastore():
            assert self.datastore is not None
            raw_data = self.datastore.load(self.collection_name)
            return [Customer.model_validate(item) for item in raw_data]

        sql = """
            SELECT customer_id, phone, name, email, stamps,
                   rewards_available, joined_date::text AS joined_date
            FROM customers
            ORDER BY customer_id ASC
        """
        rows = db.fetch_all(sql, conn=self.conn)
        return [Customer.model_validate(r) for r in rows]

    def get_by_id(self, customer_id: str) -> Customer | None:
        """Retrieve a single customer by their unique customer_id.

        Args:
            customer_id: Unique customer ID (e.g. 'cust_001').

        Returns:
            Customer domain model, or None if not found.
        """
        if self._use_datastore():
            assert self.datastore is not None
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if item.get("customer_id") == customer_id:
                    return Customer.model_validate(item)
            return None

        sql = """
            SELECT customer_id, phone, name, email, stamps,
                   rewards_available, joined_date::text AS joined_date
            FROM customers
            WHERE customer_id = %s
        """
        row = db.fetch_one(sql, (customer_id,), conn=self.conn)
        return Customer.model_validate(row) if row else None

    def get_by_phone(self, phone: str) -> Customer | None:
        """Retrieve a customer by matching normalized phone number digits.

        Args:
            phone: Phone number in any formatting.

        Returns:
            Customer domain model, or None if not found.
        """
        if self._use_datastore():
            assert self.datastore is not None
            norm_phone = normalize_phone(phone)
            raw_data = self.datastore.load(self.collection_name)
            for item in raw_data:
                if normalize_phone(item.get("phone", "")) == norm_phone:
                    return Customer.model_validate(item)
            return None

        norm_phone = normalize_phone(phone)
        sql = """
            SELECT customer_id, phone, name, email, stamps,
                   rewards_available, joined_date::text AS joined_date
            FROM customers
            WHERE phone = %s
        """
        row = db.fetch_one(sql, (norm_phone,), conn=self.conn)
        return Customer.model_validate(row) if row else None

    def create(self, customer: Customer) -> Customer:
        """Persist a new customer record into the database.

        Args:
            customer: Customer domain model instance to persist.

        Returns:
            The created Customer instance.

        Raises:
            ValueError: If a customer with the same phone or customer_id exists.
        """
        if self._use_datastore():
            assert self.datastore is not None
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

        norm_phone = normalize_phone(customer.phone)
        check_sql = """
            SELECT customer_id, phone FROM customers
            WHERE phone = %s OR customer_id = %s
        """
        existing = db.fetch_one(
            check_sql, (norm_phone, customer.customer_id), conn=self.conn
        )
        if existing:
            if existing["phone"] == norm_phone:
                raise ValueError(
                    f"Customer with phone '{customer.phone}' already exists."
                )
            raise ValueError(
                f"Customer with ID '{customer.customer_id}' already exists."
            )

        sql = """
            INSERT INTO customers (
                customer_id, phone, name, email, stamps,
                rewards_available, joined_date
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            )
        """
        with db.transaction(self.conn) as conn:
            conn.execute(
                sql,
                (
                    customer.customer_id,
                    norm_phone,
                    customer.name,
                    customer.email,
                    customer.stamps,
                    customer.rewards_available,
                    customer.joined_date,
                ),
            )
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
        if self._use_datastore():
            assert self.datastore is not None
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

        sql = """
            UPDATE customers
            SET stamps = %s, rewards_available = %s
            WHERE customer_id = %s
            RETURNING customer_id, phone, name, email, stamps,
                      rewards_available, joined_date::text AS joined_date
        """
        with db.transaction(self.conn) as conn:
            cur = conn.execute(sql, (stamps, rewards_available, customer_id))
            row = cur.fetchone()
            if not row:
                raise KeyError(f"Customer with ID '{customer_id}' not found.")
            return Customer.model_validate(row)


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
        self,
        datastore: JsonDatastore | None = None,
        collection_name: str = "store_info.json",
        conn: Connection | None = None,
    ) -> None:
        """Initialize repository with optional datastore or connection.

        Args:
            datastore: Optional JsonDatastore instance for backward compatibility.
            collection_name: Optional file name for backward compatibility.
            conn: Optional psycopg Connection instance. If omitted, queries use
                the active scoped connection or the connection pool.
        """
        self.datastore = datastore
        self.collection_name = collection_name
        self.conn = conn

    def _use_datastore(self) -> bool:
        return (
            self.datastore is not None
            and self.conn is None
            and db.get_current_connection() is None
        )

    def get_store_info(self) -> StoreInfo:
        """Retrieve full store information, policies, hours, and FAQs.

        Returns:
            StoreInfo domain model.

        Raises:
            RuntimeError: If store_info is not found in database.
        """
        if self._use_datastore():
            assert self.datastore is not None
            raw_data = self.datastore.load(self.collection_name)
            return StoreInfo.model_validate(raw_data)

        sql = """
            SELECT name, address, phone, email, hours, policies, faqs
            FROM store_info
            WHERE id = true
        """
        row = db.fetch_one(sql, conn=self.conn)
        if not row:
            raise RuntimeError("Store information is not configured in database.")
        return StoreInfo.model_validate(row)


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
