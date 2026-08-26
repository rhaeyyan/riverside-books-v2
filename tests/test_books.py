import pytest
from fastapi.testclient import TestClient
from psycopg import Connection

from backend.api.core.repositories import BookRepository, OrderRepository
from backend.api.deps import get_book_repo, get_order_repo
from backend.api.main import app


@pytest.fixture
def book_repo(db_connection: Connection) -> BookRepository:
    return BookRepository()


@pytest.fixture
def order_repo(db_connection: Connection) -> OrderRepository:
    return OrderRepository()


@pytest.fixture
def client(book_repo: BookRepository, order_repo: OrderRepository) -> TestClient:
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
    delta = target_book.stock_count - target_book.reserved_count
    if delta > 0:
        book_repo.adjust_reserved_count(target_book.isbn, delta)

    response = client.patch(
        f"/api/books/{target_book.isbn}/stock",
        json={"stock_count": target_book.stock_count - 1},
    )
    assert response.status_code == 400
    assert "below reserved" in response.json()["detail"].lower()
