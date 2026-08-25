# Implementation Plan — Riverside Books Suite (Cycle 4)

## Context

The repo currently contains five markdown files, five empty directories, and **zero
commits**. `docs/PRD.md` (v0.2) now specifies the data model, API contract, and
acceptance criteria in detail — but no code, no tooling config, and no seed data
exist to build against.

This plan turns that specification into a working suite: all four products, built
solo, in an order where each phase is verifiable before the next depends on it.

**The PRD is the spec; this document is the build order.** Field names, endpoint
shapes, and acceptance criteria are not restated here — implement against
`docs/PRD.md` §6 (data model), §7 (API contract), and §8 (per-product criteria).

**Decisions carried in from planning:**
- Full suite — all four products
- Products C and D ship as **panels inside A and B** (chat panel in customer-app,
  marketing tab in staff-dashboard), resolving PRD §12 Q1
- **pytest on the backend only**; frontends verified by hand against PRD §10
- **Architectural Purity**: The "Simplicity > Pattern Purity" default is suspended. We will employ the Repository Pattern, rich domain models, 12-Factor config, and a Service Layer to ensure maximum decoupling.

---

## Architecture

Per PRD §5.1, one FastAPI process owns all state. Chatbot and marketing logic are
decoupled into Service layers, with the API handling transport.

```text
riverside-books-v2/
├── pyproject.toml              # ruff + pytest + deps
├── mock_data/*.json            # system of record (PRD §6)
├── backend/
│   ├── __init__.py
│   ├── config.py               # 12-Factor App config (pydantic-settings)
│   ├── api/
│   │   ├── main.py             # app, CORS (via config), router mounting
│   │   ├── core/
│   │   │   ├── datastore.py    # generic JsonDatastore with granular file locks
│   │   │   └── repositories.py # BookRepository, OrderRepository, CustomerRepository
│   │   ├── models.py           # Rich domain Pydantic models (with @computed_field)
│   │   └── routers/            # HTTP transport for books, customers, orders, chatbot, marketing
│   ├── chatbot/                # Product C (Service Layer): tree.py, matching.py, service.py
│   └── marketing/              # Product D (Service Layer): templates.py, generate.py, service.py
├── tests/                      # pytest, mirrors backend/ layout
└── apps/
    ├── customer-app/           # Product A + C's chat panel  (Vite, port 5173)
    └── staff-dashboard/        # Product B + D's marketing tab (Vite, port 5174)
```

**Import direction is one-way:** `api.routers` imports from `chatbot.service` and `marketing.service`, keeping HTTP transport completely decoupled from Product C/D's business logic.

---

## Phase 0 — Repo foundation

Blocks everything. Nothing here is interesting, all of it is load-bearing.

| Task | Detail |
|---|---|
| Rename branch | `git branch -m main` — free now, annoying after the first push |
| `.gitkeep` | In all five empty dirs; git does not track empty directories |
| First commit | Everything currently untracked has no backup anywhere |
| `pyproject.toml` | ruff + pytest config, deps |
| Python env | `uv venv && uv pip install fastapi uvicorn[standard] pydantic pydantic-settings` + dev: `pytest httpx ruff` |
| Node | `nvm install 20 && nvm use 20` — **`node` is not on PATH**; apt's candidate is 18, too old for current Vite. `~/.nvm` already exists |

**`pyproject.toml` ruff block** — per AGENTS.md, with the one addition it omits:

```toml
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "W", "F", "I", "B", "UP", "SIM", "D"]

[tool.ruff.lint.pydocstyle]
convention = "google"   # required, or D203/D211 and D212/D213 conflict

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["D"]       # docstrings on every test function is noise
```

**Done when:** `uv run ruff check .` passes on an empty tree, `node --version`
reports 20.x, and `git log` shows one commit.

---

## Phase 1 — Data layer

The contract. Everything downstream inherits its bugs from here, so this phase
gets tests before any endpoint exists.

**`backend/api/models.py`** — Rich Domain Models for all six files in PRD §6. Types
exactly as specified. Rather than anemic data bags, models contain their own domain logic:
- `available_count` and `stock_status` implemented as `@computed_field` on the Book model.
- `is_expired()` helper on the Order model.

**`mock_data/*.json`** — seed data meeting the PRD §6.7 minimums.

