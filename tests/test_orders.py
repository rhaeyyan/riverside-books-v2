from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from psycopg import Connection

from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    OrderRepository,
)
from backend.api.deps import get_book_repo, get_customer_repo, get_order_repo
from backend.api.main import app

MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"


@pytest.fixture
def book_repo(db_connection: Connection) -> BookRepository:
    return BookRepository()


@pytest.fixture
def customer_repo(db_connection: Connection) -> CustomerRepository:
    return CustomerRepository()


@pytest.fixture
def order_repo(db_connection: Connection) -> OrderRepository:
    return OrderRepository()


@pytest.fixture
def client(book_repo, customer_repo, order_repo) -> TestClient:
    app.dependency_overrides[get_book_repo] = lambda: book_repo
    app.dependency_overrides[get_customer_repo] = lambda: customer_repo
    app.dependency_overrides[get_order_repo] = lambda: order_repo
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_last_copy_concurrency(
    client: TestClient, book_repo: BookRepository, customer_repo: CustomerRepository
):
    # Find a customer
    customer = customer_repo.get_all()[0]

    # Create a book with exactly 1 available copy
    books = book_repo.get_all()
    target_book = books[0]

    # Adjust to have exactly 1 available
    book_repo.update_stock(target_book.isbn, target_book.reserved_count + 1)

    # First order should succeed
    response1 = client.post(
        "/api/orders",
        json={
            "customer_id": customer.customer_id,
            "items": [{"isbn": target_book.isbn, "quantity": 1}],
        },
    )
    assert response1.status_code == 200

    # Second order should fail with 409
    response2 = client.post(
        "/api/orders",
        json={
            "customer_id": customer.customer_id,
            "items": [{"isbn": target_book.isbn, "quantity": 1}],
        },
    )
    assert response2.status_code == 409


def test_illegal_transition_rejected(client: TestClient, order_repo: OrderRepository):
    # Get a pending order
    orders = order_repo.get_all(status="pending")
    if not orders:
        # Create one if not exists
        pytest.skip("No pending order found in seed data")

    target_order = orders[0]

    # Try illegal transition from pending -> completed
    response = client.patch(
        f"/api/orders/{target_order.order_id}/status", json={"status": "completed"}
    )
    assert response.status_code == 400
