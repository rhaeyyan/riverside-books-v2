# Product D (Marketing Content Generator) — Review

Scope: `backend/marketing/` (`service.py`, `templates.py`), the `/api/marketing`
router, and the staff-dashboard `Marketing` tab, assessed against PRD §8.D's
functional requirements and acceptance criteria, and against the pain points
`docs/market_strategy.md` says Product D owns.

## Summary

Judged against **PRD §8.D**, the checklist it was actually built to, Product D
is mostly complete: subject selection, tone selection, deterministic
generation, the 280-char budget, missing-blurb handling, out-of-stock template
skipping, and sold-out → waitlist fallback are all implemented and covered by
tests in `tests/test_marketing.py` that map directly onto the PRD's acceptance
criteria. Two of those acceptance criteria are not actually met, and one UI
element makes a claim the code doesn't back up.

Judged against the fuller MVP in `docs/market_strategy.md` — three
simultaneous variations, an editable draft, Save Draft / Mark Ready state, and
an explicit fact-protection layer — none of that exists yet. That's a scope
gap, not a defect, but it means the "central risk" the strategy doc identifies
(a polished wrong post) doesn't yet have the guardrail the doc says it needs.

## Findings

### 1. Past events are still offered as generation subjects
PRD §8.D edge cases: *"An event whose `starts_at` is in the past is not
offered as a subject."* `EventRepository.get_all()` in
`backend/api/core/repositories.py:437` is docstringed as "Retrieve all
upcoming store events" but returns every event unfiltered by date. Neither
`backend/api/routers/events.py` nor `apps/staff-dashboard/src/pages/Marketing.tsx`
filters on `starts_at`. Staff can generate a promotional caption for an event
that already happened.

**Recommendation:** filter `starts_at >= now` either in `EventRepository` (fix
the docstring to match reality, or make it true) or at the point Product D
lists selectable subjects — this is a one-line fix with an easy regression
test (event with a past `starts_at` should not appear in the marketing
subject list / search results).

### 2. Hashtags aren't derived the way the PRD describes
PRD §8.D requirement 3: hashtags "derived from genre, format, and store
name." In `backend/marketing/service.py:57`, `#RiversideBooks` is hardcoded
rather than read from `store_info.json`'s `name` field, and every event post
gets a hardcoded `#AuthorTalk` (`service.py:124`) regardless of event type.
The seed data (`mock_data/events.json`) includes a poetry workshop, a local
history lecture, a children's story hour, and a monthly book club — none of
which are author talks, so several of today's generated event posts already
carry a wrong hashtag.

**Recommendation:** read the store name from `store_info.json` instead of
hardcoding it, and either derive an event hashtag from an event
type/category field (may require adding one to the `Event` model) or drop
`#AuthorTalk` in favor of a generic tag like `#LocalEvents` that's true for
every event.

### 3. "No unsupported facts flagged" is a hardcoded claim, not a check
`Marketing.tsx:231-234` renders a green "✓ No unsupported facts flagged"
badge on every generated draft, unconditionally. There is no fact-checking
logic anywhere in `backend/marketing/` to back this — the API response has
no `warnings` field, and `service.py` does no verification of any kind. It's
harmless today because pure string templating can't invent facts, but the
badge implies an active check that doesn't exist, which is exactly the kind
of "staff trust the fluency and skim the details" failure mode
`docs/market_strategy.md`'s "store-data accuracy problem" section warns
against.

**Recommendation:** either remove the badge, or make it honest — e.g. only
show it once a real check exists, or reword it to state plainly that output
is generated from structured fields only (no free text), which is the actual
guarantee the architecture provides.

## Out of scope for this PR (flagging, not proposing to build now)

`docs/market_strategy.md`'s "Recommended MVP" additionally calls for: three
simultaneous caption variations per generation, per-channel (Instagram vs.
Facebook) formatting, an editable draft (today's caption is a read-only
`<p>`, not a text field), and Save Draft / Mark Ready workflow states. None
of PRD §8.D's acceptance criteria require these, so they're not treated as
defects here — but they're the parts of the strategy doc that speak most
directly to "keep a person in control before anything is published," and
they don't exist yet. Worth a deliberate call on whether they're in scope for
a follow-up cycle before Product D is called feature-complete against the
strategy doc (as opposed to against the PRD).
