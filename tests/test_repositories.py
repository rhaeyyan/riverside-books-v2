"""Tests for Repository Pattern implementations.

Covers:
- BookRepository: query filtering, search, pagination, stock adjustments.
- CustomerRepository: lookup by phone (normalized) and ID, loyalty updates.
- OrderRepository: status filtering, customer order history, lazy expiration.
- Concurrency & Thread-Safety: verifying datastore locking isolates writes.
- Cross-collection isolation: ensuring distinct repositories do not block.
"""

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from psycopg import Connection

from backend.api.core.datastore import JsonDatastore
from backend.api.core.db import set_current_connection
from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    OrderRepository,
    StoreInfoRepository,
)
from backend.api.models import (
    Book,
    Customer,
    Order,
    OrderItem,
    StoreInfo,
)

MOCK_DATA_DIR = Path(__file__).resolve().parent.parent / "mock_data"


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def datastore(tmp_path: Path) -> JsonDatastore:
    """Create a JsonDatastore populated with seed data copies in a temp directory."""
    for seed_file in ["inventory.json", "customers.json", "orders.json"]:
        source = MOCK_DATA_DIR / seed_file
        dest = tmp_path / seed_file
        if source.exists():
            dest.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            dest.write_text("[]", encoding="utf-8")
    return JsonDatastore(data_dir=tmp_path)


@pytest.fixture
def empty_datastore(tmp_path: Path) -> JsonDatastore:
    """Create a datastore with empty collections."""
    (tmp_path / "inventory.json").write_text("[]", encoding="utf-8")
    (tmp_path / "customers.json").write_text("[]", encoding="utf-8")
    (tmp_path / "orders.json").write_text("[]", encoding="utf-8")
    return JsonDatastore(data_dir=tmp_path)


@pytest.fixture
def book_repo(db_connection: Connection) -> BookRepository:
    """Provide BookRepository instance backed by Postgres transaction."""
    return BookRepository()


@pytest.fixture
def customer_repo(db_connection: Connection) -> CustomerRepository:
    """Provide CustomerRepository instance backed by Postgres transaction."""
    return CustomerRepository()


@pytest.fixture
def store_info_repo(db_connection: Connection) -> StoreInfoRepository:
    """Provide StoreInfoRepository instance backed by Postgres transaction."""
    return StoreInfoRepository()


@pytest.fixture
def order_repo(datastore: JsonDatastore) -> OrderRepository:
    """Provide OrderRepository instance."""
    return OrderRepository(datastore=datastore)


# ============================================================================
# BookRepository Tests
# ============================================================================


