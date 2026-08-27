# Riverside Books

This repository contains the software suite for Riverside Books, a single-location independent bookstore. The project aims to modernize the customer experience and staff operations without turning the business into a large e-commerce platform.

This is a monorepo containing four interconnected products built as part of the Cycle 4 fellowship assignment.

## Products

### Product A: Customer Ordering & Loyalty App
A frontend application that allows customers to search the store's catalog, check real-time stock levels, place pre-orders for in-store pickup, and track their loyalty rewards.

### Product B: Staff Inventory & Ops Dashboard
An operational dashboard for the store staff and owner to monitor live stock levels, flag low/out-of-stock titles, and manage pending pre-orders. **Note:** Access requires a staff PIN. For local development and demos, use `1234` (Manager) or `5678` (Bookseller). The Messages inbox can draft an AI reply to a customer message via Gemini, given a `GEMINI_API_KEY` — no fallback if the call fails.

### Product C: Customer Support Chatbot
A customer support agent that answers common questions (store hours, return policy, event schedules) and performs live stock checks. **Note:** This is built using a deterministic approach (e.g., decision trees and exact matching) rather than generative AI.

### Product D: Marketing Content Generator
An internal tool that automatically generates social media captions and post ideas based on book metadata or upcoming events, using strict string templating by default. An opt-in "Generate with AI" mode calls Gemini instead, falling back to templating on any failure or missing `GEMINI_API_KEY`.

## Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python 3.12 (FastAPI)
- **Database**: PostgreSQL (managed Supabase or local instance) via `psycopg` 3 connection pooling.

## Project Structure
- `apps/customer-app/` - Source code for Product A (Customer Ordering & Loyalty)
- `apps/staff-dashboard/` - Source code for Product B (Staff Inventory & Ops Dashboard)
- `backend/api/` - Shared backend API and PostgreSQL persistence layer
  - `backend/api/core/` - Connection pooling (`db.py`) and domain repositories (`repositories.py`)
  - `backend/api/routers/` - FastAPI endpoints for books, customers, orders, chat, and marketing
- `backend/chatbot/` - Source code for Product C (Deterministic Chatbot)
- `backend/marketing/` - Source code for Product D (Deterministic Content Generator, plus an opt-in Gemini-backed mode)
- `backend/messages/` - Product B's AI reply drafter for the staff Messages inbox (Gemini-backed, opt-in via `GEMINI_API_KEY`)
- `mock_data/` - Base seed datasets for inventory, orders, customers, and events
- `scripts/` - Database seeding (`seed.py`) and PRD conformance auditor (`check_contract.py`)
- `web/` - Static landing page for the unified gateway (see below)

## Running Locally

### Prerequisites
- Python 3.12+ and `uv`
- Node.js 18+ and `npm`
- PostgreSQL database (Supabase connection or local container). Configure `DATABASE_URL` in `.env`:
  ```bash
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
  ```
- *(Optional)* A Google AI Studio key to exercise the two Gemini-backed features — Product D's
  "Generate with AI" and Product B's Messages inbox "Draft a reply". Without it, marketing
  generation silently falls back to templating and the draft-reply button returns a 400.
  ```bash
  GEMINI_API_KEY="your-google-ai-studio-key"
  GEMINI_MODEL="gemini-3.6-flash"   # optional, this is the default
  ```

To run the full suite locally, you will need three terminal windows:

**1. Seed Database and Start Backend API:**
```bash
uv run python -m scripts.seed --db   # seeds Postgres database with relative timestamps
uv run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```
This serves the API with live PostgreSQL persistence.

`scripts/seed.py --db` generates database rows with timestamps relative to runtime, ensuring holds stay active and events stay upcoming (PRD §6.7). It is the source of truth for seed data. Re-run it anytime the pre-order board looks empty or holds expire.

**2. Start Product A (Customer App):**
```bash
cd apps/customer-app
npm install
npm run dev
```
Runs on `http://localhost:5173`.

**3. Start Product B (Staff Dashboard):**
```bash
cd apps/staff-dashboard
npm install
npm run dev
```
Runs on `http://localhost:5174`.

## Unified Demo Mode

For a demo or a quick look at the whole suite, you don't need three
terminals or three ports. Build both frontends once:

```bash
cd apps/customer-app && npm install && npm run build && cd ../..
cd apps/staff-dashboard && npm install && npm run build && cd ../..
```

Then start only the backend:

```bash
uv run uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

and open **`http://127.0.0.1:8000/`** - a landing page linking to the
storefront (`/shop/`), the staff dashboard (`/staff/`), and the API
reference (`/docs`), all served by the one FastAPI process. This is
static output, so it won't pick up frontend changes until you rebuild;
for active frontend development, use the three-terminal setup above
instead, which hot-reloads.


## Deployment

The project is packaged as a **Unified Application** for deployment on platforms like Render or Railway. The FastAPI application serves the REST API, the Gateway Landing Page, the Customer App (`/shop`), and the Staff Dashboard (`/staff`) from a single service and domain.

We provide a unified build script (`render-build.sh`) that installs Python and Node dependencies and compiles both React frontends.

### Deploying to Render
1. Create a **Web Service** on Render connected to this repository.
2. Set the Environment to **Python**.
3. Set the **Build Command** to:
   ```bash
   ./render-build.sh
   ```
4. Set the **Start Command** to:
   ```bash
   uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
   ```
5. Configure Environment Variables:
   - `DATABASE_URL`: Your production PostgreSQL connection URI (e.g., from Supabase or Render Postgres).
   - `CORS_ORIGINS`: *(Optional)* Allowed CORS origins if accessing the API externally.
   - `GEMINI_API_KEY`: *(Optional)* Enables Product D's "Generate with AI" and Product B's
     Messages inbox "Draft a reply". Leave unset to keep both products fully deterministic —
     marketing generation still works via templating either way.
   - `GEMINI_MODEL`: *(Optional)* Defaults to `gemini-3.6-flash`.

Once deployed, the unified FastAPI application serves all four products seamlessly with live PostgreSQL persistence.
