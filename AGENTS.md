# Riverside Books (Cycle 4) - Agent Operations & Rules

## Architecture & Stack
- **Frontend (Products A & B)**: React + TypeScript (Vite).
- **Backend (Products C & D, API)**: Python 3.12 + FastAPI.
- **Database**: Mock data (JSON files or in-memory dictionaries). No Supabase or live database required.
- **AI/LLM Replacement (Strict Rule, two named exceptions)**: Product C's chatbot and
  Product D's marketing generator still default to deterministic solutions, and any
  *other* model call in either is out.
  - *Chatbot*: decision tree, regex matching, or keyword search against FAQs and
    inventory (`backend/chatbot/tree.py`) — unchanged.
  - *Marketing*: string templating with book/event metadata (`backend/marketing/service.py`,
    `templates.py`) — still the default and the fallback.
  - **Exceptions, added 2026-08-27**: `backend/marketing/gemini_service.py` (Product D,
    opt-in `use_ai` flag on `POST /api/marketing/generate`, falls back to templating on
    any failure or missing key) and `backend/messages/gemini_reply.py` (a Product B
    feature — staff dashboard "Draft a reply"; no fallback). Both call the Gemini API
    directly over `httpx`, gated on a `GEMINI_API_KEY` env var read by `backend/config.py`.
    See `CLAUDE.md` non-negotiable 1 for the full detail.

## Tooling & Linting
- **Python**: `ruff` is mandatory.
  - Config: `target-version = "py312"`
  - Rules: `E,W,F,I,B,UP,SIM,D` (Baseline + Google-style docstrings).
  - Rationale: Standard project setup per Fellowship default rules. Since we are using mock data and no user data/LLM, the `S` (bandit) rule is omitted to keep things lightweight.
  - Line length: 88.
- **Frontend**: `eslint` and `prettier`.

## Security Isolation Assessment
- **Assessment**: No untrusted third-party *code*. No live production database
  credentials. This no longer holds without qualification for external *calls*:
  the two Gemini integrations above send data to Google's API over a real
  `GEMINI_API_KEY` credential, and the staff-inbox one (`gemini_reply.py`)
  sends a real customer's name, contact info, and message body off-box to
  draft a reply — the one place in this codebase real user PII now leaves the
  server. Neither integration existed when this assessment was first written.
- **Mechanism**: None needed for first-party code running locally, still true.
  For the two exceptions: fail closed on a missing key (both raise/400 rather
  than silently proceeding), never log the key (`scripts/verify_gemini_key.py`
  masks it), and keep it out of version control (non-negotiable 3 in
  `CLAUDE.md`). No mechanism currently limits what of a customer message
  reaches Gemini beyond what `gemini_reply.py` puts in the prompt.

## Project Structure (Monorepo)
- `apps/customer-app/` - Product A (Customer Ordering & Loyalty)
- `apps/staff-dashboard/` - Product B (Staff Inventory & Ops Dashboard)
- `backend/api/` - Shared API serving mock data to frontends
- `backend/chatbot/` - Product C (Deterministic Customer Support)
- `backend/marketing/` - Product D (Deterministic Content Generator by default;
  `gemini_service.py` is an opt-in exception — see above)
- `backend/messages/` - Product B's staff-inbox AI reply drafter (`gemini_reply.py`,
  added 2026-08-27 — see the AI/LLM Replacement exceptions above); the message store
  itself is served from `backend/api/routers/messages.py` and stays shared
- `mock_data/` - JSON stores for inventory, orders, and events
