# Riverside Books

This repository contains the software suite for Riverside Books, a single-location independent bookstore. The project aims to modernize the customer experience and staff operations without turning the business into a large e-commerce platform.

This is a monorepo containing four interconnected products built as part of the Cycle 4 fellowship assignment.

## Products

### Product A: Customer Ordering & Loyalty App
A frontend application that allows customers to search the store's catalog, check real-time stock levels, place pre-orders for in-store pickup, and track their loyalty rewards.

### Product B: Staff Inventory & Ops Dashboard
An operational dashboard for the store staff and owner to monitor live stock levels, flag low/out-of-stock titles, and manage pending pre-orders. **Note:** Access requires a staff PIN. For local development and demos, use `1234` (Manager) or `5678` (Bookseller).

### Product C: Customer Support Chatbot
A customer support agent that answers common questions (store hours, return policy, event schedules) and performs live stock checks. **Note:** This is built using a deterministic approach (e.g., decision trees and exact matching) rather than generative AI.

### Product D: Marketing Content Generator
An internal tool that automatically generates social media captions and post ideas based on book metadata or upcoming events, using strict string templating.

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
- `backend/marketing/` - Source code for Product D (Deterministic Content Generator)
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

Once deployed, the unified FastAPI application serves all four products seamlessly with live PostgreSQL persistence.

> **Supabase connection strings — use the pooler, not the direct connection.**
> Supabase's "Direct connection" host (`db.<project-ref>.supabase.co:5432`) is
> IPv6-only, and Render's network doesn't support outbound IPv6 — the
> connection just hangs (no error, no fast failure) until it eventually times
> out. Use the **Transaction pooler** connection string instead (Supabase
> dashboard → **Connect** → connection type **Transaction pooler**), which
> looks like:
> ```
> postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
> ```
> Note the username changes too (`postgres.<project-ref>`, not just
> `postgres`). If your password has special characters, percent-encode them
> (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, etc.) or the connection string will
> parse incorrectly.

### Managing the deploy from the command line

The [Render CLI](https://render.com/docs/cli) covers everything above (and viewing logs) without leaving the terminal — useful for debugging a deploy that isn't behaving, since the dashboard's log viewer is slower to work with for anything beyond a quick glance.

**Install** (macOS/Linux):
```bash
brew install render
# or
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```
Windows and manual downloads: see the [releases page](https://github.com/render-oss/cli/releases).

**Authenticate** (opens a browser to authorize the CLI, then lets you pick the workspace):
```bash
render login
```

**Common commands:**
```bash
render services                          # list services in the active workspace, with their IDs
render logs --resources <serviceID> --tail=true   # stream logs live — the fastest way to see a real traceback
render deploys create <serviceID>        # trigger a manual deploy (e.g. after changing an env var)
```

Run `render <command> --help` for the full flag list on any subcommand — env var management in particular (`render services update`) is easiest to get exactly right by checking `--help` rather than guessing at flag names, since the CLI has changed shape across versions.
