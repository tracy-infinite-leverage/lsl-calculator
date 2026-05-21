---
name: devops-git-guardrails
description: Use when setting up a project to block dangerous git commands from Claude Code. Triggered when the DevOps agent says "git guardrails", "add git hooks for claude", "protect main branch", or during initial project setup. Installs Claude Code PreToolUse hooks that intercept and block force push, reset --hard, branch -D main, git add ., and --amend on published commits.
credits: |
  Adapted from mattpocock/skills (git-guardrails-claude-code)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# DevOps Git Guardrails

Claude Code hooks that block dangerous git commands before they execute.

## What Gets Blocked

| Command Pattern | Why |
|---|---|
| `git push --force` / `git push -f` | Overwrites remote history — can destroy teammates' work |
| `git reset --hard` | Discards uncommitted changes without recovery |
| `git branch -D main` / `git branch -D master` | Deletes the main branch |
| `git add .` / `git add -A` | Stages everything including secrets and generated files |
| `git commit --amend` on a pushed commit | Rewrites published history |

## Installation

Write the following to `.claude/settings.json` (project-level) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/git-guardrails.sh"
          }
        ]
      }
    ]
  }
}
```

Create `.claude/hooks/git-guardrails.sh`:

```bash
#!/usr/bin/env bash
# Git guardrails for Claude Code
# Reads the command from stdin as JSON and blocks dangerous patterns.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

block() {
  echo "BLOCKED: $1" >&2
  echo '{"decision":"block","reason":"'"$1"'"}' 
  exit 0
}

# Block force push
if echo "$COMMAND" | grep -qE 'git push.*(--force|-f)\b'; then
  block "Force push is not allowed. Use a PR and merge instead."
fi

# Block reset --hard
if echo "$COMMAND" | grep -qE 'git reset --hard'; then
  block "git reset --hard discards uncommitted work. Use git stash or git restore instead."
fi

# Block deleting main/master branch
if echo "$COMMAND" | grep -qE 'git branch -D (main|master)'; then
  block "Deleting the main/master branch is not allowed."
fi

# Block git add . or git add -A
if echo "$COMMAND" | grep -qE 'git add (\.|(-A))(\s|$)'; then
  block "git add . / git add -A stages everything including secrets. Stage files by name."
fi

# Block amend (warn — do not hard block, as local amends before push are valid)
if echo "$COMMAND" | grep -qE 'git commit --amend'; then
  # Check if HEAD is already on remote
  BRANCH=$(git branch --show-current 2>/dev/null)
  if git log "origin/$BRANCH..HEAD" 2>/dev/null | grep -q .; then
    : # Commit not yet pushed — amend is OK
  else
    block "git commit --amend on a pushed commit rewrites public history. Create a new commit instead."
  fi
fi

# All checks passed
echo '{"decision":"allow"}'
exit 0
```

Make executable:

```bash
chmod +x .claude/hooks/git-guardrails.sh
```

## Verify

Test that the hook fires:

```bash
echo '{"tool_input":{"command":"git push --force origin main"}}' | bash .claude/hooks/git-guardrails.sh
# Expected: BLOCKED message + JSON decision:block
```

## Commit

```bash
git add .claude/hooks/git-guardrails.sh .claude/settings.json
git commit -m "chore: add Claude Code git guardrail hooks"
```

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `git-guardrails-claude-code`  
License: MIT — Copyright (c) 2026 Matt Pocock
