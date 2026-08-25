# Product Requirements Document — Riverside Books Suite

**Cycle 4 Fellowship · v0.3 · Last updated 2026-08-25**

> **How to read this document.** Sections 5–7 (Shared Architecture, Data Model, API
> Contract) are **binding contracts**. All four products read and write the same
> store, so a unilateral change to a field name or endpoint shape breaks someone
> else's product silently. Changes there need agreement from all four owners.
> Sections 8.A–8.D are owned by one teammate each and can evolve freely within
> the contract.

---

## 1. Executive Summary

Riverside Books is a single-location independent bookstore run by an owner and two
part-time booksellers. Inventory, orders, and customer questions are currently
handled through memory, sticky notes, and a spreadsheet.

This suite solves four bottlenecks — no online stock visibility, manual inventory
tracking, repetitive customer inquiries, and inconsistent marketing — without
turning the store into an e-commerce business. Customers still shop by walking in
or calling ahead; the software makes those interactions better rather than
replacing them.

Four products, four owners, one shared data store.

---

## 2. Goals & Non-Goals

### 2.1 Goals

| # | Goal | Pain point addressed | Product |
|---|---|---|---|
| G1 | A customer can confirm a title is in stock without calling or visiting | "No way to check stock before making a trip" | A, C |
| G2 | A customer can reserve a book for in-store pickup | "No way to place a pre-order online" | A |
| G3 | Regulars accumulate a reason to return | "No loyalty or rewards system" | A |
| G4 | Staff see low and out-of-stock titles before a customer asks | "No one notices a book is out of stock" | B |
| G5 | Routine questions get answered without pulling staff from the register | "Hours, returns, events asked repeatedly" | C |
| G6 | Staff can produce a publishable caption in under a minute | "Writing captions takes time nobody has" | D |

### 2.2 Non-Goals

Explicitly **out of scope** for Cycle 4. Listed so nobody builds them by accident:

- **Online payment or checkout.** Pre-orders are holds, not sales. Money changes
  hands in person at the register.
- **Shipping or fulfilment by mail.** Pickup only (BOPIS).
- **Portability across database engines.** One database, reached through the
  repository layer that already exists (§5.2). No dialect-abstraction layer, no
  second engine kept working "just in case."
- **Authentication, passwords, or sessions.** See §5.3 for the identity model that
  replaces it.
- **Generative AI anywhere.** Products C and D are deterministic by mandate
  (§5.5).
- **A native mobile app.** Products A and B are browser applications.
- **Cards and gifts in the catalogue.** The store sells them; this cycle's
  catalogue is books only. The chatbot answers "do you sell cards?" from a static
  policy string, not from inventory.
- **Real social media posting.** Product D outputs text for a human to copy,
  review, and publish. No platform integrations.
- **Email or SMS notifications.** "Your order is ready" is a phone call the staff
  makes, as it is today.
- **Multi-store or multi-location support.** One store, one address, one set of
  hours.

> **Struck in v0.3:** *"A live database. `mock_data/` JSON is the system of
> record. No Supabase, no Postgres, no ORM."* A managed relational database is
> now the system of record — see §5.2. Every other non-goal above still stands,
> including authentication: moving to a database that offers auth is not a
> decision to adopt it.

---

## 3. Users

| Persona | Who | Uses | Needs |
|---|---|---|---|
| **Regular** | Local resident, visits monthly or more, knows staff by name | A, C | Check stock fast, hold a title, see loyalty progress |
| **Caller** | Occasional customer who phones ahead before driving over | C | One answer: is this book on the shelf right now |
| **Owner** | Runs day-to-day operations, orders stock, posts to social | B, D | See what's running out, prepare pickups, post consistently |
| **Bookseller** | Two part-time staff, work the register and floor | B, D | Same as owner, at a glance, between customers |

Staff are a **trusted, in-store audience**. The dashboard runs on the shop's own
machine (§5.3).

---

## 4. Market Research & Competitor Analysis

### 4.1 Inventory & Ordering (Products A & B)

- **IndieCommerce / Bookmanager** — the incumbents in independent bookselling.
  Enormous title databases (14M+) and deep supplier integrations, but the setup
  cost and complexity are aimed at stores with dedicated staff for them.
- **Shopify / Square Online** — excellent generic retail, but bookselling needs
  ISBN-native records and large catalogues, which means heavy customisation.
- **Takeaway** — model inventory strictly around **ISBN-13 as the primary key**,
  and cut scope to **BOPIS (Buy Online, Pick Up In Store)**. Dropping shipping,
  carriers, and address validation removes most of the complexity while keeping
  everything the store actually asked for.

