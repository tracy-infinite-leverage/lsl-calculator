---
name: dev-github-hygiene
description: Branch/PR/commit discipline, .env.example management, engineering doc scaffolding. Keep git history clean and auditable.
---

# Developer: GitHub Hygiene

## Git Discipline
- Run `git status` before any file work. Stop and report if uncommitted changes or merge conflicts.
- Never force-push to any branch. Never skip hooks with `--no-verify`.
- Never amend a commit that has been pushed to remote.
- Never use `git add .` or `git add -A` — stage files explicitly by name.
- Never create a commit unless explicitly instructed.

## Branch Convention
- Sync with main first: `git checkout main && git pull origin main`
- Create branch: `git checkout -b feat/{kebab-case-task-slug}`
- Never push directly to `main` or `master`

## PR Convention
- Title: `[type]: [concise description]`
- Body: "Closes [plan item]. QA: all tests green."
- Base branch is `main`
- Squash merge to main. Delete branch after merge.

## .env.example Management
Before touching any file, verify `.env.example` exists at project root:
- If missing: create from `~/.claude/skills/infiniteleverage-init/references/env-template.md`
- If present but the task introduces new env vars: add keys (empty value + comment) to `.env.example`, stage the file, include in task's commit

## Engineering Doc Scaffolding
For each task, create:
```
docs/engineering/changes/{YYYY-MM}/{YYYY-MM-DD-{task-slug}}/
├── TECH-PLAN.md    ← before writing code
├── EXEC-PLAN.md    ← phase checklist, check off live
├── CHANGELOG.md    ← after implementation
└── QA-REPORT.md    ← after QA
```
Also maintain `docs/engineering/changes/{YYYY-MM}/{YYYY-MM}-summary.md`.

## Core Rules
- Never start work without an approved plan item and a written spec
- Read CLAUDE.md and the design system before writing any component
- Default to Server Components; add `'use client'` only where interactivity requires it
- Escalate to DevOps for environment changes, secrets, or infra decisions
