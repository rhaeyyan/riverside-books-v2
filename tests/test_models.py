"""Tests for rich domain models and helper utilities.

Covers:
- Global helpers (normalize_phone, normalize_isbn)
- Seed data parsing against Pydantic models (Book, Customer, Order, etc.)
- Book computed fields (available_count, stock_status) and thresholds
- Order domain logic (is_expired)
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from backend.api.models import (
    Book,
    Customer,
    Event,
    FAQItem,
    Message,
    Order,
    OrderItem,
    StoreInfo,
    normalize_isbn,
    normalize_phone,
)

MOCK_DATA_DIR = Path(__file__).resolve().parent.parent / "mock_data"


# ============================================================================
# Helper Functions Tests
# ============================================================================


class TestHelperFunctions:
    """Tests for global normalization helpers."""

    def test_normalize_phone_various_formats(self) -> None:
        """Test normalize_phone extracts digits-only representation."""
        assert normalize_phone("(555) 100-0001") == "5551000001"
        assert normalize_phone("555-100-0002") == "5551000002"
        assert normalize_phone("555.100.0003") == "5551000003"
        assert normalize_phone(" 555 100 0004 ") == "5551000004"
        assert normalize_phone("5551000005") == "5551000005"
        assert normalize_phone("+1 (555) 100-0006") == "15551000006"

    def test_normalize_isbn_various_formats(self) -> None:
        """Test normalize_isbn removes hyphens, spaces, and preserves check digits."""
        assert normalize_isbn("978-0-14-303943-3") == "9780143039433"
        assert normalize_isbn("978 0 374 60592 8") == "9780374605928"
        assert normalize_isbn(" 978-0-525-55947-4 ") == "9780525559474"
        assert normalize_isbn("9780062315007") == "9780062315007"
        assert normalize_isbn("0-19-852663-X") == "019852663X"
        assert normalize_isbn("0-19-852663-x") == "019852663X"


# ============================================================================
# Seed Data Parsing Tests
# ============================================================================


class TestSeedDataParsing:
    """Tests confirming all seed JSON datasets parse into Pydantic models."""

    def test_inventory_seed_parsing(self) -> None:
        """Ensure all seed inventory items parse cleanly into Book domain models."""
        inventory_file = MOCK_DATA_DIR / "inventory.json"
        assert inventory_file.exists(), f"Missing seed file: {inventory_file}"

        with open(inventory_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        assert len(raw_data) >= 30, f"Expected 30+ books, found {len(raw_data)}"

        books = [Book(**item) for item in raw_data]
        assert len(books) == len(raw_data)

        # Check edge cases required by PRD §6.7
        zero_available = [b for b in books if b.available_count == 0]
        assert len(zero_available) >= 2, (
            f"Expected >=2 books with available_count == 0, got {len(zero_available)}"
        )

        low_stock = [b for b in books if b.stock_status == "low_stock"]
        assert len(low_stock) >= 2, (
            f"Expected >=2 books with low_stock status, got {len(low_stock)}"
        )

        in_stock = [b for b in books if b.stock_status == "in_stock"]
        assert len(in_stock) >= 1, "Expected in_stock books in seed data"

    def test_customers_seed_parsing(self) -> None:
        """Ensure all seed customer records parse into Customer domain models."""
        customers_file = MOCK_DATA_DIR / "customers.json"
        assert customers_file.exists(), f"Missing seed file: {customers_file}"

        with open(customers_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        assert len(raw_data) >= 8, f"Expected 8+ customers, found {len(raw_data)}"

        customers = [Customer(**item) for item in raw_data]
        assert len(customers) == len(raw_data)

        # Check customer seed profiles
        has_zero_stamps = any(c.stamps == 0 for c in customers)
        has_mid_stamps = any(3 <= c.stamps <= 7 for c in customers)
        has_rewards = any(c.rewards_available >= 1 for c in customers)

        assert has_zero_stamps, "Expected customer with 0 stamps in seed data"
        assert has_mid_stamps, "Expected customer with mid-range stamps in seed data"
        assert has_rewards, "Expected customer with rewards_available >= 1"

    def test_orders_seed_parsing(self) -> None:
        """Ensure all seed orders parse into Order and OrderItem models."""
        orders_file = MOCK_DATA_DIR / "orders.json"
        assert orders_file.exists(), f"Missing seed file: {orders_file}"

        with open(orders_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        assert len(raw_data) >= 10, f"Expected 10+ orders, found {len(raw_data)}"

        orders = [Order(**item) for item in raw_data]
        assert len(orders) == len(raw_data)

        # Verify items are OrderItem instances
        for o in orders:
            assert len(o.items) > 0
            for item in o.items:
                assert isinstance(item, OrderItem)
                assert len(item.isbn) > 0
                assert item.quantity >= 1

        # Verify all 5 order statuses represented
        statuses = {o.status for o in orders}
        expected_statuses = {
            "pending",
            "ready_for_pickup",
            "completed",
            "cancelled",
            "expired",
        }
        assert expected_statuses.issubset(
            statuses
        ), f"Missing order statuses: {expected_statuses - statuses}"

    def test_events_seed_parsing(self) -> None:
        """Ensure all seed events parse into Event domain models."""
        events_file = MOCK_DATA_DIR / "events.json"
        assert events_file.exists(), f"Missing seed file: {events_file}"

        with open(events_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        assert len(raw_data) >= 4, f"Expected 4+ events, found {len(raw_data)}"

        events = [Event(**item) for item in raw_data]
        assert len(events) == len(raw_data)

        # Check sold out event
        sold_out = [e for e in events if e.tickets_sold >= e.capacity]
        assert len(sold_out) >= 1, "Expected at least 1 sold-out event in seed data"

    def test_store_info_seed_parsing(self) -> None:
        """Ensure store_info seed JSON parses into StoreInfo domain model."""
        store_info_file = MOCK_DATA_DIR / "store_info.json"
        assert store_info_file.exists(), f"Missing seed file: {store_info_file}"

        with open(store_info_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        store_info = StoreInfo(**raw_data)
        assert store_info.name == "Riverside Books"
        assert store_info.policies.gifts is not None
        assert store_info.policies.returns is not None
        assert store_info.policies.holds is not None
        assert store_info.policies.special_orders is not None
        assert len(store_info.faqs) >= 1
        for faq in store_info.faqs:
            assert isinstance(faq, FAQItem)
            assert len(faq.id) > 0
            assert len(faq.question) > 0

    def test_messages_seed_parsing(self) -> None:
        """Ensure messages seed JSON parses into Message domain models."""
        messages_file = MOCK_DATA_DIR / "messages.json"
        assert messages_file.exists(), f"Missing seed file: {messages_file}"

        with open(messages_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        assert len(raw_data) >= 2, f"Expected 2+ messages, found {len(raw_data)}"

        messages = [Message(**item) for item in raw_data]
        assert len(messages) == len(raw_data)

        statuses = {m.status for m in messages}
        assert "new" in statuses, "Expected 'new' message in seed data"
        assert "read" in statuses, "Expected 'read' message in seed data"


# ============================================================================
# Book Domain Model & Computed Properties Tests
# ============================================================================


class TestBookDomainModel:
    """Tests for Book computed properties and stock threshold boundaries."""

    def test_available_count_computation(self) -> None:
        """Test available_count is computed as (stock_count - reserved_count)."""
        book = Book(
            isbn="9780143039433",
            title="Sample Book",
            author="Author Name",
            format="paperback",
            price_cents=1500,
            stock_count=10,
            reserved_count=3,
            genre="Fiction",
            publisher="Publisher",
            published_date="2020-01-01",
        )
        assert book.available_count == 7

        book_zero = Book(
            isbn="9780143039433",
            title="Sample Book",
            author="Author Name",
            format="paperback",
            price_cents=1500,
            stock_count=4,
            reserved_count=4,
            genre="Fiction",
            publisher="Publisher",
            published_date="2020-01-01",
        )
        assert book_zero.available_count == 0

    @pytest.mark.parametrize(
        ("stock_count", "reserved_count", "threshold", "expected_status"),
        [
            # available == 0 -> out_of_stock
            (0, 0, 2, "out_of_stock"),
            (5, 5, 2, "out_of_stock"),
            (10, 10, 5, "out_of_stock"),
            # 1 <= available <= threshold -> low_stock
            (1, 0, 2, "low_stock"),  # Lower bound of low_stock
            (2, 0, 2, "low_stock"),  # Upper bound of low_stock (threshold = 2)
            (5, 3, 2, "low_stock"),  # available = 2 == threshold
            (5, 4, 2, "low_stock"),  # available = 1
            (10, 5, 5, "low_stock"),  # Custom threshold = 5, available = 5
            (10, 9, 5, "low_stock"),  # Custom threshold = 5, available = 1
            # available > threshold -> in_stock
            (3, 0, 2, "in_stock"),  # Lower bound of in_stock (threshold + 1)
            (10, 0, 2, "in_stock"),  # Plentiful stock
            (10, 4, 5, "in_stock"),  # Custom threshold = 5, available = 6
        ],
    )
    def test_stock_status_boundary_conditions(
        self,
        stock_count: int,
        reserved_count: int,
        threshold: int,
        expected_status: str,
    ) -> None:
        """Test boundary conditions for stock_status calculation per PRD §5.6."""
        book = Book(
            isbn="9780143039433",
            title="Boundary Test Book",
            author="Author",
            format="paperback",
            price_cents=2000,
            stock_count=stock_count,
            reserved_count=reserved_count,
            low_stock_threshold=threshold,
            genre="Fiction",
            publisher="Publisher",
            published_date="2020-01-01",
        )
        assert book.stock_status == expected_status

    def test_book_computed_fields_in_model_dump(self) -> None:
        """Ensure computed fields available_count and stock_status are serialized."""
        book = Book(
            isbn="9780143039433",
            title="Serialization Test",
            author="Author",
            format="hardcover",
            price_cents=2500,
            stock_count=6,
            reserved_count=1,
            low_stock_threshold=2,
            genre="Fiction",
            publisher="Publisher",
            published_date="2020-01-01",
        )
        dumped = book.model_dump()
        assert "available_count" in dumped
        assert dumped["available_count"] == 5
        assert "stock_status" in dumped
        assert dumped["stock_status"] == "in_stock"


# ============================================================================
# Order Domain Model Tests
# ============================================================================


class TestOrderDomainModel:
    """Tests for Order domain logic and expiration checks."""

    def test_order_is_expired_true_when_past_hold_expiry(self) -> None:
        """Test is_expired() returns True for pending order past hold_expires_at."""
        past_time = (datetime.now(UTC) - timedelta(hours=50)).isoformat()
        past_expiry = (datetime.now(UTC) - timedelta(hours=2)).isoformat()

        order = Order(
            order_id="order_exp_001",
            customer_id="cust_001",
            items=[OrderItem(isbn="9780143039433", quantity=1)],
            status="pending",
            created_at=past_time,
            hold_expires_at=past_expiry,
            total_cents=1799,
        )
        assert order.is_expired() is True

    def test_order_is_expired_false_when_within_hold_window(self) -> None:
        """Test is_expired() returns False for pending order within 48h hold."""
        recent_time = (datetime.now(UTC) - timedelta(hours=10)).isoformat()
        future_expiry = (datetime.now(UTC) + timedelta(hours=38)).isoformat()

        order = Order(
            order_id="order_act_001",
            customer_id="cust_001",
            items=[OrderItem(isbn="9780143039433", quantity=1)],
            status="pending",
            created_at=recent_time,
            hold_expires_at=future_expiry,
            total_cents=1799,
        )
        assert order.is_expired() is False

    def test_order_is_expired_false_for_terminal_or_completed_status(self) -> None:
        """Test is_expired() returns False for completed/cancelled orders."""
        past_time = (datetime.now(UTC) - timedelta(hours=50)).isoformat()
        past_expiry = (datetime.now(UTC) - timedelta(hours=2)).isoformat()

        order_completed = Order(
            order_id="order_comp_001",
            customer_id="cust_001",
            items=[OrderItem(isbn="9780143039433", quantity=1)],
            status="completed",
            created_at=past_time,
            hold_expires_at=past_expiry,
            total_cents=1799,
        )
        assert order_completed.is_expired() is False