### 4.2 Loyalty (Product A)

- **App fatigue** — customers resist installing a standalone app for a single
  small business. Adoption is the whole game for a loyalty program.
- **Loopy Loyalty / Square Loyalty** — the ones that work either live in
  Apple/Google Wallet or attach to a phone number given at the register.
- **Takeaway** — a **digital stamp card keyed to a phone number**: buy 10 books,
  get 1 free.
- **Reconciling this with Product A.** The research argues against *downloading an
  app*, and Product A is not one — it is a browser page with no install and no
  password. The phone number is both the loyalty key and the identity (§5.3), so
  a customer types 10 digits and sees their stamps. This was a deliberate
  response to the app-fatigue finding, not an exception to it.

### 4.3 Support Automation (Product C)

- **Zendesk Answer Bot / Intercom** — widely deployed, and widely resented when
  they can only recite a help centre. The failure mode is a bot that cannot see
  live data.
- **Takeaway** — the chatbot's value is entirely in **reading the same live
  inventory the register sees**. A menu-driven decision tree over real stock
  counts beats free-text chat over stale FAQs, and it satisfies the no-LLM
  constraint rather than working around it.

### 4.4 Marketing Automation (Product D)

- **Buffer / Hootsuite** — solve scheduling, not the blank page. Staff time is
  lost to *writing*, not posting.
- **Takeaway** — **string-templated captions** filled from book and event
  metadata, with a tone selector so output doesn't read identically every time.

---

## 5. Shared Architecture & Binding Decisions

These decisions exist because four products share one dataset. Each one prevents a
specific class of bug.

### 5.1 One writer owns all state

The **database** is the system of record. `backend/api/` is a single FastAPI
application and the only thing that reads or writes it. Products C and D live at
`backend/chatbot/` and `backend/marketing/` as Python packages **mounted as
routers** into that app — not as separate servers, and never holding their own
connection.

*Why:* if three services each hold their own view of stock, their counts diverge
and Product C's entire value proposition — live stock — quietly becomes a lie.
One writer, one truth.

*Changed in v0.3.* Through v0.2 this section read "one process owns all state,"
and that single process was the only thing making the read-modify-write sequences
in §5.4 and §5.7 correct — they were guarded by an in-process lock. A database
does not inherit that guarantee. Those sequences are now **transactions**, and
the guarantee comes from the database rather than from there being only one
process. Porting them as plain reads and writes would silently lose the
invariant; see R2.

**Ownership of `backend/api/`:** it is not one of the four products and needs an
explicit owner. See §9.

### 5.2 Persistence model

A **managed relational database** holds the canonical data. Reads and writes go
through the repository classes in `backend/api/core/repositories.py`; no router
or product package reaches past them to the database directly.

This extends to tests, which is a change: today several test modules set up state
by writing seed JSON directly, bypassing the repositories. That shortcut has no
equivalent once the store is a database, so tests build their fixtures through
the repository layer or through the seed script (§6.7). See R9.

The field conventions below are unchanged from v0.2 and remain binding. They were
chosen to be database-shaped in the first place, which is why §6 and §7 need no
rework:

- Money is stored as **integer cents** (`price_cents`). Never floats.
- Timestamps are **ISO 8601 UTC strings** (`2026-08-24T14:30:00Z`).
- ISBNs are **strings**, never integers — leading zeros and the `X` check digit
  are both real.
- IDs are prefixed strings: `cust_001`, `order_001`, `event_001`. They stay
  application-generated; no database sequences or UUID defaults, so an ID means
  the same thing before and after it is persisted.

**What this does not change.** The API contract in §7 is unaffected — same paths,
same shapes, same status codes. So are the stock rules (§5.4), the thresholds
(§5.6), determinism (§5.5), and the identity model (§5.3). A product team should
be able to ignore this amendment entirely unless they are working inside
`backend/api/`.

**Migrations.** Schema changes ship as ordered, committed migration scripts
applied in CI and locally by the same command. No schema is changed by hand
against a live database, because a schema that exists only in someone's console
is not a contract §6 can hold anyone to.

**Credentials.** No connection string, key, or password is committed to this
repository, in any environment. They are supplied as environment variables. The
application uses a least-privileged role for request-time work; any elevated
credential is reserved for running migrations and is never present in the running
application's environment. See R8.

### 5.3 Identity model (replaces authentication)

- **Customers** are identified by **phone number**, normalised to digits only
  (`5551234567`). A customer "signs in" by typing their number; if it matches a
  record they see their orders and stamps, if not they are offered a one-field
  registration (phone + name). There are no passwords and no sessions.
