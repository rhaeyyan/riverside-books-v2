import pytest
from fastapi.testclient import TestClient
from psycopg import Connection

from backend.api.core import db
from backend.api.core.repositories import BookRepository, EventRepository
from backend.api.deps import get_book_repo, get_event_repo
from backend.api.main import app


@pytest.fixture
def book_repo(db_connection: Connection) -> BookRepository:
    return BookRepository()


@pytest.fixture
def event_repo(db_connection: Connection) -> EventRepository:
    return EventRepository()


@pytest.fixture
def client(book_repo, event_repo) -> TestClient:
    app.dependency_overrides[get_book_repo] = lambda: book_repo
    app.dependency_overrides[get_event_repo] = lambda: event_repo
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_same_question_twice_identical_response(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    payload = {
        "subject_type": "book",
        "subject_id": book.isbn,
        "tone": "cozy",
        "variant": 0,
    }
    r1 = client.post("/api/marketing/generate", json=payload)
    r2 = client.post("/api/marketing/generate", json=payload)
    assert r1.status_code == 200
    assert r1.json() == r2.json()


def test_all_three_tones_differ(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    captions = set()
    for tone in ["cozy", "exciting", "urgent"]:
        r = client.post(
            "/api/marketing/generate",
            json={
                "subject_type": "book",
                "subject_id": book.isbn,
                "tone": tone,
                "variant": 0,
            },
        )
        assert r.status_code == 200
        captions.add(r.json()["caption"])
    assert len(captions) == 3


def test_empty_blurb(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    db.execute("UPDATE books SET blurb = '' WHERE isbn = %s", (book.isbn,))

    r = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "book",
            "subject_id": book.isbn,
            "tone": "cozy",
            "variant": 0,
        },
    )
    assert r.status_code == 200
    caption = r.json()["caption"]
    assert "  " not in caption  # no double spaces
    assert "{blurb}" not in caption


def test_caption_under_280_chars(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    db.execute("UPDATE books SET blurb = %s WHERE isbn = %s", ("A " * 300, book.isbn))

    r = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "book",
            "subject_id": book.isbn,
            "tone": "cozy",
            "variant": 0,
        },
    )
    assert r.status_code == 200
    caption = r.json()["caption"]
    assert len(caption) <= 280


def test_out_of_stock_no_stock_template(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    db.execute(
        "UPDATE books SET stock_count = 0, reserved_count = 0 WHERE isbn = %s",
        (book.isbn,),
    )

    # Tone 'cozy' has a requires_stock template at index 1
    # Without stock, variant 1 should wrap around to index 0, NOT use index 1
    r0 = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "book",
            "subject_id": book.isbn,
            "tone": "cozy",
            "variant": 0,
        },
    )
    r1 = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "book",
            "subject_id": book.isbn,
            "tone": "cozy",
            "variant": 1,
        },
    )
    assert r0.status_code == 200
    assert r1.status_code == 200
    # Both variants should produce the same non-stock template!
    assert r0.json() == r1.json()


def test_sold_out_event_waitlist(client: TestClient, event_repo):
    events = event_repo.get_all()
    event = events[0]
    db.execute(
        "UPDATE events SET tickets_sold = capacity WHERE event_id = %s",
        (event.event_id,),
    )

    r = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "event",
            "subject_id": event.event_id,
            "tone": "urgent",
            "variant": 0,
        },
    )
    assert r.status_code == 200
    assert "sold out" in r.json()["caption"].lower()
