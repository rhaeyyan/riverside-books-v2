"""Check the running API against the contract written in ``docs/PRD.md`` §6–7.

CLAUDE.md non-negotiable #2 says PRD §5–7 is a contract, and names the exact
reason it needs a mechanical check:

    Renaming a model field or changing an endpoint shape breaks another
    teammate's product at runtime with no compile error.

Nothing else in the suite notices that. Ruff does not read Markdown, pytest
asserts against the code rather than the document, and the four products only
find out at demo time. This script closes that gap by comparing two things that
are supposed to agree:

* the field tables in §6.1–6.6 against the Pydantic models in
  ``backend/api/models.py``;
* the route table in §7 against the routes FastAPI actually registers.

It is deliberately narrow. It compares *names* -- field names and
method/path pairs -- because those are unambiguous and are what break a
consumer at runtime. It does not try to parse the Type or Notes columns:
"`0`–`9`. Rolls to a reward at 10" is prose, and a checker that guessed at it
would be wrong often enough to be ignored.

Usage::

    uv run python -m scripts.check_contract          # report, exit 1 on drift
    uv run python -m scripts.check_contract --quiet  # silent when clean

Exit 0 = the code and the PRD agree (modulo ACCEPTED below). Exit 1 = drift.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PRD_PATH = REPO_ROOT / "docs" / "PRD.md"

# PRD §6 section heading -> the model that implements it.
SECTION_TO_MODEL = {
    "6.1": "Book",
    "6.2": "Customer",
    "6.3": "Order",
    "6.4": "Event",
    "6.5": "StoreInfo",
    "6.6": "Message",
    "6.8": "StaffMember",
}

# Drift that is real, understood, and deliberately not "fixed" by editing one
# side to match the other. Every entry needs a reason; an unexplained entry is
# just a silenced check. Same idea as the "known drift" section of the
# design-system skill.
ACCEPTED: dict[str, str] = {
    "field:Book.available_count": (
        "Derived, not stored. §7 documents it under 'Derived fields' prose "
        "rather than in the §6.1 table, because it never appears in the JSON."
    ),
    "field:Book.stock_status": "Same as available_count -- derived per §5.4/§5.6.",
    "field:Customer.password_hash": (
        "Deliberately absent from the Customer model (§5.3, §6.2 v0.5): it's a "
        "real DB column, documented in the §6.2 table so a reader knows it "
        "exists, but never a field on the Pydantic model any API response "
        "uses -- so response_model cannot leak it even by omission of an "
        "explicit exclude. §6's own definition of scope ('field names in the "
        "API and in every product') doesn't cover it either way."
    ),
    "field:StaffMember.password_hash": (
        "Same reasoning and same deliberate omission as "
        "field:Customer.password_hash above, for the §6.8 staff table."
    ),
}


def _accept(key: str) -> bool:
    return key in ACCEPTED


def parse_prd_fields() -> dict[str, set[str]]:
    """Return ``{section: {field, ...}}`` for each §6.N data-model table.

    Field cells are not always a single name: §6.5 and §6.6 group related
    columns as ``` `name`, `address`, `phone`, `email` ```. Every backticked
    identifier in the first cell counts.
    """
    text = PRD_PATH.read_text(encoding="utf-8")
    sections: dict[str, set[str]] = {}
    current: str | None = None

    for line in text.splitlines():
        heading = re.match(r"^###\s+(6\.\d)\b", line)
        if heading:
            current = heading.group(1)
            if current in SECTION_TO_MODEL:
                sections[current] = set()
            continue
        if re.match(r"^#{2,3}\s", line):
            current = None
            continue
        if current not in sections:
            continue

        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if (
            len(cells) < 2
            or cells[0] in {"Field", "---"}
            or set(cells[0]) <= {"-", ":"}
        ):
            continue
        names = re.findall(r"`([a-z_][a-z0-9_]*)`", cells[0])
        sections[current].update(names)

    return sections


def parse_prd_routes() -> set[tuple[str, str]]:
    """Return ``{(METHOD, path), ...}`` from the §7 API contract table.

    §7 writes paths without the ``/api`` prefix ("All routes are prefixed
    ``/api``"), which ``main.py`` supplies via ``include_router``. Normalise to
    the full path so both sides are directly comparable.
    """
    text = PRD_PATH.read_text(encoding="utf-8")
    body = text.split("## 7. API Contract", 1)
    if len(body) < 2:
        raise SystemExit(
            "check_contract: could not find '## 7. API Contract' in the PRD"
        )
    body = body[1].split("\n## ", 1)[0]

    routes: set[tuple[str, str]] = set()
    for line in body.splitlines():
        m = re.match(r"^\|\s*`(GET|POST|PATCH|PUT|DELETE)`\s*\|\s*`([^`]+)`\s*\|", line)
        if m:
            routes.add((m.group(1), "/api" + m.group(2)))
    return routes


def collect_code_fields() -> dict[str, set[str]]:
    """Return ``{ModelName: {field, ...}}``, including Pydantic computed fields."""
    from backend.api import models

    out: dict[str, set[str]] = {}
    for name in set(SECTION_TO_MODEL.values()):
        model = getattr(models, name, None)
        if model is None:
            out[name] = set()
            continue
        out[name] = set(model.model_fields) | set(model.model_computed_fields)
    return out


def collect_code_routes() -> set[tuple[str, str]]:
    """Return ``{(METHOD, path), ...}`` for every registered ``/api`` route.

    Read from the generated OpenAPI schema rather than by walking ``app.routes``.
    Two reasons, one practical and one principled. Practically, FastAPI 0.141 /
    Starlette 1.6 stopped flattening ``include_router`` calls into ``app.routes``
    -- they appear as opaque ``_IncludedRouter`` objects -- so a tree walk breaks
    on a dependency bump. Principled: the schema *is* the published surface. It is
    what ``npm run gen:types`` turns into ``src/api/types.ts`` for both frontends,
    so it is the same artefact the other products actually consume.
    """
    from backend.api.main import app

    routes: set[tuple[str, str]] = set()
    for path, operations in app.openapi().get("paths", {}).items():
        if not path.startswith("/api/"):
            continue
        for method in operations:
            if method.upper() in {"HEAD", "OPTIONS", "TRACE"}:
                continue
            routes.add((method.upper(), path))
    return routes


def main(argv: list[str]) -> int:
    quiet = "--quiet" in argv
    problems: list[str] = []

    prd_fields = parse_prd_fields()
    code_fields = collect_code_fields()

    for section, model_name in sorted(SECTION_TO_MODEL.items()):
        documented = prd_fields.get(section, set())
        if not documented:
            problems.append(
                f"§{section}: no field table found in the PRD (did the heading move?)"
            )
            continue
        implemented = code_fields.get(model_name, set())

        for field in sorted(documented - implemented):
            key = f"field:{model_name}.{field}"
            if not _accept(key):
                problems.append(
                    f"§{section} documents `{field}`, but {model_name} does not "
                    f"define it. A consumer reading that field gets nothing."
                )
        for field in sorted(implemented - documented):
            key = f"field:{model_name}.{field}"
            if not _accept(key):
                problems.append(
                    f"{model_name} defines `{field}`, but §{section} does not "
                    f"document it. Other products cannot rely on a field the "
                    f"contract omits."
                )

    prd_routes = parse_prd_routes()
    code_routes = collect_code_routes()

    for method, path in sorted(prd_routes - code_routes):
        key = f"route:{method} {path}"
        if not _accept(key):
            problems.append(
                f"§7 documents `{method} {path}`, but the API does not serve it."
            )
    for method, path in sorted(code_routes - prd_routes):
        key = f"route:{method} {path}"
        if not _accept(key):
            problems.append(
                f"The API serves `{method} {path}`, but §7 does not document it."
            )

    if problems:
        print("PRD contract drift (docs/PRD.md §6-7 vs. the code):\n", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print(
            "\nNon-negotiable #2: propose the change, do not just make it.\n"
            "Either update the PRD (with @rhaeyyan's review, since §5-7 is\n"
            "shared) or bring the code back in line. If the drift is deliberate\n"
            "and permanent, add it to ACCEPTED in scripts/check_contract.py\n"
            "with the reason.",
            file=sys.stderr,
        )
        return 1

    if not quiet:
        n = sum(len(v) for v in prd_fields.values())
        print(
            f"PRD contract OK: {n} documented fields and "
            f"{len(prd_routes)} routes all match."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
