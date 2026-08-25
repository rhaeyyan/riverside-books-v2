# Contributing

Riverside Books is a monorepo with four products in it. Every change reaches
`main` through a pull request. `main` is protected: direct pushes are rejected,
a pull request needs one approving review from the code owner of the paths it
touches, and force pushes and branch deletion are blocked. @rhaeyyan keeps an
admin override for emergencies but follows the same flow.

## Who owns what

| Product | Directories | Owner |
| --- | --- | --- |
| A — Customer Ordering & Loyalty App | `apps/customer-app/` | @rhaeyyan |
| B — Staff Inventory & Ops Dashboard | `apps/staff-dashboard/` | @Cheewaiyip |
| C — Customer Support Chatbot | `backend/chatbot/`, `backend/api/routers/chat.py` | @humaali-create |
| D — Marketing Content Generator | `backend/marketing/`, `backend/api/routers/marketing.py` | @crystalwatson-art |
| Shared | `backend/api/core/`, `mock_data/`, `docs/`, `.github/` | @rhaeyyan |

The same mapping lives in [`.github/CODEOWNERS`](.github/CODEOWNERS), which
GitHub uses to request reviews automatically. You own your product's
directories: you review pull requests that touch them, and you are expected to
review promptly so nobody is blocked.

## The workflow

1. **Branch off `main`.** Name it `<product>/<short-description>`, for example
   `product-b/low-stock-filter` or `product-c/hours-intent`.

   ```bash
   git switch main
   git pull
   git switch -c product-b/low-stock-filter
   ```

2. **Make your change**, keeping it inside your product's directories where you
   can. If you need to change a shared file, say so in the pull request — that
   change needs @rhaeyyan's review because it can break the other three products.

3. **Run the checks locally** before you push:

   ```bash
   uv run ruff check .
   uv run pytest
   ```

4. **Push the branch and open a pull request** against `main`:

   ```bash
   git push -u origin product-b/low-stock-filter
   gh pr create --fill
   ```

   Fill in the pull request template. CI runs lint and tests on every pull
   request, and the checks have to be green before merge.

5. **Get a review.** The code owner for the paths you touched is requested
   automatically. Address the comments, then the reviewer (or you, once
   approved) merges.

## House rules

- **No generative AI in Products C and D.** `AGENTS.md` is strict about this:
  the chatbot and the content generator use deterministic logic — decision
  trees, exact matching, string templating — not a model. Pull requests that
  add a model call will be rejected.
- **Don't commit secrets.** The project runs on mock data in `mock_data/`;
  there are no production credentials in this repository and none should be
  added.
- **Keep pull requests small.** One product, one concern, where you can manage
  it. It makes review faster for whoever owns the code.
- **Don't rewrite `main`'s history.** No force pushes to shared branches.

## Getting set up

`README.md` covers running the backend and both frontends locally. In short:

```bash
uv sync
uv run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
```

Then `npm install && npm run dev` inside `apps/customer-app/` (port 5173) or
`apps/staff-dashboard/` (port 5174).
