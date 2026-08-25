# Riverside Books

This repository contains the software suite for Riverside Books, a single-location independent bookstore. The project aims to modernize the customer experience and staff operations without turning the business into a large e-commerce platform.

This is a monorepo containing four interconnected products built as part of the Cycle 4 fellowship assignment.

## Products

### Product A: Customer Ordering & Loyalty App
A frontend application that allows customers to search the store's catalog, check real-time stock levels, place pre-orders for in-store pickup, and track their loyalty rewards.

### Product B: Staff Inventory & Ops Dashboard
An operational dashboard for the store staff and owner to monitor live stock levels, flag low/out-of-stock titles, and manage pending pre-orders.

### Product C: Customer Support Chatbot
A customer support agent that answers common questions (store hours, return policy, event schedules) and performs live stock checks. **Note:** This is built using a deterministic approach (e.g., decision trees and exact matching) rather than generative AI.

### Product D: Marketing Content Generator
An internal tool that automatically generates social media captions and post ideas based on book metadata or upcoming events, using strict string templating.

## Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python 3.12 (FastAPI)
- **Database**: Local mock data (JSON/in-memory) instead of a live database.

## Project Structure
- `apps/customer-app/` - Source code for Product A
- `apps/staff-dashboard/` - Source code for Product B
- `backend/api/` - Shared backend API exposing mock data to the frontends
- `backend/chatbot/` - Source code for Product C (Deterministic Chatbot)
- `backend/marketing/` - Source code for Product D (Deterministic Content Generator)
- `mock_data/` - Mock JSON files acting as the store's central database for inventory, orders, and events
- `web/` - Static landing page for the unified gateway (see below)

## Running Locally

To run the full suite locally, you will need three terminal windows:

**1. Start the Backend API:**
```bash
uv run python -m scripts.seed   # first run, or whenever the demo data looks stale
uv run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```
This serves the API and the data layer from `mock_data/`.

`scripts/seed.py` generates `mock_data/` with timestamps relative to when you
run it, so holds stay live and events stay upcoming (PRD §6.7). It is the source
of truth for seed data — edit the script, not the JSON. Re-run it any time the
pre-order board looks empty or every hold shows as expired.

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

Because this project relies on local JSON files (`mock_data/`) for state and is designed to operate as a single cohesive storefront, it is best deployed as a **Unified Application** on a service with persistent disk storage (like Render or Railway) rather than split across serverless providers like Vercel.

We have included a unified build script (`render-build.sh`) that installs the backend dependencies and builds both React frontends. 

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
5. *(Optional)* Add the `CORS_ORIGINS` environment variable if you plan to access the API externally.

Once deployed, the FastAPI application will seamlessly serve the API, the Landing Page, the Customer App (`/shop`), and the Staff Dashboard (`/staff`) all from a single domain.