**`backend/api/core/datastore.py` & `repositories.py`** — The Repository Pattern:
- `JsonDatastore` acts as the generic file I/O layer with **granular, per-collection locks** (e.g., locking only `inventory.json` rather than the whole store) and atomic writes (`os.replace`).
- Repositories (`BookRepository`, `OrderRepository`) encapsulate query logic, separating data access from the domain.

**Helpers used everywhere, defined once:** `normalize_phone()` (digits only) and
`normalize_isbn()` (strip hyphens and spaces).

**Tests (`tests/test_models.py`, `test_repositories.py`):**
- Every seed row parses into its model — catches seed/schema drift immediately.
- `stock_status` at the boundaries: 0, 1, threshold, threshold+1.
- Repository locks isolate concurrent writes correctly.

**Done when:** seed data validates, computed field tests pass, and repositories survive concurrent writes in tests.

---

## Phase 2 — Core API

Implement PRD §7's routes across router modules. 

**Configuration (`backend/config.py`)**:
- Uses `pydantic-settings` to load environments. CORS origins (`http://localhost:5173`, `http://localhost:5174`) must be injected via settings rather than hardcoded in `main.py`, adhering to 12-Factor App principles.

**Rules to enforce server-side** — every one of these has a PRD acceptance
criterion attached:
- `POST /orders` → **409** when `available_count < quantity` (two customers, one
  last copy)
- Order status transitions follow PRD §6.3; anything else → **400**. `completed`,
  `cancelled`, `expired` are terminal
- `PATCH /books/{isbn}/stock` rejects `stock_count < reserved_count`
- Placing an order increments `reserved_count` **only**; completing one
  decrements both counts
- **Stamps are awarded in exactly one place** — the transition to `completed`,
  one per book collected (`sum(item.quantity for item in order.items)`). Rolls to
  a reward at 10 and resets. Any second code path that touches `stamps` is a bug
- `release_expired_holds()` runs as a FastAPI dependency on reads that return
  orders or books — cheap at this scale, and makes expiry impossible to forget

**Tests (`tests/test_orders.py`, `test_books.py`, `test_loyalty.py`)** via
`fastapi.testclient.TestClient`, against a temp-directory copy of the seed data:
- Last copy: first order 201, second 409
- Illegal transition rejected
- 3-book order completed → stamps +3
- Customer at 9 stamps completes 1 book → 0 stamps, 1 reward
- Stock cannot be set below reserved

**Done when:** `/docs` lists all 21 endpoints and the above tests pass.

---

## Phase 3 — Products C & D (Service Layers)

Both are pure functions decoupled from HTTP transport. They act as Service Layers that the API routers consume.

### Product C — chatbot (`backend/chatbot/`)

- **`service.py`** — Exposes business logic to the API router.
- **`tree.py`** — the decision tree as data. Root options per PRD §8.C.1.
- **`matching.py`** — exact match on normalized ISBN; case-insensitive substring
  on title/author; >5 matches → narrowing prompt with the count; 0 matches →
  special-order policy plus escalation.
- Answers report **`available_count`**, never `stock_count` (PRD §5.4). A copy on
  hold for someone else is not on the shelf.
- Hours formatting handles the closed-today case and names the next open day.
- **Every leaf either answers or offers escalation.** No dead ends.

### Product D — marketing (`backend/marketing/`)

- **`service.py`** — Exposes generation logic to the API router.
- **`templates.py`** — template sets keyed `(subject_type, tone)`, each template
  carrying a `requires_stock: bool` flag.
- **Deterministic variant selection** (PRD §5.5, §8.D.4):
  1. Filter out `requires_stock` templates when `available_count == 0` — so an
     out-of-stock book never generates "only 2 left, come get it"
  2. Then `templates[variant % len(templates)]`

  Filtering **before** the modulo matters: reversing the order makes a variant
  index point at different text depending on stock, breaking reproducibility.
- **Missing-metadata fallbacks** — an empty `blurb` drops its clause entirely.
  Templates must never emit `None`, `null`, or an empty bracket.
- **280-character budget** including hashtags. When over, truncate the blurb
  clause first, never the title.

**Tests (`tests/test_chatbot.py`, `test_marketing.py`):**
- Same question twice → byte-identical response
- Hyphenated ISBN (`978-0-14-303943-3`) matches
- A 40-match query asks for narrowing rather than dumping 40 results
- Same `(subject_id, tone, variant)` → identical output **across a store reload**
- All three tones differ visibly for one book
- Empty blurb → clean prose, no placeholder
- Every generated caption ≤ 280 chars including hashtags
- Out-of-stock book → no stock-referencing template

