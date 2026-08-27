from fastapi.testclient import TestClient

from backend.api.main import app
from backend.config import settings

client = TestClient(app)


def test_draft_reply_missing_key(monkeypatch):
    """Test that drafting a reply without an API key returns 400."""
    monkeypatch.setattr(settings, "gemini_api_key", "")

    # We need a message to exist in the database.
    response = client.post(
        "/api/chat/escalate",
        json={
            "name": "Test User",
            "contact": "test@example.com",
            "body": "Do you have any sci-fi books?",
        },
    )
    assert response.status_code == 200
    msg_id = response.json()["message_id"]

    res = client.post(f"/api/messages/{msg_id}/draft-reply")
    assert res.status_code == 400
    assert "GEMINI_API_KEY" in res.json()["detail"]


def test_draft_reply_with_mocked_gemini(monkeypatch):
    """Test that a valid Gemini response is returned."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")

    # Create message
    response = client.post(
        "/api/chat/escalate",
        json={
            "name": "Test User",
            "contact": "test@example.com",
            "body": "Do you have any sci-fi books?",
        },
    )
    msg_id = response.json()["message_id"]

    # Mock httpx.post
    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Hello Test User, this is a draft reply!"}
                            ]
                        }
                    }
                ]
            }

    def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("httpx.post", mock_post)

    res = client.post(f"/api/messages/{msg_id}/draft-reply")
    print(res.json())
    assert res.status_code == 200
    assert res.json()["draft_text"] == "Hello Test User, this is a draft reply!"


def test_draft_reply_surfaces_gemini_error(monkeypatch):
    """A real Gemini API failure returns 502 with Gemini's own error message."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")

    response = client.post(
        "/api/chat/escalate",
        json={
            "name": "Test User",
            "contact": "test@example.com",
            "body": "Do you have any sci-fi books?",
        },
    )
    msg_id = response.json()["message_id"]

    import httpx

    class MockErrorResponse:
        status_code = 400

        def raise_for_status(self):
            raise httpx.HTTPStatusError("Bad Request", request=None, response=self)

        def json(self):
            return {
                "error": {"message": "API key not valid. Please pass a valid API key."}
            }

        text = (
            '{"error": {"message": "API key not valid. Please pass a valid API key."}}'
        )

    def mock_post(*args, **kwargs):
        return MockErrorResponse()

    monkeypatch.setattr("httpx.post", mock_post)

    res = client.post(f"/api/messages/{msg_id}/draft-reply")
    assert res.status_code == 502
    assert "API key not valid" in res.json()["detail"]


def test_draft_reply_no_candidates(monkeypatch):
    """A Gemini response with no candidates (e.g. safety-blocked) returns 502."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")

    response = client.post(
        "/api/chat/escalate",
        json={
            "name": "Test User",
            "contact": "test@example.com",
            "body": "Do you have any sci-fi books?",
        },
    )
    msg_id = response.json()["message_id"]

    class MockBlockedResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"candidates": [], "promptFeedback": {"blockReason": "SAFETY"}}

    def mock_post(*args, **kwargs):
        return MockBlockedResponse()

    monkeypatch.setattr("httpx.post", mock_post)

    res = client.post(f"/api/messages/{msg_id}/draft-reply")
    assert res.status_code == 502
    assert "SAFETY" in res.json()["detail"]
