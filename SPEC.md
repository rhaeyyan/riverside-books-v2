### Task 1: Phase 0 — Repo Foundation & Python Environment
**Agent**: Redwood
**Files**:
1. `pyproject.toml`
2. `backend/__init__.py`
3. `backend/api/__init__.py`
4. `backend/chatbot/__init__.py`
5. `backend/marketing/__init__.py`

**[SPEC]**
- **Initialize Workspace**: Execute `git branch -m main`, create the `backend` package directories. 
- **pyproject.toml**: Configure `ruff` (target `py312`, max-length `88`, select `["E", "W", "F", "I", "B", "UP", "SIM", "D"]`, pydocstyle google convention, and ignore `D` in tests). Configure `pytest` and dependencies (`fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `pytest`, `httpx`).
- **Setup Scripts**: Ensure the environment is set up (via `uv venv` and `uv pip install`).
- **Commit**: Make the first Git commit to back up the empty directories and scaffolding.

**[FORCES]**
- **Pattern Purity > Simplicity**: Ensure strict 12-factor config foundations and robust package architecture boundaries from day one.
- **Dependency Management**: Lock dependencies explicitly for deterministic builds across environments.

---

### Task 2: Phase 1 — Data Layer Seed (Part 1: Core Commerce)
**Agent**: Redwood
**Files**:
1. `mock_data/inventory.json`
2. `mock_data/customers.json`
3. `mock_data/orders.json`

**[SPEC]**
- Generate seed data strictly adhering to PRD §6 data models. Use integer cents for prices, ISO 8601 UTC strings for dates, and string ISBNs.
- `inventory.json`: 30+ books. Ensure at least two have `available_count == 0` (by configuring `stock_count` and `reserved_count`), and two in the low-stock band.
- `customers.json`: 8+ customers spanning 0 stamps, mid-card, and one with `rewards_available >= 1`. Use string digit-only phone numbers.
- `orders.json`: 10+ orders across all five statuses (`pending`, `ready_for_pickup`, `completed`, `cancelled`, `expired`). Include at least one pending hold past `hold_expires_at` (48 hours).

**[FORCES]**
- **Pattern Purity > Simplicity**: Seed data must strictly reflect edge cases (e.g., zero available stock, expired holds) to validate robust domain abstractions.
- **Data Integrity**: Enforce schema constraints directly in the JSON files; no drifting fields.

---

### Task 3: Phase 1 — Data Layer Seed (Part 2: Content & Support)
**Agent**: Redwood
**Files**:
1. `mock_data/events.json`
2. `mock_data/store_info.json`
3. `mock_data/messages.json`

**[SPEC]**
- Generate the remaining seed data strictly adhering to PRD §6.
- `events.json`: 4+ upcoming events. Include at least one event where `capacity == tickets_sold`.
- `store_info.json`: Provide store details, operating hours, policies (including `policies.gifts`), and FAQs to support the chatbot.
- `messages.json`: Pre-seed 1-2 new/read escalation messages to validate staff inbox rendering.

**[FORCES]**
- **Pattern Purity > Simplicity**: Data structure must map exactly to domain models and future Service Layers without any ad-hoc schema modifications.
- **Data Integrity**: JSON schema must be perfectly valid for deserialization by Pydantic.

---

### Task 4: Phase 1 — Rich Domain Models & Atomic Datastore
**Agents**: Cypress (Tests) -> Redwood (Implementation)
**Files**:
1. `backend/api/models.py`
2. `tests/test_models.py`
3. `backend/api/core/datastore.py`
4. `backend/api/core/__init__.py`

**[SPEC]**
- **Models (`models.py`)**: Implement Pydantic models for all six datasets. Include computed properties: `available_count` (`stock_count - reserved_count`) and `stock_status` for Books, and `is_expired()` for Orders. Implement global helpers like `normalize_phone()` and `normalize_isbn()`.
- **Datastore (`datastore.py`)**: Implement `JsonDatastore` as a generic file I/O layer. Must use granular, per-collection file locking and atomic writes via `os.replace` (write-through to a temp file first).
- **Tests (`test_models.py`)**: Ensure every seed row from Tasks 2/3 parses perfectly. Test boundary conditions for `stock_status` thresholds.

**[FORCES]**
- **Pattern Purity > Simplicity**: Maximize architectural correctness. The domain model must be rich and encapsulate logic (computed fields) rather than acting as anemic data bags. 
- **Robust Abstractions**: File I/O must strictly guarantee thread safety, atomic commits, and prevent JSON corruption under concurrent load.

---

### Task 5: Phase 1 — Repository Pattern
**Agents**: Cypress (Tests) -> Redwood (Implementation)
**Files**:
1. `backend/api/core/repositories.py`
2. `tests/test_repositories.py`

**[SPEC]**
- **Repositories (`repositories.py`)**: Implement `BookRepository`, `OrderRepository`, and `CustomerRepository`. They must inject `JsonDatastore` and encapsulate all query and mutation logic, shielding the API routers from direct file access.
- **Tests (`test_repositories.py`)**: Write tests proving that repositories can correctly isolate concurrent writes utilizing the datastore's locking mechanism. Validate that repository methods return correctly typed domain models.

**[FORCES]**
- **Pattern Purity > Simplicity**: Use the Repository Pattern to completely decouple data access from the domain and service layers. Strict separation of concerns is mandatory.
- **Robust Abstractions**: Ensure the API layer can rely on predictable data fetching and deterministic state changes.
