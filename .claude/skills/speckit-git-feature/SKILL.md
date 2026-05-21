---
name: speckit-git-feature
description: Create and switch to a new git feature branch with sequential (001-feature-name) or timestamp numbering before specification begins. Triggered automatically via before_specify hook when .specify/extensions/git/extension.yml is configured.
credits: |
  github/spec-kit — git extension, speckit.git.feature command
  Source: https://github.com/github/spec-kit
  License: MIT
---

# Create Feature Branch

Create and switch to a new git feature branch for the given specification. This command handles **branch creation only** — the spec directory and files are created by the core `speckit-specify` workflow.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Environment Variable Override

If the user explicitly provided `GIT_BRANCH_NAME` (e.g., via environment variable, argument, or in their request), pass it through to the script by setting the `GIT_BRANCH_NAME` environment variable before invoking the script. When `GIT_BRANCH_NAME` is set:
- The script uses the exact value as the branch name, bypassing all prefix/suffix generation
- `--short-name`, `--number`, and `--timestamp` flags are ignored
- `FEATURE_NUM` is extracted from the name if it starts with a numeric prefix, otherwise set to the full branch name

## Prerequisites

- Verify Git is available by running `git rev-parse --is-inside-work-tree 2>/dev/null`
- If Git is not available, warn the user and skip branch creation

## Branch Numbering Mode

Determine the branch numbering strategy by checking configuration in this order:

1. Check `.specify/extensions/git/git-config.yml` for `branch_numbering` value
2. Default to `sequential` if config does not exist

## Execution

Generate a concise short name (2-4 words) for the branch:
- Analyze the feature description and extract the most meaningful keywords
- Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug")
- Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)

Run the appropriate script if available:

- **Bash**: `.specify/extensions/git/scripts/bash/create-new-feature.sh --json --short-name "<short-name>" "<feature description>"`
- **Bash (timestamp)**: `.specify/extensions/git/scripts/bash/create-new-feature.sh --json --timestamp --short-name "<short-name>" "<feature description>"`

**If the script is not available**, fall back to basic git commands:

```bash
# Sequential fallback — scan existing branches for highest number
NEXT_NUM=$(git branch --list '[0-9][0-9][0-9]-*' | wc -l | tr -d ' ')
NEXT_NUM=$(printf "%03d" $((NEXT_NUM + 1)))
BRANCH_NAME="${NEXT_NUM}-<short-name>"
git checkout -b "$BRANCH_NAME"
echo "✅ Created branch: $BRANCH_NAME"
```

**IMPORTANT**:
- You must only ever run branch creation once per feature
- The JSON output (when script is available) will contain `BRANCH_NAME` and `FEATURE_NUM`

## Graceful Degradation

If Git is not installed or the current directory is not a Git repository:
- Branch creation is skipped with a warning: `[specify] Warning: Git repository not detected; skipped branch creation`
- Continue with spec creation on the current branch
