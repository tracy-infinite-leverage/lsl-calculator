---
name: dev-planning
description: Read project-status.html and epic-status.md to identify approved items and open bugs, then draft a daily plan under docs/plans/. If called with a spec path, routes to dev-feature-plan instead of the daily planning workflow.
---

# Developer: Planning from Project Status

## Feature mode gate

**Check first**: was this skill invoked with a spec path argument (e.g. `.specify/features/{slug}/spec.md`)?

- **Yes — spec path provided**: invoke **dev-feature-plan** with that spec path. Stop here — do not run the daily planning workflow below.
- **No spec path**: run the daily planning workflow below.

---

## Daily planning workflow

### Inputs
- `docs/project-status.html` — approved items in today's plan
- `docs/product/epic-status.md` — bugs, outstanding items per epic

### Workflow
1. Read `docs/project-status.html` — identify items marked "approved" in today's plan
2. Read `docs/plans/{today}.md` — confirm approval status. If no approved plan exists: stop and notify stakeholder, do not proceed.
3. Draft `docs/plans/plan-{index}-{YYYY-MM-DD}.md`:

```markdown
# Plan #{index} — YYYY-MM-DD

## Approved Items
| # | Item | Epic | Risk | Assigned |
|---|------|------|------|----------|

## Bugs to Fix
| # | Bug | Epic | Severity |

## Definition of Done for Each Item
```

4. Present the plan for confirmation before executing.

### File Paths
| Artifact | Path |
|----------|------|
| Input (project status) | `docs/project-status.html` |
| Input (epic status) | `docs/product/epic-status.md` |
| Output (daily plan) | `docs/plans/plan-{index}-{YYYY-MM-DD}.md` |
