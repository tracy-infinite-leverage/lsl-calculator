---
name: dev-diagnose
description: Use when a bug surfaces and the root cause is not obvious. Triggered when the developer says "diagnose this", "I can't figure out why", "this is broken and I don't know why", or when a bug is confirmed but the cause is unclear. Runs a structured debug loop: reproduce → minimise → hypothesise → instrument → fix → gate.
credits: |
  Adapted from mattpocock/skills (diagnose)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Diagnose

Structured debug loop for bugs with non-obvious causes.

## Phase 1 — Reproduce

Before anything else: confirm the bug is reproducible.

1. State the exact failing behaviour (symptom, not guess).
2. Write the minimal reproduction: one test, one command, one curl — whatever isolates the failure.
3. If you cannot reproduce it, stop. Ask for steps to reproduce before continuing.

## Phase 2 — Minimise

Strip the reproduction down to its smallest possible form.

- Remove all code not needed to trigger the failure.
- Remove all data not needed to trigger the failure.
- If the bug disappears during minimisation, the removed code is the cause — inspect it.

## Phase 3 — Hypothesise

Generate 3–5 distinct hypotheses. For each:

- State the assumed mechanism.
- State what evidence would confirm it.
- State what evidence would rule it out.

Rank by likelihood. Do not skip low-probability hypotheses — they catch blind spots.

## Phase 4 — Instrument

Add targeted observability to confirm or rule out each hypothesis:

- Prefer log statements at decision points over debugger stepping.
- One hypothesis per instrument run — do not change multiple things at once.
- Record what you observed and which hypotheses it eliminates.

## Phase 5 — Fix

Once the root cause is confirmed:

1. Write the fix as the minimal change that addresses the root cause.
2. Do not refactor surrounding code as part of the fix.
3. Verify the reproduction from Phase 1 no longer fails.
4. Check for other call sites where the same bug could exist.

## Phase 6 — Gate

Before closing:

- [ ] The original reproduction passes.
- [ ] No new failures introduced (run the test suite).
- [ ] Root cause is documented in the commit message or PR description.
- [ ] Instrument code (logs, debug statements) removed.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `diagnose`  
License: MIT — Copyright (c) 2026 Matt Pocock