- **Staff** are not authenticated at all. The dashboard is assumed to run on a
  machine inside the shop. This is an accepted, documented risk (§11, R3) — not
  an oversight — and is only acceptable because deployment is local-only.

*Why this is in the PRD:* Product A cannot show "your stamps" or "your pre-orders"
without answering "whose?". This was the largest gap in v0.1.

### 5.4 Stock accounting: on-hand vs. available

Three numbers, and confusing them is the most likely cross-product bug:

| Field | Meaning | Who changes it |
|---|---|---|
| `stock_count` | Physical copies on the shelf | Staff (B), at pickup/receipt |
| `reserved_count` | Copies held by active pre-orders | System, on order create/cancel/expire |
| `available_count` | **Derived:** `stock_count - reserved_count` | Never stored |

**Rules:**
- Product A and Product C must show **`available_count`** to customers. A copy
  someone else has on hold is not available.
- Product B shows **both** `stock_count` and `available_count` — staff need to
  know what's physically present *and* what's spoken for.
- A pre-order may only be placed when `available_count >= quantity`.
- Placing a pre-order increments `reserved_count`. It does **not** decrement
  `stock_count` — the book is still on the shelf until someone collects it.
- Completing a pickup decrements **both**.

### 5.5 Determinism (Products C & D)

No LLM, no generative model, and — importantly — **no randomness**. Given the same
inputs, both products must produce byte-identical output. This is what makes them
testable. Product D in particular must not pick a template at random; see §8.D.

### 5.6 Stock status thresholds

One rule, used identically by every product. v0.1 specified two colours but only
one threshold:

| Status | Condition | Dashboard colour |
|---|---|---|
| `out_of_stock` | `available_count == 0` | Red |
| `low_stock` | `1 <= available_count <= low_stock_threshold` | Amber |
| `in_stock` | `available_count > low_stock_threshold` | Green |

`low_stock_threshold` is a per-book field defaulting to `2`, so the owner can set a
higher floor on reliable sellers.

### 5.7 Pre-order hold expiry

Holds last **48 hours**. Expiry stays **lazy and computed at read time** — a
scheduler remains out of scope, and lazy expiry keeps the rule in one place
rather than splitting it between a job and a read path:

- Any endpoint returning an order compares `hold_expires_at` to now. A `pending`
  order past its expiry is reported with status `expired` and its
  `reserved_count` contribution is released at that moment.
- Product B additionally exposes a manual **"Release expired holds"** action so
  staff can force the sweep and see the result.

*Why this is in the PRD:* v0.1 promised a 48-hour hold with no mechanism to end
one, which would have left reserved stock locked forever.

*Changed in v0.3:* releasing a hold reads an order, decides it has expired, and
decrements `reserved_count`. Under v0.2 an in-process lock made that safe. It is
now one transaction — two concurrent readers must not release the same hold twice
and double-decrement the count. Same rule, same observable behaviour, different
mechanism.

---

## 6. Canonical Data Model

Database tables. **This is the contract.** Field names here are the field names in
the API and in every product.

*Changed in v0.3:* these were JSON files under `mock_data/`. The field lists below
are unchanged — they were written to mimic a relational structure, so the move is
a change of storage, not of shape. Each subsection keeps its original filename in
its heading so existing references still resolve:

| v0.2 file | v0.3 table |
|---|---|
| `inventory.json` | `books` |
| `customers.json` | `customers` |
| `orders.json` | `orders` (line items in `order_items`) |
| `events.json` | `events` |
| `store_info.json` | `store_info` (single row) |
| `messages.json` | `messages` |

Nullability, indexes, and foreign keys are not specified here. They are decided in
the migration that creates each table and reviewed with it — §6 governs names and
types, which is what the four products depend on.

### 6.1 `inventory.json` — books

| Field | Type | Notes |
|---|---|---|
| `isbn` | string | **Primary key.** ISBN-13, digits only |
| `title` | string | |
| `author` | string | Single author; multiples joined with `", "` |
| `format` | enum | `hardcover` \| `paperback` |
| `price_cents` | int | e.g. `1899` = $18.99 |
| `stock_count` | int | Physical copies on shelf, `>= 0` |
| `reserved_count` | int | Copies held by active pre-orders, `>= 0` |
| `low_stock_threshold` | int | Default `2` |
| `genre` | string | Single primary genre |
| `blurb` | string | 1–2 sentences; may be `""` |
| `cover_image_url` | string | Local path under `/static/covers/`; may be `""` |
| `publisher` | string | |
| `published_date` | string | `YYYY-MM-DD` |

### 6.2 `customers.json`

