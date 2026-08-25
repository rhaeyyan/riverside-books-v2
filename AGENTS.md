# Riverside Books (Cycle 4) - Agent Operations & Rules

## Architecture & Stack
- **Frontend (Products A & B)**: React + TypeScript (Vite).
- **Backend (Products C & D, API)**: Python 3.12 + FastAPI.
- **Database**: Mock data (JSON files or in-memory dictionaries). No Supabase or live database required.
- **AI/LLM Replacement (Strict Rule)**: Any product that would typically require an AI layer (Product C: Chatbot, Product D: Marketing Content) **MUST** use a deterministic solution instead. 
  - *Chatbot*: Use a decision tree, regex matching, or keyword search against FAQs and inventory.
  - *Marketing*: Use string templating with book/event metadata rather than generative AI.

## Tooling & Linting
- **Python**: `ruff` is mandatory.
  - Config: `target-version = "py312"`
  - Rules: `E,W,F,I,B,UP,SIM,D` (Baseline + Google-style docstrings).
  - Rationale: Standard project setup per Fellowship default rules. Since we are using mock data and no user data/LLM, the `S` (bandit) rule is omitted to keep things lightweight.
  - Line length: 88.
- **Frontend**: `eslint` and `prettier`.

## Security Isolation Assessment
- **Assessment**: No untrusted third-party code, no live production credentials, no real user PII.
- **Mechanism**: None needed. First-party code running locally.

## Project Structure (Monorepo)
- `apps/customer-app/` - Product A (Customer Ordering & Loyalty)
- `apps/staff-dashboard/` - Product B (Staff Inventory & Ops Dashboard)
- `backend/api/` - Shared API serving mock data to frontends
- `backend/chatbot/` - Product C (Deterministic Customer Support)
- `backend/marketing/` - Product D (Deterministic Content Generator)
- `mock_data/` - JSON stores for inventory, orders, and events
