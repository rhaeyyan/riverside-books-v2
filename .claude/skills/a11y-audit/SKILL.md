---
name: a11y-audit
description: WCAG 2.2 AA checklist for the Riverside Books frontends, plus the specific accessibility defects already known to exist. Load before calling any UI change done, and when reviewing a diff under apps/.
---

# Accessibility audit

Target is **WCAG 2.2 Level AA**. There is no automated a11y linting in this
repo — oxlint runs `react`, `typescript`, and `oxc` plugins only — so this pass
is manual and it is the only thing standing between a defect and `main`.

## The pass

Work through these against the diff. Each maps to a real success criterion.

**1. Semantics before ARIA.** Something clickable is a `<button>`. Something
navigating is an `<a>`. A `<div onClick>` is invisible to keyboard and screen
reader alike. Reach for `role=` and `aria-` only when no native element fits.
(SC 4.1.2)

**2. Keyboard.** Tab to every interactive element in the change. Can you reach
it? Activate it with Enter and Space? Escape a dialog? Is the tab order the
visual order? Nothing keyboard-trapped? (SC 2.1.1, 2.1.2, 2.4.3)

**3. Visible focus.** Every focusable element needs a focus indicator you can
actually see, in both color schemes. Never `outline: none` without a
replacement. (SC 2.4.7, 2.4.11)

**4. Contrast.** 4.5:1 for body text, 3:1 for large text (24px+, or 18.66px+
bold) and for UI component boundaries. Check both color schemes. White on
amber is the classic failure and this repo has one — see below. (SC 1.4.3,
1.4.11)

**5. Names.** Every input has a `<label>` tied by `htmlFor`/`id`. Every
icon-only button has an accessible name. Every meaningful image has `alt`;
decorative ones get `alt=""`. This project uses `lucide-react` icons, which
render inline SVG with no name of their own. (SC 1.1.1, 3.3.2, 4.1.2)

**6. Motion.** Wrap animation in `@media (prefers-reduced-motion: reduce)`.
Nothing in this repo does yet. (SC 2.3.3)

**7. State, announced.** Loading, error, and empty states need to reach a
screen reader, not just the eye. An async result that appears silently is
invisible. Use `aria-live` for content that updates in place — the chat panel
in `Support.tsx` is exactly this shape. (SC 4.1.3)

**8. Zoom and reflow.** At 320px wide and at 200% zoom, no horizontal scroll and
no clipped content. Note that `#root` is a fixed `width: 1126px` with
`max-width: 100%`. (SC 1.4.4, 1.4.10)

## Already-known defects

These exist on `main` today. Do not report them as new; do fix the one you are
already touching.

- **`Inventory.tsx:161` and `:168`** — `<div className="alert-card" onClick=…>`.
  Two stock filters that are mouse-only: no keyboard access, no role, no focus.
  The fix is a `<button>`.
- **`.alert-card.low-stock`** — `color: white` on `#f59e0b`. Roughly 2.1:1
  against a 4.5:1 requirement. Fails.
- **No `prefers-reduced-motion` guard** anywhere, with `transition: transform`
  live in `Inventory.css`.
- **8 of 10 page and component files contain zero `aria-` or `role`
  attributes** — `Home.tsx`, `BookDetail.tsx`, `MyOrders.tsx`,
  `LoyaltyCard.tsx`, `ChatPanel.tsx`, `Inventory.tsx`, `Messages.tsx`,
  `Preorders.tsx`. Not proof of a defect on its own, but that is where to look.

## Reporting

```markdown
[A11Y]
- **Checked**: <which of the eight items applied to this change>
- **Fixed**: <file:line — defect, and the criterion it broke>
- **Pre-existing, not fixed**: <file:line — out of this change's scope>
- **Manual verification**: <what you actually tabbed through and looked at>
```

Do not claim a check you did not run. "Not applicable to this diff" is a fine
answer; "looks accessible" is not.

## A note on tooling

Adding `eslint-plugin-jsx-a11y` or `axe-core` would mechanize items 1 and 5 and
catch them before review. Both are new dependencies, so they need their own
decision and their own PR — propose it, do not install it.