**Done when:** every C and D acceptance criterion in PRD §8 has a passing test.

---

## Phase 4 — Frontend foundation

- Scaffold both apps: `npm create vite@latest <app> -- --template react-ts`
- ESLint + Prettier per AGENTS.md; pin ports 5173 / 5174
- **Generate TS types from the live API** rather than hand-writing them:
  `openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/types.ts`,
  wired as an `npm run gen:types` script in each app.

  One devDependency, one command, and PRD §6 drift — risk R1, the top risk on the
  board — becomes structurally impossible instead of a discipline problem.
- A thin `src/api/client.ts` per app wrapping `fetch`. Two small typed clients
  beat a shared workspace package at this size.
- **Format money only at the render edge.** `price_cents` stays an integer
  everywhere else.

**Done when:** both apps boot, generate types cleanly, and fetch `/api/books`.

---

## Phase 5 — Product A: customer-app (+ C's chat panel)

Per PRD §8.A. Routes: search/browse → book detail → pre-order → my orders →
loyalty card, plus the chat panel.

Points where the PRD's edge cases bite:
- Display **`stock_status`** from the API; never recompute availability locally
- Out-of-stock → pre-order control **disabled with a reason**, not hidden
- Unknown phone → inline registration in one step, and **the pending pre-order
  survives it** (hold the intent in component state across the registration call)
- Empty search result → empty state that offers the chatbot, not a blank page
- 409 on the last copy → explain it; this will happen in the demo if two tabs are open
- Chat panel renders buttons from `GET /chat/tree` — no hardcoded options

## Phase 6 — Product B: staff-dashboard (+ D's marketing tab)

Per PRD §8.B. Inventory grid → alerts summary → inline stock edit → Kanban board
→ release-expired action → message inbox, plus the marketing tab.

- Grid shows `stock_count` **and** `available_count` as separate columns — staff
  need to know what's physically present *and* what's spoken for
- Alert summary counts must match the number of red/amber rows exactly
- Inline stock edit is optimistic **with rollback** — the server rejects values
  below `reserved_count` and the UI has to survive that
- Kanban: an illegal transition (Completed → Pending) is refused by the API and
  the card snaps back
- Board renders correctly with **zero** pending orders
- Marketing tab: subject search → tone select → "Show another" increments
  `variant` → copy caption + hashtags together

---

## Phase 7 — Integration

- Run the **PRD §10 seven-step walkthrough** end to end without restarting
  anything. It deliberately crosses all four products and will surface any place
  where state didn't actually reach disk
- Fill in README "Running Locally" — currently a TODO
- Update PRD §12: close Q1 (resolved: panels), record the Q2 ownership answer

---

## Verification

```bash
# Backend
uv run ruff check .
uv run pytest
uv run uvicorn backend.api.main:app --reload    # → http://127.0.0.1:8000/docs

# Frontends (separate terminals, backend running)
cd apps/customer-app    && npm run dev          # → :5173
cd apps/staff-dashboard && npm run dev          # → :5174
```

`backend/`, `backend/api/`, `backend/chatbot/`, and `backend/marketing/` each
need an `__init__.py` for the `backend.api.main:app` module path to resolve from
the repo root.

**Acceptance is PRD §10** — the seven-step walkthrough. Its step 6 (generate
"cozy", switch to "urgent", switch back and get the original text **verbatim**)
is the one that catches non-determinism, and it will not be caught by clicking
around casually.

---

## Sequencing notes

Phases 0–3 are the critical path: they are the whole backend, and Phase 4 cannot
start without a running API to generate types from. Phases 5 and 6 are
independent of each other once Phase 4 lands.

**If teammates join:** Phases 0–2 are the shared foundation and should be built
once, together, in a single session (PRD §9, Option 1). After Phase 2 is
committed, Products A/B/C/D genuinely parallelize — which is exactly what PRD §9
Q2 is asking the team to decide, and it remains the one open item that blocks
everyone.

---

## Risks carried from PRD §11

| Risk | Handled by |
|---|---|
| R1 — data model churn | Phase 1 lands and is committed before any product code; Phase 4 generates types from the live schema |
| R2 — JSON corruption | Single process, granular locks, atomic temp-then-`os.replace` writes via JsonDatastore |
| R3 — no staff auth | Accepted, local-only. **Revisit before any hosting** |
| R6 — Node missing | Phase 0, via the already-installed nvm |
| R7 — thin seed data | Phase 1 enforces the PRD §6.7 minimums |
