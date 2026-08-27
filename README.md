# Riverside Books

A modern software suite for **Riverside Books**, a single-location independent bookstore in Beacon, New York. Designed to modernize customer ordering, loyalty, and staff operations while preserving the warm, personal touch of a community bookshop — without turning the business into a generic e-commerce platform.

This monorepo contains four interconnected products and a unified gateway landing page, built as part of the Cycle 4 fellowship assignment and **deployed as a unified web service on Render**.

## Products & Features

### Unified Gateway Landing Page (`/`)
- Curated editorial landing page matching the physical bookstore's warm aesthetic.
- Highlights real-time store hours, Beacon, NY address, and upcoming literary events.
- **Customer Sign-In Modal**: Allows customers to sign in with email/password from the homepage, automatically carrying their authenticated session into the customer app (`/shop`).
- **Discreet Staff Entry**: Direct link to the email/password-protected staff dashboard.

### Product A: Customer Ordering & Loyalty App (`/shop`)
- **Shelf Catalog & Search**: Browse titles by category/genre with instant keyword search across title, author, and description.
- **Live Shelf Availability**: Real-time stock status matching what the store register sees (In Stock, Low Stock count, or Out of Stock).
- **48-Hour In-Store Holds**: Place pre-orders for in-store pickup without upfront credit card requirements. Holds expire automatically after 48 hours.
- **Loyalty Stamp Card**: Tied to the signed-in customer's account. Every physical book purchase earns 1 stamp; 10 stamps redeem a $10 store credit reward.
- **My Holds Management**: Real-time tracking of pending, ready-for-pickup, and fulfilled orders with hold countdown indicators.
- **Integrated Customer Chat**: Embedded chat bubble with instant answers to common questions and a direct "Ask a bookseller" escalation form.
- **Design & Polish**: Warm cream and ink editorial palette (Fraunces serif + Inter sans-serif) optimized across desktop and mobile screens.

