from fastapi.testclient import TestClient

from backend.api.main import app
from backend.config import settings

client = TestClient(app)

def test_draft_reply_missing_key(monkeypatch):
    """Test that drafting a reply without an API key returns 400."""
    monkeypatch.setattr(settings, "gemini_api_key", "")

    # We need a message to exist in the database.
    response = client.post("/api/chat/escalate", json={
        "name": "Test User",
        "contact": "test@example.com",
        "body": "Do you have any sci-fi books?"
    })
    assert response.status_code == 200
    msg_id = response.json()["message_id"]

    res = client.post(f"/api/messages/{msg_id}/draft-reply")
    assert res.status_code == 400
    assert "GEMINI_API_KEY" in res.json()["detail"]

def test_draft_reply_with_mocked_gemini(monkeypatch):
    """Test that a valid Gemini response is returned."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")

    # Create message
    response = client.post("/api/chat/escalate", json={
        "name": "Test User",
        "contact": "test@example.com",
        "body": "Do you have any sci-fi books?"
    })
    msg_id = response.json()["message_id"]

    # Mock httpx.post
    class MockResponse:
        def raise_for_status(self): pass
        def json(self):
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Hello Test User, this is a draft reply!"}]
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