| Field | Type | Notes |
|---|---|---|
| `customer_id` | string | **Primary key.** `cust_001` |
| `phone` | string | **Unique.** Digits only, 10 chars. The identity key |
| `name` | string | |
| `email` | string | Optional, may be `""` |
| `stamps` | int | `0`–`9`. Rolls to a reward at 10 |
| `rewards_available` | int | Unredeemed free books |
| `joined_date` | string | `YYYY-MM-DD` |

### 6.3 `orders.json` — pre-orders

| Field | Type | Notes |
|---|---|---|
| `order_id` | string | **Primary key.** `order_001` |
| `customer_id` | string | FK → customers |
| `items` | array | `[{ "isbn": str, "quantity": int }]` |
| `status` | enum | `pending` \| `ready_for_pickup` \| `completed` \| `cancelled` \| `expired` |
| `created_at` | string | ISO 8601 UTC |
| `hold_expires_at` | string | `created_at + 48h` |
| `total_cents` | int | Sum at time of order; prices may change later |
| `notes` | string | Free text from customer, may be `""` |

**Status transitions.** `pending → ready_for_pickup → completed` is the happy
path. `pending` or `ready_for_pickup` may go to `cancelled` at any time.
`pending → expired` happens only via §5.7. `completed`, `cancelled`, and `expired`
are terminal — no transitions out.

### 6.4 `events.json`

| Field | Type | Notes |
|---|---|---|
| `event_id` | string | **Primary key.** `event_001` |
| `title` | string | e.g. "An Evening with Ali Smith" |
| `author_name` | string | |
| `starts_at` | string | ISO 8601 UTC |
| `capacity` | int | |
| `tickets_sold` | int | |
| `description` | string | |

### 6.5 `store_info.json` — single object

| Field | Type | Notes |
|---|---|---|
| `name`, `address`, `phone`, `email` | string | |
| `hours` | object | Keyed `monday`–`sunday` → `{"open": "10:00", "close": "18:00"}` or `null` when closed |
| `policies` | object | `returns`, `holds`, `special_orders`, `gifts` → prose strings |
| `faqs` | array | `[{ "id": str, "question": str, "keywords": [str], "answer": str }]` |

`policies.gifts` is what the chatbot returns for cards and gift questions, since
those aren't in the catalogue (§2.2).

### 6.6 `messages.json` — chatbot escalations

| Field | Type | Notes |
|---|---|---|
| `message_id` | string | **Primary key.** `msg_001` |
| `name`, `contact`, `body` | string | Contact is a phone or email, as typed |
| `created_at` | string | ISO 8601 UTC |
| `status` | enum | `new` \| `read` |

### 6.7 Seed data requirement

Seed data must include, at minimum, enough to demonstrate every state: **30+
books** covering all three stock statuses (including at least two at exactly
`available_count == 0` and two in the low band), **8+ customers** spanning 0
stamps, mid-card, and a customer with `rewards_available >= 1`, **10+ orders**
across all five statuses including one already past `hold_expires_at`, and **4+
events** with at least one sold out.

*Rationale:* every product's edge-case UI needs a row to render. Empty-state and
error paths that can't be demonstrated won't be built.

*Changed in v0.3:* seed data ships as a committed, re-runnable seed script rather
than as checked-in JSON. The minimums above are unchanged and are what the script
must produce. One of them now needs care: "one order already past
`hold_expires_at`" was a fixed timestamp in a file that aged into the past on its
own. A seed script must generate it **relative to the run time**, or the expired
case silently stops being expired — and §10's walkthrough stops demonstrating it.

---

## 7. API Contract

All routes are prefixed `/api`. All responses are JSON. Errors use standard HTTP
codes with a `{"detail": "..."}` body.

