---
name: qa-documentation
description: Write QA-REPORT.md to the task's engineering doc folder and update project-status.html with pass/fail status per item.
---

# QA: Documentation

## Per-Task QA Report

Write `QA-REPORT.md` to `docs/engineering/changes/YYYY-MM/YYYY-MM-DD-{task-slug}/`:

```markdown
# QA REPORT: {task name}
Date: YYYY-MM-DD | Result: PASS / FAIL

## Acceptance Criteria Coverage
| AC | Test type | Result |
|----|-----------|--------|

## Automated Tests
| Suite | Tests | Pass | Fail |

## Manual Verification Required
- [ ] item (flag to human)

## Edge Cases Tested

## Known Issues / Follow-ups
```

## Project Status Dashboard Update

Update `docs/project-status.html` under the relevant task:
- ✅ All tests pass — safe to merge
- ❌ Failures — list each with expected vs actual (exact assertion, not "it broke")
- ⚠️ Needs human verification — list what and why

## File Paths

| Artifact | Path |
|----------|------|
| QA report | `docs/engineering/changes/{YYYY-MM}/{YYYY-MM-DD-{slug}}/QA-REPORT.md` |
| Status view | `docs/project-status.html` |
