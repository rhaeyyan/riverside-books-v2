---
name: grill-me
description: Requirements interview for an ambiguous goal — pins down the exact target, whether it moves a PRD contract, and what done looks like, then emits a [REQUIREMENTS] block for the planner. Load when a request has more than one plausible reading, before planning.
---

# Grill me

Closes the gap between what was asked and what was meant, **before** `planner`
spends a round-trip on the wrong reading.

The loop in `CLAUDE.md` puts a human approval gate on the `[SPEC]`, which
catches a wrong plan — but only after it is written, and only if the reviewer
spots the wrong assumption inside a plausible-looking spec. This runs one step
earlier and asks instead of assuming.

It never plans and never builds. Its only output is a `[REQUIREMENTS]` block.

## When to run

- A request has two or more readings that would produce **different diffs**.
  ("Fix the stock badge" — the customer-app book card or the staff-dashboard
  table cell? They are different products with different owners.)
- A "clean up", "improve", or "redesign" request that does not say what done
  looks like.
- Anything that might move a `docs/PRD.md` §5–7 field name or endpoint shape —
  that is a contract change and needs to be proposed, not guessed at.

Skip it for a typo, a copy change, or a one-line fix. `CLAUDE.md` is explicit
that matching ceremony to task size is the point; an interview about a
one-liner is the same failure as running four agents at it.

## Process

1. **List the live interpretations first.** Read only what you need to name the
   candidates — not the whole tree. Write down each reading that leads to a
   *different* implementation. **If there is only one, say so, emit the block,
   and skip the interview entirely.**

2. **Interview with `AskUserQuestion`.** At most **2 rounds**, up to 4 questions
   each. On exhaustion, record what is still open under *Open assumptions* and
   move on — never loop uncapped (the same cap the `qa` retry loop carries, for
   the same reason).

   Ask only what changes the plan, in this order:

   - **Which product?** A, B, C, D, or shared. This decides the owner, the
     reviewer, and the branch name, so it is never a detail. Offer the concrete
     paths, not the letters alone.
   - **Which exact file, page, or component?** Named concretely. Offer the real
     candidates you found in step 1.
   - **Does this move a contract?** If a PRD §5–7 field or endpoint is in scope,
     ask outright whether changing it is on the table. If yes, the answer is a
     proposal in a PR body, not an edit — say so now rather than after the code
     is written.
   - **What does done look like?** Something a test can assert. "Looks better"
     is not an answer; "the badge reads 'Low stock' at `available_count <= 2`"
     is.
   - **Structural or cosmetic?** For UI work: does the DOM change, or only the
     styling? This decides whether `designer` needs a spec at all.

3. **Emit the block.** Then stop. Do not plan, do not open files, do not write
   code. Hand it to `planner`.

## Output

```markdown
[REQUIREMENTS]
- **Request (verbatim)**: <what the human actually typed>
- **Chosen interpretation**: <the one reading, in one sentence>
- **Rejected interpretations**: <the others, and why each was ruled out>
- **Product**: <A | B | C | D | shared>
- **Target files**: <concrete paths>
- **Contract impact**: <none | proposes a change to PRD §N.N — needs @rhaeyyan>
- **Done looks like**: <observable, assertable>
- **Open assumptions**: <anything the interview did not settle, stated as an
  assumption rather than left implicit>
```

`planner` turns this into a `[SPEC]`. The fields line up deliberately:
*Product* and *Target files* feed **Files** (still capped at 5), *Done looks
like* feeds **Done when**, and *Contract impact* feeds **Constraints**.