class TestBookRepository:
    """Unit and behavioral tests for BookRepository."""

    def test_get_all_returns_typed_domain_models(
        self, book_repo: BookRepository
    ) -> None:
        """Ensure get_all returns a list of Book domain models."""
        books = book_repo.get_all()
        assert len(books) >= 30
        for book in books:
            assert isinstance(book, Book)
            assert isinstance(book.available_count, int)
            assert book.stock_status in {"in_stock", "low_stock", "out_of_stock"}

    def test_get_by_isbn_exact_and_normalized(self, book_repo: BookRepository) -> None:
        """Ensure get_by_isbn handles formatted ISBNs with hyphens and spaces."""
        # Query by normalized ISBN
        book = book_repo.get_by_isbn("9780143039433")
        assert book is not None
        assert isinstance(book, Book)
        assert book.isbn == "9780143039433"
        assert book.title == "The Grapes of Wrath"

        # Query by formatted ISBN with hyphens
        book_hyphen = book_repo.get_by_isbn("978-0-14-303943-3")
        assert book_hyphen is not None
        assert book_hyphen.isbn == "9780143039433"

        # Query non-existent ISBN
        assert book_repo.get_by_isbn("9999999999999") is None

    def test_get_all_search_by_title_author_isbn(
        self, book_repo: BookRepository
    ) -> None:
        """Test filtering by search query across title, author, and ISBN."""
        # Search by partial title (case-insensitive)
        grapes = book_repo.get_all(query="grapes")
        assert len(grapes) >= 1
        assert any("grapes" in b.title.lower() for b in grapes)

        # Search by partial author
        steinbeck = book_repo.get_all(query="Steinbeck")
        assert len(steinbeck) >= 1
        assert any("steinbeck" in b.author.lower() for b in steinbeck)

        # Search by partial ISBN
        by_isbn = book_repo.get_all(query="0143039433")
        assert len(by_isbn) >= 1
        assert any("0143039433" in b.isbn for b in by_isbn)

        # Non-matching query returns empty list
        assert book_repo.get_all(query="nonexistentsearchtermxyz") == []

    def test_get_all_in_stock_only_filter(self, book_repo: BookRepository) -> None:
        """Ensure in_stock_only=True excludes books with available_count <= 0."""
        all_books = book_repo.get_all()
        in_stock_books = book_repo.get_all(in_stock_only=True)

        assert len(in_stock_books) < len(all_books)
        for book in in_stock_books:
            assert book.available_count > 0
            assert book.stock_status in {"in_stock", "low_stock"}

    def test_get_all_pagination_limit_and_offset(
        self, book_repo: BookRepository
    ) -> None:
        """Ensure pagination parameters correctly slice the results."""
        all_books = book_repo.get_all()
        page_1 = book_repo.get_all(limit=5, offset=0)
        page_2 = book_repo.get_all(limit=5, offset=5)

        assert len(page_1) == 5
        assert len(page_2) == 5
        assert [b.isbn for b in page_1] != [b.isbn for b in page_2]
        assert [b.isbn for b in page_1] == [b.isbn for b in all_books[:5]]
        assert [b.isbn for b in page_2] == [b.isbn for b in all_books[5:10]]

    def test_create_book(self, book_repo: BookRepository) -> None:
        """Ensure creating a book saves it to the datastore and returns Book."""
        new_book = Book(
            isbn="9780000000001",
            title="The Art of Software Testing",
            author="Glenford J. Myers",
            format="paperback",
            price_cents=3500,
            stock_count=5,
            reserved_count=0,
            low_stock_threshold=2,
            genre="Technology",
            publisher="Wiley",
            published_date="2011-10-01",
        )
        created = book_repo.create(new_book)
        assert isinstance(created, Book)
        assert created.isbn == "9780000000001"

        fetched = book_repo.get_by_isbn("9780000000001")
        assert fetched is not None
        assert fetched.title == "The Art of Software Testing"

    def test_create_duplicate_isbn_raises_error(
        self, book_repo: BookRepository
    ) -> None:
        """Ensure creating duplicate ISBN raises ValueError."""
        duplicate_book = Book(
            isbn="9780143039433",
            title="Duplicate Title",
            author="Another Author",
            format="paperback",
            price_cents=1000,
            stock_count=1,
            genre="Fiction",
            publisher="Test",
            published_date="2020-01-01",
        )
        with pytest.raises(ValueError, match="already exists"):
            book_repo.create(duplicate_book)

    def test_update_stock_count(self, book_repo: BookRepository) -> None:
        """Ensure update_stock adjusts on-hand count and returns updated Book."""
        isbn = "9780143039433"
        updated = book_repo.update_stock(isbn, stock_count=15)
        assert isinstance(updated, Book)
        assert updated.stock_count == 15

        reloaded = book_repo.get_by_isbn(isbn)
        assert reloaded is not None
        assert reloaded.stock_count == 15

    def test_update_stock_nonexistent_book_raises_error(
        self, book_repo: BookRepository
    ) -> None:
        """Ensure updating stock of non-existent book raises KeyError or ValueError."""
        with pytest.raises((KeyError, ValueError)):
            book_repo.update_stock("0000000000000", stock_count=5)

    def test_adjust_reserved_count(self, book_repo: BookRepository) -> None:
        """Ensure adjust_reserved_count correctly increments/decrements reservations."""
        isbn = "9780525559474"
        original = book_repo.get_by_isbn(isbn)
        assert original is not None
        original_reserved = original.reserved_count

        updated = book_repo.adjust_reserved_count(isbn, delta=2)
        assert updated.reserved_count == original_reserved + 2
        assert updated.available_count == original.stock_count - (original_reserved + 2)

        # Decrement back
        reverted = book_repo.adjust_reserved_count(isbn, delta=-2)
        assert reverted.reserved_count == original_reserved


