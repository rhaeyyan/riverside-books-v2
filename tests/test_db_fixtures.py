"""Tests for database fixtures and transactional rollback isolation."""

from __future__ import annotations

from psycopg import Connection

from backend.api.core import db

TEST_ISBN = "9780000000001"


def test_db_connection_yields_valid_connection(db_connection: Connection) -> None:
    """Assert fixture yields an active open psycopg Connection."""
    assert db_connection is not None
    assert not db_connection.closed


def test_db_connection_scoped_context(db_connection: Connection) -> None:
    """Assert db module recognizes the scoped test connection."""
    assert db.get_current_connection() is db_connection


def test_db_connection_rollback_isolation_step_1(db_connection: Connection) -> None:
    """Insert a test book inside a test transaction."""
    db.execute(
        """
        INSERT INTO books (
            isbn, title, author, format, price_cents, stock_count,
            reserved_count, low_stock_threshold, published_date
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """,
        (
            TEST_ISBN,
            "Isolation Test Book",
            "Test Author",
            "paperback",
            1299,
            5,
            0,
            2,
            "2026-01-01",
        ),
    )
    row = db.fetch_one("SELECT title FROM books WHERE isbn = %s", (TEST_ISBN,))
    assert row is not None
    assert row["title"] == "Isolation Test Book"


def test_db_connection_rollback_isolation_step_2(db_connection: Connection) -> None:
    """Assert the row inserted in step 1 was rolled back and does not exist."""
    row = db.fetch_one("SELECT title FROM books WHERE isbn = %s", (TEST_ISBN,))
    assert row is None


def test_db_nested_transaction_savepoint(db_connection: Connection) -> None:
    """Assert nested transaction context manager works as a savepoint."""
    with db.transaction() as tx_conn:
        assert tx_conn is db_connection
        db.execute(
            """
            INSERT INTO books (
                isbn, title, author, format, price_cents, stock_count,
                reserved_count, low_stock_threshold, published_date
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                "9780000000002",
                "Savepoint Book",
                "Author",
                "paperback",
                1500,
                3,
                0,
                1,
                "2026-01-01",
            ),
        )
        row = db.fetch_one(
            "SELECT title FROM books WHERE isbn = %s", ("9780000000002",)
        )
        assert row is not None
        assert row["title"] == "Savepoint Book"
