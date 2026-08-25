# Design System — Riverside Books Suite

**Cycle 4 Fellowship · v0.1 · Draft**

> **How to read this document.** This is a companion to [`PRD.md`](./PRD.md), not
> a replacement for it. The PRD's §5–§7 (shared architecture, data model, API
> contract) remain the binding contracts. This document is the **shared visual
> and interaction language** across all four products so that a customer moving
> from the chatbot into the ordering app, or a staff member moving between the
> inventory grid and the marketing panel, experiences one coherent product
> instead of four student projects stapled together.
>
> Sections 1–6 (principles, tone, color, type, spacing, core components) are
> **shared and binding** — the same rule as the PRD's §5–§7: a unilateral change
> here should be agreed by whoever owns the affected surface. Section 7
> (per-product application) is where each owner has latitude within the system.

---

## 1. Why this document exists

The [project brief](../Cycle%204_%20Project%20briefs.md) names five pain points.
Three of them are *operational* (no stock visibility, no inventory tracking, no
loyalty), but they are experienced by real people under real constraints — a
customer standing in their kitchen deciding whether to drive over, a bookseller
mid-transaction with a line forming, an owner glancing at a screen between
tasks. Good visual design is not decoration on top of the PRD's functional
requirements; it is how those requirements actually land for those people.

| Pain point | What the design system has to make effortless |
|---|---|
| **No stock visibility before a trip** | Availability must be legible at a glance, in one color-coded state, with no ambiguity about "on the shelf" vs. "held by someone else" (§5.4 of the PRD). |
| **No loyalty/rewards reason to return** | The stamp card must feel tangible and a little delightful — the entire point is emotional, not transactional. |
| **Staff can't see stock at a glance** | The dashboard is a **glance surface**, not a data-entry form. Alerts, color, and density do the work; reading prose should never be required. |
| **Repetitive customer questions** | The chatbot panel must feel like a fast, credible shortcut — not a lesser version of asking a person. |

*(The fifth pain point — inconsistent social posting, owned by Product D — is
addressed in §7.D. It didn't come up as a top design priority in scoping this
doc, so it inherits the shared system rather than getting bespoke treatment.)*

---

## 2. Design principles

1. **Shelf, not screen.** Riverside Books is a physical, single-location store.
   The software should feel like an extension of walking in — warm, specific,
   slightly imperfect — never like a generic SaaS dashboard wearing a bookstore
   skin.
2. **One glance, one answer.** Every core screen answers one question fast: Is
   it in stock? What's running low? Is my hold still good? Nothing should
   require reading a paragraph to find out.
3. **Calm by default, loud when it matters.** Stock status colour (§5.6 of the
   PRD) is the one place the UI is allowed to shout. Everywhere else, restraint.
4. **Same bones, different posture.** Customer-facing surfaces (Product A, the
   Product C chat panel) are unhurried and inviting. Staff-facing surfaces
   (Product B, the Product D panel) are dense and fast. They must still be
   visibly the same product family — see §7.
