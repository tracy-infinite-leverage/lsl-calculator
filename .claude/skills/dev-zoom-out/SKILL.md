---
name: dev-zoom-out
description: Use when entering an unfamiliar module or codebase section before making changes. Triggered when the developer says "zoom out", "give me context on this module", "I'm new to this area", or when the PM assigns work in a part of the codebase the developer hasn't touched recently. Produces a 1-page module summary.
credits: |
  Adapted from mattpocock/skills (zoom-out)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Zoom Out

Module context protocol. Run before making changes in unfamiliar territory.

## Step 1 — Public Surface

Read the module's exports and entry points.

- What does this module expose? (functions, classes, types, constants)
- What are the primary entry points a caller would use?
- What does it explicitly NOT expose? (private internals)

## Step 2 — Callers

Find who depends on this module.

```bash
grep -r "from.*{module-name}" src/ --include="*.ts" -l
```

- List the top 5 callers by import frequency.
- Note any callers that use the module in unexpected ways.

## Step 3 — Data Flow

Trace the primary data flow through the module.

- What comes in? (input types, external deps, config)
- What transformations happen internally?
- What goes out? (output types, side effects, events)

## Step 4 — Invariants

Identify the assumptions this module makes:

- What must be true for this module to work correctly?
- What would cause it to silently produce wrong output?
- What error conditions does it explicitly handle vs ignore?

## Step 5 — 1-Page Summary

Write a concise summary (max 1 page / ~300 words):

```
MODULE: {name}
PURPOSE: {one sentence}
ENTRY POINTS: {list}
KEY CALLERS: {list}
DATA FLOW: {input → transform → output}
INVARIANTS: {list}
DANGER ZONES: {areas where bugs are likely}
SAFE TO CHANGE: {list of isolated, low-risk areas}
```

Use this summary as context before writing any code in this module.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `zoom-out`  
License: MIT — Copyright (c) 2026 Matt Pocock
