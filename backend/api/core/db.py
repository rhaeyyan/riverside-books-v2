"""Postgres connection management for the repository layer.

PRD §5.1 changed in v0.3: the read-modify-write sequences in §5.4 and §5.7 used
to be correct only because a single process held an in-memory lock. A database
does not inherit that guarantee, so those sequences are transactions now and the
guarantee comes from Postgres. This module is where that boundary lives — the
pool, and the one context manager the nine R2 sites run inside.

Nothing above the repository layer imports this. Routers reach the database only
through a repository, per §5.2.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.config import settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return the process-wide connection pool, opening it on first use.

    Raises:
        RuntimeError: If no connection string has been configured.
    """
    global _pool
    if _pool is None:
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. The suite reads it from the "
                "environment or a local .env file; see README. It is never "
                "committed (PRD R8)."
            )
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            max_size=10,
            # Supabase's session pooler sits in front of Postgres, so a
            # connection that has been idle can be closed underneath us.
            # Checking it on checkout turns a stale handle into a retry rather
            # than a request-time error.
            check=ConnectionPool.check_connection,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def close_pool() -> None:
    """Close the pool. Used at application shutdown and between test sessions."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def transaction() -> Iterator[Connection]:
    """Run a block inside a single database transaction.

    Every write in the repository layer goes through this. psycopg commits when
    the block exits cleanly and rolls back on any exception, so a partially
    applied read-modify-write — the failure mode PRD R2 describes — cannot be
    left behind.

    Reads use this too. A multi-statement read that spans a concurrent write
    would otherwise see two different versions of the store's stock, which is
    exactly the divergence §5.1 exists to prevent.
    """
    with get_pool().connection() as conn, conn.transaction():
        yield conn


def fetch_one(sql: str, params: Any = None) -> dict[str, Any] | None:
    """Run a single read returning at most one row."""
    with get_pool().connection() as conn:
        return conn.execute(sql, params).fetchone()


def fetch_all(sql: str, params: Any = None) -> list[dict[str, Any]]:
    """Run a single read returning every matching row."""
    with get_pool().connection() as conn:
        return conn.execute(sql, params).fetchall()
