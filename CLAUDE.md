# Riverside Books v2 — Claude Code Operating Manual

A monorepo holding four products for a single-location independent bookstore.
FastAPI backend, two Vite/React frontends, JSON files instead of a database.

Related docs, which this file does not repeat:
- [`AGENTS.md`](AGENTS.md) — stack, ruff config and its rationale, security assessment.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch names, review, merge flow.
- [`docs/PRD.md`](docs/PRD.md) — product requirements. §5–7 are a binding contract.
- [`README.md`](README.md) — running the suite locally, deploying to Render.

## Commands

Backend (from the repo root, always through `uv`):

```bash
uv sync                  # install/refresh the environment
uv run python -m scripts.seed   # regenerate mock_data (see Gotchas)
uv run pytest            # 75 tests, all green as of 2026-08-25
uv run ruff check .      # lint; must be clean before a PR
uv run ruff format .     # format
uv run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend (from `apps/customer-app/` or `apps/staff-dashboard/`):

```bash
npm ci
npm run lint             # oxlint, not eslint — see Gotchas
npm run build            # tsc -b && vite build; this is the typecheck
npm run dev              # 5173 for customer-app, 5174 for staff-dashboard
```

There is no frontend test runner. CI runs lint + build for the apps and lint +
pytest for the backend. Do not invent an `npm test`.

## Layout and ownership

Product boundaries are also review boundaries — [`.github/CODEOWNERS`](.github/CODEOWNERS)
routes the PR to whoever owns the paths a change touches.

| Product | Paths | Owner |
| --- | --- | --- |
| A — Customer app | `apps/customer-app/` | @rhaeyyan |
| B — Staff dashboard | `apps/staff-dashboard/` | @Cheewaiyip |
| C — Chatbot | `backend/chatbot/`, `backend/api/routers/chat.py` | @humaali-create |
| D — Marketing generator | `backend/marketing/`, `backend/api/routers/marketing.py` | @crystalwatson-art |
| Shared | `backend/api/core/`, `backend/api/models.py`, `mock_data/`, `docs/`, `.github/` | @rhaeyyan |

Keep a change inside one product's paths where you can. A change to a shared
path can break the other three silently, so call it out explicitly in the PR
body and expect it to need the shared owner's review.

## Non-negotiables

1. **No generative AI in Products C and D.** The chatbot is a decision tree
   (`backend/chatbot/tree.py`) plus keyword matching; the marketing generator is
   string templating (`backend/marketing/templates.py`). Adding a model call to
   either is a rejected PR, not a design discussion.
2. **`docs/PRD.md` §5–7 is a contract.** Renaming a model field or changing an
   endpoint shape breaks another teammate's product at runtime with no compile
   error. Propose the change; do not just make it.
3. **No secrets, ever.** The suite runs on mock data and has no production
   credentials. Nothing goes in `.env` that would matter if leaked.
4. **`main` is protected.** Branch, PR, green CI, one owner approval. No direct
   pushes, no force pushes to shared branches, no history rewrites.
5. **New dependency = its own decision.** Adding a package means updating
   `pyproject.toml`, regenerating `uv.lock` (`uv sync`) *and* `requirements.txt`
   (`uv pip compile pyproject.toml -o requirements.txt`), because Render builds
   from the latter. Flag it rather than slipping it into a feature PR.

## Multi-agent orchestration

Four subagents live in [`.claude/agents/`](.claude/agents). The main session is
the builder: it writes the implementation code and carries handoffs between
agents, since subagents cannot invoke each other.

| Agent | May edit | Use for |
| --- | --- | --- |
| [`planner`](.claude/agents/planner.md) | nothing (read-only) | turning a goal into a spec of at most 5 files |
| [`qa`](.claude/agents/qa.md) | `tests/` only | failing tests from the spec, then running the checks |
| [`reviewer`](.claude/agents/reviewer.md) | nothing (read-only) | an independent read of the diff before the PR |
| [`designer`](.claude/agents/designer.md) | `apps/` | styling, layout, and frontend accessibility in Products A and B |

The default loop for a feature or a non-trivial fix:

1. `planner` returns a `[SPEC]`. A human approves it before any code is written.
2. `qa` writes failing tests against the spec's behaviour.
3. The main session implements until those tests pass.
4. `qa` runs the full check suite and reports PASS or FAIL. **Two retries max**,
   then stop and ask the human. Never loop uncapped.
5. `reviewer` reads the diff cold, before `gh pr create`.

Skip straight to step 3 for a typo, a copy change, or a one-line fix. Matching
the ceremony to the size of the task is the point; running four agents at a
one-line bug is the failure mode, not the safe choice.

Each agent's restrictions are enforced by its `tools:` frontmatter. `qa` cannot
edit source, which is the whole reason it is a separate agent: it cannot make a
failing test pass by weakening the code.

`designer` sits outside that loop rather than inside it: UI work still gets a
spec and still gets reviewed, but it replaces the main session as the builder
for anything under `apps/`. Route visual and interaction work there instead of
styling by hand.

Two products can be built in parallel by spawning a builder with
`isolation: "worktree"` so each gets its own checkout. Only do this when the
tasks genuinely touch different products' directories. Use a worktree too when
someone else is working in this clone, so you never move their checkout out
from under them.

### Skills

Two project skills live in [`.claude/skills/`](.claude/skills), and anyone on
the team can load them, not just the agents:

- [`design-system`](.claude/skills/design-system/SKILL.md) — the tokens, which
  of the three coexisting styling systems to use for a given file, and the
  known drift not to "fix" in passing. Load before touching CSS or `className`.
- [`a11y-audit`](.claude/skills/a11y-audit/SKILL.md) — the WCAG 2.2 AA pass,
  plus the accessibility defects already known to be on `main`. Load before
  calling a UI change done.

They exist as skills rather than as prose in `designer.md` so that a reviewer, a
teammate, or the main session can load the same rules without going through the
agent.

### The `[SPEC]` block

```markdown
[SPEC]
- **Objective**: <what must be true when this is done>
- **Product**: <A | B | C | D | shared>  (shared needs @rhaeyyan)
- **Files**: <at most 5>
- **Done when**: <observable behaviour a test can assert>
- **Constraints**: <forbidden libraries, contracts that must not move>
```

Anything needing more than 5 files is more than one task. Split it.

## Gotchas

- **Running the app mutates tracked files.** `JsonDatastore` writes back to
  `mock_data/*.json`, which is committed. A dev session or a demo leaves a dirty
  tree. Check `git status` before committing and do not sweep incidental seed
  drift into a feature commit.
- **`scripts/seed.py` is the source of truth for seed data, not the JSON.**
  Timestamps are generated relative to run time, so holds stay live and events
  stay upcoming instead of ageing into the past. Edit the script and re-run it;
  hand-editing `mock_data/*.json` gets overwritten. It refuses to write a seed
  that fails the PRD §6.7 minimums, and CI runs it before pytest.
- **The lint script is `oxlint`.** `AGENTS.md` says eslint; the `package.json`
  scripts and CI actually run oxlint, configured in each app's `.oxlintrc.json`.
  Trust the script.
- **`npm run build` is the typecheck.** There is no separate `tsc` step, so a
  type error only surfaces at build time.
- **The two frontends are not interchangeable.** `customer-app` is on
  react-router-dom v6, `staff-dashboard` on v7. Do not copy routing code between
  them without checking the API.
- **CI runs Python 3.12; the local venv is 3.13.** Ruff targets py312. Do not
  reach for 3.13-only syntax.
- **The static mounts vanish under pytest.** `backend/api/main.py` skips
  `/shop`, `/staff`, and `/` when the `dist/` directories are absent, which is
  always the case in tests. Gateway behaviour needs a real build to verify.
- **`SPEC.md` and `docs/implementation_plan.md` are history.** They describe the
  completed original build. Read them for context; do not treat them as work
  still queued.
- **Per-file ruff ignores exist** in `pyproject.toml` for the template and tree
  modules, whose long string literals are deliberate. Do not "fix" those lines.