| Method | Path | Purpose | Consumers |
|---|---|---|---|
| `GET` | `/books` | Search catalogue. Params: `q` (title/author/ISBN), `in_stock_only`, `limit`, `offset` | A, B, C, D |
| `GET` | `/books/{isbn}` | Single book with derived `available_count` and `stock_status` | A, B, C, D |
| `PATCH` | `/books/{isbn}/stock` | Adjust on-hand count. Body: `{"stock_count": int}` | B |
| `POST` | `/customers/lookup` | Body: `{"phone": str}` → customer or `404` | A |
| `POST` | `/customers` | Register. Body: `{"phone": str, "name": str, "email": str?}` | A |
| `GET` | `/customers/{customer_id}/loyalty` | `{stamps, rewards_available, stamps_to_next_reward}` | A |
| `POST` | `/customers/{customer_id}/rewards/redeem` | Decrement `rewards_available` | A, B |
| `GET` | `/customers/{customer_id}/orders` | That customer's orders, newest first | A |
| `POST` | `/orders` | Place pre-order. Body: `{"customer_id", "items", "notes"?}` | A |
| `GET` | `/orders` | All orders. Param: `status` filter | B |
| `PATCH` | `/orders/{order_id}/status` | Body: `{"status": str}`. Enforces §6.3 transitions | A (cancel), B |
| `POST` | `/orders/release-expired` | Force the lazy expiry sweep, returns count released | B |
| `GET` | `/events` | Upcoming events, soonest first | A, C, D |
| `GET` | `/store` | Hours, address, policies, FAQs | A, C |
| `GET` | `/chat/tree` | The full decision tree as data | C |
| `POST` | `/chat/message` | Body: `{"node_id": str, "input": str?}` → deterministic reply | C |
| `POST` | `/chat/escalate` | Body: `{"name", "contact", "body"}` → writes a message | C |
| `GET` | `/messages` | Staff inbox. Param: `status` | B |
| `GET` | `/marketing/tones` | Available tones and which subject types support them | D |
| `POST` | `/marketing/generate` | Body: `{"subject_type", "subject_id", "tone", "variant"?}` | D |

**Derived fields.** Every book returned by any endpoint includes computed
`available_count` and `stock_status` (§5.4, §5.6). Products must never recompute
these client-side — one implementation, in the API.

---

## 8. Product Requirements

Each product below is owned by one teammate. Acceptance criteria are written to be
demonstrable in a five-minute walkthrough.

### 8.A — Customer Ordering & Loyalty App

**Surface:** React + TypeScript (Vite) at `apps/customer-app/`.
**User:** Regular, Caller.

**User stories**
- As a customer, I search by title, author, or ISBN and see whether it's available
  *right now*, so I don't drive over for nothing.
- As a customer, I place a 48-hour hold so the last copy is still there when I
  arrive.
- As a regular, I see how many stamps I have so I know when my next book is free.

**Functional requirements**
1. **Search & browse** — search across title, author, and ISBN. Case-insensitive
   substring on title/author, exact match on ISBN. Results show cover, title,
   author, price, and stock status.
2. **Stock display** — "In stock (4 copies)" / "Only 1 left" / "Out of stock",
   driven by `stock_status` from §5.6. Uses `available_count`, never
   `stock_count`.
3. **Pre-order** — from a book page, a customer enters their phone number and
   places a hold. Registers inline if the number is unknown. Confirmation shows
   the order ID and the exact pickup deadline.
4. **My orders** — after a phone lookup, list that customer's orders with status
   and, for pending holds, time remaining. Pending and ready orders can be
   cancelled.
5. **Loyalty card** — visual stamp card showing `stamps`/10 and any
   `rewards_available`. Stamps are earned per **book collected**, awarded when an
   order moves to `completed` — not when it is placed (§8.B.5).

**Acceptance criteria**
- [ ] Searching an ISBN with no match shows an empty state offering the chatbot,
      not a blank page or a spinner.
- [ ] A book at `available_count == 0` shows a disabled pre-order control with a
      reason, not a hidden one.
- [ ] Placing a hold increments `reserved_count` and the same book's availability
      drops by one on refresh.
- [ ] An unknown phone number leads to registration in one step, and the pending
      pre-order survives it.
- [ ] A customer with 9 stamps who collects one book shows 0 stamps and 1 reward.
- [ ] An expired hold appears as expired with an explanation of the 48-hour rule.

**Edge cases**
- Two customers holding the last copy — the second `POST /orders` returns `409`
  and the UI explains it, rather than failing silently.
- Phone entered as `(555) 123-4567` — normalise to digits before lookup.
- Cancelling a hold releases the reservation immediately.

---

### 8.B — Staff Inventory & Ops Dashboard

**Surface:** React + TypeScript (Vite) at `apps/staff-dashboard/`.
**User:** Owner, Bookseller.

**User stories**
- As the owner, I open one screen and immediately see what's running out, before a
  customer asks.
- As a bookseller, I see which pre-orders to pull off the shelf this morning.
- As a bookseller, I adjust a count when the physical shelf disagrees with the
  screen.

**Functional requirements**
1. **Inventory grid** — all titles, sortable by title, author, stock, and status;
   filterable by status and genre; searchable. Shows `stock_count` **and**
   `available_count` as separate columns (§5.4).
2. **Low-stock alerts** — a pinned summary at the top: counts of out-of-stock and
   low-stock titles, each clicking through to the filtered grid. Row colouring per
   §5.6.
