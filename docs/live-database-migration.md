# Moving off JSON files to a live database: lift assessment

@rhaeyyan — this came out of a conversation about what it would take to replace
`JsonDatastore` with a real database. Writing it down here since it touches
`backend/api/`, which §9 of the PRD lists as unassigned and needing agreement
from all four owners before its shape changes.

## Current state

`backend/api/core/repositories.py` already puts a clean boundary in front of
storage: every router goes through a `BookRepository`/`EventRepository`-style
class, never `JsonDatastore` directly (only tests reach around it, for
convenience, by mutating the seed files in place). The canonical fields are
already DB-shaped — integer cents, ISO 8601 strings, prefixed string IDs
(PRD §5.2) — so there's no data-model rework needed, only a storage swap.

No SQL/DB client is in `pyproject.toml` or `requirements.txt` today — this
would be a fresh dependency, not a half-started attempt.

## What makes it more than a mechanical swap

Roughly nine call sites in `repositories.py` wrap a read-modify-write in
`datastore.get_lock(...)` — stock reservation, hold expiry, and similar. That
pattern is only correct because one Python process holds an in-memory lock
(PRD §5.1's "one process owns all state"). Moving to a real database means
rewriting each of those as an actual transaction or atomic update, which is
exactly the stock-accounting logic §5.4/§5.7 exist to protect — worth doing
carefully, not mechanically porting.

The test suite also assumes a `tmp_path` JSON store rebuilt per test
(`tests/test_marketing.py`, `test_chatbot.py`, etc.) — fast and hermetic with
no external service. A real database means either a containerized test DB or
a transactional-rollback fixture pattern; not hard, but real work, and CI
(`.github/workflows/ci.yml`) would need a service container or equivalent.

Worth noting: a Supabase-backed approach was already scoped once, for a
Product-D-only rewrite, and walked back in favor of the current JSON design —
`docs/market_strategy.md`'s "Product decisions and team dependencies" table
still describes it, and `docs/README.md` already flags that table as
contradicting the PRD (shared data source, model provider, and staff auth all
ruled out by §2.2/§5.2/§5.3/§5.5). Before redoing this, it's worth finding out
why it was shelved the first time.

## What I can do vs. what needs you (or the team)

**Mechanical, and something I can do once the shape is agreed:**
- Repository implementations against a real client, behind the existing
  interface
- The ~9 lock sites rewritten as transactions/atomic updates
- Schema and migration scripts translating the current JSON shapes into tables
- Test suite rework to run against a test database
- Wiring `deps.py`, config, and CI to a DB connection instead of a file path

**Not something I should do:**
- Provisioning the actual database — creating a project, picking a plan/region
  — since that's an account and possibly billing action
- Ratifying the schema itself, since `backend/api/`'s data model is shared
  across all four products per PRD §9 — a cross-team call, not a unilateral
  one in a PR

## The ask

The team has a Supabase account. Two things needed before any of the
mechanical work above starts:
1. Is there already a project provisioned for this app, or does one need to be
   created?
2. Once one exists — a connection string (or project URL + service role key)
   handed over out-of-band, not committed to the repo.

And separately from the infra question: since this changes shared state, it
probably wants a decision from all four product owners the same way §9 asks
for on `backend/api/` generally, not just a green light from whoever owns the
Supabase account.
