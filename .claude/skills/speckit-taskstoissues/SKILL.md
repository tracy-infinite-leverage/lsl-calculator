---
name: speckit-taskstoissues
description: Convert tasks.md into dependency-ordered GitHub Issues via the GitHub MCP server. Only proceeds if the git remote is a GitHub URL. Replaces pm-to-issues for spec-driven features.
credits: |
  github/spec-kit — taskstoissues command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before tasks-to-issues conversion)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_taskstoissues` key
- Handle hooks per the optional/mandatory protocol (check enabled flag, skip condition evaluation, output appropriate hook block).
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. Load `.specify/features/{feature_name}/tasks.md` — parse all tasks with their IDs, descriptions, and dependencies.

2. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

3. For each task in the list, use the GitHub MCP server to create a new issue in the repository that matches the Git remote URL.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL

4. Order issues by dependency (create dependencies first).

5. After all issues are created, update `.specify/features/{feature_name}/tasks.md` with the GitHub issue numbers next to each task.

## Post-Execution Checks

**Check for extension hooks (after tasks-to-issues conversion)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.after_taskstoissues` key
- Handle hooks per the optional/mandatory protocol.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently
