---
name: dev-improve-arch
description: Use when a module needs strategic architectural improvement beyond a point fix. Triggered when the developer says "improve the architecture", "this module is a mess", "we should refactor this properly", or when the PM flags tech debt as a priority. Scans the domain, inventories friction points, ranks improvements, and requires approval before executing any one.
credits: |
  Adapted from mattpocock/skills (improve-codebase-architecture)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Improve Arch

Domain scan → friction inventory → ranked improvements → approve one at a time.

## Step 1 — Domain Scan

Read the module without judging it. Understand it as it is.

- What is the module's responsibility?
- What patterns does it use? (classes, functions, hooks, services, etc.)
- What are its dependencies — inbound (callers) and outbound (deps)?
- How old is the code? (`git log --oneline -- {path} | tail -5`)
- What has changed most recently? (`git log --oneline -10 -- {path}`)

Do not propose changes yet.

## Step 2 — Friction Inventory

List every source of friction you observe. One item per line:

```
FRICTION: {description}
TYPE: complexity / coupling / duplication / naming / missing-abstraction / over-abstraction / performance
IMPACT: high / medium / low
EFFORT: high / medium / low
```

Examples:
- "UserService has 12 methods mixing auth logic with profile logic"
- "DB queries duplicated across 4 different files"
- "Function names don't match what the functions actually do"

## Step 3 — Rank

For each friction item, compute a priority score:

```
Priority = (Impact × 2) + (1 / Effort)
```

Sort highest to lowest. Present the top 5.

## Step 4 — Propose One Improvement

Present only the highest-priority improvement with a concrete plan:

```
IMPROVEMENT: {name}
PROBLEM: {what's wrong now}
SOLUTION: {what it looks like after}
FILES AFFECTED: {list}
RISKS: {what could break}
ROLLBACK: {how to undo if it goes wrong}
ESTIMATED EFFORT: {hours / days}
```

Do not proceed without explicit approval.

## Step 5 — Implement (Approved Only)

Once approved:

1. Use `dev-zoom-out` on the affected module before touching any code.
2. Implement the change as a single focused PR — no scope creep.
3. All existing tests must pass after the refactor.
4. Update `docs/engineering/` with a change record.

After completion, return to Step 3 and present the next highest-priority improvement. One at a time.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `improve-codebase-architecture`  
License: MIT — Copyright (c) 2026 Matt Pocock
