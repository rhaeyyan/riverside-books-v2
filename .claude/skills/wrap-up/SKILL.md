---
name: wrap-up
description: Close out a session — separate seed drift from real work, run the full check suite, commit in Conventional Commits, and open the PR with the shared-path callout filled in. Load when the work is done and it is time to ship it. User-invoked; never run unprompted.
---

# Wrap-up

The ritual that ends a session in this repo, in one place, because two of its
steps are easy to skip and expensive to skip.

The human invoking this skill **is** the request to commit and push. Never run
it on your own initiative, and never let it be the thing that decides work is
finished.

## Why this exists

Two failure modes, both already documented in `CLAUDE.md` as gotchas, both
currently prevented only by remembering to read them:

1. **Running the app dirties tracked files.** `JsonDatastore` writes back to
   `mock_data/*.json`, which is committed. Any dev session, demo, or test run
   leaves seed drift in the tree. Sweeping it into a feature commit puts a
   shared-path change (@rhaeyyan's review) into a PR that nobody expected to
   touch shared state.
2. **The PRD is a contract with no compiler.** Renaming a model field or
   changing an endpoint shape breaks another product at runtime, silently.
   Step 4 runs the mechanical check for it.

## The steps

### 1. Confirm you are not on `main`

```bash
git rev-parse --abbrev-ref HEAD
```

`main` is protected (non-negotiable #4). If you are on it, stop and branch:
`<product>/<short-description>`, matching `CONTRIBUTING.md` — e.g.
`product-b/low-stock-filter`. The `git-guard.sh` PreToolUse hook will also ask
before a commit on `main`, but it is a backstop, not the plan.

### 2. Separate seed drift from real work

```bash
git status --porcelain
git diff --stat -- mock_data/
```

For every changed file under `mock_data/`, decide explicitly which it is:

- **Incidental drift** — the file changed only because the app or the tests ran.
  `scripts/seed.py` regenerates it with run-time-relative timestamps, so a diff
  showing only shifted timestamps and hold expiries is drift. **Restore it:**
  `git restore mock_data/` — do not stage it.
- **Intended data change** — you edited `scripts/seed.py` and re-ran it. Then
  the diff to `scripts/seed.py` is the real change, the JSON rides along with
  it, and it is a shared-path change that needs @rhaeyyan (step 6).

Never hand-edit `mock_data/*.json` directly; the next seed run overwrites it.

Then check for anything the session produced that git cannot see:

```bash
git status --short --untracked-files=all
```

If something you created does not appear, run `git check-ignore -v <path>` and
surface the matching rule to the human. Never silently `git add -f`.

### 3. Run the checks

```bash
uv run ruff check .
uv run python -m scripts.seed
uv run pytest
```

Then, for each app whose files you touched:

```bash
npm ci && npm run lint && npm run build   # from apps/<app>/
```

`npm run build` is the typecheck — there is no separate `tsc` step, and there is
no `npm test` to run. `scripts.seed` refuses to write a seed failing the PRD
§6.7 minimums, which is why it runs before pytest here and in CI.

**Re-run step 2 after this.** `pytest` and `seed` both rewrite `mock_data/`.

### 4. Check the PRD contract

```bash
uv run python -m scripts.check_contract
```

Compares the §6 field tables and the §7 route table against the Pydantic models
and the generated OpenAPI schema. Advisory here rather than blocking: it reports
known drift that predates this session, so read what it says instead of
assuming a clean exit. If **your** diff added a row to that output, resolve it
before the PR — that is a contract break with no compile error behind it.

### 5. Commit

Group the work into isolated Conventional Commits — `feat(scope):`,
`fix(scope):`, `docs(scope):`, `chore(scope):`, with the scope naming the
product (`shared`, `product-a`, …), matching the existing log. Never mix
unrelated concerns in one commit, and never mix seed drift into a feature
commit.

Commit trailers follow the harness default in this repo: the recent history
carries `Co-Authored-By` and `Claude-Session` lines. Keep doing that.

### 6. Open the PR

```bash
git push -u origin <branch>
gh pr create --fill
```

Fill in `.github/pull_request_template.md`. Before you do, run the diff past the
ownership table:

```bash
git diff --name-only main...HEAD
```

If any path is shared — `backend/api/core/`, `backend/api/models.py`,
`backend/api/main.py`, `backend/api/deps.py`, `mock_data/`, `docs/`, `.github/`,
`scripts/`, `supabase/` — **say so explicitly in the PR body** and name what
could break. CODEOWNERS requests @rhaeyyan automatically, but the reviewer
should not have to derive the blast radius from the file list.

State the same for a change to `docs/PRD.md` §5–7: propose it in the PR body,
do not present it as done.

### 7. Report

Close with: the branch, the commits, the PR URL, whether CI is green, and
anything left unfinished or blocked. If work is finished but no commit was
authorized, say that plainly rather than leaving it silently uncommitted.

## What this skill does not do

- It does not decide the work is correct. That is `qa` (checks) and `reviewer`
  (a cold read of the diff), and both run **before** this skill.
- It does not merge. One approving review from the code owner, then the merge.
