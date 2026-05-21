---
name: dev-qa-delegation
description: Call QA after implementation, fix bugs from QA reports, trigger PR review, merge after QA sign-off. Complete the development cycle.
---

# Developer: QA Delegation

## Workflow
1. **Call QA** once implementation is complete:
   - Invoke `@qa` with a summary of what was built and where the files are
   - QA runs tests and updates `docs/project-status.html` with pass/fail results
2. **If QA finds bugs**: fix each → re-invoke `@qa` → repeat until 100% clean
3. **Refactor and rebase**:
   - `git checkout main && git pull origin main`
   - `git checkout feat/{branch} && git merge main` (resolve conflicts if any)
   - `git push origin feat/{branch}`
4. **Write CHANGELOG.md** once QA is green:
   - Files created, files modified, DB changes, env vars added, breaking changes
   - Append one line to YYYY-MM-summary.md
5. **Open a PR**: `gh pr create --title "[task]" --body "Closes [plan item]. QA: all tests green."`
6. **Trigger QA PR review**: `@qa "PR review: [URL]. Review diff for correctness, regressions, code quality. Return PASS or FAIL."`
7. **If QA PR review returns FAIL**: fix → push → re-invoke → repeat until PASS
8. **Merge**: `gh pr merge [URL] --squash --delete-branch` — Vercel CI/CD auto-deploys
9. **Finalize**: Mark items 🟢 Done in `docs/project-status.html`, record what shipped

## File Paths
| Artifact | Path |
|----------|------|
| QA results | `docs/project-status.html` |
| CHANGELOG | `docs/engineering/changes/.../CHANGELOG.md` |
| Summary | `docs/engineering/changes/YYYY-MM/YYYY-MM-summary.md` |
| PR | GitHub PR interface |
