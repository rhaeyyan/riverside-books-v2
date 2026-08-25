from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.core.datastore import JsonDatastore
from backend.api.core.repositories import (
    BookRepository,
    CustomerRepository,
    OrderRepository,
)
from backend.api.deps import get_book_repo, get_customer_repo, get_order_repo
from backend.api.main import app

MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"


@pytest.fixture
def datastore(tmp_path: Path) -> JsonDatastore:
    for seed_file in ["inventory.json", "customers.json", "orders.json"]:
        source = MOCK_DATA_DIR / seed_file
        dest = tmp_path / seed_file
        if source.exists():
            dest.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            dest.write_text("[]", encoding="utf-8")
    return JsonDatastore(data_dir=tmp_path)


@pytest.fixture
def book_repo(datastore: JsonDatastore) -> BookRepository:
    return BookRepository(datastore=datastore)


@pytest.fixture
def customer_repo(datastore: JsonDatastore) -> CustomerRepository:
    return CustomerRepository(datastore=datastore)


@pytest.fixture
def order_repo(datastore: JsonDatastore) -> OrderRepository:
    return OrderRepository(datastore=datastore)


@pytest.fixture
def client(book_repo, customer_repo, order_repo) -> TestClient:
    app.dependency_overrides[get_book_repo] = lambda: book_repo
    app.dependency_overrides[get_customer_repo] = lambda: customer_repo
    app.dependency_overrides[get_order_repo] = lambda: order_repo
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_three_book_order_completed_awards_three_stamps(
    client: TestClient, book_repo, customer_repo, order_repo
):
    # Setup
    customer = customer_repo.get_all()[0]

    # Needs to be 0 or small enough so it doesn't wrap around
    customer_repo.update_loyalty(customer.customer_id, 0, customer.rewards_available)

    books = book_repo.get_all()
    # Find a book with stock >= 3
    target_book = None
    for b in books:
        if b.stock_count >= 3:
            target_book = b
            break

    if not target_book:
        target_book = books[0]
        book_repo.update_stock(target_book.isbn, target_book.reserved_count + 3)

    # Place order
    res = client.post(
        "/api/orders",
        json={
            "customer_id": customer.customer_id,
            "items": [{"isbn": target_book.isbn, "quantity": 3}],
        },
    )
    order_id = res.json()["order_id"]

    # Move to ready
    client.patch(f"/api/orders/{order_id}/status", json={"status": "ready_for_pickup"})

    # Move to completed
    res_comp = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "completed"}
    )
    assert res_comp.status_code == 200

    # Check stamps
    updated_customer = customer_repo.get_by_id(customer.customer_id)
    assert updated_customer.stamps == 3


def test_customer_at_9_stamps_completes_1_book_gets_reward(
    client: TestClient, book_repo, customer_repo, order_repo
):
    customer = customer_repo.get_all()[0]
    customer_repo.update_loyalty(customer.customer_id, 9, 0)

    books = book_repo.get_all()
    target_book = books[0]
    book_repo.update_stock(target_book.isbn, target_book.reserved_count + 1)

    res = client.post(
        "/api/orders",
        json={
            "customer_id": customer.customer_id,
            "items": [{"isbn": target_book.isbn, "quantity": 1}],
        },
    )
    order_id = res.json()["order_id"]

    client.patch(f"/api/orders/{order_id}/status", json={"status": "ready_for_pickup"})
    client.patch(f"/api/orders/{order_id}/status", json={"status": "completed"})

    updated_customer = customer_repo.get_by_id(customer.customer_id)
    assert updated_customer.stamps == 0
    assert updated_customer.rewards_available == 1
