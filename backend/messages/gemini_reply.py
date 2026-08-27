"""Service for drafting AI replies to customer messages using Gemini Flash."""

import logging

import httpx

from backend.api.models import Message, StoreInfo
from backend.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


def generate_draft_reply(message: Message, store_info: StoreInfo) -> str:
    """Generate a draft email reply to a customer message using Gemini Flash.

    Args:
        message: The customer's message.
        store_info: The store's information and policies for grounding.

    Returns:
        A string containing the drafted email reply.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    # Format hours for the prompt
    hours_lines = []
    for day, hours in store_info.hours.model_dump().items():
        if hours:
            hours_lines.append(f"{day.title()}: {hours['open']} - {hours['close']}")
        else:
            hours_lines.append(f"{day.title()}: Closed")
    hours_str = "\n".join(hours_lines)

    # Format policies for the prompt
    policies_str = "\n".join(
        [
            f"Returns: {store_info.policies.returns}",
            f"Holds: {store_info.policies.holds}",
            f"Special Orders: {store_info.policies.special_orders}",
            f"Gifts: {store_info.policies.gifts}",
        ]
    )

    prompt = (
        "You are a helpful, professional, and warm staff member at Riverside Books, "
        f"located at {store_info.address}. Your phone number is {store_info.phone} "
        f"and your email is {store_info.email}.\n\n"
        "Here are the store's current hours:\n"
        f"{hours_str}\n\n"
        "Here are the store's policies:\n"
        f"{policies_str}\n\n"
        "A customer has left the following message:\n"
        f"Customer Name: {message.name}\n"
        f"Customer Contact: {message.contact}\n"
        f"Message Body:\n{message.body}\n\n"
        "Write a draft email reply to this customer. Be polite, concise, and helpful. "
        "Use the store's policies and hours to answer their question if applicable. "
        "Do not invent any policies or make promises outside of the provided information. "
        "Return ONLY the text of the email reply, ready to be sent."
    )

    url = (
        GEMINI_API_URL.format(model=settings.gemini_model)
        + f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.5,
        },
    }

    try:
        resp = httpx.post(url, json=payload, timeout=12.0)
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        # Gemini's error body names the actual problem (bad model name,
        # invalid key, quota exceeded, ...) -- surface it instead of a bare
        # "500", but never the URL itself, which carries the API key.
        try:
            api_message = e.response.json()["error"]["message"]
        except Exception:
            api_message = e.response.text[:300]
        logger.error(
            "Gemini API request failed (%s): %s", e.response.status_code, api_message
        )
        raise RuntimeError(f"Gemini API error: {api_message}") from e
    except httpx.HTTPError as e:
        logger.error("Gemini API request failed: %s", e)
        raise RuntimeError(f"Could not reach Gemini: {e}") from e

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        block_reason = data.get("promptFeedback", {}).get("blockReason")
        logger.error(
            "Gemini returned no candidates (blockReason=%s): %s", block_reason, data
        )
        raise RuntimeError(
            f"Gemini declined to respond (blockReason={block_reason})"
            if block_reason
            else "Gemini returned no candidates"
        )

    raw_text = candidates[0]["content"]["parts"][0]["text"]
    return raw_text.strip()
