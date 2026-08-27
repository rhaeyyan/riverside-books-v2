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
from contextvars import ContextVar
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.config import settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_current_conn: ContextVar[Connection | None] = ContextVar("_current_conn", default=None)


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
            # Supabase's pooler sits in front of Postgres, so a connection
            # that has been idle can be closed underneath us. Checking it on
            # checkout turns a stale handle into a retry rather than a
            # request-time error.
            check=ConnectionPool.check_connection,
            # DATABASE_URL points at Supabase's Transaction pooler (PgBouncer
            # in transaction mode — see README's deploy section), which
            # multiplexes each logical connection across different backend
            # Postgres connections mid-session. psycopg3's server-side
            # prepared statements (auto-enabled after a statement repeats a
            # few times) don't survive that swap: a later query can land on a
            # backend connection that already has a same-named prepared
            # statement from a *different* pooled client, raising
            # DuplicatePreparedStatement. Disabling server-side prepare is
            # the standard fix for this pooler mode.
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
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
def set_current_connection(conn: Connection | None) -> Iterator[None]:
    """Set the active connection for the current context (e.g. test isolation).

    Args:
        conn: The psycopg connection to use for queries, or None to clear.

    Yields:
        None.
    """
    token = _current_conn.set(conn)
    try:
        yield
    finally:
        _current_conn.reset(token)


def get_current_connection() -> Connection | None:
    """Return the active connection in the current context, if set."""
    return _current_conn.get()


@contextmanager
def transaction(conn: Connection | None = None) -> Iterator[Connection]:
    """Run a block inside a single database transaction.

    Every write in the repository layer goes through this. psycopg commits when
    the block exits cleanly and rolls back on any exception, so a partially
    applied read-modify-write — the failure mode PRD R2 describes — cannot be
    left behind.

    Reads use this too. A multi-statement read that spans a concurrent write
    would otherwise see two different versions of the store's stock, which is
    exactly the divergence §5.1 exists to prevent.

    Args:
        conn: Optional specific Connection. If omitted, uses the scoped
            connection if set, or checks out a connection from the pool.

    Yields:
        The active Connection for this transaction.
    """
    active_conn = conn or _current_conn.get()
    if active_conn is not None:
        with active_conn.transaction():
            yield active_conn
    else:
        with get_pool().connection() as pool_conn, pool_conn.transaction():
            yield pool_conn


def fetch_one(
    sql: str, params: Any = None, conn: Connection | None = None
) -> dict[str, Any] | None:
    """Run a single read returning at most one row.

    Args:
        sql: SQL query string to execute.
        params: Parameters to substitute into query.
        conn: Optional specific Connection. If omitted, uses scoped connection
            or pool.

    Returns:
        Dict of row columns if found, None otherwise.
    """
    active_conn = conn or _current_conn.get()
    if active_conn is not None:
        return active_conn.execute(sql, params).fetchone()
    with get_pool().connection() as pool_conn:
        return pool_conn.execute(sql, params).fetchone()


def fetch_all(
    sql: str, params: Any = None, conn: Connection | None = None
) -> list[dict[str, Any]]:
    """Run a single read returning every matching row.

    Args:
        sql: SQL query string to execute.
        params: Parameters to substitute into query.
        conn: Optional specific Connection. If omitted, uses scoped connection
            or pool.

    Returns:
        List of dicts representing matching rows.
    """
    active_conn = conn or _current_conn.get()
    if active_conn is not None:
        return active_conn.execute(sql, params).fetchall()
    with get_pool().connection() as pool_conn:
        return pool_conn.execute(sql, params).fetchall()


def execute(sql: str, params: Any = None, conn: Connection | None = None) -> None:
    """Execute a single statement without returning rows.

    Args:
        sql: SQL statement to execute.
        params: Parameters to substitute into statement.
        conn: Optional specific Connection. If omitted, uses scoped connection
            or pool.
    """
    active_conn = conn or _current_conn.get()
    if active_conn is not None:
        active_conn.execute(sql, params)
    else:
        with get_pool().connection() as pool_conn:
            pool_conn.execute(sql, params)