# ============================================================================
# CustomerRepository Tests
# ============================================================================


class TestCustomerRepository:
    """Unit and behavioral tests for CustomerRepository."""

    def test_get_all_returns_typed_domain_models(
        self, customer_repo: CustomerRepository
    ) -> None:
        """Ensure get_all returns a list of Customer domain models."""
        customers = customer_repo.get_all()
        assert len(customers) >= 8
        for customer in customers:
            assert isinstance(customer, Customer)
            assert customer.customer_id.startswith("cust_")

    def test_get_by_id(self, customer_repo: CustomerRepository) -> None:
        """Ensure get_by_id returns matching customer or None."""
        cust = customer_repo.get_by_id("cust_001")
        assert cust is not None
        assert isinstance(cust, Customer)
        assert cust.customer_id == "cust_001"

        assert customer_repo.get_by_id("cust_nonexistent") is None

    def test_get_by_phone_normalized(self, customer_repo: CustomerRepository) -> None:
        """Ensure lookup by phone normalizes phone strings in various formats."""
        first_cust = customer_repo.get_all()[0]
        raw_phone = first_cust.phone

        formatted_1 = f"({raw_phone[:3]}) {raw_phone[3:6]}-{raw_phone[6:]}"
        formatted_2 = f"{raw_phone[:3]}-{raw_phone[3:6]}-{raw_phone[6:]}"
        formatted_3 = f"  {raw_phone}  "

        for query_phone in [raw_phone, formatted_1, formatted_2, formatted_3]:
            found = customer_repo.get_by_phone(query_phone)
            assert found is not None, f"Failed lookup for phone format: {query_phone}"
            assert isinstance(found, Customer)
            assert found.customer_id == first_cust.customer_id

        assert customer_repo.get_by_phone("9999999999") is None

    def test_create_customer(self, customer_repo: CustomerRepository) -> None:
        """Ensure creating a new customer persists correctly."""
        new_cust = Customer(
            customer_id="cust_999",
            phone="5559998888",
            name="Grace Hopper",
            email="grace@example.com",
            stamps=0,
            rewards_available=0,
            joined_date="2026-08-24",
        )
        created = customer_repo.create(new_cust)
        assert isinstance(created, Customer)
        assert created.customer_id == "cust_999"

        fetched = customer_repo.get_by_id("cust_999")
        assert fetched is not None
        assert fetched.name == "Grace Hopper"

    def test_create_duplicate_phone_raises_error(
        self, customer_repo: CustomerRepository
    ) -> None:
        """Ensure duplicate phone registrations raise ValueError."""
        first_cust = customer_repo.get_all()[0]
        duplicate = Customer(
            customer_id="cust_dup",
            phone=first_cust.phone,
            name="Duplicate Person",
            joined_date="2026-08-24",
        )
        with pytest.raises(ValueError, match="already exists"):
            customer_repo.create(duplicate)

    def test_update_loyalty(self, customer_repo: CustomerRepository) -> None:
        """Ensure updating stamps and rewards persists and returns updated Customer."""
        cust = customer_repo.get_all()[0]
        updated = customer_repo.update_loyalty(
            customer_id=cust.customer_id,
            stamps=8,
            rewards_available=2,
        )
        assert isinstance(updated, Customer)
        assert updated.stamps == 8
        assert updated.rewards_available == 2

        reloaded = customer_repo.get_by_id(cust.customer_id)
        assert reloaded is not None
        assert reloaded.stamps == 8
        assert reloaded.rewards_available == 2