5. **Design for the edge cases the PRD insists on.** Empty states, out-of-stock,
   expired holds, and zero-pending-orders are first-class screens, not
   afterthoughts (PRD §6.7, "empty-state and error paths that can't be
   demonstrated won't be built").

---

## 3. Tone & reference direction

**Direction: warm & literary.** Closest in spirit to
[Good Books](https://www.markramel.com/project-goodbooks),
[The Goose](https://www.pymk.co.uk/home/the-goose), and
[Dreambooks](https://www.vicarelstudios.com/work/dreambooks) from the
[look-and-feel references](./look_and_feel_references.md) — warm neutrals, a
serif with character in headings, generous whitespace, nothing that reads as
"enterprise software." These are inspiration for mood and type pairing, not
layouts to copy — attribute, adapt, don't clone, per that document's own note.

In practice that means:
- Paper-toned backgrounds instead of stark white.
- A serif typeface for anything a customer reads as "content" (book titles,
  headings, the loyalty card) and a clean sans for anything they read as "tool"
  (buttons, form fields, status text).
- Illustration/photography treated simply — book covers are the imagery; the
  UI doesn't compete with them.
- Copy that sounds like a bookseller, not a system. "Only 1 left" instead of
  "Low inventory alert."

Staff-facing surfaces (§7.B, §7.D) keep the same palette and type family but
turn the "warm" dial down and the "dense" dial up — see §7 for how far.

---

## 4. Color system

Colors are expressed as CSS custom properties so both apps can share them
verbatim. This replaces the current Vite-starter purple placeholder
(`--accent: #aa3bff`) in both `apps/*/src/index.css`.

### 4.1 Core palette (light mode)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fbf7f0` | Page background — warm paper, not white |
| `--bg-raised` | `#ffffff` | Cards, panels sitting above the page |
| `--text` | `#4a4038` | Body text — warm charcoal, not black |
| `--text-h` | `#241d16` | Headings, highest-emphasis text |
| `--border` | `#e6ddd0` | Hairlines, card borders |
| `--accent` | `#a63d2f` | Primary actions, links, focus — brick/terracotta |
| `--accent-bg` | `rgba(166, 61, 47, 0.08)` | Accent-tinted backgrounds (selected state) |
| `--accent-border` | `rgba(166, 61, 47, 0.35)` | Accent-tinted borders |
| `--code-bg` | `#f4efe6` | Subtle recessed surfaces (input backgrounds, chips) |
| `--shadow` | `rgba(36, 29, 22, 0.08) 0 10px 15px -3px, rgba(36, 29, 22, 0.04) 0 4px 6px -2px` | Card elevation |

### 4.2 Stock status colors (PRD §5.6 — binding, shared by every product)

These three states are the single most important color decision in the whole
suite. They must render identically in Products A, B, and C.

| Status | Condition | Color token | Value | `-bg` (badge tint) |
|---|---|---|---|---|
| `in_stock` | `available_count > low_stock_threshold` | `--status-in` | `#3a7455` (forest green) | `rgba(58, 116, 85, 0.1)` |
| `low_stock` | `1 <= available_count <= low_stock_threshold` | `--status-low` | `#8e5e22` (amber/ochre) | `rgba(142, 94, 34, 0.1)` |
| `out_of_stock` | `available_count == 0` | `--status-out` | `#b3392c` (rust red) | `rgba(179, 57, 44, 0.1)` |

Each `-bg` token is its base color at 10% alpha via `rgba()`, not a
pre-blended hex — the same pattern as `--accent-bg` in §4.1. Using alpha
rather than a flattened hex means the tint stays correct wherever it's
composited (over `--bg` or `--bg-raised`, light or dark) instead of only
matching the one background it was mixed against.

These three base values are deliberately a shade darker than a first pass at
"forest green / amber / rust" would land, specifically so the badge text
passes AA against its own tint (§4.4) — see the verified ratios there. Do not
re-lighten them for visual taste without re-checking contrast.

Badges use the base color as text on the `-bg` tint so they read as soft
pills, not alarm colors, except in the staff dashboard's row-highlight
context where the full color is used as a solid stripe (§7.B).

**Rule:** stock-status color is never used for anything else in the UI. If a
future feature wants "green," it must pick a different green. This keeps the
signal uncontaminated.

### 4.3 Dark mode

Follow the existing `prefers-color-scheme: dark` pattern already in both
`index.css` files. Same warm-vs-cool logic, inverted:

| Token | Value |
|---|---|
| `--bg` | `#1b1712` |
| `--bg-raised` | `#242019` |
| `--text` | `#c9bfae` |
| `--text-h` | `#f2ece2` |
| `--border` | `#3a3327` |
| `--accent` | `#e07a5f` |
| `--accent-bg` | `rgba(224, 122, 95, 0.15)` |
| `--accent-border` | `rgba(224, 122, 95, 0.5)` |
| `--code-bg` | `#241f18` |
| `--shadow` | `rgba(0, 0, 0, 0.4) 0 10px 15px -3px, rgba(0, 0, 0, 0.25) 0 4px 6px -2px` |

`--accent-bg`/`--accent-border` carry a higher alpha here than their
light-mode counterparts (§4.1's `0.08`/`0.35`) because the same alpha reads
noticeably fainter against a dark page — this matches the Vite-starter dark
block already present in both `index.css` files, which used the same
lift. `--shadow` switches to pure black at higher opacity rather than the
warm-tinted light-mode shadow, again matching the existing dark block: a
tinted shadow disappears against a dark background, so only opacity does the
work of separating a raised surface from the page behind it.

| Status | Token | Value | `-bg` (badge tint) |
|---|---|---|---|
| `in_stock` | `--status-in` | `#6fae8c` | `rgba(111, 174, 140, 0.1)` |
| `low_stock` | `--status-low` | `#e0a44f` | `rgba(224, 164, 79, 0.1)` |
| `out_of_stock` | `--status-out` | `#e27164` | `rgba(226, 113, 100, 0.1)` |

Same `rgba()`-at-10%-alpha pattern as light mode's `-bg` tokens (§4.2).

Stock-status colors get lighter, not desaturated, in dark mode — they still
need to pass contrast against a dark page while staying legible as
"traffic-light" signals at a glance. `--status-out` is a touch lighter here
than a straight hue-shift of the light-mode red would give, so it clears
AA against its own tint (§4.4) — the same reasoning as the light-mode
adjustment in §4.2.

### 4.4 Accessibility

- Every status color/background pairing must hit **WCAG AA (4.5:1)** for the
  label text sitting on it. Because the `-bg` tint is `rgba()` alpha rather
  than a flat hex (§4.2), it composites differently depending on what's
  underneath — a badge on a card (`--bg-raised`) and a badge directly on the
  page (`--bg`) are two different pairings, and **both** must be checked; a
  status badge is not guaranteed to only ever sit on one or the other.
  All twelve combinations (three statuses × light/dark × two backgrounds)
  are pre-verified against the values in §4.2/§4.3:

  | Pairing | Light on `--bg-raised` | Light on `--bg` | Dark on `--bg-raised` | Dark on `--bg` |
  |---|---|---|---|---|
  | in-stock | 4.82:1 | 4.53:1 | 5.32:1 | 5.92:1 |
  | low-stock | 4.86:1 | 4.57:1 | 6.15:1 | 6.86:1 |
  | out-of-stock | 5.10:1 | 4.80:1 | 4.55:1 | 5.05:1 |

  Light mode is the tight case — the worst pairing (low-stock on `--bg`) has
  about 0.07 of headroom above the 4.5:1 floor by design, since the palette
  stays in the intended hue family rather than over-darkening for margin.
  Dark mode has generous headroom throughout. If any token in §4.1–§4.3 is
  changed later, re-verify **all four** backgrounds for the affected status
  before merging — checking only `--bg-raised` is not sufficient, as a prior
  revision of this doc found out.
- Status is never color-only: the badge always carries text ("Out of stock,"
  "Only 1 left," "In stock") and, where space allows, an icon. This matters
  most in Product B's grid, which is read fast and under time pressure.
- Focus states use `--accent-border` at full opacity with a visible outline,
  not just a color shift — staff and customers alike may be on a trackpad, not
  a mouse.

---

## 5. Typography

| Token | Family | Use |
|---|---|---|
| `--heading` | `'Fraunces', Georgia, serif` | Book titles, page headings, the loyalty card, chat bubbles from the "store" |
| `--sans` | `'Inter', system-ui, 'Segoe UI', Roboto, sans-serif` | UI chrome — buttons, labels, form fields, dashboard grid |
| `--mono` | `ui-monospace, Consolas, monospace` | ISBNs, order IDs, phone numbers — anything that benefits from fixed-width scanning |

**Fraunces** was chosen over a plain system serif because it has the
slightly-irregular, warm character the "warm & literary" reference sites share
(variable optical sizing gives large headings real presence without feeling
like a wedding invitation). Load it via Google Fonts `<link>` in each app's
`index.html`; no other external font hosts are permitted for this project's
deployment target.

**Scale** (reuses the existing `index.css` structure, restyled):

| Element | Size | Weight | Notes |
|---|---|---|---|
| `h1` | 48px / 32px mobile | 500 | Fraunces. Page-level only — one per screen. |
| `h2` | 28px / 22px mobile | 500 | Fraunces. Section headings, book titles in cards. |
| `h3` | 18px | 600 | Inter. Card labels, dashboard column headers. |
| Body | 16px / 145% | 400 | Inter. |
| Small / meta | 13px | 400–500 | Inter. Timestamps, counts, secondary info. |
| Mono | 14px | 400 | `--mono`. |

Rule of thumb: **if a customer would say it out loud in the store, it's
Fraunces; if it's a control or a fact, it's Inter.**

---

## 6. Spacing, layout & core components

### 6.1 Spacing

Use a 4px base unit (Tailwind's default scale is already this — no custom
scale needed). Standard content padding: 16px mobile, 24px desktop. Cards use
16px internal padding minimum; dashboard grid rows are denser (8–12px) per §7.B.

### 6.2 Shared components

These render (near-)identically wherever they appear, styled from the tokens
above:

- **Stock badge** — pill, status color, icon + label (`In stock`, `Only 2
  left`, `Out of stock`). Built once, reused in A's search results, A's book
  detail, B's grid, and C's chat replies, so a customer never sees the same
  fact phrased two different ways.
- **Book card** — cover image (or a warm placeholder using the title's first
  letter on `--code-bg` when `cover_image_url` is empty), title in Fraunces,
  author in Inter, price, stock badge.
- **Phone-number identity field** — a single input, digit-only, used for both
  lookup and registration (PRD §5.3). Same component in A and in escalation
  flows.
- **Status pill** (orders) — `pending` / `ready_for_pickup` / `completed` /
  `cancelled` / `expired`, distinct from stock-status colors so the two systems
  are never visually confused. Use neutral `--text`/`--border` tones with a
  small icon, not the red/amber/green set.
- **Empty state** — icon (lucide-react, already a dependency in both apps),
  one line of bookseller-voiced copy, one action. No blank canvases, per
  Design Principle 5.

---

## 7. Per-product application

### 7.A — Customer Ordering & Loyalty App

Full warm treatment. Generous whitespace, large cover imagery, Fraunces
headings set the tone from the homepage search down to book detail. The
**loyalty card** (PRD §8.A.5) is the one place to spend extra craft: render it
as an actual stamp card — 10 slots, filled stamps in `--accent`, a small
flourish when a reward unlocks. This directly serves the "no reason to return"
pain point — the card has to *feel* worth collecting, not just report a number.

The **chatbot panel** (Product C, hosted here per PRD §8.C) reuses A's
component conventions exactly — it is a guest in A's house. Decision-tree
buttons use the same button component as the rest of A; replies that cite
stock use the shared stock badge so an answer from the bot is visually
indistinguishable from an answer from the search page.

### 7.B — Staff Inventory & Ops Dashboard

Same palette and type family, dial turned toward density and speed:

- Base font size drops one step from A (Inter 14px body vs. 16px).
- The inventory grid is a real data grid — tight row height, `stock_count` and
  `available_count` as separate columns (PRD §5.4), sortable headers, zebra
  striping using `--code-bg`, not whitespace, to separate rows.
- The **low-stock alert summary** (PRD §8.B.2) is the one place staff-facing UI
  gets loud: large numerals in `--status-out` / `--status-low`, pinned at the
  top, each a clickable filter. This is the direct answer to "staff can't see
  stock at a glance" — the alert has to be readable from across a shop counter,
  not just at reading distance.
- Row color-coding uses the full-strength status colors (not the 10% tint used
  for badges elsewhere) as a left-edge stripe, so the grid reads as a color
  field before it reads as text.
- The **pre-order Kanban** (PRD §8.B.4) uses card-based columns with the same
  book-card component as A, minus the cover image emphasis — phone and hold
  deadline are the scannable facts here, not the cover.
- Fraunces appears only for the page title; everything else in B is Inter or
  mono. This is deliberate — B is a tool a bookseller reads in six seconds
  between customers, not a page a customer lingers on.

### 7.C — Customer Support Chatbot

No standalone surface (PRD §8.C resolves this: hosted inside A). See §7.A.

### 7.D — Marketing Content Generator

Hosted as a panel inside B (PRD §8.D), so it inherits B's dense posture for
the subject/tone picker — but the **generated caption preview** is the one
spot inside B that borrows A's warmth: render it in Fraunces on a
`--bg-raised` card, closer to how it'll actually look as a social post, so
staff are previewing what a customer will see, not just reading templated
text in a form field. This is a small, deliberate crack in the "staff surfaces
are all-business" rule (§7.B) — the whole point of D is producing something a
customer-facing audience will read.

---

## 8. Implementation notes

- Both apps already run **Tailwind v4** with a CSS-first `@theme`/custom-property
  pattern in `src/index.css` (see the existing `--accent`, `--text`, etc.
  tokens). Section 4–5 of this doc are meant to replace those placeholder
  values directly, keeping the same variable names.
- **That replacement is necessary but not sufficient — read this before
  assuming merging this doc gets you the design.** As of this writing,
  neither app's components read the CSS custom properties at all: `0`
  `var(--…)` usages in either `apps/*/src/**/*.tsx`. Instead every component
  is written against hardcoded Tailwind utility classes — 40+ call sites like
  `text-slate-500`, `text-slate-900`, `border-slate-200` in
  `apps/staff-dashboard/src/pages/Marketing.tsx` alone. Swapping the token
  *values* in `index.css` changes nothing on screen until one of these
  happens:
  1. **Map the tokens into Tailwind's theme** (`@theme` block, e.g.
     `--color-slate-500: var(--text)`) so the existing utility classes resolve
     to the new palette with no component edits — fastest, but only works
     cleanly where a Tailwind shade already lines up with a token.
  2. **Rewrite the call sites** to use the token-backed classes directly —
     more accurate long-term, more surface area to touch.
  Either path crosses both product boundaries (Product A and Product B are
  separately owned), so it needs the same explicit agreement the PRD asks for
  on shared-architecture changes (§9), not an assumption that it happens for
  free.
- `lucide-react` is already a shared dependency in both apps — use it for all
  iconography (status icons, empty states, nav) rather than introducing a
  second icon set.
- **Both** `Fraunces` (`--heading`) **and** `Inter` (`--sans`) need a Google
  Fonts `<link>` tag in `index.html` in both apps — `--sans` is where most of
  the UI's actual text lives (buttons, labels, the entire dashboard grid), so
  loading only Fraunces leaves nearly everything silently rendering in the
  `system-ui` fallback instead of the specified typeface. Pull in the weights
  §5's scale actually uses (400/500/600 for Inter; 500 plus the numeral/italic
  variants Fraunces exposes for headings), and rely on Google Fonts' default
  `font-display: swap` so cold loads don't block text.
- Any new shared component (stock badge, book card, phone field) that both A
  and B need should be built once and decided where it lives — this is the
  same "shared ownership" problem the PRD raises for `backend/api/` (§9). It
  isn't resolved by this document; flag it to the team the same way.

---

## 9. Open questions

| # | Question | Owner |
|---|---|---|
| D1 | Do A and B share an actual component library/package, or does each app implement the shared components (§6.2) independently against this spec? | A + B |
| D2 | Fraunces requires a Google Fonts network request at runtime — acceptable for the local-only staff dashboard (PRD §5.3 assumes a shop machine, presumably with internet), or should it be self-hosted / bundled? | B |
| D3 | Should the loyalty stamp card (§7.A) get a lightweight animation on stamp-fill, or is that scope creep for Cycle 4? | A |

---

## Appendix — Attribution

Palette and type direction are original to this document, informed by the
mood of the sites listed in
[`look_and_feel_references.md`](./look_and_feel_references.md):
[Good Books](https://www.markramel.com/project-goodbooks),
[Pulp](https://martaryczko.com/project/pulp),
[The Last Bookstore](https://www.wix.com/explore/websites/site/the-last-bookstore),
[The Goose](https://www.pymk.co.uk/home/the-goose),
[Dreambooks](https://www.vicarelstudios.com/work/dreambooks),
[27th Letter Books](https://www.orsodesignco.com/work/27th-letter-books).
No layout, imagery, or copy is copied from these references.
