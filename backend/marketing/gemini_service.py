"""Marketing content generation service powered by Google Gemini."""

import json
import logging
from typing import Any

import httpx

from backend.api.models import Book, Event
from backend.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

MARKETING_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "caption": {
            "type": "STRING",
            "description": (
                "Engaging social media post caption, 280 characters or fewer "
                "including hashtags."
            ),
        },
        "post_idea": {
            "type": "STRING",
            "description": (
                "One sentence photography or visual staging concept for store staff."
            ),
        },
        "hashtags": {
            "type": "STRING",
            "description": "3 to 5 relevant hashtags separated by spaces.",
        },
    },
    "required": ["caption", "post_idea", "hashtags"],
}


def _enforce_length(caption: str, max_len: int = 280) -> str:
    """Guarantee the caption never exceeds 280 characters."""
    if len(caption) <= max_len:
        return caption
    return caption[: max_len - 3].rstrip() + "..."


def generate_book_post_gemini(
    book: Book, tone: str, variant: int = 0
) -> dict[str, Any]:
    """Generate marketing post for a book using Gemini Flash.

    Args:
        book: Book domain model.
        tone: Selected tone (e.g. 'cozy', 'exciting', 'urgent').
        variant: Integer variant seed to introduce stylistic diversity.

    Returns:
        Dict with caption, post_idea, hashtags, and has_image flag.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    stock_desc = (
        f"Only {book.available_count} copies currently available on the shelf"
        if book.available_count > 0
        else "Currently out of stock (available to special order or reserve)"
    )

    prompt = (
        "You are a bookseller marketing assistant for Riverside Books, a warm, "
        "community-focused independent bookstore located on Main Street in Standing Stone, NY.\n\n"
        "Write a ready-to-publish social media caption for this book:\n"
        f"- Title: {book.title}\n"
        f"- Author: {book.author}\n"
        f"- Genre: {book.genre}\n"
        f"- Format: {book.format}\n"
        f"- Stock Status: {stock_desc}\n"
        f"- Description / Blurb: {book.blurb or 'A customer favorite at Riverside Books.'}\n\n"
        f"Tone requirement: {tone.upper()}\n"
        f"Variation seed: Style option {variant + 1}\n\n"
        "Strict Guidelines:\n"
        "1. Grounding: Do not invent discounts, fake reviews, or changed dates/prices.\n"
        "2. Character budget: The entire caption MUST be <= 280 characters with hashtags.\n"
        "3. Voice: Warm, genuine, local, and literary. Avoid generic corporate hype.\n"
        "4. Output: Return structured JSON matching the requested schema.\n"
    )

    url = (
        GEMINI_API_URL.format(model=settings.gemini_model)
        + f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": MARKETING_RESPONSE_SCHEMA,
            "temperature": 0.7,
        },
    }

    resp = httpx.post(url, json=payload, timeout=12.0)
    resp.raise_for_status()

    data = resp.json()
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    result = json.loads(raw_text)

    caption = _enforce_length(result.get("caption", "").strip())
    post_idea = result.get("post_idea", "").strip()
    hashtags = result.get("hashtags", "").strip()

    return {
        "caption": caption,
        "post_idea": post_idea,
        "hashtags": hashtags,
        "has_image": bool(book.cover_image_url),
        "source": "gemini",
    }


def generate_event_post_gemini(
    event: Event, tone: str, variant: int = 0
) -> dict[str, Any]:
    """Generate marketing post for an event using Gemini Flash.

    Args:
        event: Event domain model.
        tone: Selected tone (e.g. 'cozy', 'exciting', 'urgent').
        variant: Integer variant seed to introduce stylistic diversity.

    Returns:
        Dict with caption, post_idea, hashtags, and has_image flag.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    is_sold_out = event.tickets_sold >= event.capacity
    ticket_status = (
        "Completely SOLD OUT (waitlist available at front counter)"
        if is_sold_out
        else f"Seats available ({event.capacity - event.tickets_sold} seats left)"
    )

    prompt = (
        "You are a bookseller marketing assistant for Riverside Books in Standing Stone, NY.\n\n"
        "Write a ready-to-publish social media caption for this upcoming store event:\n"
        f"- Event: {event.title}\n"
        f"- Featured Guest/Author: {event.author_name}\n"
        f"- Date & Time: {event.starts_at}\n"
        f"- Ticket Availability: {ticket_status}\n"
        f"- Description: {event.description or 'Join our community for a special evening.'}\n\n"
        f"Tone requirement: {tone.upper()}\n"
        f"Variation seed: Style option {variant + 1}\n\n"
        "Strict Guidelines:\n"
        "1. If SOLD OUT, do not pitch tickets; invite readers to join the waitlist.\n"
        "2. Grounding: Do not invent event times or guest names.\n"
        "3. Character budget: The entire caption MUST be <= 280 characters with hashtags.\n"
        "4. Voice: Welcoming, literary, and community-oriented.\n"
        "5. Output: Return structured JSON matching the requested schema.\n"
    )

    url = (
        GEMINI_API_URL.format(model=settings.gemini_model)
        + f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": MARKETING_RESPONSE_SCHEMA,
            "temperature": 0.7,
        },
    }

    resp = httpx.post(url, json=payload, timeout=12.0)
    resp.raise_for_status()

    data = resp.json()
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    result = json.loads(raw_text)

    caption = _enforce_length(result.get("caption", "").strip())
    post_idea = result.get("post_idea", "").strip()
    hashtags = result.get("hashtags", "").strip()

    return {
        "caption": caption,
        "post_idea": post_idea,
        "hashtags": hashtags,
        "has_image": False,
        "source": "gemini",
    }
