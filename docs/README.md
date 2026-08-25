# Documentation

Suite-wide documentation for Riverside Books. These documents cover all four
products — they are not owned by any single product workstream.

| Document | What it is | Status |
| --- | --- | --- |
| [`PRD.md`](PRD.md) | Product requirements for the whole suite. §5–7 (shared architecture, data model, API contract) are **binding contracts** — changing a field name or endpoint shape there breaks another product silently, so those sections need agreement from all four owners. §8.A–8.D are owned one per teammate. | Authoritative |
| [`implementation_plan.md`](implementation_plan.md) | The build order that turns the PRD into the working suite, phase by phase. The PRD is the spec; this is the sequence. | Completed |
| [`market_strategy.md`](market_strategy.md) | Competitor and market research for Product D's marketing generator. | Research, see note below |

The project brief the suite was built from is [`../Cycle 4_ Project briefs.md`](../Cycle%204_%20Project%20briefs.md).
Repository layout and the toolchain rules live in [`../AGENTS.md`](../AGENTS.md);
[`../CONTRIBUTING.md`](../CONTRIBUTING.md) covers the branch, review, and merge flow.

## A note on `market_strategy.md`

Its competitor research is sound and worth keeping, but its "Product decisions
and team dependencies" table was written against a different architecture and
contradicts the PRD in three places: it assumes a shared Supabase project as the
data source, a configurable model provider for generation, and authenticated
staff users. The PRD rules out all three — see §2.2 (Non-Goals), §5.2
(persistence), §5.3 (identity), and §5.5 (determinism). Read the research; treat
that table as historical.