3. **Stock adjustment** — inline edit of `stock_count` with optimistic update and
   rollback on failure. Cannot be set below `reserved_count`.
4. **Pre-order board** — Kanban with three columns: Pending → Ready for Pickup →
   Completed. Each card shows customer name, phone, items, and hold deadline.
   Pending cards past deadline are visually flagged.
5. **Fulfilment** — moving a card to Completed decrements `stock_count` and
   `reserved_count` for each item and **awards one loyalty stamp per book
   collected** (§8.A.5). This is the only place stamps are granted.
6. **Expired holds** — a "Release expired holds" action running the §5.7 sweep and
   reporting how many were released.
7. **Message inbox** — chatbot escalations from `GET /messages`, markable as read.

**Acceptance criteria**
- [ ] The alert summary count matches the number of red/amber rows in the grid.
- [ ] Setting stock below the reserved count is rejected with an explanation.
- [ ] Completing a 3-book order moves that customer's stamps up by exactly 3.
- [ ] Completing an order reduces both counts, and Product A reflects it on
      refresh.
- [ ] The release-expired action frees reservations and the freed copies become
      available in Product A.
- [ ] The board renders correctly with zero pending orders.

**Edge cases**
- A card dragged to an illegal transition (Completed → Pending) is rejected by the
  API and snaps back.
- An order whose book was deleted from inventory still renders, showing the ISBN.

---

### 8.C — Customer Support Chatbot

**Surface:** FastAPI router at `backend/chatbot/`, mounted into `backend/api/`.
**User:** Caller, Regular.
**Constraint:** 100% deterministic. No LLM, no randomness (§5.5).

> **Client surface — must be resolved.** A chatbot needs somewhere to be typed
> into. The default plan is a chat panel inside Product A (customer-app), built by
> C's owner against A's component conventions. See §9 and §12 Q1.

**Functional requirements**
1. **Decision tree** — served as data from `GET /chat/tree` so the UI renders
   buttons rather than hardcoding them. Root options:
   `Check if a book is in stock` · `Store hours & location` ·
   `Returns & policies` · `Upcoming events` · `Leave a message for staff`
2. **Live stock check** — prompts for a title, author, or ISBN, then searches the
   same inventory the register sees. Matching rules:
   - Exact match on ISBN → that book.
   - Case-insensitive substring on title or author → up to 5 results.
   - More than 5 matches → ask the customer to be more specific, showing the
     count.
   - Zero matches → offer the special-order policy and the escalation path.
   - Answers report `available_count` and phrase it plainly: "Yes — we have 3
     copies of *Title* on the shelf right now."
3. **Static answers** — hours (formatted from `store_info.hours`, with today's
   hours called out and a closed-today case), address, returns, special orders,
   and gifts, plus keyword matching against `store_info.faqs`.
4. **Events** — upcoming events soonest first, marking sold-out ones.
5. **Escalation** — from any dead end, "leave a message for staff" collects name,
   contact, and message, and writes to `messages` for Product B's inbox.

**Acceptance criteria**
- [ ] Every leaf node either answers or offers escalation. No dead ends.
- [ ] The same question asked twice returns identical text.
- [ ] Stock answers match Product B's grid for the same ISBN, at the same moment.
- [ ] Searching a title with 40 matches asks for narrowing instead of dumping 40.
- [ ] Asking for hours on a day the store is closed says so, and gives the next
      open day.
- [ ] An escalated message appears in Product B's inbox without a restart.
- [ ] A book held by another customer reports as unavailable, not available.

**Edge cases**
- Empty input at a prompt re-asks rather than searching for `""`.
- Hyphenated ISBN input (`978-0-14-303943-3`) is normalised before matching.

---

### 8.D — Marketing Content Generator

**Surface:** FastAPI router at `backend/marketing/`, mounted into `backend/api/`.
**User:** Owner, Bookseller.
**Constraint:** string templating only. No LLM, no randomness (§5.5).

> **Client surface — must be resolved.** "Staff select a book and a tone" is a UI.
> The default plan is a tab inside Product B (staff-dashboard), built by D's owner.
> See §9 and §12 Q1.

**Functional requirements**
1. **Subject selection** — staff pick a book (by search) or an upcoming event.
2. **Tone selection** — `urgent`, `exciting`, `cozy`. Each tone has a template set
   per subject type (book, event).
3. **Generation** — merge metadata into the chosen template and return:
   - `caption` — ≤ 280 characters, ready to paste
   - `post_idea` — one sentence on what to photograph or pair it with
   - `hashtags` — 3–5, derived from genre, format, and store name
