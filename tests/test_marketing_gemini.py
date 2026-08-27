"""Tests for Gemini marketing generation and fallback behavior."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from psycopg import Connection

from backend.api.core.repositories import BookRepository, EventRepository
from backend.api.deps import get_book_repo, get_event_repo
from backend.api.main import app
from backend.config import settings
from backend.marketing.gemini_service import (
    generate_book_post_gemini,
    generate_event_post_gemini,
)


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


def test_mocked_gemini_book_generation(book_repo):
    book = book_repo.get_all()[0]
    fake_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": (
                                '{"caption": "Warm up with a book at Riverside! '
                                '#StandingStoneNY", '
                                '"post_idea": "Photo of book beside warm mug.", '
                                '"hashtags": "#RiversideBooks #CozyRead"}'
                            )
                        }
                    ]
                }
            }
        ]
    }

    with (
        patch("backend.config.settings.gemini_api_key", "mock_key"),
        patch("httpx.post") as mock_post,
    ):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = fake_gemini_response

        res = generate_book_post_gemini(book, "cozy", variant=0)
        assert "Riverside" in res["caption"]
        assert len(res["caption"]) <= 280
        assert res["post_idea"] == "Photo of book beside warm mug."
        assert res["source"] == "gemini"


def test_mocked_gemini_event_generation(event_repo):
    event = event_repo.get_all()[0]
    fake_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": (
                                '{"caption": "Join us this Friday for an event! '
                                '#StandingStoneNY", '
                                '"post_idea": "Staging of chairs with flyer.", '
                                '"hashtags": "#RiversideEvents #AuthorTalk"}'
                            )
                        }
                    ]
                }
            }
        ]
    }

    with (
        patch("backend.config.settings.gemini_api_key", "mock_key"),
        patch("httpx.post") as mock_post,
    ):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = fake_gemini_response

        res = generate_event_post_gemini(event, "exciting", variant=0)
        assert "Friday" in res["caption"]
        assert len(res["caption"]) <= 280
        assert res["source"] == "gemini"


def test_gemini_fallback_on_api_error(client: TestClient, book_repo):
    book = book_repo.get_all()[0]

    with (
        patch("backend.config.settings.gemini_api_key", "mock_key"),
        patch("httpx.post", side_effect=Exception("API connection timeout")),
    ):
        # Even with use_ai=True, network error falls back to templates
        res = client.post(
            "/api/marketing/generate",
            json={
                "subject_type": "book",
                "subject_id": book.isbn,
                "tone": "cozy",
                "variant": 0,
                "use_ai": True,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "caption" in data
        # Did not fail, returned deterministic output
        assert "source" not in data or data["source"] != "gemini"


@pytest.mark.skipif(
    not settings.gemini_api_key, reason="Live GEMINI_API_KEY not configured"
)
def test_live_gemini_generation(client: TestClient, book_repo):
    """Smoke test running live against Gemini when key is available."""
    book = book_repo.get_all()[0]
    res = client.post(
        "/api/marketing/generate",
        json={
            "subject_type": "book",
            "subject_id": book.isbn,
            "tone": "cozy",
            "variant": 0,
            "use_ai": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["caption"]) <= 280
    assert data.get("source") == "gemini"
    assert "post_idea" in data
    assert "hashtags" in data