# ============================================================================
# OrderRepository Tests
# ============================================================================


class TestOrderRepository:
    """Unit and behavioral tests for OrderRepository."""

    def test_get_all_returns_typed_domain_models(
        self, order_repo: OrderRepository
    ) -> None:
        """Ensure get_all returns a list of Order domain models."""
        orders = order_repo.get_all()
        assert len(orders) >= 10
        for order in orders:
            assert isinstance(order, Order)
            assert isinstance(order.items, list)
            for item in order.items:
                assert isinstance(item, OrderItem)

    def test_get_all_filter_by_status(self, order_repo: OrderRepository) -> None:
        """Ensure get_all(status=...) filters by order status."""
        pending_orders = order_repo.get_all(status="pending")
        assert len(pending_orders) >= 1
        for order in pending_orders:
            assert order.status == "pending"

        completed_orders = order_repo.get_all(status="completed")
        assert len(completed_orders) >= 1
        for order in completed_orders:
            assert order.status == "completed"

    def test_get_by_id(self, order_repo: OrderRepository) -> None:
        """Ensure get_by_id returns specific Order or None."""
        first_order = order_repo.get_all()[0]
        found = order_repo.get_by_id(first_order.order_id)
        assert found is not None
        assert isinstance(found, Order)
        assert found.order_id == first_order.order_id

        assert order_repo.get_by_id("order_nonexistent") is None

    def test_get_by_customer_id(self, order_repo: OrderRepository) -> None:
        """Ensure get_by_customer_id returns orders matching customer_id."""
        first_order = order_repo.get_all()[0]
        cust_orders = order_repo.get_by_customer_id(first_order.customer_id)
        assert len(cust_orders) >= 1
        for order in cust_orders:
            assert order.customer_id == first_order.customer_id

    def test_create_order(self, order_repo: OrderRepository) -> None:
        """Ensure creating an order persists cleanly and returns typed Order."""
        new_order = Order(
            order_id="order_test_999",
            customer_id="cust_001",
            items=[OrderItem(isbn="9780143039433", quantity=2)],
            status="pending",
            created_at="2026-08-24T12:00:00Z",
            hold_expires_at="2026-08-26T12:00:00Z",
            total_cents=3798,
            notes="Please keep at front counter",
        )
        created = order_repo.create(new_order)
        assert isinstance(created, Order)
        assert created.order_id == "order_test_999"

        fetched = order_repo.get_by_id("order_test_999")
        assert fetched is not None
        assert fetched.notes == "Please keep at front counter"
        assert len(fetched.items) == 1
        assert fetched.items[0].quantity == 2

    def test_update_status(self, order_repo: OrderRepository) -> None:
        """Ensure updating status changes order state atomically."""
        first_order = order_repo.get_all()[0]
        updated = order_repo.update_status(
            first_order.order_id, new_status="ready_for_pickup"
        )
        assert isinstance(updated, Order)
        assert updated.status == "ready_for_pickup"

        reloaded = order_repo.get_by_id(first_order.order_id)
        assert reloaded is not None
        assert reloaded.status == "ready_for_pickup"

    def test_get_expired_pending_orders(self, order_repo: OrderRepository) -> None:
        """Ensure get_expired_pending_orders retrieves pending orders past expiry."""
        expired_orders = order_repo.get_expired_pending_orders()
        assert len(expired_orders) >= 1
        for order in expired_orders:
            assert order.status == "pending"
            assert order.is_expired() is True


# ============================================================================
# Concurrency & Locking Isolation Tests
# ============================================================================


