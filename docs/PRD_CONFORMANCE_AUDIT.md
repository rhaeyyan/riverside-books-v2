# PRD Conformance Audit

**Scope:** whole-project audit of the Riverside Books Suite against `docs/PRD.md`
(binding architecture in §5, data model in §6, API contract in §7, per-product
requirements in §8, demo acceptance in §10). Read-only review — no application
code changed.

## Summary

The suite is solidly built and largely conforms to the PRD. The hard
architectural rules — single-process state ownership, derived
`available_count`/`stock_status`, stock/loyalty accounting, lazy hold expiry,
and determinism for the chatbot and marketing generator — are all correctly
implemented and match the binding contract. All five pain points from the
original brief are addressed by working code, not stubs. There are, however,
real gaps against the PRD's explicit acceptance criteria and a couple of
process violations (undocumented API surface) worth fixing before calling
Cycle 4 done.

## What's solid

- **Data model & seed data** — exact field-name match to §6; seed volumes
  exceed the §6.7 minimums (32 books, 10 customers, 12 orders across all 5
  statuses incl. one already expired, 5 events incl. one sold out).
- **API contract** — all 20 §7 endpoints present and correctly wired.
- **Derived fields** — `available_count`/`stock_status` computed server-side
  only (`backend/api/models.py:57`); no persistent client-side recompute found.
- **Stock/loyalty rules** — order creation checks `available_count >=
  quantity` and returns `409` on conflict; completion decrements both
  counters and awards exactly 1 stamp per book; stamps are granted nowhere
  else. Matches §5.4, §8.A.5, §8.B.5 exactly.
- **Hold expiry** — correctly lazy (computed on every read via a FastAPI
  dependency), plus the manual sweep endpoint. No scheduler/cron anywhere.
- **Determinism** — chatbot and marketing generator are both provably
  deterministic; no `random`, no LLM calls in either module.
- **Non-goals respected** — no auth, payments, LLM, live DB, or
  notifications found anywhere in the codebase.

## Punch list (most → least severe)

1. **Chatbot FAQ keyword matching is missing entirely.** §8.C.3 requires
   matching against `store_info.faqs`. The 6 seeded FAQs are never read by
   `backend/chatbot/service.py` — this is a spec'd functional requirement,
   not polish.
2. **Undocumented endpoints bypass the "binding contract" process.**
   `GET /books/external/{isbn}` (live OpenLibrary call — breaks the
   local-only spirit of §2.2) and `POST /books` (book creation, out of scope
   for all four products) were added to `backend/api/routers/books.py`
   without the four-owner consensus §5/§9 requires for changes to the shared
   contract.
3. **Marketing: past events aren't excluded as generation subjects** (§8.D
   edge case). Neither `backend/marketing/service.py` nor
   `apps/staff-dashboard/src/pages/Marketing.tsx` filters by `starts_at`.
4. **Marketing: the extreme-length-title fallback can truncate the title
   itself**, contradicting the explicit "truncate the blurb clause first,
   never the title" rule (`backend/marketing/service.py:90-97`).
5. **Customer-app "My Orders" misses two explicit acceptance criteria** — no
   "time remaining" countdown on pending holds (absolute deadline only), and
   no explanation of the 48-hour rule on expired holds.
6. **Staff pre-order board isn't actually drag-and-drop.** It's button-only,
   so the "illegal drag snaps back" UX requirement (§8.B) can never be
   exercised even though the API correctly rejects illegal transitions
   server-side.
7. **`cover_image_url` seed values are external `https://` URLs**, not local
   `/static/covers/` paths as §6.1 specifies; no such static directory
   exists in the repo.
8. **`GET /chat/tree`'s events node doesn't sort by `starts_at`** the way
   `GET /events` does — latent "soonest first" bug (§8.C.4) if seed/insertion
   order ever diverges from chronological order.
9. **No end-to-end test for `POST /orders/release-expired`** or for the
   lazy-expiry-on-read dependency actually firing through `GET /books` /
   `GET /orders` — only the underlying model methods are unit-tested.
10. **Minor code smells** — fragile triple-casing status matching in
    `Inventory.tsx`, duplicated chat logic between `ChatPanel.tsx` and
    `Support.tsx`, and silent `except Exception: pass` around the expiry
    sweep (`backend/api/deps.py`, `backend/api/routers/orders.py`) that
    could mask real bugs such as a deleted book breaking
    `adjust_reserved_count`.

## Demo acceptance (§10)

The 7-step walkthrough should run end to end without a restart. Nothing found
breaks it structurally, though step 7 ("ask something unanswerable") is
weaker than the PRD implies, since there's no FAQ engine to be
"unanswerable" against yet (see punch-list item 1) — only the fixed decision
tree and the zero-stock-match path route to escalation.

## Also noted, already resolved

An earlier draft of this audit flagged `docs/IMPLEMENTATION_PLAN.md` and
`docs/implementation_plan.md` as two separate git-tracked files differing
only by case, with genuinely different committed content — a landmine on
case-insensitive filesystems (macOS, Windows) that would confuse
`git status`/`checkout`/`pull` for anyone working locally. By the time this
audit was rebased onto current `main`, the collision was already gone: a
separate merged PR deleted the uppercase file, leaving only
`docs/implementation_plan.md`. No follow-up needed.
