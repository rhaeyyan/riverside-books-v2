"""Pytest fixtures for database testing with transactional rollback."""

from __future__ import annotations

from collections.abc import Iterator

import psycopg
import pytest
from psycopg import Connection

from backend.api.core.db import get_pool, set_current_connection
from backend.config import settings


@pytest.fixture
def db_connection() -> Iterator[Connection]:
    """Provide a database connection wrapped in an outer transaction that rolls back.

    Guarantees hermetic test isolation without re-running migrations or re-seeding
    between tests (PRD §12 Q8, R9).

    Yields:
        An isolated psycopg Connection inside an uncommitted transaction.
    """
    if not settings.database_url:
        pytest.skip("DATABASE_URL is not set; skipping database test")

    pool = get_pool()
    with pool.connection() as conn, conn.transaction(), set_current_connection(conn):
        yield conn
        raise psycopg.Rollback
