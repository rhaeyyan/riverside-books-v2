"""Inventory search matching logic for chatbot."""

from backend.api.models import Book, normalize_isbn


def find_books(query: str, books: list[Book]) -> list[Book]:
    """Find books matching the query.

    1. Exact match on normalized ISBN.
    2. Case-insensitive substring on title or author.
    """
    if not query:
        return []

    query_isbn = normalize_isbn(query)

    # Check ISBN exact match first
    if query_isbn:
        for b in books:
            if normalize_isbn(b.isbn) == query_isbn:
                return [b]

    # Otherwise check title / author substring
    q_lower = query.lower()
    matches = []
    for b in books:
        if q_lower in b.title.lower() or q_lower in b.author.lower():
            matches.append(b)

    return matches