4. **Deterministic variants** — `POST /marketing/generate` accepts an optional
   `variant` integer, default `0`. The same
   `(subject_id, tone, variant)` triple must return **byte-identical** output every
   time. Staff cycle variants with a "Show another" control; the API must not
   choose randomly.
5. **Missing-metadata fallbacks** — templates must never emit `None`, `null`, or an
   empty bracket. If `blurb` is empty the template omits that clause entirely;
   if `cover_image_url` is empty the response flags `has_image: false` so the UI
   can prompt staff to attach a photo.
6. **Copy to clipboard** — one action copies the caption and hashtags together.

**Acceptance criteria**
- [ ] The same book, tone, and variant produce identical output across two calls
      and a server restart.
- [ ] All three tones produce visibly different phrasing for the same book.
- [ ] A book with an empty blurb produces clean prose with no gap or placeholder.
- [ ] Every generated caption is ≤ 280 characters, including hashtags.
- [ ] An out-of-stock book does not generate an "only 2 left, come get it" caption
      — stock-referencing templates are skipped when `available_count == 0`.
- [ ] A sold-out event generates a waitlist caption rather than a ticket pitch.

**Edge cases**
- A very long title that would push the caption past 280 characters — truncate the
  blurb clause first, never the title.
- An event whose `starts_at` is in the past is not offered as a subject.

---

## 9. Ownership & Cross-Product Dependencies

| Component | Owner | Notes |
|---|---|---|
| `apps/customer-app/` | Teammate A | |
| `apps/staff-dashboard/` | Teammate B | |
| `backend/chatbot/` | Teammate C | |
| `backend/marketing/` | Teammate D | |
| **`backend/api/` + the database schema and migrations** | **Unassigned — must be assigned** | Not one of the four products, but every product depends on it. As of v0.3 this also covers migrations and the credentials in R8 |
| `docs/PRD.md` (§5–§7) | All four jointly | Changes need consensus |

**The shared-API problem.** The brief says "each teammate builds one of these four
products," which leaves the shared API and the data model with no owner — while
making all four products blocked on them. Two workable options:

- **Option 1 (recommended):** the team builds §6 and §7 together in a single
  session on day one, then one person maintains it. Everyone unblocked fastest.
- **Option 2:** whoever owns Product B takes it, since the staff dashboard touches
  the most endpoints. Risks making B the bottleneck.

**Dependency edges to watch**
- C and D need host UIs inside A and B (§8.C, §8.D). Agree the component boundary
  early; the host owner provides layout and styling, the router owner provides the
  panel.
- Loyalty stamps are written by B (§8.B.5) and read by A (§8.A.5). A single
  misplaced increment shows up as a customer bug.
- `available_count` is computed in the API only (§7). Any product recomputing it
  locally will drift.

---

## 10. Demo Acceptance

The suite is done for Cycle 4 when this walkthrough runs end to end without a
restart:

1. In Product A, search a title and see it in stock. Place a hold with a phone
   number.
2. In Product B, the new pre-order appears in Pending; the title's available count
   has dropped by one and on-hand has not.
3. In Product C, ask whether that title is in stock — the count matches B.
4. In Product B, move the order to Ready, then Completed. On-hand drops; the
   customer's stamps increase by the number of books.
5. In Product A, look up that phone number and see the completed order and the new
   stamp count.
6. In Product B, open Product D, pick that book with tone "cozy", and get a caption
   with correct title and author. Change to "urgent" and get different text. Repeat
   "cozy" and get the original text back verbatim.
7. In Product C, ask something unanswerable, leave a message, and see it land in
   Product B's inbox.

---

## 11. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Data model churn after products are built | High — reworks all four | §6 frozen and committed before product code starts |
| R2 | ~~Concurrent writes to JSON corrupt the file~~ **Superseded in v0.3:** read-modify-write sequences ported to SQL without transactions | High — silently wrong stock counts, the exact bug §5.4 exists to prevent | Each of the nine `get_lock` sites in `repositories.py` rewritten as an explicit transaction or atomic update, with a concurrency test per site. Not a mechanical port |
| R3 | No staff authentication | Low here, high if ever deployed | Documented accepted risk; local-only (§2.2). **Must be revisited before any hosting** |
| R4 | C and D have no host UI and slip late | High — two products undemoable | Resolve §12 Q1 in week one |
| R5 | `backend/api/` unowned, blocking everyone | High | §9 Option 1 on day one |
| R6 | Node not installed on dev machines | Blocks A and B entirely | Verify Node 20+ before frontend work starts |
| R7 | Seed data too thin to show edge cases | Medium — empty states go untested | §6.7 minimums |
| R8 | Database credentials leak via a commit, a CI log, or a pasted message | High — the store's data, and hard to undo once public | §5.2: environment variables only, never committed; least-privileged role at request time; elevated credentials confined to migrations |
| R9 | Test suite loses its hermeticity and CI slows or flakes | Medium — the fast, offline suite is why the tests get run | Decide the strategy before migrating (§12 Q8): a throwaway database per run, or transactional rollback per test. Tests must not share mutable state |
| R10 | The suite becomes undemoable without network or a provisioned database | High — §10 is the deliverable | Keep a local engine usable for development and CI, so a laptop with no connectivity can still run the walkthrough |

