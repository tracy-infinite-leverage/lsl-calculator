# LSL Calculator · Epic Status · Last updated: 2026-05-25 · E1 NSW SHIPPED (Phases 1+2+3 live on lsl-calculator.vercel.app) · E2 Phase 1+3+4+5 merged to main (PR #8 `56ae5fd`, PR #10 `93484f3`, PR #11 `0bddbbc`, PR #13 QLD engine, PR #14 DEV-CROSS-1 `bd2d284`, PR #18 DEV-CROSS-2 `0a2d652`, PR #19 WA engine `fe66b99` — VIC + QLD + WA engines LIVE) · E2 Phase 6 (SA) T6.0 ✅ SIGNED OFF 2026-05-25 on branch `pm/sa-test-cases` — all 12 TBDs resolved; T6.1 unblocked immediately; NO DEV-CROSS-3 (TBD-SA-07 SA-localised via `extraInputs`)

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
| E1 · NSW Calculator | ✅ done | 100% | ●●●●● | 0 | 6 (Q-01..Q-04 fixed in PR #3; Q-05/Q-06 pre-existing single-mode items, separate cleanup ticket) | **SHIPPED 2026-05-24.** Phases 1+2+3 live on https://www.lslcalculator.com.au (also reachable at lsl-calculator.vercel.app). PR #3 squash-merged at `50061f5`. Architectural fix removed server-side pdfjs (issue #5) in favour of Anthropic document content block. 319 unit tests + 92 Playwright across 4 browsers. Phase 7 (opt-in logins) deferred post-launch. |
| E2 · All-State Coverage | 🔄 in flight | 73% | ●●●●○ | 0 | 0 | Spec v0.3.1 + impl-plan v0.3.3 + tasks v0.3.3 committed (10 phases, 77 tasks; total 32–48 dev-days). **Phases 1+3+4+5 MERGED to `main`** (PR #8 `56ae5fd`, PR #10 `93854f3`, PR #11 `0bddbbc`, PR #13 QLD engine `11511fb`, PR #14 DEV-CROSS-1 `bd2d284`, PR #16 QLD v1.1 `fb52701`, PR #18 DEV-CROSS-2 `0a2d652`, PR #19 WA engine `fe66b99` — 73 WA fixtures incl. 5 DEV-CROSS-2-dependent reinstated). NSW + VIC + QLD + WA all LIVE. **Phase 6 (SA) T6.0 ✅ SIGNED OFF 2026-05-25** — `docs/qa/test-cases-sa.md` v1.0 PM-signed Tracy Angwin on branch `pm/sa-test-cases`, 67 fixtures (64 single + 3 bulk). **All 12 TBDs resolved**: TBD-SA-01 single regime (no dual-regime split — SA mirrors QLD's flat architecture); TBD-SA-04 SA-localised `extraInputs.sa_worker_notice_compliance`; TBD-SA-07 SA-localised `extraInputs.sa_higher_duties_*` (operator chose YAGNI — **NOT DEV-CROSS-3, no pre-flight cross-state PR**); other 9 per PM-recommended path. **T6.1 unblocked immediately** — engine work proceeds at M (3-5 dev-days). |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: **SHIPPED 2026-05-24**. Phases 1+2+3 in production.
- **Pipeline**: ●●●●● (Stage 5 · Shipped — live on https://www.lslcalculator.com.au, also reachable at lsl-calculator.vercel.app)
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
- **Post-launch follow-ups**: (1) Q-05 + Q-06 pre-existing single-mode browser-only items — separate cleanup ticket; (2) issue #4 (P3 UX) on empty service-event rows blocking Calculate; (3) Phase 7 opt-in logins when there's customer pull for them. ~~Cloudflare DNS for `lsl.austpayroll.com.au`~~ resolved 2026-05-25 — domain switched to `www.lslcalculator.com.au`, now live.
- **Phase 7 scope (added 2026-05-23)**: opt-in user accounts with email + password (no magic links, no SSO, no OAuth). Adds `profiles` + `saved_calculations` Supabase tables with RLS, signup/login/reset flows, "my calculations" history view, and an account-deletion path. Triggers a privacy-notice revision (S1 changes from "no server-side employee data" to "permitted for authenticated users only").

### E2 · All-State Coverage
- **Phase**: **Phase 3 (VIC) SHIPPED; Phase 4 (QLD) SHIPPED (incl. DEV-CROSS-1 + QLD v1.1); Phase 5 (WA) SHIPPED (incl. DEV-CROSS-2 + WA engine T5.1-T5.5); Phase 6 (SA) T6.0 ✅ SIGNED OFF 2026-05-25 — all 12 TBDs resolved; T6.1 UNBLOCKED immediately; NO DEV-CROSS-3 (TBD-SA-07 SA-localised via `extraInputs`)** — 2026-05-25
- **Pipeline**: ●●●●○ (Stage 1 Specified done; Stage 2 In flight — Phase 1+3+4+5 merged; Phase 6 T6.0 SIGNED OFF; T6.1 unblocked)
- **Spec**: `.specify/features/002-all-state-coverage/spec.md` **v0.3.1** (2026-05-24 — s.67 → s.34 citation correction per TBD-VIC-12; all 6 OQs still resolved per v0.3.0)
- **Plan + tasks**: `.specify/features/002-all-state-coverage/{impl-plan,tasks}.md` **v0.3.3** (2026-05-25 — Phase 6 SA TBDs resolved; §6 expanded to document resolved interpretations; **no architectural re-scope** — TBD-SA-01 single regime; **no DEV-CROSS-3** — TBD-SA-07 SA-localised; 10 phases, 77 tasks, **32–48 dev-days** unchanged). Phase 6 T6.1-T6.4 acceptance criteria expanded 2026-05-25 to reflect resolved TBD-SA-01..12 interpretations.
- **Dev findings**: `.specify/features/002-all-state-coverage/dev-findings.md` (0 HIGH, **8 MEDIUM**, 5 LOW). **DEV-CROSS-1** ✅ MERGED 2026-05-25 at `bd2d284` (PR #14). **DEV-CROSS-2** ✅ MERGED 2026-05-25 at `0a2d652` (PR #18). **NO DEV-CROSS-3 created** — operator explicitly chose YAGNI for TBD-SA-07 (higher-duties acting rate); SA-localised via `extraInputs.sa_higher_duties_*` instead of promoting to `Employee` fields. If NT/TAS/ACT genuinely need this concept later, retrofit at that time.
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
- **Phase 4 T4.0 status**: ✅ **SIGNED OFF 2026-05-25** by Tracy Angwin (PM). `docs/qa/test-cases-qld.md` v1.1 (was v1.0 — bumped 2026-05-25 to reinstate the 5 DEV-CROSS-1-deferred fixtures). 57 active single-mode + 3 bulk = 60 total fixtures covering QLD IR Act 2016 ss.93–110 (Chapter 2 Part 3 Division 9) + s.134 (general continuity) + historical cliffs (s.96 = 23 June 1990 general; s.103 = 30 March 1994 casual). Coverage spans the s.95(2) 10-yr automatic payout (incl. misconduct), the s.95(3)/(4) 7–10-yr qualifying-reason gate, s.110 cashing-out non-blocking advisory (vs VIC's hard error), s.105 casual loaded-rate, s.99 commission averaging, s.97 PH-exclusive treatment, and 3 bulk fixtures asserting per-state branching across NSW + VIC + QLD. **All 6 TBDs resolved** — see Resolutions section in the document:
  - **TBD-QLD-01** (Sev-1, 15-yr accrual + threshold inclusivity): RESOLVED. Continuous 1/60 accrual (no discrete step at 15 yrs); thresholds at 7/10/15 yrs all inclusive at exact-day boundary.
  - **TBD-QLD-02** (Sev-1, historical cliffs): RESOLVED. s.103 casual cliff HARD-ANCHOR to 1994-03-30; s.96 general cliff ADVISORY-ONLY (use actual start date + emit warning). Casual portion of casual-to-permanent transition follows the cliff.
  - **TBD-QLD-03** (Sev-2, casual rate-of-pay averaging window): RESOLVED. Single 52-wk lookback per Business QLD's published formula. NOT multi-tier "greater of".
  - **TBD-QLD-04** (Sev-2, cash-out advisory granularity): RESOLVED. No user-supplied s.110 ground required; emit BOTH base + sub-10-yr-specific advisories; pass through with $0 at sub-7-yr.
  - **TBD-QLD-05** (Sev-2, Workers Comp rate-of-pay): RESOLVED. Apply literal s.98 ordinary-rate-at-leave-time even if reduced WC rate. NEW: emit `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory when a `workers_comp_absence` overlaps the trigger date, suggesting LSL deferral if feasible.
  - **TBD-QLD-06** (Sev-2, termination-reason enum design): RESOLVED via cross-state refactor. **DEV-CROSS-1 MERGED** in PR #14 at `bd2d284` (2026-05-25). The 5 fixtures previously deferred to this refactor (TC-QLD-005 employer-initiated illness, TC-QLD-007 employer_initiated_not_misconduct, TC-QLD-008 unfair_dismissal, TC-QLD-015 poor_performance, TC-QLD-016 domestic_pressing_necessity) have been reinstated as active QLD launch-gate fixtures in v1.1 of `test-cases-qld.md` (2026-05-25, this PR). All 5 pass the engine gold-standard test on first run with no engine code changes.
- **Pre-flight blockers**: DEV-CROSS-2 must merge before WA T5.1 (rule-set scaffold) starts. Same pattern as DEV-CROSS-1 was a pre-flight blocker for the 5 deferred QLD fixtures.
- **DEV-CROSS-1 status**: ✅ MERGED 2026-05-25 at `bd2d284` (PR #14). Cross-state termination-reason enum redesign added the additive enum (`employer_initiated_not_misconduct`, `unfair_dismissal`, `domestic_pressing_necessity`, `poor_performance`) + optional `terminationInitiator: 'employee' | 'employer'` on the termination trigger. NSW + VIC byte-identical preserved; QLD now exercises all sub-paragraphs of s.95(3). 5 deferred QLD fixtures reinstated in a follow-up PR (this PR).
- **Phase 5 T5.0 status**: ✅ **SIGNED OFF 2026-05-25** by Tracy Angwin (PM). `docs/qa/test-cases-wa.md` v1.0 on branch `pm/wa-test-cases`. **70 active single-mode + 3 bulk = 73 total fixtures** covering WA LSL Act 1958 ss.4–9 + WCIM Act 2023 (WA) WC counts-from-2024-07-01 override. Coverage spans s.8(1) accrual, s.8(3) "any-reason except serious misconduct" pro-rata at 7+ yrs (WA divergence from NSW/QLD — voluntary resignation qualifies), the WA-unique 10+yr serious-misconduct PARTIAL forfeiture (only last fully-accrued block payable, less prior leave taken against that block), s.9 accrual-period averaging (different from VIC 3-tier and QLD 52-wk), s.5 cash-out post-accrual advisory (non-blocking — aligns with QLD; contrast VIC s.34 hard error), s.6 dual continuous-service modules selected by accrual-block "fully accrued" date, the independent 2024-07-01 WC cutoff, the 2-mo/6-mo non-slackness/slackness re-employment tolerances, and 3 bulk fixtures asserting per-state branching across NSW + VIC + QLD + WA. **All 16 TBDs resolved** — see Resolutions section in the document:
  - **TBD-WA-01** (Sev-1, LOAD-BEARING — dual-regime architecture): RESOLVED. Accept PM's reading — single rule set with date-aware continuous-service handling, mirroring TBD-VIC-01. Impl-plan §5 re-scoped at v0.3.2; ~2 dev-days saved on Phase 5 (5–8 → 4–6).
  - **TBD-WA-07** (Sev-1, 10+yr misconduct partial-forfeiture interaction with leave already taken): RESOLVED. Accept PM's reading — `payable = max(0, last_fully_accrued_block_weeks - leave_already_taken_against_that_block)`. Engine subtracts prior leave taken against that block.
  - **TBD-WA-08, -12, -13, -14 + slackness signal** (Sev-2/3 schema extensions): RESOLVED via DEV-CROSS-2. Bundle as separate state-agnostic WA-schema-extension PR. Same pattern as DEV-CROSS-1. Adds `slacknessOfTrade` to `employer_initiated_termination_and_rehire`, `paidConcurrent` + `returnToWorkProgram` to `workers_comp_absence`, `reasonableExpectationOfReturn` to `unpaid_parental_leave`, `mealsAndAccommodationCashValueWeekly` to `Employee`. Lands BEFORE WA T5.1 begins. 5 fixtures (TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060) remain in active launch-gate suite, pass once DEV-CROSS-2 lands.
  - **TBD-WA-02** (Sev-2, WCIM Act 2023 section number): RESOLVED with documented limitation. Cite as "WCIM Act 2023 (WA)" at Act level in v1; sub-section TBD via quarterly review (RES-3). One research pass attempted; legislation pages did not load via WebFetch — most likely s.709 (consequential amendments part). Documented limitation acceptable for launch.
  - **TBD-WA-03** (Sev-2, cashing-out advisory granularity): RESOLVED. Three distinct codes — post-accrual, pre-first-milestone, no-entitlement — parallel to resolved TBD-QLD-04.
  - **TBD-WA-04** (Sev-2, 15-yr accrual continuous + threshold inclusivity): RESOLVED. Continuous 1/60 (no discrete step); thresholds at 7, 10, 15, 20, 25 yrs inclusive at exact-day boundary. Parallel to resolved TBD-QLD-01.
  - **TBD-WA-05** (Sev-2, WC rate of pay during LSL): RESOLVED. Literal s.9 ordinary rate at leave time + `wa_lsl_calculated_at_wc_reduced_rate_warning` advisory when WC overlaps trigger date. Parallel to resolved TBD-QLD-05. WA has NO equivalent to VIC s.17.
  - **TBD-WA-06** (Sev-2, accrual-period averaging partial-block handling): RESOLVED. Average over partial duration only — not extrapolated to 5 yrs.
  - **TBD-WA-09** (Sev-2, pre-2022 sickness cap working days vs calendar days): RESOLVED. Working days proportionate to the employee's normal pattern (FT 5-day-week: 15; PT 3-day-week: 9; casual: based on prior 52-wk pattern).
  - **TBD-WA-10** (Sev-3, pre-2022 casual continuity general-rule application): RESOLVED. Apply general s.6 2-mo non-slackness / 6-mo slackness re-employment tolerances + `wa_pre_2022_casual_no_specific_rules` advisory.
  - **TBD-WA-11** (Sev-3, cutoff inclusivity at exactly 2022-06-20): RESOLVED. Blocks fully accrued ON 2022-06-20 → post-2022 (strict "on or after" reading). TC-WA-042 `first_block_rules` updated to `post_2022` (was inline-noted as `pre_2022` in draft).
  - **TBD-WA-15** (Sev-3, pre-first-milestone cash-out hard-error vs advisory): RESOLVED. Advisory (status: computed + warning), parallel to QLD's universal advisory model.
  - **TBD-WA-16** (Sev-3, sub-7-yr death no-carve-out): RESOLVED. No carve-out. Death at sub-7-yr returns $0 (same as resignation at sub-7-yr).
- **DEV-CROSS-2 status**: ✅ MERGED 2026-05-25 at `0a2d652` (PR #18). State-agnostic schema extension added 5 optional fields (`slacknessOfTrade`, `paidConcurrent`, `returnToWorkProgram`, `reasonableExpectationOfReturn`, `mealsAndAccommodationCashValueWeekly`). NSW + VIC + QLD fixtures byte-identical.
- **Phase 5 WA engine status**: ✅ MERGED 2026-05-25 at `fe66b99` (PR #19). 73 WA fixtures all green (incl. 5 DEV-CROSS-2-dependent reinstated). WA LIVE.
- **Phase 6 T6.0 SA status**: ✅ **SIGNED OFF 2026-05-25** by Tracy Angwin (PM). `docs/qa/test-cases-sa.md` v1.0 PM-signed on branch `pm/sa-test-cases`. **64 active single-mode + 3 bulk = 67 total fixtures** covering SA LSL Act 1987 ss.3–6 (+ LSL (Calculation of Average Weekly Earnings) Amendment Act 2015 (SA) ordinary-pay methodology). Coverage spans: s.5(1) 13-week first entitlement at 10 yrs (F10/AC12 — most generous in Australia); s.5(3) 7-10-yr pro-rata with TWO disqualifiers (serious & wilful misconduct + SA-unique unlawful-worker-termination); s.5 PH-INCLUSIVE in LSL period (F11/AC13 — headliner divergence from all 4 prior states); SA-unique higher-duties acting rate (s.4); 156-wk all-hours casual averaging with WC/UPL substitution (s.4 as amended 2015); cashing-out non-blocking advisory post-10-yr (s.5); 10+ yr full-payout-regardless-of-reason (parallel to NSW/VIC/QLD; SA does NOT mirror WA's partial-forfeiture). **All 12 TBDs resolved** — see Resolutions section in the document:
  - **TBD-SA-01** (Sev-1, LOAD-BEARING — dual-regime architecture): RESOLVED. Accept PM's reading — **single regime, no date-aware service routing**. LSL (AWE) Amendment Act 2015 (SA) applies prospectively to all LSL taken on/after commencement INCLUDING for absences before commencement — uniform forward-looking rule, not a dual-regime cliff. SA mirrors QLD's flat single-regime architecture. Impl-plan v0.3.3 §6 stands as drafted (no re-scope). Phase 6 effort estimate stays at M (3-5 days).
  - **TBD-SA-04** (Sev-2, schema-impact — unlawful-worker-termination representation): RESOLVED. Accept PM's reading — SA-localised `extraInputs.sa_worker_notice_compliance: boolean` (default `true`). Consistent with ACT extraInputs pattern (Phase 7). No cross-state `TerminationReason` enum change.
  - **TBD-SA-07** (Sev-2, schema-impact — higher-duties acting rate): RESOLVED — **operator chose `extraInputs.sa_higher_duties_*` over DEV-CROSS-3**. SA-localised via `extraInputs.sa_higher_duties_active: boolean` + `extraInputs.sa_higher_duties_weekly_rate: number`. YAGNI — SA is the only state with a statutory higher-duties rule for LSL today. **No new DEV-CROSS-3 dev-finding created. T6.1 unblocked immediately — no pre-flight cross-state PR required.**
  - **TBD-SA-02, -03, -05, -06, -08, -09, -10, -11, -12** (Sev-2/3, resolved per PM-recommended path): casual continuity 3-mo/6-mo heuristic (TBD-SA-02); cashing-out citation `SA LSL Act 1987 s.5` at Act level only with documented limitation pending RES-3 quarterly review, parallel to TBD-WA-02 (TBD-SA-03); WC counts as service AND triggers 156-wk substitution separately (TBD-SA-05); three distinct cash-out advisory codes parallel to WA (TBD-SA-06); WC overlap literal s.4 + advisory parallel to QLD/WA (TBD-SA-08); single-day PH-LSL counts as 1 day of LSL — literal inclusive rule (TBD-SA-09); SA public-holidays calendar from Public Holidays Act 1910 (SA), 12 PHs (TBD-SA-10); portable LSL schemes out of v1 scope, no advisory (TBD-SA-11); pre-1987 service counts where continuous, moot in practice (TBD-SA-12).
- **Next action**: Developer agent picks up T6.1 (SA rule-set scaffold) — **unblocked immediately**. No pre-flight cross-state PR required. Engine work proceeds at M (3-5 dev-days) per impl-plan v0.3.3 §6.

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
