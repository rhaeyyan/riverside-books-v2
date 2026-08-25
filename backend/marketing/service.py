"""Marketing content generation service layer."""

import re
from typing import Any

from backend.api.models import Book, Event
from backend.marketing.templates import TEMPLATES, WAITLIST_TEMPLATES


def _clean_prose(text: str) -> str:
    """Clean up double spaces resulting from empty clauses."""
    return re.sub(r"\s+", " ", text).strip()


def _truncate_text(text: str, max_len: int = 280) -> str:
    """Truncate text to max_len, appending '...' if truncated.

    The truncation happens within the blurb clause typically,
    but this is a fallback.
    """
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def get_available_tones() -> dict[str, list[str]]:
    """Return available tones grouped by subject type."""
    tones: dict[str, set[str]] = {"book": set(), "event": set()}
    for subj, tone in TEMPLATES:
        if subj in tones:
            tones[subj].add(tone)
    return {k: sorted(list(v)) for k, v in tones.items()}


def generate_book_post(book: Book, tone: str, variant: int = 0) -> dict[str, Any]:
    """Generate deterministic marketing post for a book."""
    key = ("book", tone)
    if key not in TEMPLATES:
        raise ValueError(f"No templates for book and tone '{tone}'")

    candidates = TEMPLATES[key]

    # 1. Filter out requires_stock when available_count == 0
    if book.available_count == 0:
        candidates = [t for t in candidates if not t["requires_stock"]]

    if not candidates:
        raise ValueError("No valid templates found for current stock status")

    # 2. Deterministic selection
    template = candidates[variant % len(candidates)]

    # Missing metadata fallbacks
    blurb_text = book.blurb.strip() if book.blurb else ""

    # Build hashtags
    hashtags = f"#RiversideBooks #{book.genre.replace(' ', '')} #{book.format}"

    # Create caption
    caption_base = template["text"].format(
        title=book.title,
        author=book.author,
        available_count=book.available_count,
        blurb=blurb_text,
    )
    caption_base = _clean_prose(caption_base)

    # Check 280 budget
    full_caption = f"{caption_base} {hashtags}"
    if len(full_caption) > 280:
        # Try truncating the blurb
        if blurb_text:
            # How much over are we?
            over_by = len(full_caption) - 280
            new_blurb_len = max(0, len(blurb_text) - over_by - 3)
            if new_blurb_len > 0:
                short_blurb = blurb_text[:new_blurb_len] + "..."
            else:
                short_blurb = ""

            caption_base = template["text"].format(
                title=book.title,
                author=book.author,
                available_count=book.available_count,
                blurb=short_blurb,
            )
            caption_base = _clean_prose(caption_base)
            full_caption = f"{caption_base} {hashtags}"

        # Final safety truncation (should preserve title theoretically, but if title alone is too long...)
        if len(full_caption) > 280:
            # We can't do much without breaking the hashtag string if we just truncate everything,
            # but let's just truncate the caption base and append hashtags.
            available_base = 280 - len(hashtags) - 1
            if available_base > 3:
                caption_base = caption_base[: available_base - 3] + "..."
            full_caption = f"{caption_base} {hashtags}"

    return {
        "caption": full_caption,
        "post_idea": template["idea"],
        "hashtags": hashtags,
        "has_image": bool(book.cover_image_url),
    }


def generate_event_post(event: Event, tone: str, variant: int = 0) -> dict[str, Any]:
    """Generate deterministic marketing post for an event."""
    is_sold_out = event.tickets_sold >= event.capacity

    if is_sold_out:
        candidates = WAITLIST_TEMPLATES.get(tone, [])
    else:
        key = ("event", tone)
        candidates = TEMPLATES.get(key, [])

    if not candidates:
        raise ValueError(f"No templates for event and tone '{tone}'")

    template = candidates[variant % len(candidates)]

    desc_text = event.description.strip() if event.description else ""

    hashtags = "#RiversideBooks #LocalEvents #AuthorTalk"

    caption_base = template["text"].format(
        title=event.title, author_name=event.author_name, description=desc_text
    )
    caption_base = _clean_prose(caption_base)

    full_caption = f"{caption_base} {hashtags}"
    if len(full_caption) > 280:
        if desc_text:
            over_by = len(full_caption) - 280
            new_desc_len = max(0, len(desc_text) - over_by - 3)
            short_desc = desc_text[:new_desc_len] + "..." if new_desc_len > 0 else ""

            caption_base = template["text"].format(
                title=event.title, author_name=event.author_name, description=short_desc
            )
            caption_base = _clean_prose(caption_base)
            full_caption = f"{caption_base} {hashtags}"

        if len(full_caption) > 280:
            available_base = 280 - len(hashtags) - 1
            if available_base > 3:
                caption_base = caption_base[: available_base - 3] + "..."
            full_caption = f"{caption_base} {hashtags}"

    return {
        "caption": full_caption,
        "post_idea": template["idea"],
        "hashtags": hashtags,
        "has_image": False,
    }
