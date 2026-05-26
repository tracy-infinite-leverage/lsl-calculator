# Session Handoff — ACT Engine Build

**Date**: 2026-05-26
**From**: Orchestrator session (closing for context hygiene before Phase 7 dev build)
**To**: New orchestrator session
**Status**: ACT Phase 7 test cases v1.0 PM-signed (PR #24 merging in background). Engine T7.1–T7.5 ready to start. No pre-flight blockers — no DEV-CROSS-4 needed.

---

## Quick state snapshot

| Item | Value |
|---|---|
| `main` HEAD (at handoff time) | `f574f6a` — bump when PR #24 + #25 (this handoff) merge |
| Production URL | https://www.lslcalculator.com.au |
| States live on prod | NSW, VIC, QLD, WA, SA |
| States with test cases ready | NSW, VIC, QLD, WA, SA, **ACT** |
| States not yet started | TAS, NT |

---

## What this session shipped today

| PR | Status | What |
|---|---|---|
| #22 | ✅ merged | SA engine — Phase 6 (T6.1-T6.5) — 67 fixtures, single regime, PH-inclusive |
| #23 | ✅ merged | Layout copy fix — "NSW, VIC, QLD, WA, SA available — ACT, TAS, NT coming soon" |
| #24 | 🟡 merging | ACT test-cases v1.0 PM-signed (T7.0) — all 17 TBDs resolved, no DEV-CROSS-4 |
| #25 | 🟡 this PR | Session handoff for ACT engine build |

E2 went from 4 of 8 states live (NSW+VIC+QLD+WA) at session start to 5 of 8 (added SA), with ACT test cases signed off and ready for engine work.

---

## Next session — fire ACT engine build

The exact dev brief to use:

> Build E2 Phase 7 — ACT engine. Implement T7.1 through T7.5 against the PM-signed-off test-case fixtures in `docs/qa/test-cases-act.md` v1.0 (binding contract). All ACT fixtures must pass. NSW + VIC + QLD + WA + SA must stay byte-identical (cross-state regression must remain green).
>
> ACT is the sixth state engine. Per PM and operator decisions captured in the test-cases-act.md Resolutions section (2026-05-26 sign-off), ACT has FOUR Sev-1 architectural divergences that make it more complex than any prior state. Read the test-cases doc THOROUGHLY before writing code.
>
> **Read first (in this order):**
> - `docs/qa/test-cases-act.md` v1.0 — binding contract. ALL 17 TBDs resolved at top in Resolutions (2026-05-26 — PM Tracy Angwin) section. Your engine MUST honour every binding decision.
> - `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.5 §Phase 7
> - `.specify/features/002-all-state-coverage/tasks.md` §7 (T7.0 ✅ SIGNED OFF; T7.1 unblocked immediately)
> - **WA engine** at `website/src/lib/lsl/states/wa/` — closest architectural precedent for the date-aware WC dual regime (ACT has its own WC cliff at 9 June 2023, parallel to WA's 2024-07-01)
> - **SA engine** at `website/src/lib/lsl/states/sa/` — closest precedent for the single-regime architecture and `extraInputs.{state}_*` localisation pattern
> - `website/src/lib/lsl/engine/types.ts` — DEV-CROSS-1 + DEV-CROSS-2 schema fields available; ACT will ADD ONE new purely-additive optional field `Result.payable_by: ISODate` (cross-state-available; ACT is the first consumer, other states leave undefined)
>
> **ACT-specific architectural decisions (locked at T7.0 sign-off — see test-cases-act.md Resolutions section for full reasoning):**
> 1. **Single regime for ordinary accrual; date-aware WC override at 9 June 2023.** Architecture mirrors WA's split: one ACT rule set, with `workers-comp-override.ts` module selected by absence date vs 2023-06-09.
> 2. **5-yr pro-rata threshold** — LOWEST in Australia. Narrow qualifying-reason list under s.11C. Voluntary resignation 5–7 yrs does NOT pay out (unlike SA/WA).
> 3. **Overtime hours/rate ASYMMETRY** — F9/AC11 clarified: hours-averaging window INCLUDES overtime hours; rate applied EXCLUDES overtime premium. Parallel to SA 156-wk pattern but applied to ACT's averaging windows.
> 4. **s.7(2) vs s.11D anchor split** — `trigger_kind = taking_leave` uses 12 mo before the entitlement date; `trigger_kind = termination` uses 12 mo before cessation. Different averaging windows depending on trigger. Spec calls this the "highest mis-coding risk in the entire epic" — the contract makes the routing rule explicit.
> 5. **ACT-unique s.7(3) FT→PT/casual within 2 yrs of entitlement** triggers a 5-year **salary** divisor formula (not hours-averaging). NO OTHER AUSTRALIAN STATE HAS THIS RULE. Easy to miss. Routes via wage-history characteristics.
> 6. **Paid parental leave does NOT count toward ACT service** (Company-paid + Government PPL both excluded per WorkSafe ACT). Divergence from NSW/SA/VIC-post-2018. ACT-specific service-event rule.
> 7. **WC cap interpretation, retirement gate, sickness cap, advance-leave refusal semantics** — all resolved per PM recommendations in Resolutions section (Sev-2 decisions).
> 8. **`Result.payable_by: ISODate`** — NEW optional field on the engine result. ACT populates with termination_date + 90 days (longest pay-on-termination in Australia). All other states leave undefined.
> 9. **No DEV-CROSS-4 needed.** All ACT-unique signals localised via `extraInputs.act_*`. The `payable_by` field bundles inline with the ACT per-state PR.
> 10. **Overtime hours input** — the Phase 1 stub at "Available when state = ACT and employment type = part_time/casual" gets ENABLED in this phase. Wire up to the form layer.
>
> **Files to create:**
> - `website/src/lib/lsl/states/act/index.ts`
> - `website/src/lib/lsl/states/act/continuous-service-rules.ts` (single profile)
> - `website/src/lib/lsl/states/act/rules/{accrual-table,value-of-week,trigger-handlers}.ts`
> - `website/src/lib/lsl/states/act/rules/workers-comp-override.ts` (date-aware module — mirror WA's pattern, applies post-2023-06-09)
> - `website/src/lib/lsl/states/act/extra-inputs.ts` (defines all `act_*` fields enumerated in test-cases-act.md schema additions section)
> - `website/src/lib/lsl/states/act/__tests__/fixtures/single/TC-ACT-*.json`
> - `website/src/lib/lsl/states/act/__tests__/fixtures/bulk/TC-ACT-BULK-*.json`
> - `website/src/lib/lsl/states/act/__tests__/{gold-standard,bulk}.test.ts`
>
> **Files to modify:**
> - `website/src/lib/lsl/dispatch.ts` — add `ACT_RULE_SET` to `STATE_REGISTRY`
> - `website/src/lib/lsl/dispatch.test.ts` — add ACT to sorted list, mirror SA/WA pattern
> - `website/src/lib/lsl/engine/types.ts` — add ACT-specific warning codes (see test-cases-act.md for all `warnings:` blocks); add OPTIONAL `payable_by?: ISODate` to `Result` type
> - `website/src/components/lsl/result-panel.tsx` — add user-facing labels for new ACT warning codes; add a small UI hook for displaying `payable_by` when present
> - `website/src/components/lsl/state-input-form.tsx` (or wherever the overtime-hours stub lives) — enable the stub when state === 'ACT' && employment_type in {part_time, casual}; wire to `extraInputs.act_overtime_hours_*`
> - `.github/workflows/ci.yml` — add `act` to state-matrix + cross-state-regression
> - `website/e2e/bulk-identity-dialog.spec.ts` — move "coming soon" canary from ACT to TAS (next unshipped state)
>
> **Don't lock idealised integer-anniversary `totalEntitlementWeeks` / `totalEntitlementDollars`** into fixtures — they won't survive day-precise engine arithmetic. Assert `valueOfWeek` + warnings + citations + `payableIndicator` (+ `payable_by` for ACT termination fixtures) only. Convention used in all 5 prior states.
>
> **Branch**: `e2-phase-7-act-engine` (cut from current `main` after PRs #24 + #25 merge).
>
> **Pattern reference**: WA engine PR #19 + SA engine PR #22 are the closest precedents.
> - WA is the closest for the date-aware WC override architecture
> - SA is the closest for the single-regime base + `extraInputs.{state}_*` localisation
> - The s.7(3) FT→PT salary divisor and the s.7(2)/s.11D anchor split have NO prior precedent — read the statute and the resolved TBDs carefully before coding these

---

## Watchouts the next session should know about

1. **Higher complexity than SA**. ACT is L (5–7 dev-days) vs SA's M (3–5). Four Sev-1 architectural divergences (overtime asymmetry, s.7(2)/s.11D anchor split, s.7(3) FT→PT salary divisor, WC dual regime). Expect the dev agent may stall or need a wrap-up cycle — that's what happened on the SA M-sized build, and ACT is bigger. Budget for a fresh wrap-up agent retry if first dev agent stalls (it's a 3-step pattern: dev → wrap-up → QA).

2. **The s.7(3) salary divisor is a true novel pattern**. No other state has this. The fixtures in test-cases-act.md §H (or wherever the resolved TBD-ACT-04 examples live) are the only reference. Watch for the dev agent over-generalising or under-implementing this.

3. **The s.7(2)/s.11D anchor split is the "highest mis-coding risk in the entire epic"** per the spec. The trigger_kind routing rule must be honoured exactly. Best caught by the fixtures — make sure both `taking_leave` and `termination` cases for the same employee are in the fixture set.

4. **WC dual regime mirror to WA**. Engine layout uses the same `workers-comp-override.ts` pattern WA established. Don't reinvent — read WA's file first. The cliff date is 9 June 2023 (not WA's 2024-07-01).

5. **The "idealised integer-anniversary" fixture trap from WA**. VIC-017, QLD-013, WA-013 all needed ±1 day fixture date adjustments. ACT fixtures may have the same. The fresh dev agent should run the test suite EARLY (after first 5-10 fixtures) to catch fixture-vs-engine arithmetic mismatches before building dozens more on top of broken expectations.

6. **Sub-agent branch hygiene**. Background agents occasionally leave the parent shell on a different branch than they claim. ALWAYS `git branch --show-current` after a sub-agent returns — don't trust the agent's self-report. This happened TWICE this session (dev agent #1 stalled and left files on disk; PM agent left orchestrator on `pm/act-test-cases`).

7. **The "claimed pushed but actually local-only" trap**. The first SA dev agent reported "3 commits pushed" but only 1 was actually on origin when wrap-up picked up. Always verify with `git log origin/<branch> --oneline` vs `git log <branch> --oneline` before trusting "all committed and pushed".

8. **`website/.claude/` and `docs/research/`** are pre-existing untracked dirs. Leave them alone — they're local-only Claude config / research notes. Don't stage them in any commit.

9. **PR merge flow has branch-protection BEHIND quirk**. PRs cut before recent main commits will fail `gh pr merge` with "head branch is not up to date". Resolution: `gh pr update-branch <num>` → CI re-runs → `gh pr merge --squash --delete-branch`. Auto-merge is DISABLED for this repo (returned `enablePullRequestAutoMerge` GraphQL error when tried). Use watch-then-merge in background instead.

10. **Layout-copy update is now in `layout.tsx`** as of `f574f6a` (PR #23). If you add a 6th state (after ACT lands), the next layout copy update is `"NSW, VIC, QLD, WA, SA, ACT available — TAS, NT coming soon."` — easy to forget. Bundle into the ACT engine PR or a separate trailing-fix PR.

---

## Production state at session end

- `main` HEAD: `f574f6a` (will move when PR #24 + #25 land — expect 2 more commits)
- Production live at https://www.lslcalculator.com.au with NSW + VIC + QLD + WA + SA selectable
- Vercel auto-deploys on main pushes
- All CI gates green on main
- No outstanding bugs or P0/P1/P2 issues (per the SA QA report)
- DEV-CROSS-1, -2 merged. DEV-CROSS-3, -4 explicitly rejected per YAGNI. No cross-state work pending.

---

## Backlog items (not blocking ACT)

- Issue #4 (P3 UX) — empty service-event rows blocking Calculate
- Issue #6 (P3) — pre-existing Radix uncontrolled→controlled warning
- 4 dead "v1 supports NSW only" strings in `states/nsw/index.ts` (since renamed to LSL Calculator)
- Q-05 / Q-06 from PR #3 QA — pre-existing single-mode items
- Service-event NSW citation needs to become state-aware (post-rename)
- Bulk sample CSV is NSW-only
- After ACT ships: layout.tsx copy update (see watchout #10)

None blocking ACT engine work.

---

## How the new session should start

1. Read this HANDOFF.md
2. Verify state: `git branch --show-current` (expect `main`), `git log --oneline -3` (should show #25 handoff + #24 ACT test-cases + #23 layout fix on top)
3. Confirm PR #24 merged successfully and `docs/qa/test-cases-act.md` v1.0 exists on main
4. Fire the dev agent in background using the brief above (include explicit pacing guidance — commit early/often, run tests after first 5-10 fixtures, commit BEFORE running tsc — same pacing rules that worked for SA wrap-up agent)
5. ETA: 5–7 dev-days agent time per impl-plan v0.3.5 §7 (probably 90–150 min real time, possibly needing one wrap-up retry)
6. After dev returns: QA, then merge, then layout copy update, then TAS Phase 8 PM test-cases

Good luck. ACT is the trickiest state engine in the epic — take it seriously, don't rush, read the resolved TBDs carefully.