### Product B: Staff Inventory & Ops Dashboard (`/staff`)
- **Email/Password Authentication**: Access secured by per-account credentials, with `Manager` and `Bookseller` roles (see [Demo Logins](#demo-logins) below).
- **Inventory Overview**: View real-time stock levels, filter by low-stock/out-of-stock, search by title/ISBN, and perform inline stock adjustments or restocks with screen-reader status announcements.
- **Pre-orders Board**: Visual kanban-style fulfillment workflow for in-store holds:
  - Tracks orders through `Pending`, `Ready for Pickup`, `Fulfilled`, and `Expired` states.
  - One-click status transitions (e.g. mark ready, complete pickup, release expired hold).
  - Shows hold expiration timers relative to current time.
- **Customer Messages Inbox**: Review and resolve customer inquiries submitted through the chatbot's leave-a-message workflow, with status filtering (`new`/`read`) and mark-as-read actions. A "Draft Reply with AI" action calls Gemini to draft a reply grounded in the store's real hours and policies, given a `GEMINI_API_KEY` — there's no template fallback for this one, so it 400s without a key configured.
- **Embedded Marketing Assistant**: Direct access to Product D from within the staff dashboard.

### Product C: Customer Support Chatbot (`backend/chatbot/`)
- **Strictly Deterministic**: Built entirely with decision trees and keyword/regex matching — zero generative AI or third-party LLM calls per fellowship requirements.
- **Store FAQs**: Answers questions regarding store hours, return policies, book club meetings, and location.
- **Live Catalog Queries**: Parses book titles or author queries and queries PostgreSQL for live stock availability.
- **Staff Escalation Workflow**: If an inquiry cannot be answered or requires human assistance, prompts the customer to submit a message directly into the Staff Messages inbox (`/api/messages`).

### Product D: Marketing Content Generator (`backend/marketing/`)
- **Deterministic by Default**: Built using metadata-driven string templating — zero generative AI in the default path.
- **Opt-In "Generate with AI"**: A `use_ai` flag on `POST /api/marketing/generate` calls Gemini instead, given a `GEMINI_API_KEY`. Falls back to the same deterministic templating on any failure or missing key, so the feature degrades silently rather than erroring.
- **Multi-Channel Copy**: Generates ready-to-publish social captions and announcements for:
  - Instagram (with thematic hashtag blocks)
  - Twitter / X (within character limits)
  - Facebook (community-focused post structure)
  - Email Newsletter blurbs
- **Context-Aware**: Generates copy for any book in inventory or upcoming bookstore author events, complete with one-click copy-to-clipboard.

## Tech Stack

| Layer | Technologies | Notes |
| --- | --- | --- |
| **Backend API** | Python 3.12, FastAPI, Uvicorn, Pydantic v2, Pydantic Settings | Serves REST API and mounts static SPA builds |
| **Database & Pooling** | PostgreSQL (Supabase or local), `psycopg` 3, `psycopg-pool` | Row-level locking & transactions for stock consistency |
| **Frontend Apps** | React, TypeScript, Vite, Tailwind CSS tokens | Customer App (React Router v6), Staff Dashboard (React Router v7) |
| **API Client** | `openapi-fetch` | Typed fetch client generated from OpenAPI schema |
| **Icons & Design** | Lucide React, Fraunces serif, Inter sans | Custom warm editorial design system (`#fbf7f0`, `#2f1739`, `#a63d2f`) |
| **Python Tooling** | `uv`, `ruff`, `pytest`, `hatchling` | Formatter & linter enforcing Google-style docstrings (py312) |
| **Frontend Tooling**| `oxlint`, `npm` | Fast Rust-based linter and Vite bundler |
| **Deployment** | Render (Web Service), bash build pipeline (`render-build.sh`) | Unified single-port deployment |

## Why This Stack Fits Riverside Books

Every technology in this project was chosen to support the practical realities of running a single-location independent bookstore:

- **All Under One Roof, Minimal Overhead**: Rather than paying for and juggling multiple separate cloud hosting platforms, servers, and subscriptions that can break independently, the entire storefront, staff dashboard, and backend operate as a single unified service on Render. For a local bookshop without a dedicated IT department, this keeps hosting simple, reliable, cost-effective, and easy to maintain.
- **Fast, Responsive Experience Without App Downloads**: Customers browsing on their phones while walking down Main Street and booksellers managing holds behind the register both get instant responses without sluggish page reloads. It delivers the responsiveness of a native app while remaining an accessible website anyone can open instantly in any browser.
- **Accurate Shelf Counts, Zero "Phantom" Holds**: In a neighborhood bookstore, inventory is finite and popular titles often have only one or two copies on hand. When a customer places a hold on the last copy of a novel, the system locks and updates stock instantly across every screen. Two customers can never accidentally reserve the same final copy simultaneously, preventing awkward pickup mix-ups and protecting customer trust.
- **Truthful Answers Over Unpredictable AI**: Generic AI chatbots can easily "hallucinate" incorrect store policies, invent inaccurate opening hours, or run up expensive recurring fees. Riverside Books relies on dependable, rule-based systems for the chatbot and, by default, for marketing copy too. The support assistant always gives 100% verified answers about store hours, upcoming events, and shelf stock—and when a question requires a personal touch, it seamlessly lets the customer leave a note for staff. The marketing assistant similarly delivers publication-ready announcements in seconds using real book metadata, with zero risk of fabricated facts — an owner who'd rather not touch Gemini at all can leave `GEMINI_API_KEY` unset and both products stay fully deterministic.
- **A Thoughtful, Welcoming Community Feel**: The visual styling intentionally reflects the quiet warmth of a neighborhood bookstore—creamy paper tones, deep ink accents, and classic typography—rather than the sterile look of a mass-market retail corporation.

## Project Structure

```text
riverside-books-v2/
├── apps/
│   ├── customer-app/          # Product A: Customer Ordering & Loyalty SPA (Vite + React)
│   │   ├── src/
│   │   │   ├── pages/         # Home, BookDetail, MyOrders, LoyaltyCard, Support
│   │   │   ├── components/    # ChatBubble, ChatPanel, customer header & footer
│   │   │   └── lib/           # Customer session storage & API client
│   │   └── package.json
│   └── staff-dashboard/       # Product B: Staff Inventory & Ops Dashboard SPA (Vite + React)
│       ├── src/
│       │   ├── pages/         # Inventory, Preorders, Messages, Marketing
│       │   ├── components/    # Email/password SignIn, navigation layout
│       │   └── lib/           # Staff session management
│       └── package.json
├── backend/
│   ├── api/
│   │   ├── core/              # Database pool (db.py) and repository layer (repositories.py)
│   │   ├── routers/           # books, customers, orders, events, store, chat, messages, marketing
│   │   ├── deps.py            # FastAPI dependency injection for repositories
│   │   ├── models.py          # Pydantic schemas & data contract
│   │   └── main.py            # FastAPI application & unified SPA static file mounts
│   ├── chatbot/                # Product C: Deterministic decision tree & FAQ engine
│   ├── marketing/               # Product D: Deterministic metadata string templater, plus an opt-in Gemini-backed mode
│   └── messages/                # Product B's Gemini-backed reply drafter for the staff Messages inbox
├── mock_data/                 # Base JSON seed snapshots for offline testing
├── scripts/
│   ├── seed.py                # Database and JSON seeder with relative runtime timestamps
│   └── check_contract.py      # Automated PRD §6-7 API conformance auditor
├── supabase/
│   └── migrations/            # PostgreSQL schema migrations (tables, constraints, RLS)
├── web/
│   └── index.html             # Static landing page for the unified gateway
├── render-build.sh            # Production build script for Render
├── pyproject.toml             # Python project definition & ruff/pytest configurations
├── requirements.txt           # Compiled Python dependencies for Render build
└── README.md
```

## Deployment on Render

Riverside Books is deployed as a **single, unified service on Render**, where a single FastAPI process serves the static landing page, both compiled React single-page applications, the REST API, and interactive OpenAPI documentation from a single domain and port.

### Unified Architecture
- **Gateway Landing Page (`/`)**: Static editorial homepage with store hours, Beacon, NY location details, and a customer sign-in modal.
- **Customer Storefront (`/shop/*`)**: React/Vite SPA mounted with client-side routing fallback via `SPAStaticFiles`.
- **Staff Operations Dashboard (`/staff/*`)**: React/Vite SPA mounted with client-side routing fallback via `SPAStaticFiles`.
- **REST API (`/api/*`)**: FastAPI endpoints for books, customers, orders, chat, messages, marketing, and events.
- **API Documentation (`/docs` & `/redoc`)**: Interactive Swagger and ReDoc API explorers.
- **Same-Origin API Routing**: In production, the frontends set API `baseUrl: ""` and router basenames (`/shop`, `/staff`), eliminating cross-origin (CORS) friction and complex multi-service hosting.

### Render Build & Run Configuration
- **Environment**: Python
- **Build Command**:
  ```bash
  ./render-build.sh
  ```
  The build script installs Python backend dependencies from `requirements.txt`, verifies Node.js/`npm`, and runs `npm run build` in both `apps/customer-app` and `apps/staff-dashboard`.
- **Start Command**:
  ```bash
  uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
  ```

### Environment Variables
| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Production PostgreSQL connection string (see pooler note below). |
| `PORT` | Auto | Assigned dynamically by Render. |
| `CORS_ORIGINS` | Optional | Additional allowed CORS origins if external clients call the API (defaults to local dev ports). |
| `GEMINI_API_KEY` | Optional | Enables Product D's "Generate with AI" and Product B's Messages inbox "Draft a reply". Leave unset to keep both products fully deterministic — marketing generation still works via templating either way. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.6-flash`. |

### Supabase Connection Gotcha: Use the Transaction Pooler (Port 6543)
> [!IMPORTANT]
> **Supabase direct connections (`port 5432`) are IPv6-only**, and Render's outbound network currently does not support IPv6. Attempting to connect to `db.<project-ref>.supabase.co:5432` will hang silently until it times out.
> 
> **Always use Supabase's Transaction Pooler (`port 6543`)** for `DATABASE_URL`:
> ```text
> postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
> ```
> - Supabase Dashboard &rarr; **Connect** &rarr; Connection type: **Transaction pooler**.
> - The user prefix changes to `postgres.<project-ref>`.
> - If your database password contains special characters (`@`, `:`, `/`, etc.), percent-encode them (`@` &rarr; `%40`, etc.).

### Managing the Render Deployment via CLI
Deploys and live production logs can be managed directly via the [Render CLI](https://render.com/docs/cli):

```bash
# Install CLI (macOS / Linux)
brew install render
# or
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh

# Authenticate
render login

# Common operations
render services                                     # List services with IDs
render logs --resources <serviceID> --tail=true     # Stream production logs in real time
render deploys create <serviceID>                   # Trigger a manual rebuild / redeploy
```

---

## Running Locally

### Prerequisites
- Python 3.12+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 18+ and `npm`
- PostgreSQL database (Supabase project or local PostgreSQL container)
- *(Optional)* A Google AI Studio key to exercise the two Gemini-backed features — Product D's
  "Generate with AI" and Product B's Messages inbox "Draft a reply". Without it, marketing
  generation silently falls back to templating and the draft-reply button returns a 400.
  ```bash
  GEMINI_API_KEY="your-google-ai-studio-key"
  GEMINI_MODEL="gemini-3.6-flash"   # optional, this is the default
  ```

### 1. Environment Configuration
Create a `.env` file in the project root:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
# Or your Supabase Transaction Pooler connection:
# DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
```

### 2. Seed the Database
Run the seeder with the `--db` flag:
```bash
uv run python -m scripts.seed --db
```
> [!TIP]
> `scripts/seed.py` generates rows with **timestamps relative to the exact moment it is run**. This guarantees that pre-order pickup holds remain active and events stay in the future for demos and testing. Re-run it whenever holds expire or when resetting test data.

---

### Development Mode (Hot-Reloading)
Run each service in a separate terminal for active frontend and backend development with instant hot-reloading:

**Terminal 1 — Backend API:**
```bash
uv run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```
Runs at `http://127.0.0.1:8000` (API docs at `http://127.0.0.1:8000/docs`).

**Terminal 2 — Product A (Customer App):**
```bash
cd apps/customer-app
npm install
npm run dev
```
Runs at `http://localhost:5173`.

**Terminal 3 — Product B (Staff Dashboard):**
```bash
cd apps/staff-dashboard
npm install
npm run dev
```
Runs at `http://localhost:5174` (see [Demo Logins](#demo-logins) below to sign in).

---

### Unified Local Mode (Production Simulation)
To preview the single-port gateway exactly as it runs in production on Render:

1. Build both frontends:
   ```bash
   cd apps/customer-app && npm install && npm run build && cd ../..
   cd apps/staff-dashboard && npm install && npm run build && cd ../..
   ```
2. Start the unified FastAPI server:
   ```bash
   uv run uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
   ```
3. Open `http://127.0.0.1:8000/` in your browser:
   - `/` &rarr; Landing Page & Gateway
   - `/shop/` &rarr; Customer Storefront
   - `/staff/` &rarr; Staff Operations Dashboard
   - `/docs` &rarr; OpenAPI Documentation

---

## Testing & Quality Checks

### Backend Tests & Verification
```bash
# Run pytest test suite
uv run pytest

# Check Python linting and formatting
uv run ruff check .
uv run ruff format --check .

# Validate PRD API contract conformance
uv run python -m scripts.check_contract
```

### Frontend Quality Checks
```bash
# Customer App
cd apps/customer-app
npm run lint       # Runs oxlint
npm run build      # Runs tsc typecheck & Vite build

# Staff Dashboard
cd apps/staff-dashboard
npm run lint       # Runs oxlint
npm run build      # Runs tsc typecheck & Vite build
```

---

## Demo Logins

Staff and customer sign-in are both email/password (see `scripts/seed.py`, the
source of truth for these). Re-run `uv run python -m scripts.seed --db` if a
login stops working — it never changes these credentials, only timestamps.

### Staff (`/staff`)

| Role | Email | Password | Access Permissions |
| --- | --- | --- | --- |
| **Manager** | `jordan@riversidebooks.example` | `manager1234` | Full access to Inventory, Pre-orders, Messages, and Marketing |
| **Bookseller** | `priya@riversidebooks.example` | `bookseller1234` | Standard operational staff access |

### Customer (`/shop`)

Every seeded customer shares one demo password: `readerclub1`. For example:

| Name | Email | Password |
| --- | --- | --- |
| Elena Rostova | `elena.rostova@example.com` | `readerclub1` |

Or use "Create an account" in the sign-in dialog to register a new one.
