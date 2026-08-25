"""Service layer for chatbot logic."""

from datetime import UTC, datetime
from typing import Any

from backend.api.models import Book, Event, StoreInfo
from backend.chatbot.matching import find_books
from backend.chatbot.tree import CHAT_TREE


def get_node(node_id: str, store: StoreInfo, events: list[Event]) -> dict[str, Any]:
    """Get the decision tree node, resolving dynamic text."""
    if node_id not in CHAT_TREE:
        raise ValueError(f"Unknown node {node_id}")

    node = dict(CHAT_TREE[node_id])

    if node_id == "hours_location":
        # Format hours and today
        now = datetime.now(
            UTC
        )  # we'll use UTC or server time as "today" for simplicity
        days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]
        today_str = days[now.weekday()]

        hours_text = f"We are located at {store.address}.\n\nHours:\n"

        for d in days:
            h = store.hours.get(d)
            if h:
                hours_text += f"{d.capitalize()}: {h.open} - {h.close}\n"
            else:
                hours_text += f"{d.capitalize()}: Closed\n"

        # Call out today's hours specifically
        today_hours = store.hours.get(today_str)
        if today_hours:
            hours_text += f"\nToday ({today_str.capitalize()}): {today_hours.open} - {today_hours.close}"
        else:
            # Find next open day
            next_day = None
            for i in range(1, 8):
                check_day = days[(now.weekday() + i) % 7]
                if store.hours.get(check_day):
                    next_day = check_day
                    break

            hours_text += f"\nToday ({today_str.capitalize()}): We are closed today."
            if next_day:
                hours_text += f" We will be open next on {next_day.capitalize()}."

        node["text"] = hours_text

    elif node_id == "events":
        if not events:
            node["text"] = "We don't have any upcoming events scheduled right now."
        else:
            text = "Here are our upcoming events:\n"
            for ev in events:
                sold_out = ev.tickets_sold >= ev.capacity
                status = "(SOLD OUT)" if sold_out else ""
                text += f"- {ev.title} with {ev.author_name} on {ev.starts_at[:10]} {status}\n"
            node["text"] = text

    elif node_id == "policy_returns":
        node["text"] = store.policies.returns
    elif node_id == "policy_holds":
        node["text"] = store.policies.holds
    elif node_id == "policy_special":
        node["text"] = store.policies.special_orders
    elif node_id == "policy_gifts":
        node["text"] = store.policies.gifts

    return node


def handle_stock_query(
    query: str, books: list[Book], store: StoreInfo
) -> dict[str, Any]:
    """Process a natural language stock check."""
    if not query.strip():
        return {
            "text": CHAT_TREE["check_stock"]["text"],
            "options": [{"id": "root", "label": "Back to main menu"}],
        }

    matches = find_books(query, books)

    if len(matches) == 0:
        text = f"I couldn't find any books matching '{query}'.\n{store.policies.special_orders}"
        return {
            "text": text,
            "options": [
                {"id": "escalate", "label": "Leave a message for staff"},
                {"id": "root", "label": "Back to main menu"},
            ],
        }

    if len(matches) > 5:
        text = f"I found {len(matches)} books matching '{query}'. Could you be more specific? (e.g. provide the full title or ISBN)"
        return {"text": text, "options": [{"id": "root", "label": "Back to main menu"}]}

    # We have 1 to 5 matches
    texts = []
    for m in matches:
        if m.available_count > 0:
            texts.append(
                f"Yes — we have {m.available_count} copies of '{m.title}' by {m.author} on the shelf right now."
            )
        else:
            texts.append(
                f"We carry '{m.title}' by {m.author}, but it is currently out of stock."
            )

    return {
        "text": "\n\n".join(texts),
        "options": [
            {"id": "check_stock", "label": "Check another book"},
            {"id": "root", "label": "Back to main menu"},
        ],
    }
