---
name: pm-to-issues
description: Use when an approved spec needs to be broken into GitHub Issues for development. Triggered when the PM says "to issues", "create issues", "break this into tickets", or after a plan has been grilled and approved. Produces vertical-slice GitHub Issues via `gh issue create`.
credits: |
  Adapted from mattpocock/skills (to-issues)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# PM To Issues

Break an approved spec into vertical-slice GitHub Issues.

## The Rule

Each issue must be a complete vertical slice — it delivers user-visible value from input to output. No horizontal slices ("build the model layer", "write all the tests"). A developer should be able to pick up any single issue and ship it independently.

## Step 1 — Identify Slices

Read the approved spec. For each distinct piece of user-visible behaviour, define one issue:

```
SLICE: {one-sentence user-visible outcome}
SCOPE: {what files/components are touched}
DEPENDS ON: {issue number(s) that must ship first, if any}
SIZE: S / M / L
```

If a slice is L (large), split it further. Target S or M for each issue.

## Step 2 — Write Issues

For each slice, create a GitHub Issue with this format:

```markdown
## What

{1-2 sentence description of the user-visible behaviour being built}

## Why

{which epic this belongs to and why it matters}

## Acceptance Criteria

- [ ] {specific, testable criterion}
- [ ] {specific, testable criterion}
- [ ] {specific, testable criterion}

## Notes

{any implementation notes the developer needs — NOT prescriptive, just constraints}

## Dependencies

{Issue numbers that must merge before this can start, if any}
```

## Step 3 — Create via gh

```bash
gh issue create \
  --title "{slice title}" \
  --body "$(cat <<'EOF'
{issue body from Step 2}
EOF
)" \
  --label "{epic-label}" \
  --assignee "@me"
```

## Step 4 — Link to Epic

After all issues are created, update `docs/product/epic-status.md` with the issue numbers under the relevant epic.

## Step 5 — Report

```
ISSUES CREATED: {count}
EPIC: {epic name}
ISSUES: #{n}, #{n}, #{n}
ORDER: {dependency order for developer to pick up}
```

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `to-issues`  
License: MIT — Copyright (c) 2026 Matt Pocock