---

## 12. Open Questions

| # | Question | Needs answering by | Owner |
|---|---|---|---|
| Q1 | Do C and D ship as panels inside A and B, or as minimal standalone pages? Affects two products' scope | **Resolved:** C and D ship as panels inside A and B. | All four |
| Q2 | Who owns `backend/api/` and `mock_data/`? (§9) | **Resolved:** Owned collectively in Phase 1 & 2, parallelized after. | All four |
| Q3 | Is a stamp earned per **book** or per **order**? This PRD assumes per book, matching "buy 10 books, get 1 free" | Before 8.B.5 is built | A + B |
| Q4 | Can staff manually adjust a customer's stamps to fix mistakes? Not currently specified | Week 2 | B |
| Q5 | Should sold-out events accept a waitlist, or only display as sold out? §8.D assumes display only | Week 2 | D |
| Q6 | Which database, and hosted where? v0.3 says "managed relational" and deliberately names no vendor | Before any provisioning | All four |
| Q7 | Does local development and CI run against the same engine as production, or a local stand-in? Affects R9 and R10 | With Q6 | Owner of `backend/api/` |
| Q8 | Test isolation strategy — database per run, or transactional rollback per test? | Before the first repository is ported | Owner of `backend/api/` |
| Q9 | Does the migration land in one change or product by product? The API contract (§7) is unchanged either way, so a staged port is possible | Before work starts | All four |

---

## Appendix A — Assumptions Introduced in v0.2

These were unspecified in v0.1 and have been decided here so work can start.
Each is reversible, but reversing one after products are built is expensive.

1. **Phone number is the customer identity key** (§5.3) — chosen because §4.2's
   own research points at it.
2. ~~**A single FastAPI process owns all state** (§5.1)~~ — **revised in v0.3.**
   The database is the system of record and `backend/api/` is its only writer
   (§5.1). The live-stock claim now rests on transactions rather than on there
   being one process.
3. **`stock_count` / `reserved_count` / `available_count` are three distinct
   things** (§5.4).
4. **Holds expire lazily at read time** (§5.7) — unchanged in v0.3, but the
   release is now a transaction rather than a lock-guarded read-modify-write.
5. **Stamps are awarded at pickup, per book** (§8.A.5, §8.B.5) — a hold that is
   never collected shouldn't earn a reward.
6. **Catalogue is books only** (§2.2) — cards and gifts answered by policy text.
7. **Product D variants are explicit and deterministic** (§8.D.4) — "random
   template" would break §5.5 and make D untestable.
8. **Staff are unauthenticated** (§5.3, R3).

## Appendix B — Changelog

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-08-24 | Initial draft: summary, market research, per-product feature lists, technical constraints |
| 0.2 | 2026-08-24 | Added goals/non-goals, personas, binding architecture decisions (§5), canonical data model (§6), API contract (§7), user stories + acceptance criteria + edge cases per product, ownership matrix, demo acceptance, risks, open questions. Resolved: customer identity, stock accounting, hold expiry, two-tier stock thresholds, determinism of Product D, C/D client surfaces. Reconciled the app-fatigue finding against Product A |
| 0.3 | 2026-08-25 | **Adopted a live database.** Struck the "a live database" non-goal (§2.2). §5.1 changed from "one process owns all state" to "one writer owns all state," with the read-modify-write guarantee moving from an in-process lock to transactions. §5.2 rewritten: managed relational database, migrations, credential handling. §5.7 hold release restated as a transaction. §6 reframed from JSON files to tables with a file→table map; field names and types unchanged. §6.7 seed data moves to a re-runnable script that must generate the expired hold relative to run time. R2 superseded; R8–R10 added for credentials, test hermeticity, and offline demoability. Q6–Q9 opened for vendor, local/CI engine, test isolation, and migration sequencing. **Unchanged: §7 API contract, §5.3 identity model, §5.4 stock rules, §5.5 determinism, §5.6 thresholds, and every other non-goal — notably authentication.** |
