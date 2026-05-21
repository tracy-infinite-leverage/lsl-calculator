---
name: pm-constitution-sync
description: After speckit-constitution writes .specify/memory/constitution.md, copy it to docs/product/constitution.md so it sits alongside product.md and epics.md. Run once per project during initial setup, or any time the constitution is updated.
---

# PM Constitution Sync

Syncs the spec-kit constitution to the canonical product docs location.

## Why

spec-kit writes the constitution to `.specify/memory/constitution.md`. Our product docs live under `docs/product/`. Keeping a copy there means the PM agent, developer agent, and any human reviewer can find the constitution alongside `product.md`, `epics.md`, and `epic-status.md` without knowing the `.specify/` structure.

## Step 1 — Verify Source Exists

Confirm `.specify/memory/constitution.md` exists and was written by speckit-constitution. If missing, stop and remind the operator to run speckit-constitution first.

## Step 2 — Run speckit-constitution (if not already run)

If `.specify/memory/constitution.md` does not exist, invoke speckit-constitution to create it. Use `docs/product/product.md` as the primary context source for project name, description, and principles.

## Step 3 — Copy to Product Docs

```bash
cp .specify/memory/constitution.md docs/product/constitution.md
```

## Step 4 — Commit Both

```bash
git add .specify/memory/constitution.md docs/product/constitution.md
git commit -m "docs(constitution): establish project constitution v{version}"
```

## Step 5 — Confirm

Print:
```
✅ Constitution synced
   Source : .specify/memory/constitution.md
   Copy   : docs/product/constitution.md
   Version: {version from constitution}
```
