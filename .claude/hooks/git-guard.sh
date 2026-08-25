#!/usr/bin/env bash
# PreToolUse hook for Bash: ask for confirmation before a git command that
# would violate CLAUDE.md non-negotiable #4 ("`main` is protected. Branch, PR,
# green CI, one owner approval. No direct pushes, no force pushes to shared
# branches, no history rewrites.").
#
# That rule is otherwise prose on the honor system. CLAUDE.md already argues
# the other way about agent permissions -- "Each agent's restrictions are
# enforced by its `tools:` frontmatter" -- and the same reasoning applies to
# git: a rule worth writing down is worth mechanizing.
#
# Every branch here emits `ask`, never `deny`. @rhaeyyan holds an admin
# override for emergencies (CONTRIBUTING.md), so the hook's job is to make the
# dangerous case deliberate, not impossible.
set -u

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

[ -z "$cmd" ] && exit 0

# Cheap prefilter: most Bash calls in a session are not git at all.
case "$cmd" in
  *git*) ;;
  *) exit 0 ;;
esac

proj="${CLAUDE_PROJECT_DIR:-$(pwd)}"
branch=$(git -C "$proj" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

reasons=""
add() { reasons="${reasons:+$reasons }$1"; }

# 1. Force push. --force-with-lease is the safe form and passes.
case "$cmd" in
  *git\ push*)
    case "$cmd" in
      *--force-with-lease*) ;;
      *--force*|*' -f '*|*' -f')
        add "git push --force (without --force-with-lease) can silently overwrite a teammate's commits on a shared branch."
        ;;
    esac
    ;;
esac

# 2. Destructive working-tree reset. Worth asking about here specifically
#    because running the app dirties tracked files (mock_data/*.json), so the
#    tree is routinely dirty with work that was never staged.
case "$cmd" in
  *git\ reset*--hard*)
    add "git reset --hard irreversibly discards uncommitted changes -- and this repo's tree is often dirty from JsonDatastore writes."
    ;;
esac

# 3. History rewrite on a branch that has already been pushed.
case "$cmd" in
  *git\ rebase*|*git\ commit*--amend*|*filter-branch*|*filter-repo*)
    if [ -n "$branch" ] && git -C "$proj" rev-parse --verify --quiet "origin/$branch" >/dev/null 2>&1; then
      add "This rewrites history on '$branch', which already exists on origin. Non-negotiable #4 forbids history rewrites on shared branches."
    fi
    ;;
esac

# 4. Committing or pushing while standing on main.
if [ "$branch" = "main" ]; then
  case "$cmd" in
    *git\ commit*)
      add "You are on main. Non-negotiable #4: branch first (CONTRIBUTING.md names the format '<product>/<short-description>')."
      ;;
    *git\ push*)
      add "You are on main and main is protected -- a direct push is rejected server-side. Open a PR instead."
      ;;
  esac
fi

if [ -n "$reasons" ]; then
  python3 -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": sys.argv[1],
    }
}))
' "$reasons"
fi

exit 0
