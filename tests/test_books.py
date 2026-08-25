from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.core.datastore import JsonDatastore
from backend.api.core.repositories import BookRepository, OrderRepository
from backend.api.deps import get_book_repo
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
def order_repo(datastore: JsonDatastore) -> OrderRepository:
    return OrderRepository(datastore=datastore)


@pytest.fixture
def client(book_repo: BookRepository, order_repo: OrderRepository) -> TestClient:
    from backend.api.deps import get_order_repo

    app.dependency_overrides[get_book_repo] = lambda: book_repo
    app.dependency_overrides[get_order_repo] = lambda: order_repo
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_get_books(client: TestClient):
    response = client.get("/api/books")
    assert response.status_code == 200
    assert len(response.json()) > 0


def test_update_stock_below_reserved(client: TestClient, book_repo: BookRepository):
    books = book_repo.get_all()
    target_book = books[0]
    book_repo.adjust_reserved_count(target_book.isbn, target_book.stock_count)

    response = client.patch(
        f"/api/books/{target_book.isbn}/stock",
        json={"stock_count": target_book.stock_count - 1},
    )
    assert response.status_code == 400
    assert "below reserved" in response.json()["detail"].lower()
