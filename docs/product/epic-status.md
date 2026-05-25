# LSL Calculator · Epic Status · Last updated: 2026-05-25 · E1 NSW SHIPPED (Phases 1+2+3 live on lsl-calculator.vercel.app) · E2 Phase 1+3 merged to main (PR #8 at `56ae5fd`, PR #10 at `93854f3`, PR #11 at `0bddbbc` — VIC engine + VIC user-facing now LIVE) · E2 Phase 4 T4.0 QLD test-cases v1.0 SIGNED OFF by Tracy Angwin (all 6 TBDs resolved; 5 fixtures deferred to DEV-CROSS-1 cross-state refactor PR)

## Pipeline stages

| Stage | Gate question |
|-------|---------------|
| 1 · Specified | Is there a written spec with acceptance criteria? |
| 2 · In flight | Is active development underway? |
| 3 · Feature-complete | Does it meet every acceptance criterion? |
| 4 · Tested | Have all tests passed? |
| 5 · Shipped | Is it deployed and measurably impacting users? |

Status glyphs: 🔄 in flight · ✅ done · ⏳ partially done · ☐ planned · 🛑 paused

## At a glance

| Epic | Status | % done (est) | Pipeline | Open bugs | Closed bugs | Notes |
|------|--------|--------------|----------|-----------|-------------|-------|
| E1 · NSW Calculator | ✅ done | 100% | ●●●●● | 0 | 6 (Q-01..Q-04 fixed in PR #3; Q-05/Q-06 pre-existing single-mode items, separate cleanup ticket) | **SHIPPED 2026-05-24.** Phases 1+2+3 live on https://lsl-calculator.vercel.app (`lsl.austpayroll.com.au` pending DNS). PR #3 squash-merged at `50061f5`. Architectural fix removed server-side pdfjs (issue #5) in favour of Anthropic document content block. 319 unit tests + 92 Playwright across 4 browsers. Phase 7 (opt-in logins) deferred post-launch. |
| E2 · All-State Coverage | 🔄 in flight | 55% | ●●●◐○ | 0 | 0 | Spec v0.3.1 + impl-plan v0.3.1 (Phase 4 acceptance criteria updated 2026-05-25) + tasks committed (10 phases, 76 tasks). **Phases 1+3 MERGED to `main`** (PR #8 `56ae5fd`, PR #10 `93854f3`, PR #11 `0bddbbc`). NSW + VIC both LIVE as of 2026-05-25 — state selector, dispatcher, VIC engine (61 fixtures byte-identical), VIC hard-error cash-out, product rename "LSL Calculator". **Phase 4 (QLD) T4.0 SIGNED OFF 2026-05-25** by Tracy Angwin (PM): `docs/qa/test-cases-qld.md` v1.0 on branch `pm/qld-test-cases`, 58 active fixtures (5 deferred) covering QLD IR Act 2016 ss.93–110 + s.134 + historical cliffs (s.96 = 23 Jun 1990, s.103 = 30 Mar 1994). **All 6 TBDs resolved** — see Resolutions section in the document. **Cross-state termination-enum refactor (DEV-CROSS-1) tracked separately** in `dev-findings.md` — to land as its own state-agnostic PR between QLD v1 launch and WA Phase 5; 5 QLD fixtures deferred until then. T4.1 onwards unblocked for developer. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: **SHIPPED 2026-05-24**. Phases 1+2+3 in production.
- **Pipeline**: ●●●●● (Stage 5 · Shipped — live on lsl-calculator.vercel.app; custom domain `lsl.austpayroll.com.au` pending DNS at Cloudflare)
- **Merge commit**: `50061f5` on `main` (squash of PR #3, which followed up PR #1's earlier Phases 1+2 ship)
- **Issue #5 (P1)**: server-side pdfjs DOMMatrix crash on Vercel — fixed by removing pdfjs server-side entirely and using Anthropic document content block. Architectural improvement, not a band-aid.
- **Branch**: `001-nsw-calculator` (historical, no longer active); `phase-3-pdf-followup` (merged via PR #3)
- **Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.5.0 (PM-signed-off 2026-05-21)
- **Test cases**: `.specify/features/001-nsw-calculator/test-cases.md` v1.1 (PM-signed-off 2026-05-21, 60 cases, all 8 TBDs resolved)
- **Plan + tasks**: `.specify/features/001-nsw-calculator/{impl-plan,tasks}.md` (82 tasks across 7 phases — Phase 7 added 2026-05-23 for opt-in logins, post-launch follow-on)
- **Dev findings**: `.specify/features/001-nsw-calculator/dev-findings.md` (22 findings + 1 carried OQ — 0 HIGH, 11 MEDIUM, 11 LOW)
- **Scope (v0.5.0)**:
  - Two modes: single employee (form) + bulk upload (CSV or PDF) of any payroll report
  - Gross-only inputs; no pay-component decomposition; no bonus high-income threshold test in v1
  - No hours-per-week or hourly-rate inputs; weekly gross is the load-bearing input
  - F8 Cat B = Cat C math (greater of 12mo / 5yr weekly avg); Cat A unchanged
  - NSW only; cross-jurisdiction detection blocks per-employee until governing state nominated
  - `as_at` mode reports accrued value; UI labels "accrued, not currently payable" when payout conditions aren't met
- **PM sign-offs (2026-05-21)**: PM-A mobile = responsive best-effort; PM-B bulk trigger = `as_at` default; OQ-B LLM = Anthropic Claude API no-retention; all 8 Phase-0 TBDs resolved.
- **Pre-flight blockers** (still open from product.md §14):
  - APA portal hosting + auth model (working default: standalone + deep-link)
- **Post-launch follow-ups**: (1) Cloudflare DNS for `lsl.austpayroll.com.au` (soft gate, Vercel-issued URL already live); (2) Q-05 + Q-06 pre-existing single-mode browser-only items — separate cleanup ticket; (3) issue #4 (P3 UX) on empty service-event rows blocking Calculate; (4) Phase 7 opt-in logins when there's customer pull for them.
- **Phase 7 scope (added 2026-05-23)**: opt-in user accounts with email + password (no magic links, no SSO, no OAuth). Adds `profiles` + `saved_calculations` Supabase tables with RLS, signup/login/reset flows, "my calculations" history view, and an account-deletion path. Triggers a privacy-notice revision (S1 changes from "no server-side employee data" to "permitted for authenticated users only").

### E2 · All-State Coverage
- **Phase**: **Phase 3 (VIC) SHIPPED to `main`; Phase 4 (QLD) T4.0 SIGNED OFF; T4.1 onwards unblocked** — 2026-05-25
- **Pipeline**: ●●●◐○ (Stage 1 Specified done; Stage 2 In flight — Phase 1+3 merged; Phase 4 T4.0 PM-signed)
- **Spec**: `.specify/features/002-all-state-coverage/spec.md` **v0.3.1** (2026-05-24 — s.67 → s.34 citation correction per TBD-VIC-12; all 6 OQs still resolved per v0.3.0)
- **Plan + tasks**: `.specify/features/002-all-state-coverage/{impl-plan,tasks}.md` v0.3.1 (10 phases, 76 tasks, **34-50 dev-days** revised down from 35-52 per VIC re-scope). Phase 4 T4.2 acceptance criteria expanded 2026-05-25 to reflect resolved TBD-QLD-01..05 interpretations and deferral of TBD-QLD-06 to DEV-CROSS-1.
- **Dev findings**: `.specify/features/002-all-state-coverage/dev-findings.md` (0 HIGH, **7 MEDIUM** — DEV-CROSS-1 added 2026-05-25 for the cross-state termination-reason enum redesign surfaced from TBD-QLD-06 — , 5 LOW — DEV-E2-M1, M3, M4, M6, L1, L4 closed in PR #8; M2, M5, L2, L3 deferred to per-state phases). DEV-E2-M2 (dual-regime encoding) re-scoped in impl-plan v0.3.1 — VIC uses one rule set with date-aware continuous-service handling; WA layout unchanged. **DEV-CROSS-1** is the new finding: a state-agnostic refactor of the engine's termination-reason enum and `Trigger` shape, scheduled to land between QLD v1 launch and WA Phase 5 start. Same disambiguation surfaces for WA/SA/TAS/ACT/NT, so it is routed to a single cross-state PR rather than per-state retrofits. After it lands, 5 QLD fixtures (TC-QLD-005, -007, -008, -015, -016) will be reinstated via a small follow-up PR.
- **Resolved decisions (v0.3.0)**:
  - **RES-1 (priority order)**: VIC → QLD → WA → SA → ACT → TAS → NT (population-weighted, VIC first on divergence-risk).
  - **RES-2 (epic structure)**: One bundled epic on the roadmap; per-state test gate inside — each state must pass its own gold-standard suite at 100% before being marked done within E2.
  - **RES-3 (legislation monitoring)**: Manual, **owner is Tracy personally for all 8 jurisdictions**, **quarterly cadence (1 Mar / 1 Jun / 1 Sep / 1 Dec)** + on-trigger override on gazetted amendments. No automated watch.
  - **RES-4 (mixed-state bulk timing)**: Mixed-state CSV accepted from v1 (day one). Per-row `state` column is **mandatory**. Row-level validation surfaces unrecognised/empty states as errors; valid rows in the same batch still process.
  - **RES-5 (cross-jurisdictional advisory heuristic)**: F13 manual nomination remains MUST in v1; F25 heuristic advisory removed from v1 scope and deferred to v2.
  - **RES-6 (sign-off authority)**: PM-only sign-off per state. **No APA-engaged payroll specialist co-signer.** Per-state launch gate (AC4b) = PM signoff on `test-cases.md` + automated suite 100% green in CI on merge commit.
- **Phase 1 status**: MERGED to `main` at `56ae5fd` (PR #8). NSW gold-standard 153/153 byte-identical. State-selector component built behind `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` (not rendered on any page yet — wired in during Phase 3). cash_out trigger scaffold added. CI matrix workflow scaffolded. QA verdict: PASSES WITH NOTES.
- **Phase 3 T3.0 status**: ✅ **SIGNED OFF 2026-05-24** by Tracy Angwin (PM). `docs/qa/test-cases-vic.md` v1.0 on branch `pm/vic-test-cases`. 61 test cases covering VIC LSL Act 2018 sections 6–17, 22–23, 34, 57 + 1992 Act provisions preserved via s.57. **All 13 TBDs resolved** — see Resolutions section in the document.
  - **TBD-VIC-01** (Sev-1, dual-regime interpretation): One VIC rule set with date-aware continuous-service handling. Impl-plan §3 re-scoped (was "two parallel rule sets"); ~2 dev-days saved on Phase 3.
  - **TBD-VIC-08** (Sev-1, LWOP 52-wk cap): Per-period interpretation accepted. Each `leave_without_pay` event evaluated independently against the 52-wk cap.
  - **TBD-VIC-12** (Sev-1, spec citation): E2 spec v0.3.1 corrects every "s.67" reference to "s.34" (Part 3 Division 3). APA training PDF still has the s.67 error externally — flagged for APA to correct in next training revision; not a launch blocker.
  - **TBD-VIC-02..07, 09..11, 13** (Sev-2/3): all resolved per the PM's drafted recommendations inline (engine warning-code rename, PM-derived APA practice values accepted, 7-yr inclusive boundary, sub-7-yr advisory warning, day-precise arithmetic, APA-page citations for legacy 1992 Act, two-case fixed-rate-vs-varied-rate classifier reading, s.8/s.22 deferred from v1).
- **Phase 4 T4.0 status**: ✅ **SIGNED OFF 2026-05-25** by Tracy Angwin (PM). `docs/qa/test-cases-qld.md` v1.0 on branch `pm/qld-test-cases`. 58 active test cases + 5 deferred fixtures (63 total) covering QLD IR Act 2016 ss.93–110 (Chapter 2 Part 3 Division 9) + s.134 (general continuity) + historical cliffs (s.96 = 23 June 1990 general; s.103 = 30 March 1994 casual). Coverage spans the s.95(2) 10-yr automatic payout (incl. misconduct), the s.95(3)/(4) 7–10-yr qualifying-reason gate, s.110 cashing-out non-blocking advisory (vs VIC's hard error), s.105 casual loaded-rate, s.99 commission averaging, s.97 PH-exclusive treatment, and 3 bulk fixtures asserting per-state branching across NSW + VIC + QLD. **All 6 TBDs resolved** — see Resolutions section in the document:
  - **TBD-QLD-01** (Sev-1, 15-yr accrual + threshold inclusivity): RESOLVED. Continuous 1/60 accrual (no discrete step at 15 yrs); thresholds at 7/10/15 yrs all inclusive at exact-day boundary.
  - **TBD-QLD-02** (Sev-1, historical cliffs): RESOLVED. s.103 casual cliff HARD-ANCHOR to 1994-03-30; s.96 general cliff ADVISORY-ONLY (use actual start date + emit warning). Casual portion of casual-to-permanent transition follows the cliff.
  - **TBD-QLD-03** (Sev-2, casual rate-of-pay averaging window): RESOLVED. Single 52-wk lookback per Business QLD's published formula. NOT multi-tier "greater of".
  - **TBD-QLD-04** (Sev-2, cash-out advisory granularity): RESOLVED. No user-supplied s.110 ground required; emit BOTH base + sub-10-yr-specific advisories; pass through with $0 at sub-7-yr.
  - **TBD-QLD-05** (Sev-2, Workers Comp rate-of-pay): RESOLVED. Apply literal s.98 ordinary-rate-at-leave-time even if reduced WC rate. NEW: emit `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory when a `workers_comp_absence` overlaps the trigger date, suggesting LSL deferral if feasible.
  - **TBD-QLD-06** (Sev-2, termination-reason enum design): RESOLVED via cross-state refactor deferral. Spun off as **DEV-CROSS-1** in `dev-findings.md` (state-agnostic refactor, lands between QLD v1 launch and WA Phase 5). 5 QLD fixtures deferred until DEV-CROSS-1 lands: TC-QLD-005 (employer-initiated illness), TC-QLD-007 (employer_initiated_not_misconduct), TC-QLD-008 (unfair_dismissal), TC-QLD-015 (poor_performance), TC-QLD-016 (domestic_pressing_necessity).
- **Pre-flight blockers**: None — T4.0 signed off; T4.1 (QLD rule-set scaffold) unblocked.
- **DEV-CROSS-1 status**: PENDING. Cross-state termination-reason enum redesign — tracked in `dev-findings.md` as a MEDIUM-severity finding. Developer agent owns the refactor PR. Sequencing: lands between QLD v1 launch (Phase 4 launch gate) and WA Phase 5 start. After it lands, 5 deferred QLD fixtures will be reinstated via a small follow-up PR (estimated S — under half a day).
- **Next action**: Operator merges PR `pm/qld-test-cases` → main. Developer agent then proceeds with T4.1 (QLD rule-set scaffold) and T4.2 (rules + orchestrator) per the updated acceptance criteria in `tasks.md` §4. Phase 2 (mixed-state bulk CSV foundation) continues in parallel where applicable.

### E3 · Audit Upload and Variance Report
- **Phase**: Phase 1
- **Pre-flight blockers**: audit data acquisition path (see Open Decisions in product.md)
- **Next action**: hold until E1 NSW rules engine is stable, then specify CSV import + replay + variance report

### E4 · Payroll System Integrations
- **Phase**: Phase 2
- **Pre-flight blockers**: first payroll-vendor selection; OAuth/API access agreements with vendor
- **Next action**: hold until E2 has at least 2-3 states encoded and E3 audit-replay is in production

## Obsolete / won't fix

_None yet._
