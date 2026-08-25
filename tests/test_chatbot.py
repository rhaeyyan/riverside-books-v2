from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.core.datastore import JsonDatastore
from backend.api.core.repositories import (
    BookRepository,
    EventRepository,
    MessageRepository,
    StoreInfoRepository,
)
from backend.api.deps import (
    get_book_repo,
    get_event_repo,
    get_message_repo,
    get_store_info_repo,
)
from backend.api.main import app

MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"


@pytest.fixture
def datastore(tmp_path: Path) -> JsonDatastore:
    for seed_file in [
        "inventory.json",
        "store_info.json",
        "events.json",
        "messages.json",
    ]:
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
def store_repo(datastore: JsonDatastore) -> StoreInfoRepository:
    return StoreInfoRepository(datastore=datastore)


@pytest.fixture
def event_repo(datastore: JsonDatastore) -> EventRepository:
    return EventRepository(datastore=datastore)


@pytest.fixture
def msg_repo(datastore: JsonDatastore) -> MessageRepository:
    return MessageRepository(datastore=datastore)


@pytest.fixture
def client(book_repo, store_repo, event_repo, msg_repo) -> TestClient:
    app.dependency_overrides[get_book_repo] = lambda: book_repo
    app.dependency_overrides[get_store_info_repo] = lambda: store_repo
    app.dependency_overrides[get_event_repo] = lambda: event_repo
    app.dependency_overrides[get_message_repo] = lambda: msg_repo
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_chat_tree_no_dead_ends(client: TestClient):
    r = client.get("/api/chat/tree")
    assert r.status_code == 200
    tree = r.json()
    for _, node in tree.items():
        assert "options" in node
        assert len(node["options"]) > 0
        for opt in node["options"]:
            assert "id" in opt


def test_same_question_twice_identical(client: TestClient):
    payload = {"node_id": "check_stock", "input": "The"}
    r1 = client.post("/api/chat/message", json=payload)
    r2 = client.post("/api/chat/message", json=payload)
    assert r1.status_code == 200
    assert r1.json() == r2.json()


def test_hyphenated_isbn_matches(client: TestClient, book_repo):
    book = book_repo.get_all()[0]
    # format isbn with hyphens
    hyphenated = (
        book.isbn[:3]
        + "-"
        + book.isbn[3:4]
        + "-"
        + book.isbn[4:6]
        + "-"
        + book.isbn[6:12]
        + "-"
        + book.isbn[12:]
    )

    r = client.post(
        "/api/chat/message", json={"node_id": "check_stock", "input": hyphenated}
    )
    assert r.status_code == 200
    assert book.title in r.json()["text"]


def test_40_match_query_asks_narrowing(client: TestClient, book_repo):
    # 'a' usually matches > 5
    r = client.post("/api/chat/message", json={"node_id": "check_stock", "input": "a"})
    assert r.status_code == 200
    assert "Could you be more specific?" in r.json()["text"]
    assert "options" in r.json()


def test_hours_formatting(client: TestClient):
    r = client.post("/api/chat/message", json={"node_id": "hours_location"})
    assert r.status_code == 200
    text = r.json()["text"]
    assert "Today" in text
    assert "Closed" in text or "-" in text


def test_escalated_message_lands_in_inbox(client: TestClient, msg_repo):
    initial_msgs = msg_repo.get_all()

    r = client.post(
        "/api/chat/escalate",
        json={"name": "Test User", "contact": "test@example.com", "body": "Help me"},
    )
    assert r.status_code == 200

    final_msgs = msg_repo.get_all()
    assert len(final_msgs) == len(initial_msgs) + 1
    assert final_msgs[-1].body == "Help me"
