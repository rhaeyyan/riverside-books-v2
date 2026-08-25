---
name: system-review
description: Read-only audit of the repo's own tooling — agents, skills, hooks, CODEOWNERS, and whether CLAUDE.md still describes the tree it documents. Produces a prioritized report for a human to approve. Load periodically, or when the setup feels out of step with the code.
---

# System review

Audits the scaffolding rather than the product: the four agents, the skills, the
hooks, `CODEOWNERS`, and the operating manual itself.

**This skill reads, analyses, and proposes. It never edits and never commits.**
Every finding needs human approval before anything changes.

## Why it exists

The docs in this repo carry rules, and a rule that describes a tree which has
moved on has quietly lost its authority. That is not hypothetical here —
`CLAUDE.md` already documents one instance of it under Gotchas ("`AGENTS.md`
says eslint; the `package.json` scripts and CI actually run oxlint"). Drift
found deliberately is a one-line fix; drift found by someone following a stale
instruction costs a debugging session.

## Run

Gather state before forming any opinion:

```bash
ls .claude/agents/ .claude/skills/ .claude/hooks/
cat .claude/settings.json
git log --oneline -20
git ls-files | grep -v '^apps/\|^tests/' | sed 's|/[^/]*$||' | sort -u
uv run python -m scripts.check_contract
```

Then work the six checks below.

### 1. Manual vs. tree

Does `CLAUDE.md`'s layout table list every top-level directory that is actually
tracked? Do the Commands still work as written? Does the stack description match
the dependencies? Report each mismatch with both sides quoted.

### 2. Ownership coverage

Every tracked top-level directory should resolve to an owner in
`.github/CODEOWNERS` more specific than the `*` default — or be a deliberate
exception. A shared surface silently owned by the catch-all rule reads as
unowned to the person opening the PR.

### 3. Agent and skill drift

For each of the four agents: does its `tools:` frontmatter still match the
restriction its description claims? `qa` editing outside `tests/` would defeat
the entire reason it is a separate agent.

For each skill: does it describe files that still exist? `design-system` names
specific paths and a file count; `a11y-audit` lists specific known defects. A
defect that has since been fixed should leave that list — a stale "known defect"
teaches the next reader to ignore the section.

### 4. Hook health

Run each hook standalone against a synthetic payload and confirm it still
behaves:

```bash
printf '{"tool_input":{"command":"git reset --hard"}}' | ./.claude/hooks/git-guard.sh
```

A hook that silently stopped matching is worse than no hook, because the rule it
mechanizes now looks enforced. Check the matcher in `settings.json` still names
the tools the hook expects.

### 5. Contract drift

`scripts/check_contract.py` reports it mechanically. Your job is to classify each
line: a genuine break to fix, a documentation gap to propose to @rhaeyyan, or
deliberate-and-permanent drift that should move into `ACCEPTED` **with its
reason written out**. An unexplained `ACCEPTED` entry is a silenced check.

### 6. Ceremony fit

The honest one. `CLAUDE.md` says "running four agents at a one-line bug is the
failure mode, not the safe choice." Look at the recent log: is the process
earning its cost, or is it being routed around? Both answers are findings.

## Output

```markdown
[SYSTEM-REVIEW-REPORT]
## Blocking — a rule that is now wrong or unenforced
- <finding> · evidence: <file:line or command output> · proposed fix: <one line>

## Worth fixing — drift that has not bitten yet
- ...

## Noted — no action proposed
- ...
```

Order by consequence, not by how easy each is to fix. Cite evidence for every
finding: a file path, a line, or literal command output. A finding without
evidence is an opinion, and this report exists to carry the other kind.

## Known open findings (as of 2026-08-25)

Do not re-report these as new; do report if they are still open.

- `CLAUDE.md` opens with "JSON files instead of a database", but `supabase/`
  holds two applied migrations and `backend` now depends on psycopg 3 (PR #21).
- `supabase/` and `web/` are tracked but appear in neither `CLAUDE.md`'s layout
  table nor `CODEOWNERS`, and there is no documented command for running
  migrations.
- Four routes are served but undocumented in PRD §7 —
  `GET /api/books/external/{isbn}`, `POST /api/books`,
  `GET /api/customers/{customer_id}`, `PATCH /api/messages/{message_id}/status`.
