---
name: design-system
description: The Riverside Books styling contract — the design tokens, which of the three coexisting styling systems to use for a given file, and the known drift not to "fix" in passing. Load before writing or editing any CSS or className under apps/.
---

# Riverside Books design system

Read this before styling anything in `apps/customer-app/` or
`apps/staff-dashboard/`. It describes what is actually in the repo, not an
aspiration.

## Three systems coexist. Know which one you are in.

| Layer | Where | What it is |
| --- | --- | --- |
| Tokens | `src/index.css` | Custom properties + element typography + a real dark-mode block. **Byte-identical in both apps.** |
| Page CSS | `App.css`, `src/pages/*.css` | Component classes with hardcoded hex. staff-dashboard has four; customer-app has none. |
| Tailwind v4 | 2 of 10 page files | Installed and imported in both apps, adopted in almost none. |

**The rule: match the file you are editing.** A page with a sibling `.css` file
stays in CSS. A page already on Tailwind stays on Tailwind. Converting a file's
approach as a side effect of an unrelated change is how the third system got
here in the first place.

**For a brand-new component, prefer Tailwind utilities plus the tokens.** It is
already installed in both apps, and it does not add another 100-line CSS file
that duplicates what the tokens already say.

## The tokens

Defined on `:root` in `src/index.css`, with dark values under
`@media (prefers-color-scheme: dark)`:

```
--text          body copy
--text-h        headings, emphasized text
--bg            page background
--border        rules, card edges, dividers
--code-bg       code and counter chips
--accent        the purple: links, primary actions, focus
--accent-bg     accent at 10% — subtle fills
--accent-border accent at 50% — outlines on accent surfaces
--shadow        the two-layer elevation shadow
--sans / --heading / --mono   font stacks
```

Type scale is set on elements, not classes: `h1` is 56px (36px under 1024px),
`h2` is 24px (20px), body is 18px/145% (16px under 1024px). Do not re-declare
these on a wrapper; style the element.

**Use `var(--token)`. Do not add a 32nd hardcoded hex.** If the color you need
has no token, say so and stop — a new token belongs in both `index.css` files
and that is a shared-path change.

## Known drift — flag it, do not fix it in passing

- **Dark mode is half-broken.** The token layer adapts; the page-CSS layer
  hardcodes 31 light-mode hex values (`#f8f9fa`, `#007bff`, `#ef4444`, `#f59e0b`
  and 27 more) with no dark variants. A card keeps its light background while
  the text around it flips.
- **`index.css` is duplicated byte-for-byte** across the two apps. A token
  change made in one silently diverges from the other.
- **`#root` carries `width: 1126px` and `text-align: center`**, inherited from
  the Vite starter template and never revisited.
- **No `prefers-reduced-motion` guard exists anywhere**, despite
  `transition: transform` rules in `Inventory.css`.

Every one of these spans both apps, so fixing one touches @Cheewaiyip's product
and needs its own PR and its own review. Note what you saw in your report and
move on. A drive-by refactor inside a feature PR is the thing to avoid.

## Verifying

There is no frontend test runner. From the app directory:

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build — this is the typecheck
```

Then look at it: narrow width, both color schemes, keyboard only. Load the
`a11y-audit` skill before calling it done.
