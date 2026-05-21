---
name: speckit-git-commit
description: Auto-commit spec-kit artifacts after a command completes. All auto-commits are DISABLED by default in git-config.yml to respect global-engineering.md rules. Only enables if the operator explicitly sets enabled:true per command in .specify/extensions/git/git-config.yml.
credits: |
  github/spec-kit — git extension, speckit.git.commit command
  Source: https://github.com/github/spec-kit
  License: MIT
---

# Auto-Commit Changes

Automatically stage and commit changes after a spec-kit command completes.

## IMPORTANT — Default Behaviour

All auto-commits are **disabled by default** in `.specify/extensions/git/git-config.yml`.

This respects the project engineering rule: never create a commit unless explicitly instructed. An operator must explicitly set `enabled: true` for a specific command in `git-config.yml` to activate auto-commit for that step.

## Behavior

This command is invoked as a hook after (or before) core commands. It:

1. Determines the event name from the hook context (e.g., if invoked as an `after_specify` hook, the event is `after_specify`)
2. Checks `.specify/extensions/git/git-config.yml` for the `auto_commit` section
3. Looks up the specific event key to see if auto-commit is enabled
4. Falls back to `auto_commit.default` if no event-specific key exists
5. Uses the per-command `message` if configured, otherwise a default message
6. If enabled and there are uncommitted changes, runs `git add .` + `git commit`

## Execution

Determine the event name from the hook that triggered this command, then run the script if available:

- **Bash**: `.specify/extensions/git/scripts/bash/auto-commit.sh <event_name>`

If the script is not available, fall back to:

```bash
# Only runs if enabled in git-config.yml for this event
git add .specify/features/ .specify/memory/
git commit -m "[spec-kit] {event_name}: {configured message or default}"
```

## Configuration

In `.specify/extensions/git/git-config.yml`:

```yaml
auto_commit:
  default: false          # Global toggle — false means disabled for all commands
  after_specify:
    enabled: false
    message: "[spec-kit] Add specification"
  after_plan:
    enabled: false
    message: "[spec-kit] Add implementation plan"
  after_tasks:
    enabled: false
    message: "[spec-kit] Add task list"
```

## Graceful Degradation

- If Git is not available or the current directory is not a repository: skips with a warning
- If no config file exists: skips (disabled by default)
- If no changes to commit: skips with a message
