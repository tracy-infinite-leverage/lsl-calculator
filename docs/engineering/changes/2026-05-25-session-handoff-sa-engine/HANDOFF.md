# Session Handoff — SA Engine Build

**Date**: 2026-05-25
**From**: Orchestrator session (context limit)
**To**: New orchestrator session
**Status**: SA Phase 6 test cases merged. Engine T6.1-T6.5 ready to start. No pre-flight blockers.

---

## Quick state snapshot

| Item | Value |
|---|---|
| `main` HEAD | `df62faf` (PR #20 — SA test cases v1.0) |
| Branch in repo | `main` (clean working tree) |
| Production URL | https://www.lslcalculator.com.au |
| States live | NSW, VIC, QLD, WA |
| States with test cases ready | NSW, VIC, QLD, WA, **SA** |
| States not yet started | ACT, TAS, NT |

---

## What this session shipped today

| PR | Status | What |
|---|---|---|
| #16 | ✅ merged | QLD 5 deferred fixtures reinstated (post DEV-CROSS-1) |
| #17 | ✅ merged | WA test cases v1.0 + DEV-CROSS-2 dev-finding |
| #18 | ✅ merged | DEV-CROSS-2 (WA schema extension) |
| #19 | ✅ merged | WA engine T5.1-T5.5 (73 fixtures, dual-regime split) |
| #20 | ✅ merged | SA test cases v1.0 (67 fixtures, 12 TBDs resolved) |

E2 went from 2 of 8 states live (NSW+VIC) at start of day to 4 of 8 states live (NSW+VIC+QLD+WA), with SA test cases signed off and ready for engine work.

---

## Next session — fire SA engine build

The exact dev brief to use:

> Build E2 Phase 6 — SA engine. Implement T6.1 through T6.5 against the 67 PM-signed-off test-case fixtures from PR #20 (now on `main` at `df62faf`). All 67 fixtures must pass. NSW + VIC + QLD + WA must stay byte-identical.
>
> SA is the fifth state engine (after NSW, VIC, QLD, WA). Per PM and operator decisions, SA mirrors QLD architecturally — single regime, no dual-regime, no pre-flight cross-state schema PR needed.
>
> **Read first:**
> - Test cases (PM-signed): `docs/qa/test-cases-sa.md` v1.0 — 67 fixtures (64 single + 3 bulk). Your contract.
> - Impl-plan §6 (SA): `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.3
> - Tasks §6: `.specify/features/002-all-state-coverage/tasks.md`
> - QLD as the closest reference: `website/src/lib/lsl/states/qld/` — SA mirrors this architecturally
> - WA engine for date-aware patterns if needed (probably not — SA is single regime)
> - DEV-CROSS-1 + DEV-CROSS-2 schema fields are available on engine/types.ts
>
> **SA-specific architectural decisions (locked in T6.0 sign-off):**
> 1. **Single regime, no dual-regime.** TBD-SA-01 resolved.
> 2. **13 weeks at 10 yrs entitlement.** Different from other 4 states (8.6667 wks). Plus 1.3 wks per further year per s.5(1).
> 3. **PH INCLUSIVE during LSL.** Public holidays during LSL count as LSL days, no extension. (Opposite of NSW/VIC/QLD/WA.)
> 4. **Two sub-10-yr disqualifiers.** Serious misconduct AND `extraInputs.sa_worker_notice_compliance === false`.
> 5. **156-week casual averaging with WC substitution.** Different from QLD's 52-wk or WA's accrual-period.
> 6. **Higher-duties acting rate IS ordinary rate.** Via `extraInputs.sa_higher_duties_active` + `extraInputs.sa_higher_duties_weekly_rate`. NOT a state-agnostic field (DEV-CROSS-3 was rejected per YAGNI).
> 7. **Cashing-out: advisory, 3 codes** (parallel to WA): `sa_cashout_post_accrual_advisory` / `sa_cashout_pre_accrual_not_authorised` / `sa_cashout_no_entitlement_to_cash_out`.
> 8. **10+yr misconduct: FULL payout** (NSW/VIC/QLD pattern, NOT WA's partial-forfeiture).
> 9. **Re-employment tolerance: 2 months** (similar to WA non-slackness). No slackness-of-trade extension.
> 10. **Pay on termination: immediate** (parallel to NSW/VIC).
>
> **Files to create:**
> - `website/src/lib/lsl/states/sa/index.ts`
> - `website/src/lib/lsl/states/sa/continuous-service-rules.ts` (single profile, no pre/post split)
> - `website/src/lib/lsl/states/sa/rules/{accrual-table,value-of-week,trigger-handlers}.ts`
> - `website/src/lib/lsl/states/sa/extra-inputs.ts` (defines `sa_worker_notice_compliance`, `sa_higher_duties_active`, `sa_higher_duties_weekly_rate`)
> - `website/src/lib/lsl/states/sa/__tests__/fixtures/single/TC-SA-001.json` through `TC-SA-064.json`
> - `website/src/lib/lsl/states/sa/__tests__/fixtures/bulk/TC-SA-BULK-{001,002,003}.json`
> - `website/src/lib/lsl/states/sa/__tests__/{gold-standard,bulk}.test.ts`
>
> **Files to modify:**
> - `website/src/lib/lsl/dispatch.ts` — add `SA_RULE_SET` to `STATE_REGISTRY`
> - `website/src/lib/lsl/engine/types.ts` — add SA-specific warning codes (see test-cases-sa.md for all `warnings:` blocks)
> - `website/src/components/lsl/result-panel.tsx` — add user-facing labels for new warning codes
> - `.github/workflows/ci.yml` — add `sa` to state-matrix + cross-state-regression
> - `website/e2e/bulk-identity-dialog.spec.ts` — move "coming soon" canary from SA to ACT (next unshipped state)
>
> **Don't lock idealised integer-anniversary `totalEntitlementWeeks` / `totalEntitlementDollars`** into fixtures — they won't survive day-precise engine arithmetic. Assert `valueOfWeek` + warnings + citations + `payableIndicator` only. Convention used in all 4 prior states.
>
> **Branch**: `e2-phase-6-sa-engine` (cut from current `main` at `df62faf`).
>
> **Pattern reference**: QLD engine PR #13 + WA engine PR #19 are the closest precedents. QLD is the closer architectural match (single regime, advisory cash-out).

---

## Watchouts the next session should know about

1. **The "idealised integer-anniversary" fixture trap from WA**. When PM specs say "exactly 15 yrs = 13.0000 weeks", the engine's day-precise `inclusiveDays / 365.25` gives slightly different numbers. The 4 prior states avoid this by only asserting structural fields. SA fixtures should follow this convention. If TC-SA-XXX has any `totalEntitlementWeeks` / `totalEntitlementDollars` assertions that fail on first run, surface — don't silently adjust.

2. **Doc-vs-engine boundary edge cases**. VIC-017, QLD-013, WA-013 all needed ±1 day fixture date adjustments when the doc's idealised "1 day short of 7 yrs" computed to >=7.0. SA fixtures may have the same. The fresh dev agent should run the test suite EARLY (after the first batch of fixtures) to catch these before building 60 more on top of broken expectations.

3. **Sub-agent branch hygiene**. Background agents occasionally leave the parent shell on a different branch than they claim. Always `git branch --show-current` after a sub-agent returns — don't trust the agent's self-report.

4. **`website/.claude/` and `docs/research/`** are pre-existing untracked dirs. Leave them alone — they're local-only Claude config / research notes. Don't stage them in any commit.

5. **No DEV-CROSS-3 needed**. Operator chose YAGNI for higher-duties (extraInputs route). Don't create a cross-state finding for it.

---

## Production state at session end

- `main` is at `df62faf`
- Production live at https://www.lslcalculator.com.au with NSW + VIC + QLD + WA selectable
- Vercel auto-deploys on main pushes
- All CI gates green
- No outstanding bugs or P0/P1 issues
- DEV-CROSS-1 merged. DEV-CROSS-2 merged. No further cross-state work pending.

---

## Backlog items (not blocking SA)

- Issue #4 (P3 UX) — empty service-event rows blocking Calculate
- Issue #6 (P3) — pre-existing Radix uncontrolled→controlled warning
- 4 dead "v1 supports NSW only" strings in `states/nsw/index.ts` (since renamed to LSL Calculator)
- Q-05 / Q-06 from PR #3 QA — pre-existing single-mode items
- Service-event NSW citation needs to become state-aware (post-rename)
- Bulk sample CSV is NSW-only

None blocking SA engine work.

---

## How the new session should start

1. Read this HANDOFF.md
2. Verify state: `git branch --show-current` (expect `main`), `git log --oneline -3` (expect `df62faf` at top)
3. Fire the dev agent in background using the brief above
4. ETA: 3-5 dev-days agent time per impl-plan v0.3.3 §6 (probably 60-90 min real time)
5. After dev returns: QA, then merge, then ACT Phase 7

Good luck.
