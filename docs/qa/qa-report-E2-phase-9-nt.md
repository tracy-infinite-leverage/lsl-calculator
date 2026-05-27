# QA Report — E2 Phase 9 NT engine

**Date**: 2026-05-27
**Phase**: E2 Phase 9 — NT (Northern Territory) LSL engine
**Verdict**: ✅ **PASS — Phase 9 ships.** Both PR [#40](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/40) (engine T9.1+T9.2) and PR [#43](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/43) (fixtures + UI + doc amendments) merged to main. CI green end-to-end across the full matrix; no P0 / P1 issues surfaced.

**Main HEAD**: `217a04c` (post-#43 squash-merge).

---

## Context — two-PR phase

NT Phase 9 shipped via two coordinated PRs after a parallel-thread coordination incident (full trail in `docs/engineering/changes/2026-05-27-e2-phase-9-nt-engine/HANDOFF.md`):

- **PR #40** (`b3a0440`) — NT engine T9.1+T9.2 combined: orchestrator, rules (per-year `RP × HWW × 1.3` formula, Age Pension age lookup, s.10(1A) complete-blocks-only misconduct, casual continuity, public holidays, trigger handlers), continuous-service walker, 7 `extraInputs.nt_*` keys, advisory codes, dispatch wiring.
- **PR #43** (`217a04c`) — Fixtures + UI + doc amendments: 78 fixtures (75 single + 3 bulk) retuned against #40's engine, 7 NT-conditional form fields, 41 NT warning labels in `result-panel.tsx` (10 added during cross-engine audit), dynamic `ENCODED_STATES` layout meta-description, e2e canary update, `UI_SHIPPED_STATES` gate flip, 4 universal doc amendments.

A third PR #41 (a parallel session's full T9.1–T9.5 pipeline with its own engine) was closed without merging — superseded by the #40 + #43 combination. See `HANDOFF.md` for the full coordination trail and the lessons-learned recommendations for the playbook.

---

## Verification evidence

### CI matrix (PR #43 final run, pre-merge)

All 11 required + informational checks green against HEAD `72e410a` (PR #43's last commit with the `UI_SHIPPED_STATES` flip):

| Check | Result | Notes |
|---|---|---|
| TypeScript · Vitest · Build | ✅ SUCCESS | `tsc --noEmit` clean; `vitest run` 2214/2214 green; `next build` succeeds |
| State suite · nsw | ✅ SUCCESS | NSW E1 regression untouched |
| State suite · vic | ✅ SUCCESS | VIC Phase 3 regression untouched |
| State suite · qld | ✅ SUCCESS | QLD Phase 4 regression untouched |
| State suite · wa | ✅ SUCCESS | WA Phase 5 regression untouched |
| State suite · sa | ✅ SUCCESS | SA Phase 6 regression untouched |
| State suite · act | ✅ SUCCESS | ACT Phase 7 regression untouched |
| State suite · engine | ✅ SUCCESS | Engine-layer suite (dispatch, decimal, dates, types) — includes 78 new NT fixture assertions |
| Cross-state regression (engine-touching PRs) | ✅ SUCCESS | Full LSL suite passes against the merged engine surface |
| Playwright (chromium · webkit · firefox · mobile-chrome) | ✅ SUCCESS | All 4 browsers green; e2e canary asserts NT now renders without "(coming soon)" and the global "no remaining coming-soon" invariant holds |
| Vercel Preview Comments | ✅ SUCCESS | Preview deploy reachable at `lsl-calculator-git-feat-e2-phase-9-nt-delta-infiniteleverage-2.vercel.app` |

### Post-merge main CI

| Run | Result |
|---|---|
| Workflow run `26492324624` against main `217a04c` | ✅ SUCCESS — all required checks pass on the merge commit |

### Local vitest (NT scope)

- **78 fixtures pass (330 assertions)**: 75 single-mode (TC-NT-001 → TC-NT-075) + 3 bulk-mode (TC-NT-BULK-001/002/003).
- **Full LSL suite**: 2214/2214 pass — no regression introduced by either PR.
- **tsc clean**, **ESLint clean** on touched files.

---

## Test plan walk-through

### Fixture spot-checks (covered by vitest CI runs against PR #43's HEAD)

| Test ID | Coverage | Status |
|---|---|---|
| TC-NT-001 | 10y FT smoke ($13,000 / 13 weeks) | ✅ PASS |
| TC-NT-023 → 026 | s.10(1A) misconduct block-truncation (9.5y → $0; 12.5y → 10y block; 16y → 15y block; exactly-10y → 10y block) | ✅ PASS — all 4 fixtures green |
| TC-NT-058 | 13y FT varying hours (20→30→38 hr/wk) per-year formula | ✅ PASS — blended `valueOfWeek = $1,789.19`, `totalDollars = $30,242.11`, 16.9023 weeks |
| TC-NT-064 → 066 | Cash-out FORBIDDEN hard-stop (`status: 'failed'`, `error.code: 'nt_cashout_forbidden_s10_4'`) | ✅ PASS — all 3 fixtures green |
| TC-NT-067 → 068 | Death pathway (s.10(3) cross-ref s.10(1) + s.10(2) — 7–10y pro-rata; 10+y full) | ✅ PASS |
| TC-NT-070 | Related-corp aggregation (5y physical + 5y related-corp = 10y aggregated → full payout) | ✅ PASS — `valueOfWeek = $1,500.00` matching `currentWeeklyGross` |
| TC-NT-BULK-001 | 5-employee NT-only mixed tenures + triggers | ✅ PASS |
| TC-NT-BULK-002 | 10-employee mixed NSW + VIC + QLD + WA + SA + ACT + TAS + NT | ✅ PASS |
| TC-NT-BULK-003 | Mixed-state per-year-formula + retirement-age matrix | ✅ PASS |

### UI surface coverage (Playwright e2e + automatic preview deploy)

| Surface | Coverage | Status |
|---|---|---|
| NT renders without "(coming soon)" suffix on state-selector dropdown | `bulk-identity-dialog.spec.ts` asserts positive `/^NT$/` visibility + global no-coming-soon invariant | ✅ PASS across chromium / webkit / firefox / mobile-chrome |
| `layout.tsx` meta description does not contain "NT coming soon" | dynamic `ENCODED_STATES` join now produces "NSW, VIC, QLD, WA, SA, ACT, TAS, NT" | ✅ PASS — verified post-merge |
| Vercel preview deploy of PR #43's HEAD | preview built and reachable | ✅ Build ready at `lsl-calculator-git-feat-e2-phase-9-nt-delta-infiniteleverage-2.vercel.app` |

### Manual UI verification NOT performed in this report

**`Vercel preview manual walk-through of the 7 NT-conditional form fields`** was not manually exercised by this QA pass — the e2e Playwright canary asserts the state-selector renders NT without "(coming soon)", but the 7 NT-conditional form fields (per-year hours array dynamic add-row, Age Pension age override checkbox, tri-state casual continuity radio, bonus flag, board/lodging value input, related-corp years input, employer-initiated dismissal flag) have no dedicated e2e assertions. They are exercised structurally by `tsc` (which passes — types align with `form-to-engine.ts` and the engine's expected shapes) and by `vitest` (which exercises the full engine path via the 78 fixtures).

**Recommendation** — operator does a 5-minute browser walk-through of `/calculator/single` with state=NT on Vercel production after merge propagates to confirm: (a) all 7 NT-conditional fields render, (b) per-year hours array dynamic add-row works, (c) submitting a TC-NT-001-equivalent scenario produces the expected `$13,000 / 13 weeks` result panel render. Tracking as P2 below.

---

## Triaged findings

### P0 (ship-blockers)

None.

### P1 (high — fix before broader rollout)

None.

### P2 (medium — flag for follow-up)

**P2-1 — Manual Vercel preview / production UI walk-through of NT-conditional form fields**

The 7 NT-conditional form fields have type-checked + engine-exercised coverage but no dedicated e2e Playwright assertions. CI proves the engine accepts the `extraInputs.nt_*` shape; what isn't proven is that the rendered form actually wires those fields correctly to the engine on every browser. A 5-minute manual walk-through on the Vercel deployment closes this gap.

*Triage rationale*: not P0/P1 because (a) `tsc` passing means form-to-engine types align with main's engine, (b) the engine itself is independently green via 78 vitest fixtures, (c) main is now the merged target so any Vercel deploy regression would show up immediately. But should not ship to broader audience without the operator confirming the form renders correctly visually.

*Suggested action*: operator browser-tests `/calculator/single` with state=NT and submits one fixture-equivalent scenario; if green, no further action; if red, file a P1.

**P2-2 — Engine-specific doc amendments deferred**

Four doc amendments from the parallel session's reconciliation analysis (Amendment 3 — blended `valueOfWeek` narrative; Amendment 5 — fallback mechanism documentation; Amendment 6 — `nt_per_year_formula_applied` unconditional firing convention; Amendment 8 — 9-item reconciliation appendix) were deferred from PR #43 because they describe behavior specific to #41's engine, which was superseded.

*Suggested action*: small follow-up doc PR to verify each amendment's claims against #40's actual engine behavior and either apply, rewrite, or drop per finding.

### P3 (low — backlog)

**P3-1 — Warning label orphans (~10 codes)**

`result-panel.tsx` `WARNING_LABELS` contains ~10 NT-related label entries for codes the shipped engine doesn't emit (e.g. `nt_overtime_excluded`, `nt_industry_leading_hand_skill_qualification_allowance_included`, `nt_per_year_hours_history_missing`, `nt_per_year_hours_history_partial`, `nt_board_lodging_included`, `nt_district_site_climatic_allowance_excluded`, `sub_7yr_review_industrial_instrument`, etc.). Dead code, not active bugs — no user-facing impact. Cleanup can land alongside the P2-2 doc-amendment follow-up.

**P3-2 — Citation page anchors at `page: 0` placeholder**

All NT engine citations use `page: 0` per the T9.1 / T9.2 scaffolding convention. RES-3 legal-reviewer pass (per TBD-NT-17) is the natural place to pin actual page anchors.

**P3-3 — RES-3 legal-reviewer pass scheduled**

Per TBD-NT-17: v1 ships against 14 Oct 2015 NT LSL Act consolidation. RES-3 legal-reviewer pass should confirm no material post-2015 amendments to s.7 / s.10 / s.11 / s.12 before broader operator rollout. Standard pre-launch step matching prior states' patterns.

---

## Sign-off

Phase 9 NT engine is **PASS — shipped on main as of 2026-05-27 commit `217a04c`**. The full E2 epic (per-state LSL coverage) is now complete: NSW, VIC, QLD, WA, SA, ACT, TAS, NT — all 8 Australian states and territories have rule-set encoding with PM-signed test cases and end-to-end test coverage.

No P0 / P1 issues. Two P2 follow-ups (manual UI walk-through; engine-specific doc amendments). Three P3 backlog items (warning label orphans; citation page anchors; RES-3 legal pass).

---

*QA report written 2026-05-27 by main-thread orchestrator (Claude Opus 4.7). Synthesises evidence from CI matrices on PR #40, PR #43, and post-merge main; local vitest runs (2214 / 2214 LSL suite); Playwright e2e canary on all 4 browser targets. Manual UI verification recommended as P2-1 follow-up.*