class TestRepositoryConcurrencyAndLocking:
    """Tests validating repository thread-safety and lock isolation."""

    def test_concurrent_stock_mutations_preserve_consistency(self) -> None:
        """Verify concurrent stock adjustments on same collection do not lose writes."""
        set_current_connection(None)
        book_repo = BookRepository()
        isbn = "9780525559474"
        initial_book = book_repo.get_by_isbn(isbn)
        assert initial_book is not None
        initial_reserved = initial_book.reserved_count
        book_repo.update_stock(isbn, stock_count=initial_book.stock_count + 100)

        num_threads = 10
        deltas_per_thread = 5

        def worker_adjust() -> None:
            set_current_connection(None)
            for _ in range(deltas_per_thread):
                book_repo.adjust_reserved_count(isbn, delta=1)

        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_adjust) for _ in range(num_threads)]
            for f in futures:
                f.result()

        final_book = book_repo.get_by_isbn(isbn)
        assert final_book is not None
        expected_reserved = initial_reserved + (num_threads * deltas_per_thread)
        assert final_book.reserved_count == expected_reserved

        # Clean up
        book_repo.adjust_reserved_count(
            isbn, delta=-(num_threads * deltas_per_thread)
        )
        book_repo.update_stock(isbn, stock_count=initial_book.stock_count)

    def test_concurrent_customer_loyalty_mutations(self) -> None:
        """Verify concurrent updates to distinct customers preserve integrity."""
        set_current_connection(None)
        customer_repo = CustomerRepository()
        customers = customer_repo.get_all()[:5]
        customer_ids = [c.customer_id for c in customers]

        def worker_update(cid: str) -> None:
            set_current_connection(None)
            for i in range(10):
                customer_repo.update_loyalty(
                    customer_id=cid,
                    stamps=i % 10,
                    rewards_available=i // 5,
                )

        with ThreadPoolExecutor(max_workers=len(customer_ids)) as executor:
            futures = [executor.submit(worker_update, cid) for cid in customer_ids]
            for f in futures:
                f.result()

        for cid in customer_ids:
            cust = customer_repo.get_by_id(cid)
            assert cust is not None
            assert isinstance(cust, Customer)

    def test_cross_collection_concurrency_no_deadlock(
        self, order_repo: OrderRepository
    ) -> None:
        """Verify distinct repositories operate without deadlock."""
        set_current_connection(None)
        book_repo = BookRepository()
        customer_repo = CustomerRepository()
        num_iterations = 20

        def mutate_books() -> None:
            set_current_connection(None)
            for i in range(num_iterations):
                book_repo.update_stock("9780143039433", stock_count=10 + i)

        def mutate_customers() -> None:
            set_current_connection(None)
            for j in range(num_iterations):
                customer_repo.update_loyalty(
                    "cust_001", stamps=j % 10, rewards_available=0
                )

        def mutate_orders() -> None:
            for k in range(num_iterations):
                status = "ready_for_pickup" if k % 2 == 0 else "pending"
                order_repo.update_status("order_001", new_status=status)

        threads = [
            threading.Thread(target=mutate_books),
            threading.Thread(target=mutate_customers),
            threading.Thread(target=mutate_orders),
        ]

        for t in threads:
            t.start()

        for t in threads:
            t.join(timeout=10)
            assert not t.is_alive(), f"Thread {t.name} timed out or deadlocked"

        book_repo.update_stock("9780143039433", stock_count=0)


# ============================================================================
# StoreInfoRepository Tests
# ============================================================================


class TestStoreInfoRepository:
    """Unit and behavioral tests for StoreInfoRepository."""

    def test_get_store_info_returns_typed_domain_model(
        self, store_info_repo: StoreInfoRepository
    ) -> None:
        """Ensure get_store_info returns a populated StoreInfo domain model."""
        info = store_info_repo.get_store_info()
        assert isinstance(info, StoreInfo)
        assert "Riverside Books" in info.name
        assert info.hours.tuesday is not None
        assert len(info.faqs) >= 6

