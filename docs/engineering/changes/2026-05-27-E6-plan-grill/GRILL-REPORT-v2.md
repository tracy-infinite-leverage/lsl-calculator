# E6 Plan + Tasks — Regression Grill Report (Round 2)

**Date:** 2026-05-27
**Reviewer:** product-manager agent (pm-grill-with-docs, regression posture)
**Round 1 report:** `docs/engineering/changes/2026-05-27-E6-plan-grill/GRILL-REPORT.md`
**Inputs grilled (round 2):**
- `.specify/features/006-ui-design-system/impl-plan.md` (amended, untracked)
- `.specify/features/006-ui-design-system/tasks.md` (amended, untracked, claimed 49 tasks)

**Reference (unchanged contract):**
- `.specify/features/006-ui-design-system/spec.md` v0.4
- `docs/engineering/changes/2026-05-27-E6-plan-grill/GRILL-REPORT.md` (round 1 fix-verification checklist)

---

## VERDICT

**APPROVE — ready to commit and start build.**

Every round-1 finding has a verifiable fix in the files (not just in the dev's report). No regressions introduced by the four new tasks or three re-sizes. Spec is untouched. Task math holds end-to-end.

---

## Headline

The dev did the work. All 12 findings VERIFIED with concrete, traceable changes in impl-plan.md and tasks.md — including the load-bearing HIGH (G-1) posture-split, which is now belt-and-braces with a posture table in §1.3, the routing logic mandate in Task 5.5 ("branches on posture BEFORE any auth check"), explicit ACs for 200-without-auth on public families, and an isolated contract test in Task 5.5-bis that lives outside `tests/` (honouring spec §5.3 sanctity).

---

## Fix-verification table (G-1..G-12)

| ID | Sev | Claimed fix | Status | Evidence |
|---|---|---|---|---|
| **G-1** | HIGH | Posture-split §1.3 + Task 5.5 amend + new Task 5.5-bis guard test | **VERIFIED** | impl-plan §1.3 lines 172–191 (full posture table + "branches on `family` BEFORE any auth check"); Task 5.5 lines 614–641 (posture table repeated + ACs assert 200 without auth header for both public families + 401 for both authed); Task 5.5-bis lines 643–660 (contract test asserts all four postures, lives in `website/e2e/` or `website/__tests__/`, explicitly OUTSIDE `tests/`) |
| G-2 | MED | SessionCookieClaims contract type, new Task 3.3-bis | **VERIFIED** | impl-plan §1.1 decision 4 lines 140 (cross-epic contract noted + file path); Task 3.3-bis lines 299–313 (full interface, claim issuer documented, type-only); Task 3.3 line 326 AC explicitly requires reading against `SessionCookieClaims` type with no inline duplicate |
| G-3 | MED | Task 2.10 CSP + bundle audit (folds G-6) | **VERIFIED** | impl-plan §2 line 241 (gate added to Phase 2 deliverables); Task 2.10 lines 233–248 (npm build chunk grep + DevTools network audit + CSP smoke test + bundle delta vs baseline). G-6 Storybook leakage folded as AC bullet 4 ("any `@storybook/*` chunk leaking into client-side bundle fails the gate") |
| G-4 | MED | Task 1.2 M→L + plan §3 effort range stated as 3–14 days | **VERIFIED** | Task 1.2 line 45 (Effort: L with "re-sized from M per G-4" rationale + description carries the 5–10 day cycle warning); impl-plan §3 line 335 ("approximately 3 days (happy path) to 14 days (fallback active)") |
| G-5 | MED | Phase 3b↔5a sequencing OR feature-flag guard | **VERIFIED** | impl-plan §3 line 337 (operator picks at Task 4.6 kickoff); Task 4.6 lines 510–520 (both paths spelled out, operator records inline, "no visible-but-disabled or coming soon CTA state ships to `main`") |
| G-6 | MED | Storybook bundle-leak guard (folded into G-3 fix) | **VERIFIED** | See G-3 evidence — Task 2.10 AC bullet 4 specifically targets `@storybook/*` chunk leakage |
| G-7 | MED | Test-folder diff guard, new Task 2.11 | **VERIFIED** | Task 2.11 lines 250–264 (CI runs `git diff origin/main -- tests/` and fails if non-empty, documented in `docs/qa/e6-test-sanctity.md`, no `--no-verify` shortcut, dependency on Task 2.1 to avoid false positives on Storybook test config) |
| G-8 | LOW | Operator-awareness flag on Task 3.5 home-org default | **VERIFIED** | Task 3.5 line 350 ("Operator awareness (G-8): ... Operator confirms the decision at task kickoff and records it inline"); AC bullet 4 adds the inline-record requirement |
| G-9 | LOW | E5.6 flag surfaced via epic-status.md note on Task 1.5 | **VERIFIED** | Task 1.5 line 83 ("Future-tense flag (G-9)" with explicit epic-status.md update requirement); AC bullet 3 makes it an enforceable acceptance criterion, not just a comment |
| G-10 | LOW | Task 2.2 baseline metrics + §1.5 testing table reference | **VERIFIED** | Task 2.2 lines 120 + 125 + 130 (precursor records baseline in `docs/qa/e6-baseline-metrics.md` pre-change, ACs require ±5% or strictly better, pre AND post numbers committed) |
| G-11 | LOW | PD-1 Puppeteer Node-runtime wording | **VERIFIED** | impl-plan PD-1 line 28 ("Vercel **Node runtime** (not edge — Puppeteer requires a Node runtime + `chromium-aws-lambda` bundle, accepting the ~200MB payload and 1–2s cold-start tax)") |
| G-12 | LOW | Task 1.4 + §1.1 decision 5 build-time copy script (no symlink) | **VERIFIED** | impl-plan §1.1 decision 5 line 141 ("Build-time copy via `scripts/sync-brand-assets.{ts,sh}` invoked from the `prebuild` script ... **no symlinks**"); Task 1.4 lines 63 + 71–73 (script path committed, wired to `prebuild`, symlink rejection rationale recorded in README) |

**Rollup: 12 VERIFIED / 0 PARTIAL / 0 NOT-FOUND / 0 REGRESSION-INTRODUCED out of 12.**

---

## New findings (regressions from round-1 fixes)

**None.**

Specific regression risks I checked, with negative results:

1. **G-1 posture split vs. methodology-footer identity across families.** The posture split is a routing decision at endpoint entry; the `MethodologyFooter` component (Task 5.3) accepts a `ReportContext` regardless of auth and renders identically. No coupling between auth posture and footer content. Safe.
2. **Task 2.10 CSP audit gating Phase 2 vs E5.2 hard-gate timing.** Task 2.10 is sized S and runs in parallel with the other Phase 2 closure tasks; it gates on dependency-introducing tasks (2.1, 2.2, 2.3, 2.6, 2.8) which are already on the Phase 2 critical path. Adds zero net latency to the E5.2 unblock date.
3. **Task 2.11 test-folder diff guard blocking legitimate Storybook test additions.** The guard greps `tests/` only — Storybook tests live under `website/e2e/`, `website/.storybook/`, `website/__tests__/`. Path scope is correct. Task 5.5-bis also explicitly lives outside `tests/` per its own AC bullet 7, so the guard does not collide with the HIGH-finding fix.
4. **Task 3.3-bis SessionCookieClaims pre-empting E5.1.** The contract is type-only (no runtime code), claim shape mirrors what E5.1 needs to issue regardless (`activeTenantId`, `homeTenantId`, `membershipCount`), and the AC explicitly notes E5.1 is the writer and edits this file if the shape changes. This is a coordination artifact, not an unilateral imposition on E5.1's branch.
5. **Task 5.5-bis test placement vs spec §5.3 test-sanctity rule.** The AC says the test "lives OUTSIDE `tests/`" — the existing 2214 + 92 corpus is preserved. Task 2.11's guard greps only `tests/`, so Task 5.5-bis is not caught by it. Both guards coexist cleanly.

---

## Spec-sanctity check

`git diff HEAD -- .specify/features/006-ui-design-system/spec.md` returns **empty**. Spec untouched. v0.4 contract preserved.

---

## Task-count + critical-path sanity

- **Counted tasks (grep `^### Task `): 49.** Matches dev's claim.
- **Phase breakdown:** E6.1=5, E6.2=11, E6.3=11, E6.4=8, E6.5=8, E6.6a=4, E6.6b=2. Sum=49. Matches dev's table at line 792–801.
- **Critical path:** Phase 1 (5 tasks) + Phase 2 (11 tasks) = 16. Matches dev's claim. Round 1 had 14 (5+9); +2 from Tasks 2.10 + 2.11. Math holds.
- **Re-sizings verified:** Task 1.2 L (line 45), Task 3.7 L (line 389), Task 5.5 L (line 639). All three carry the resize rationale inline.

---

## Traceability spot-check (4 new tasks + 1 random re-size)

Per dev brief, each new/resized task must reference spec § + AC + grill finding ID.

| Task | Source line present | Spec § cited | AC § cited | Grill ID cited |
|---|---|---|---|---|
| 2.10 (new) | line 237 | §5.7 + §5.1 + LAUNCH-GUARD | §5.7 + §5.1 (AC line 239) | G-3 + G-6 |
| 2.11 (new) | line 254 | §5.3 + SC-7 | §5.3 + SC-7 (AC line 256) | G-7 |
| 3.3-bis (new) | line 303 | §5.2 (OQ-9) + impl-plan §1.1 decision 4 | §5.2 (AC line 305) | G-2 |
| 5.5-bis (new) | line 647 | §5.3 + §5.4 · OQ-6 | §5.3 + OQ-6 (AC line 649) | G-1 |
| 5.5 (re-sized) | line 627 | §5.3 + §5.4 + §5.7 · OQ-6 | impl-plan §1.3 + Spec §5.3 + OQ-6 (AC line 629) | G-1 |

Traceability is genuinely there — not boilerplate.

---

## Sign-off recommendation to operator

**Commit-and-go.**

1. **Commit** the three untracked artifacts on the current `006-ui-design-system` branch:
   - `.specify/features/006-ui-design-system/impl-plan.md`
   - `.specify/features/006-ui-design-system/tasks.md`
   - `docs/engineering/changes/2026-05-27-E6-plan-grill/` (both round-1 and round-2 reports)
2. **Push** to remote and update PR #54.
3. **Route to developer agent** to start Phase 1 execution via `/speckit-implement` (designer-agent owns Tasks 1.1–1.5).
4. **No further grilling needed** unless the developer surfaces a new constraint mid-Phase-2 that requires a plan amendment.

The plan is structurally sound, the spec contract is honoured, and the four new tasks strengthen (rather than reshape) the original work. Honest summary: this is the right shape — ship it.

---

## git status snapshot (round-2)

```
On branch 006-ui-design-system
Your branch is up to date with 'origin/006-ui-design-system'.

Untracked files:
	.specify/features/006-ui-design-system/impl-plan.md
	.specify/features/006-ui-design-system/tasks.md
	docs/engineering/changes/2026-05-27-E6-plan-grill/

nothing added to commit but untracked files present
```

---

*End of regression grill report. No commit; no PR; no file modifications to spec / plan / tasks. Operator next action: commit the three artifacts and start Phase 1.*
