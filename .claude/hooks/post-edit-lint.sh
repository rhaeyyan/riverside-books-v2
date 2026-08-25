#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: auto-fix the file that was just changed,
# then lint what is left.
#
# CLAUDE.md requires `uv run ruff check .` to be clean before a PR, and CI
# enforces it -- but only after a push. This closes that loop to the edit
# itself. Formatting and import-order nits are fixed silently; only genuine
# violations that survive the auto-fix are sent back (exit 2 feeds stderr to
# Claude as context to fix immediately).
#
# Python goes through `uv run` because CLAUDE.md says the backend is "always
# through uv". TS/TSX goes through the app's own oxlint binary, not eslint --
# `AGENTS.md` says eslint, the package.json scripts and CI actually run oxlint
# (CLAUDE.md, Gotchas). Trust the script.
set -u

input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)

if [ -z "$file" ] || [ ! -f "$file" ]; then
  exit 0
fi

case "$file" in
  */node_modules/*|*/.venv/*|*/dist/*) exit 0 ;;
esac

proj="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Informational notice via additionalContext -- does not interrupt the turn.
emit_reread_notice() {
  python3 -c '
import json, sys
msg = f"{sys.argv[1]} was auto-formatted ({sys.argv[2]}) after your edit; re-read it before further edits, since whitespace, quotes, or import order may have changed."
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": msg}}))
' "$1" "$2"
}

case "$file" in
  *.py)
    command -v uv >/dev/null 2>&1 || exit 0
    before=$(cat "$file")
    (cd "$proj" && uv run ruff format "$file") >/dev/null 2>&1
    (cd "$proj" && uv run ruff check --fix "$file") >/dev/null 2>&1
    after=$(cat "$file")

    if ! out=$(cd "$proj" && uv run ruff check "$file" 2>&1); then
      echo "ruff reported problems in $file that --fix could not resolve. Fix them before moving on:" >&2
      echo "$out" >&2
      exit 2
    fi

    [ "$before" != "$after" ] && emit_reread_notice "$file" "ruff format + ruff check --fix"
    ;;

  *.ts|*.tsx|*.js|*.jsx)
    # Walk up to the nearest package.json so the app's own .oxlintrc.json applies.
    dir=$(dirname "$file")
    while [ "$dir" != "/" ] && [ "$dir" != "." ]; do
      if [ -f "$dir/package.json" ]; then
        oxlint_bin="$dir/node_modules/.bin/oxlint"
        [ -x "$oxlint_bin" ] || exit 0

        before=$(cat "$file")
        (cd "$dir" && "$oxlint_bin" --fix "$file") >/dev/null 2>&1
        after=$(cat "$file")

        if ! out=$(cd "$dir" && "$oxlint_bin" "$file" 2>&1); then
          echo "oxlint reported problems in $file that --fix could not resolve. Fix them before moving on:" >&2
          echo "$out" >&2
          exit 2
        fi

        [ "$before" != "$after" ] && emit_reread_notice "$file" "oxlint --fix"
        exit 0
      fi
      dir=$(dirname "$dir")
    done
    ;;
esac

exit 0
