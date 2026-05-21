---
name: use-dev-team
description: Use when any development work needs to be routed to the right agent on the dev team. Triggered automatically by CLAUDE.md context when the conversation involves planning, coding, testing, or infrastructure work. Also triggered explicitly when the operator says "use dev team", "who handles this", "route this to dev", or "what agent do I need for X". Covers PM, Developer, QA, and DevOps agents.
---

# Use Dev Team

Routing guide for the 4-agent development team.

## Team Roster

| Agent | File | Handles |
|---|---|---|
| **Product Manager** | `~/.claude/agents/product-manager.md` | Epics, specs, plans, issue creation, standup, project-status.html |
| **Developer** | `~/.claude/agents/developer.md` | Implementation, debugging, architecture, code review |
| **QA** | `~/.claude/agents/qa.md` | Test strategy, bug triage, regression reports, QA reports |
| **DevOps** | `~/.claude/agents/devops.md` | CI/CD, infra, pre-commit hooks, git guardrails, deploy pipeline |

## Routing Table

| Task | Agent | Trigger Phrases |
|---|---|---|
| Plan a new feature | PM | "plan", "spec this", "write an epic", "what should we build" |
| Break spec into issues | PM → `pm-to-issues` | "create issues", "break into tickets", "to issues" |
| Validate plan vs project docs | PM → `pm-grill-with-docs` | "validate plan", "check against epics", "grill with docs" |
| Implement anything | Developer | "build", "implement", "code", "write the function", "fix" |
| Debug a bug | Developer → `dev-diagnose` | "debug", "why is this broken", "diagnose" |
| Enter unfamiliar code | Developer → `dev-zoom-out` | "zoom out", "give me context", "what does this module do" |
| Stress-test a plan | Developer → `dev-grill` | "grill me", "stress-test this", "what could go wrong" |
| Strict TDD | Developer → `dev-tdd` | "tdd", "test-driven", "red-green-refactor" |
| Technical spike | Developer → `dev-prototype` | "spike", "prototype", "is this feasible" |
| Architectural improvement | Developer → `dev-improve-arch` | "improve architecture", "refactor this module", "tech debt" |
| Session handoff | Developer → `dev-handoff` | "handoff", "wrapping up", "passing to QA" |
| Bug triage | QA → `qa-triage` | "triage", "classify this bug", "prioritise" |
| Test strategy | QA → `qa-best-practices` | "test strategy", "how to test", "what to test" |
| QA report | QA → `qa-documentation` | "qa report", "write up the QA", "document test results" |
| CI/CD setup | DevOps | "ci/cd", "pipeline", "github actions", "deployment" |
| Pre-commit hooks | DevOps → `devops-setup-pre-commit` | "pre-commit", "husky", "lint-staged" |
| Git guardrails | DevOps → `devops-git-guardrails` | "git hooks", "protect main", "guardrails" |

## Handoff Chain

```
PM (plan + approve)
    ↓
Developer (implement)
    ↓ dev-handoff
QA (test + triage)
    ↓ qa-triage (if bugs found)
Developer (fix)
    ↓
QA (re-verify)
    ↓
merge → Vercel CI/CD
```

## Hard Rules

- **Developer never starts without an approved PM plan.** If no plan exists, route to PM first.
- **QA never skips triage.** Every bug gets classified and scored before routing.
- **DevOps never deploys directly.** All deployments flow through `git push` → CI/CD.
- **No agent merges their own PR.** Developer opens, QA verifies, PM or operator merges.

## Skills Index

```
dev-diagnose      — structured debug loop
dev-zoom-out      — module context before changes
dev-grill         — adversarial plan interrogation
dev-handoff       — session/agent handoff doc
dev-tdd           — red-green-refactor discipline
dev-prototype     — throwaway spike for unknowns
dev-improve-arch  — strategic module improvement
pm-grill-with-docs — validate plan vs project docs
pm-to-issues      — spec → GitHub Issues
qa-triage         — bug classify → score → route
devops-setup-pre-commit — Husky + lint-staged + Prettier
devops-git-guardrails   — Claude Code git safety hooks
```
