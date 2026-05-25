# SA LSL Calculator — Gold-Standard Test Cases

**Status**: SIGNED OFF · Tracy Angwin (PM) · 2026-05-25
**Version**: v1.0
**Date**: 2026-05-25
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.2 Phase 6 (SA) — single regime, no DEV-CROSS-3 (TBD-SA-07 SA-localised via `extraInputs`)
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T6.0 ✅ SIGNED OFF; T6.1 unblocked immediately (no pre-flight cross-state PR)
**Source-of-truth Acts**:
- *Long Service Leave Act 1987* (SA) — sections 3, 4, 5, 6, 7, 8 (and where relevant 9, 10, 11). Cited as **"SA LSL Act 1987 s.N"**.
- *Long Service Leave (Calculation of Average Weekly Earnings) Amendment Act 2015* (SA) — amended the ordinary-pay calculation in s.3/s.4. Applies prospectively to all LSL taken or paid in lieu **on or after commencement**, including absences before commencement. Cited as **"LSL (AWE) Amendment Act 2015 (SA)"** where the historical change point is relevant — but see TBD-SA-01 below: the transitional provision is uniform forward-looking, not dual-regime, so no date-aware service routing is required.

---

## Resolutions (2026-05-25 — PM Tracy Angwin)

All 12 TBDs are resolved as listed below. The verbatim resolution text is the authority — where individual fixtures elsewhere in this document still carry "TBD" markers in inline prose, treat the Resolutions section here as binding and the inline marker as historical context to be ignored.

### TBD-SA-01 (Sev-1, LOAD-BEARING) — Dual-regime architecture

**RESOLVED: Accept PM's reading. Single regime, no date-aware service routing.** The LSL (Calculation of Average Weekly Earnings) Amendment Act 2015 (SA) transitional provision is uniform forward-looking — the amended methodology applies to every calculation taken on or after commencement, INCLUDING in respect of absences before commencement. There is no need for two parallel rule sets. SA mirrors QLD's flat single-regime architecture. **Impl-plan v0.3.2 §6 stands as drafted — no re-scope.** No `rules-pre-X.ts` / `rules-post-X.ts` split; no `sa_regime_split_applied` warning code; no insufficient-granularity fallback fixtures. Phase 6 effort estimate stays at M (3–5 days).

### TBD-SA-02 (Sev-2) — Casual continuity gap threshold

**RESOLVED: 3-month heuristic for casual gaps without seasonal-shutdown justification; up to 6 months tolerated where the user supplies a seasonal-shutdown signal.** Surface `sa_casual_continuity_uncertain` advisory when the gap is 2–6 months without seasonal justification. SafeWork SA guidance does not prescribe a hard month-cap; the "regular or systematic" test is case-by-case. The 3-month/6-month heuristic matches QLD's hard threshold (which is operationally clean) while preserving SA's seasonal-shutdown carve-out. Fixtures TC-SA-050 (4-month seasonal — preserved) and TC-SA-051 (12-month no-justification — broken) are drafted on this assumption and unchanged.

### TBD-SA-03 (Sev-2) — Cashing-out section reference

**RESOLVED: Cite as "SA LSL Act 1987 s.5" without sub-section reference in v1.0.** Documented-limitation pending quarterly review — same precedent as TBD-WA-02 (which cited "WCIM Act 2023 (WA)" at Act level only). SafeWork SA and the Law Handbook SA describe the cashing-out rule but do not cite a sub-section verbatim; the AustLII s.5 page suggests the cashing-out rule is in s.5 (specifically s.5(3) read with s.5(4) or s.5 generally). One targeted research pass post-launch (RES-3 quarterly review) can verify the exact sub-section against the consolidated Act text. **Documented limitation** — citation accuracy is to Act level for cashing out, not section level. Acceptable for launch.

### TBD-SA-04 (Sev-2) — Unlawful-worker-termination representation

**RESOLVED: Accept PM's reading. SA-localised `extraInputs.sa_worker_notice_compliance: boolean` (default `true` — assume notice was given).** Localised to SA; no cross-state enum change; consistent with ACT's planned `extraInputs` pattern (Phase 7) and with the SA-localised pattern adopted for higher-duties (TBD-SA-07). The engine's SA orchestrator checks `extraInputs.sa_worker_notice_compliance` when `reason === 'voluntary_resignation'`. SA-only form field and SA-only optional bulk-CSV column. Fixtures TC-SA-025 → TC-SA-028 unchanged.

### TBD-SA-05 (Sev-2) — Workers Comp counts as service + excluded from 156-wk averaging

**RESOLVED: WC absence counts toward continuous service (same as NSW/VIC/QLD); separately, WC weeks are EXCLUDED from the 156-week casual/PT averaging window and substituted with prior worked weeks.** Two-rule treatment per SafeWork SA: (a) accruing-leave guidance lists "absences from work due to illness or injury (paid or unpaid sick leave, including for casual workers) are included" — the natural reading is WC sits within the broader illness/injury bucket and counts toward service; (b) part-time / casual calculation methodology: "Weeks on approved unpaid leave or weeks on workers' compensation are excluded from the calculation and substituted for a working week" — drives the 156-wk window extension. Fixtures TC-SA-030 (WC counts as service) and TC-SA-049 (WC triggers 156-wk substitution) unchanged.

### TBD-SA-06 (Sev-2) — Cashing-out advisory granularity

**RESOLVED: Three distinct advisory codes** — `sa_cashout_post_accrual_advisory` (10+ yr, post-accrual, agreement required), `sa_cashout_pre_accrual_not_authorised` (7–10 yr or otherwise pre-10-yr), `sa_cashout_no_entitlement_to_cash_out` (sub-7-yr, nothing to cash out). Parallel to resolved TBD-WA-03 (three-tier WA advisory) and resolved TBD-QLD-04. Stronger user awareness; modest engine complexity. Fixtures TC-SA-055 → TC-SA-058 unchanged.

### TBD-SA-07 (Sev-2) — Higher-duties acting rate representation

**RESOLVED: SA-localised via `extraInputs.sa_higher_duties_active: boolean` + `extraInputs.sa_higher_duties_weekly_rate: number`.** **NOT a DEV-CROSS-3 cross-state schema extension.** Operator chose YAGNI — SA is the only state with a statutory higher-duties rule for LSL today; NSW/VIC/QLD/WA have no analogous provision. If NT/TAS/ACT genuinely need this concept later, the retrofit is no harder than doing it now. Same SA-localised pattern as `extraInputs.sa_worker_notice_compliance` (TBD-SA-04 resolution). **No new dev-finding is created. T6.1 is unblocked immediately — no pre-flight cross-state PR is required.** Phase 6 effort estimate stays at M (3–5 dev-days) per impl-plan v0.3.2 §6. Fixture TC-SA-042 unchanged (already drafted with the extraInputs naming).

### TBD-SA-08 (Sev-3) — WC overlap with LSL rate

**RESOLVED: Literal s.4 rate at leave time + non-blocking `sa_lsl_calculated_at_wc_reduced_rate_warning` advisory.** Parallel to resolved TBD-QLD-05 and TBD-WA-05. SA s.4 has no s.17-equivalent higher-of-pre-injury-or-current rule (unlike VIC). The engine pays at the literal rate but emits the advisory. Fixture TC-SA-059 unchanged.

### TBD-SA-09 (Sev-3) — Single-day LSL on a PH

**RESOLVED: Count it as 1 day of LSL (charge entitlement; pay at ordinary daily rate).** Literal reading of the inclusive rule (s.5 + SafeWork SA — "Weekends and public holidays count during the period of long service leave"). Avoids unintentional gaming where a worker could schedule all LSL days on PHs to consume zero entitlement. 0 dev-days additional — already covered by the general PH-inclusive engine path. Fixture TC-SA-039 unchanged.

### TBD-SA-10 (Sev-3) — SA public-holidays calendar source

**RESOLVED: Hardcode the SA PH list from the Public Holidays Act 1910 (SA) into `website/src/lib/lsl/states/sa/rules/public-holidays.ts`.** Include the 12 standard SA PHs (NYD, Australia Day, Adelaide Cup Day, Good Friday, Easter Saturday, Easter Sunday, Easter Monday, Anzac Day, King's Birthday, Labour Day, Christmas Day, Proclamation Day). Adelaide Cup Day is the SA-unique PH (second Monday in March, metropolitan Adelaide); the engine treats it as a SA PH for the inclusive-leave-counting rule (statewide for v1 — regional carve-outs deferred to v2). Re-validate annually as part of RES-3 quarterly review. ½ dev-day for data entry + a date-arithmetic helper for Easter / King's Birthday.

### TBD-SA-11 (Sev-3) — Portable LSL schemes — out of v1 scope

**RESOLVED: OUT OF v1 SA engine scope.** Both the Construction Industry Long Service Leave Act 1987 (SA) and the Portable Long Service Leave Act 2024 (SA — community services from October 2025) are separate portable schemes that override the LSL Act 1987 for specific industries. The engine assumes the LSL Act 1987 (SA) governs and does NOT surface an industry-portable-scheme advisory in v1. Same convention as VIC industry awards, QLD industry-specific portable schemes, WA MyLeave construction. Re-evaluate in v2 if user surveys surface frequent confusion. 0 dev-days.

### TBD-SA-12 (Sev-3) — Pre-1987 service

**RESOLVED: Pre-1987 service counts where the employee was continuously employed with the same employer from before 1987 to the present.** SA LSL Act 1987 contains no explicit transitional-savings provision excluding pre-1987 service; the natural reading is that continuous service performed before 1987 with the same employer DOES count under s.6. In practice this is moot — an employee starting pre-1987 has 39+ years of post-1987 service to draw on, far above the 13-week first-entitlement threshold. The engine emits no advisory; the user-provided `startDate` is used as-is. No fixture needed; this is a documentary note for the v1 PM sign-off record.

### Net effect on fixtures and impl-plan

| Resolution | Fixture impact | Impl-plan impact |
|---|---|---|
| TBD-SA-01 | All fixtures unchanged (PM's option (b) was the basis the fixtures were drafted on) | §6 unchanged. No re-scope. No `sa_regime_split_applied` warning code. M (3–5 d) effort estimate stands. |
| TBD-SA-02 | TC-SA-050 + TC-SA-051 unchanged. 3-mo/6-mo threshold confirmed. | §6 acceptance criteria reflect 3-mo / 6-mo casual continuity threshold. |
| TBD-SA-03 | Citation form unchanged — `SA LSL Act 1987 s.5` already used at Act level for cash-out. | §6 documents the Act-level citation as a v1 limitation (parallel to TBD-WA-02). |
| TBD-SA-04 | Fixtures TC-SA-025 → TC-SA-028 unchanged. `extraInputs.sa_worker_notice_compliance` already used in fixture inputs. | §6 documents SA-localised `extraInputs` field. |
| TBD-SA-05 | TC-SA-030 (WC counts as service) + TC-SA-049 (WC triggers 156-wk substitution) unchanged. | §6 confirms two-rule WC treatment. |
| TBD-SA-06 | TC-SA-055 → TC-SA-058 unchanged. Three advisory codes confirmed. | §6 confirms three-code cash-out advisory taxonomy. |
| TBD-SA-07 | TC-SA-042 unchanged. `extraInputs.sa_higher_duties_active` + `extraInputs.sa_higher_duties_weekly_rate` already used in fixture inputs. **No DEV-CROSS-3.** | §6 documents SA-localised `extraInputs` fields. **No pre-flight cross-state PR.** T6.1 unblocked immediately. |
| TBD-SA-08 | TC-SA-059 unchanged. Literal s.4 + advisory confirmed. | §6 confirms parallel to QLD/WA WC-overlap pattern. |
| TBD-SA-09 | TC-SA-039 unchanged. Single-day PH counts as 1 day of LSL confirmed. | No §6 change — covered by general PH-inclusive path. |
| TBD-SA-10 | Fixtures TC-SA-037 → TC-SA-040 unchanged — they reference SA PHs hardcoded per the Public Holidays Act 1910 (SA). | §6 / T6.2 acceptance criteria reference hardcoded SA PHs from Public Holidays Act 1910 (SA). |
| TBD-SA-11 | No fixture impact. Out of v1 scope. | §6 documents portable schemes as deferred per state convention. |
| TBD-SA-12 | No fixture impact. Documentary note only. | No §6 change. |

**No fixture-value changes from the v1.0-draft. All 67 fixtures (64 single-mode + 3 bulk) stand as drafted.** The Resolutions section above is the binding authority for any inline TBD references that remain in fixture notes — the inline references are historical context, not unresolved questions.

---

## Sources of legal truth

- *Long Service Leave Act 1987* (SA) — current at the time of writing (May 2026), available at `legislation.sa.gov.au` (`__legislation/lz/c/a/long%20service%20leave%20act%201987/current/1987.73.auth.pdf`). Cited as **"SA LSL Act 1987 s.N"** throughout. Section numbers and headings verified against the legislation.sa.gov.au consolidated index and against the AustLII consolidated version at `classic.austlii.edu.au/au/legis/sa/consol_act/lsla1987179/`.
- *Long Service Leave (Calculation of Average Weekly Earnings) Amendment Act 2015* (SA) — Act No. 35 of 2015. Amended ordinary-weekly-earnings calculation (s.3 definitions + s.4 averaging methodology). Transitional provision: amendments apply to any LSL taken (or paid in lieu) **on or after commencement of the 2015 Act**, including in respect of absences occurring before commencement. **Single forward-looking regime — NOT a dual-regime cliff.** Source: legislation.sa.gov.au.
- *SafeWork SA — Long Service Leave* portal at `safework.sa.gov.au/workers/wages-and-conditions/long-service-leave` and downstream pages (`/calculating-long-service-leave`, `/calculating-leave-casual-workers`, `/calculating-leave-full-time-and-part-time-workers`, `/calculating-long-service-leave/commission,-target-and-per-piece-workers`, `/taking-leave/pro-rata-entitlement`, `/payment`, `/accruing-leave`, `/who-is-entitled-to-long-service-leave`, `/long-service-leave-faqs`). The official plain-English operational summary published by SafeWork SA (the enforcement body). Cited as **"SafeWork SA — LSL guidance"** where used.
- *SafeWork SA Guide to Long Service Leave 2025* — operational PDF (`safework.sa.gov.au/__data/assets/pdf_file/0006/726648/Guide-to-Long-Service-Leave-2025.pdf`). HTTP 403 during the v1.0-draft research pass — content corroborated via the SafeWork SA web pages and the Law Handbook SA. Cited as **"SafeWork SA Guide 2025"** where individual paragraphs were corroborated.
- *Law Handbook SA* at `lawhandbook.sa.gov.au/ch18s06s01.php` — published by the Legal Services Commission of South Australia. Cited as **"Law Handbook SA"**.
- *APA LSL Masterclass* PDF (`docs/features/LSL-training.pdf`) pp.80–94 — supplies worked examples for SA used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"**.
- *South Australian Employment Tribunal* (`saet.sa.gov.au/industrial-and-employment/long-service-leave-disputes/`) — authoritative for SA LSL disputes.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-SA-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or SA LSL Act 1987 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative / Cashing-out advisory) or Bulk mode
- **Why it matters** — the spec acceptance criterion or SA-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit SA LSL Act 1987 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic is unrounded — same convention as NSW (F12, AC25 in E1 spec), VIC, QLD, and WA.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-25` (= as-at default for v1 testing — same anchor as VIC/QLD/WA).
- **Entitlement formula** (SA LSL Act 1987 s.5): **13 weeks** at 10 years of continuous service, plus **1.3 weeks for each completed year after the first 10 years**. The accrual ratio is 1.3 / 10 = 0.13 weeks per year of service — the **most generous in Australia** (vs NSW/VIC/QLD/WA/TAS/ACT at 8.6667/10 = 0.0867 wks/yr). Same accrual table as NT (per impl-plan v0.3.2 §6 and §9 — `SA_NT_ACCRUAL_TABLE` to be extracted in T6.2). **This formula is unchanged across the LSL (AWE) Amendment Act 2015 cutoff** — that Amendment touched only the averaging methodology (s.3/s.4), not s.5 entitlements.
- **Pro-rata at termination** (s.5(3)): payable to an employee who has completed **at least 7 years** of continuous service whose employment ends for any reason **other than (a) serious and wilful misconduct, or (b) unlawful termination by the worker** (e.g. failure to give the notice required under contract or award). Pro-rata is **1.3 weeks for each completed year of service**, paid at the ordinary weekly rate immediately before termination. Death is treated equivalently (the entitlement vests in the personal representative — s.5(4) per the SafeWork SA / Law Handbook SA construction of the section).
- **Serious & wilful misconduct** (s.5(3)): forfeits all pro-rata at sub-10-yr tenure. **At 10+ years, the full 13-week (or higher) entitlement is payable regardless** — SA mirrors QLD on this point (no partial-forfeiture as in WA). The misconduct exception applies only to the **pro-rata** branch, not to the **full-entitlement** branch under s.5(1).
- **Unlawful termination by the worker** (s.5(3) — second disqualifier): SA-unique among the encoded states. If the worker walks off the job without giving the contractually required notice, the pro-rata branch is forfeited. Engine reads `extraInputs.sa_worker_notice_compliance: boolean` (default `true` — assume notice was given) when `reason === 'voluntary_resignation'` and emits the `unlawful_worker_termination_excluded_sa` warning when notice was not given and tenure is 7–10 yrs. SA-localised pattern per TBD-SA-04 RESOLUTION — no cross-state `TerminationReason` enum change.
- **Ordinary pay** (s.3/s.4 as amended 2015): for fixed-rate full-time employees, the ordinary weekly rate at the time of taking leave applies (excluding overtime, penalty rates, shift premiums). **Higher-duties / acting rule (SA-unique)**: if the employee is acting in a higher-paid position when LSL commences, the higher rate is the ordinary weekly rate. For **part-time and casual** employees, the **average of all hours worked (including overtime hours) over the 156 weeks immediately preceding the leave** is divided by 156 to derive the weekly hours figure, then multiplied by the **current base hourly rate** (including 25% casual loading for casuals; excluding overtime / penalty / shift premium components of the rate). **Weeks of approved unpaid leave or weeks during which the worker was paid through a workers-compensation claim are excluded from the 156-week window and substituted with prior worked weeks** (the window extends backward). For **commission / piece-rate / payment-by-result** employees, the **52-week (12-month) lookback** of total earnings divided by 52 is used per SafeWork SA — commission, target, and per-piece worker page. **Bonuses (e.g. Christmas bonus, target-achievement bonus on top of an hourly rate) are excluded.**
- **Continuous service** (s.6 + SafeWork SA guidance): paid working time and paid leave count (annual leave, paid personal/sick leave, LSL, paid parental leave). **Illness/injury including unpaid sick leave** counts (SafeWork SA guidance: "absences from work due to illness or injury (paid or unpaid sick leave, including for casual workers) are included"). **Workers compensation absences count as service** (SafeWork SA — accruing-leave guidance; TBD-SA-05 RESOLVED — WC counts as service AND triggers the 156-wk averaging substitution separately). **Unpaid leave agreed by the employer** does not count toward service but does not break continuity — entitlement date moves out (the so-called "extends-the-line" rule, contrast with NSW/VIC/QLD which apply different denominators). **Re-employment within 2 months** of a termination preserves continuity (SafeWork SA — accruing-leave guidance; same threshold as WA non-slackness; tighter than QLD's 3 months). **Casual / seasonal employees**: continuous service is preserved where the engagement is "regular or systematic" and absences are due to seasonal variation, temporary shutdown, or other authorised absences. Per TBD-SA-02 RESOLUTION: 3-month engine heuristic for casual gaps without seasonal-shutdown justification; up to 6 months tolerated where the user supplies a seasonal-shutdown signal (`sa_casual_continuity_uncertain` advisory between 2–6 months without seasonal justification).
- **Transfer of business** (s.6 + SafeWork SA): on a transmission of business to a new owner with the employee continuing to be employed, service is deemed continuous and the LSL liability transfers with the employee.
- **Public holidays during LSL** (s.5 + SafeWork SA — calculating-leave): **INCLUSIVE — a PH falling within an LSL period IS counted as a day of LSL; the leave is NOT extended by the duration of the PH.** This is the **headliner SA-specific divergence** from NSW/VIC/QLD/WA (all of which apply exclusive PH-during-LSL — PH extends the leave by one day per PH). See F11/AC13 in the E2 spec.
- **Cashing out** (SA LSL Act 1987 s.5 — Act-level citation only per TBD-SA-03 RESOLUTION, documented limitation pending RES-3 quarterly review): permitted **only after the employee has completed at least 10 years of continuous service**. Requires **written agreement signed by both parties**. Employer must provide a written statement showing entitlement, payment amount, period covered, and remaining leave. **Engine emits a non-blocking advisory** when a `cash_out` trigger is received — same shape as QLD (`qld_cashout_requires_instrument_or_qirc`) and WA (`wa_cashout_post_accrual_advisory`); contrast VIC's hard-error path. Three advisory codes per TBD-SA-06 RESOLUTION (parallel to WA/QLD precedent): `sa_cashout_post_accrual_advisory` (10+ yr, post-accrual, agreement required), `sa_cashout_pre_accrual_not_authorised` (7–10 yr or otherwise pre-10-yr, no statutory basis), `sa_cashout_no_entitlement_to_cash_out` (sub-7-yr, nothing to cash out).
- **Pay-on-termination timing** (s.5(3) + SafeWork SA): "the employer must pay the worker the amount to which they are entitled **immediately upon termination**." Same effective rule as NSW ("forthwith"), VIC ("on the day on which the employment ends"), and QLD (next-pay-cycle accepted in practice). v1 treats next-pay-cycle as compliant; user can over-ride.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## SA-specific divergences from NSW + VIC + QLD + WA (the load-bearing facts)

| Topic | NSW | VIC | QLD | WA | SA | SA source |
|---|---|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | 10 yrs | 10 yrs | **10 yrs** | SA LSL Act 1987 s.5(1) |
| Entitlement at qualifying period | 8.6667 wks | 6.0667 wks (at 7 yrs, 8.6667 at 10) | 8.6667 wks | 8.6667 wks | **13 weeks** (most generous in Australia) | SA LSL Act 1987 s.5(1); F10/AC12 |
| Accrual rate after first entitlement | 1/60 (8.6667 / 10 = 0.0867 wks/yr) | 1/60 | 1/60 (continuous, per resolved TBD-QLD-01) | 1/60 (continuous, per resolved TBD-WA-04) | **1.3 wks/yr continuous after 10 yrs** (1.3 / 10 = 0.13 wks/yr — 50% higher rate than other states) | SA LSL Act 1987 s.5(1); SafeWork SA |
| 15-year additional accrual | continuous 1/60 | continuous 1/60 | continuous 1/60 | continuous 1/60 | **continuous 1.3/yr — NO discrete step**. At 15 yrs: 13 + 5 × 1.3 = 19.5 wks. At 20 yrs: 13 + 10 × 1.3 = 26.0 wks | SA LSL Act 1987 s.5(1); SafeWork SA |
| Pro-rata at termination (sub-10-yr threshold) | 5 yrs (limited reasons) | 7 yrs (any reason, incl. misconduct) | 7 yrs (limited reasons under s.95(3)) | 7 yrs (any reason except serious misconduct) | **7 yrs (any reason except serious & wilful misconduct OR unlawful termination by worker)** | SA LSL Act 1987 s.5(3); SafeWork SA — pro-rata entitlement |
| Sub-7-yr entitlement | none on resignation; pro-rata at 5 yrs for limited reasons | none | none | none | **none — no sub-7-yr entitlement** | SA LSL Act 1987 s.5(3) |
| Resignation between 7–10 yrs | not payable | full payout | not payable (only qualifying reasons) | pro-rata payable | **PRO-RATA PAYABLE (1.3 wks × completed yrs) — voluntary resignation qualifies unless worker's notice was deficient ("unlawful termination by worker")** | SA LSL Act 1987 s.5(3); SafeWork SA — "1.3 weeks for each completed year of service" |
| Redundancy at 7–10 yrs | pro-rata (limited at 5+) | full payout | pro-rata (s.95(3)(d)) | pro-rata payable | **pro-rata payable** | SA LSL Act 1987 s.5(3); SafeWork SA |
| Serious-misconduct dismissal — sub-10-yr | full forfeiture | full payout | full forfeiture (s.95(3)(d)) | full forfeiture | **full forfeiture — NO pro-rata** | SA LSL Act 1987 s.5(3) |
| Serious-misconduct dismissal — 10+ yrs | full payout | full payout | full payout | **PARTIAL FORFEITURE** (last fully-accrued block only) | **FULL PAYOUT — same as NSW/VIC/QLD; SA does NOT mirror WA's partial-forfeiture** | SA LSL Act 1987 s.5(1); SafeWork SA — "13 weeks vests after 10 years' continuous service" |
| Unlawful termination by worker (sub-10-yr) | not specifically encoded | not specifically encoded | not specifically encoded | not specifically encoded | **FORFEITURE — SA-unique. If worker fails to give the required notice on resignation, pro-rata is barred** | SA LSL Act 1987 s.5(3); SafeWork SA — "or if you unlawfully terminated your employment, such as failure to give the required amount of notice" |
| Break tolerance — re-employment after termination | 2 mo (≤60 days) | 12 weeks | 3 months | 2 months (non-slackness); 6 months (slackness of trade) | **2 months** | SA LSL Act 1987 s.6; SafeWork SA — accruing-leave |
| Casual continuity test | "regular and systematic" | 12 weeks unless agreement, seasonal, etc. (s.12(3)) | 3 months between contracts (s.103) | No specific gap; "permitted under the terms of employment / regular and systematic" | **"regular or systematic" — no specific gap duration; seasonal shutdowns / temporary closures preserve** | SA LSL Act 1987 s.6; SafeWork SA — casual workers |
| Casual loading | included | included | included (s.105) | included (s.9 as amended 2022) | **included (25% loading for SA casuals)** | SafeWork SA — casual workers calculation |
| Historical cliffs | none | 1 Nov 2018 (dual-regime via s.57) | 23 Jun 1990 (general); 30 Mar 1994 (casual) | 20 June 2022 (continuous-service rules amended) | **NONE — no historical cliff. The LSL (AWE) Amendment Act 2015 (SA) is forward-looking only and not a dual-regime split** | SA LSL Act 1987 (no transitional cliffs in s.5/s.6); LSL (AWE) Amendment Act 2015 (SA) transitional provision |
| Sickness / injury counted as service | counts | counts | counts | **15-day cap pre-2022; counts in full post-2022** | **counts (paid or unpaid sick leave — SafeWork SA guidance is explicit)** | SafeWork SA — accruing-leave; Law Handbook SA |
| Unpaid leave (other than sick) | excluded | first 52 wks count (s.13(1)(b)) | does not count but no break (s.134) | excluded pre-2022; depends on regime post-2022 | **does not count as service but does not break continuity — entitlement date moves out ("extends-the-line")** | SafeWork SA — accruing-leave |
| Workers Comp absence | counts (NSW LSA s.4(11)) | counts (s.13(1)(b)) | counts (s.134) | depends on accrual date (cap pre-2022 / excluded pre-2024-07-01 / counts post-2024-07-01) | **counts as continuous service — but excluded from 156-wk casual/PT averaging window (substituted with prior worked weeks)** | SafeWork SA — part-time / casual calculation methodology |
| WC rate of pay during LSL | counts as service; current ordinary rate | s.17 higher-of-pre-injury-or-current | literal s.98 ordinary rate at leave time + advisory | literal s.9 ordinary rate at leave time + advisory | **literal s.4 ordinary rate at leave time + advisory (parallel to QLD/WA)** — TBD-SA-08 RESOLVED | SA LSL Act 1987 s.4; SafeWork SA |
| Higher-duties / acting rate | not specifically encoded | not specifically encoded | not specifically encoded | not specifically encoded | **SA-UNIQUE: if employee is acting in a higher-paid position when LSL begins, the higher rate is the ordinary weekly rate** | SA LSL Act 1987 s.4; SafeWork SA — full-time calculation |
| Public holiday during LSL | exclusive (NSW LSA s.4(4A)) | exclusive (s.7) | exclusive (s.97) | exclusive (s.9) | **INCLUSIVE — PH falling within LSL counts as a day of LSL; does NOT extend the leave** | SA LSL Act 1987 s.5; SafeWork SA — calculating LSL; F11/AC13 |
| Death of employee | NSW LSA s.4(2)(iii)(d) — pro-rata, estate on request | s.10 — full accrued + 52-wk avg | s.95(3)(a) — pro-rata to legal personal rep | s.8(3) — pro-rata to legal personal rep | **s.5 — entitlement vests in personal representative; pro-rata payable at 7+ yrs (any age), full entitlement at 10+** | SA LSL Act 1987 s.5; AustLII s.5 quote: "Where a worker's service is terminated by the worker's death, the worker's entitlement under this section vests in his or her personal representative" |
| Casual averaging window | implicit via "regular and systematic" + 52-wk lookback (E1) | 3-tier: weekly_avg_12mo / weekly_avg_5yr / whole (s.15(2)) | 52 weeks (s.105 per Business QLD) | accrual-period-average per block (s.9 — partial-duration averaging per TBD-WA-06) | **156 weeks (3 yrs) of all-hours-incl-overtime, with unpaid-leave / WC weeks substituted with prior worked weeks** | SafeWork SA — casual / part-time calculation |
| Commission / piece-rate averaging window | research §1.4 (NSW) | 52 wks pre-leave (s.15(3)) | 365 days pre-leave (s.99) | 365 days pre-leave (s.9 results-based) | **52 weeks (12 months) of total income immediately preceding leave date** | SafeWork SA — commission, target and per-piece workers |
| Cashing out | not in scope NSW v1 | **CRIMINAL OFFENCE — s.34** | PERMITTED via instrument or QIRC order (s.110) — advisory | PERMITTED post-accrual only with written agreement (s.5 as amended 2022) — advisory | **PERMITTED post-10-yr only with written agreement signed by both parties; employer must provide written statement — non-blocking advisory** | SA LSL Act 1987 s.5 (Act-level citation only per TBD-SA-03 RESOLUTION — documented limitation pending RES-3 quarterly review); SafeWork SA — cashing out |
| Pay-on-termination timing | "forthwith" (NSW LSA s.4(5)(a)) | "on the day on which the employment ends" (VIC s.9(1)(b)) | payable on termination (s.95) | payable on termination (s.8(3), s.9) | **payable IMMEDIATELY upon termination (next-pay-cycle accepted in SafeWork SA enforcement practice)** | SA LSL Act 1987 s.5(3); SafeWork SA — payment of entitlement |
| Working elsewhere during LSL | not encoded | OFFENCE under s.35 | not encoded | s.27 — forfeiture of unexpired LSL | **not specifically encoded in the SA Act; out of v1 SA scope** | SA LSL Act 1987 (no s.27 analogue) |
| Industry-specific portable schemes | not in scope | not in scope | separate Acts (s.110 cross-ref) | MyLeave portable scheme (construction) | **Construction Industry Long Service Leave Act 1987 (SA) + Portable Long Service Leave Act 2024 (SA) — community services from Oct 2025. OUT OF v1 statutory engine scope** | Portable LSL Act 2024 (SA); SA Construction Industry Long Service Leave Act 1987 |

---

## TBD-SA-01 (LOAD-BEARING) — Dual-regime architecture: NO · ✅ RESOLVED 2026-05-25

**RESOLUTION**: Single regime. No date-aware service routing required. See the binding Resolutions section near the top of this document. The detail below is retained as the reasoning that produced the resolution.

The original impl-plan v0.3.2 §6 does not call out a dual-regime risk for SA, and the research pass confirms there is no analogous transition cliff like VIC s.57 (2018-11-01) or WA 2022-06-20.

### Evidence

1. **No entitlement-formula amendment.** SA LSL Act 1987 s.5 has the same 13-weeks-at-10-yrs + 1.3-wks-per-further-year formula it had at enactment in 1987. No subsequent Amending Act has touched the entitlement weeks.

2. **The 2015 LSL (Calculation of Average Weekly Earnings) Amendment Act is forward-looking only.** Its transitional provision is explicit: *"the amendments effected to the Long Service Leave Act 1987 by this Act apply in relation to any long service leave taken (or any payment made in lieu of long service leave) on or after the commencement of the Act (including so as to apply in relation to absences of a worker occurring before the commencement of the Act)."* This is uniform forward-looking applicability — the new averaging methodology (156-wk all-hours-incl-overtime + WC/UPL substitution) applies to **every** calculation as at the leave date, regardless of when the underlying service was performed. There is no need for two parallel rule sets.

3. **No historical cliffs.** Unlike QLD (1990, 1994) or WA (2022-06-20), SA has no date-anchored historical limit baked into the Act. Pre-1987 service exists in some long-tenure employees' records, but the Act applies the same continuity test regardless of when the service was performed.

4. **No proposed amendment in the legislative pipeline that we have surfaced.** The Portable Long Service Leave Act 2024 (SA) is a **separate scheme** for community-services workers from October 2025; it does not amend the LSL Act 1987 itself.

### Therefore

- **No `rules-pre-X.ts` / `rules-post-X.ts` split needed.** SA mirrors QLD's flat single-regime structure. Impl-plan v0.3.2 §6 stands as drafted (no re-scope required).
- **No `sa_regime_split_applied` warning code.** Not needed.
- **No insufficient-granularity fallback case** (no TC-SA-{044,045} equivalent of TC-WA-044/045 needed).
- **Engine effort estimate stays at M (3–5 days)** per impl-plan v0.3.2 — no upward pressure from a regime split.

**TBD-SA-01 status**: ✅ RESOLVED — single regime confirmed by operator 2026-05-25. Impl-plan v0.3.2 §6 stands as drafted.

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF SA worked examples (pp.80–94) | TC-SA-001 → TC-SA-010 | 10 |
| Sub-7-year and 7–10-year qualifying-reason cases (s.5(3)) | TC-SA-011 → TC-SA-018 | 8 |
| 10+ year full payout (any reason, incl. misconduct at 10+) (s.5(1)) | TC-SA-019 → TC-SA-023 | 5 |
| Serious & wilful misconduct treatment + unlawful-worker-termination (s.5(3)) | TC-SA-024 → TC-SA-028 | 5 |
| Continuous-service edge cases (s.6) | TC-SA-029 → TC-SA-036 | 8 |
| Public holiday INCLUSIVE in LSL period (F11/AC13) — the headliner | TC-SA-037 → TC-SA-040 | 4 |
| Ordinary pay — fixed-rate, higher-duties acting, varied hours, commission/piece (s.4) | TC-SA-041 → TC-SA-047 | 7 |
| Casual employees — 156-wk all-hours averaging with WC/UPL substitution (s.4 + SafeWork SA) | TC-SA-048 → TC-SA-052 | 5 |
| 15-year and 20-year continuous-accrual cases (s.5(1)) | TC-SA-053 → TC-SA-054 | 2 |
| Cashing out — non-blocking advisory (s.5(3)/(4)) | TC-SA-055 → TC-SA-058 | 4 |
| Workers comp overlap + LSL rate advisory | TC-SA-059 | 1 |
| Transfer of business (s.6) | TC-SA-060 | 1 |
| As-at snapshot trigger | TC-SA-061 → TC-SA-062 | 2 |
| Cross-jurisdiction (SA + other state) | TC-SA-063 → TC-SA-064 | 2 |
| Bulk-mode fixtures | TC-SA-BULK-001 → TC-SA-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 SA launch** | | **64** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **67** |

> **Note on size**: SA fixture count (67) sits between QLD (60) and WA (73). SA has no dual-regime split (so no regime-split or insufficient-granularity fixtures) but it does carry four dedicated PH-INCLUSIVE fixtures (the headliner divergence), a dedicated SA-unique higher-duties case, the second SA-unique disqualifier (unlawful-worker-termination), and the 156-wk-with-substitution casual averaging methodology. Bulk count matches QLD/WA at 3.

---

# Single-mode test cases

## §A — APA PDF SA worked examples (pp.80–94)

### TC-SA-001 — 10 yrs FT resignation, full entitlement 13 weeks

- **Source**: APA p.80 worked example; SA LSL Act 1987 s.5(1)
- **Category**: Fixed-rate (s.4)
- **Why it matters**: Canonical "10 yrs → 13 weeks" calculation — the **most generous accrual in Australia** (F10/AC12). 50% larger than NSW/VIC/QLD/WA's 8.6667-week first entitlement.

**Inputs**

```yaml
employee:
  id: TC-SA-001
  legalName: SamSA
  startDate: 2016-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2016-05-25, periodEnd: 2026-05-25, grossPay: 936000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 13.0000        # s.5(1) — 13 wks at 10 yrs (NOT 8.6667)
value_of_week: 1800.00                   # s.4 — fixed-rate ordinary pay
value_of_day: 360.00                     # 1800 / 5 (FT 5-day week)
total_entitlement_dollars: 23400.00      # 13 × 1800
expected_citations:
  - { section: SA LSL Act 1987 s.5(1), rule: accrual.qualifying-period-10yr-13wks, pdfPage: 80 }
  - { section: SA LSL Act 1987 s.4,    rule: ordinary-pay.fixed-rate, pdfPage: 81 }
  - { section: SA LSL Act 1987 s.5(1), rule: trigger.termination.10yr-full-entitlement, pdfPage: 80 }
```

**Notes**

This is the **single load-bearing test for F10/AC12**. The same employee profile in NSW/VIC/QLD/WA returns 8.6667 weeks; in SA it returns 13.0 weeks. Engine MUST route to the `SA_NT_ACCRUAL_TABLE` (per impl-plan v0.3.2 §6 — shared with NT in T9.x) when `state === 'SA'`. The 50% uplift over 8.6667-week states is the most operationally significant cross-state divergence in the entire E2 epic.

---

### TC-SA-002 — 7 yrs FT resignation, pro-rata 9.1 wks (1.3 × 7)

- **Source**: APA p.81; SA LSL Act 1987 s.5(3); SafeWork SA — pro-rata entitlement
- **Category**: Pro-rata at termination — voluntary resignation 7+ yrs
- **Why it matters**: Voluntary resignation at 7-10 yrs PAYS OUT pro-rata in SA. Aligns with VIC, WA on the "any reason except misconduct" pattern. Diverges from NSW + QLD (which require a qualifying reason).

**Inputs**

```yaml
employee:
  id: TC-SA-002
  legalName: ResignationSAFixture
  startDate: 2019-05-25
  endDate: 2026-05-25                   # exactly 7 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2019-05-25, periodEnd: 2026-05-25, grossPay: 618800.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 9.1000          # 7 × 1.3
value_of_week: 1700.00
total_entitlement_dollars: 15470.00      # 9.1 × 1700
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination, pdfPage: 81 }
  - { section: SA LSL Act 1987 s.4,    rule: ordinary-pay.fixed-rate, pdfPage: 81 }
```

**Notes**

Pro-rata at SA uses 1.3 wks per completed year, NOT 8.6667/10. So 7 yrs = 9.1 wks (vs WA 6.0667 wks, vs VIC 6.0667 wks at 7 yrs). Engine MUST apply the SA-specific pro-rata multiplier from the `SA_NT_ACCRUAL_TABLE`. SafeWork SA guidance is explicit: "1.3 weeks for each completed year of service."

---

### TC-SA-003 — 8 yrs FT redundancy, pro-rata 10.4 wks

- **Source**: APA p.82; SA LSL Act 1987 s.5(3)
- **Category**: Fixed-rate, redundancy

**Inputs**

```yaml
employee:
  id: TC-SA-003
  legalName: RedundancySAFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1500.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 10.4000        # 8 × 1.3
value_of_week: 1500.00
total_entitlement_dollars: 15600.00
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination, pdfPage: 82 }
```

---

### TC-SA-004 — 8 yrs FT death, pro-rata 10.4 wks payable to personal representative

- **Source**: APA p.82; SA LSL Act 1987 s.5; SafeWork SA — payment
- **Category**: Pro-rata at termination — death

**Inputs**

```yaml
employee:
  id: TC-SA-004
  legalName: DeathSAFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: death }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 10.4000         # 8 × 1.3
value_of_week: 1700.00
total_entitlement_dollars: 17680.00
payment_recipient: "personal representative of the deceased worker"
expected_citations:
  - { section: SA LSL Act 1987 s.5, rule: trigger.termination.death-vests-in-personal-representative, pdfPage: 82 }
  - { section: SA LSL Act 1987 s.4, rule: ordinary-pay.fixed-rate, pdfPage: 81 }
```

**Notes**

SA has no equivalent to VIC's s.10 (52-wk averaging on death). The general s.4 ordinary-rate-at-leave-time rule applies, with the leave-time anchor for a death trigger being the date of death. The AustLII excerpt of s.5 confirms: *"Where a worker's service is terminated by the worker's death, the worker's entitlement under this section vests in his or her personal representative."*

---

### TC-SA-005 — 7 yrs FT serious-and-wilful-misconduct dismissal → $0

- **Source**: APA p.83; SA LSL Act 1987 s.5(3); SafeWork SA — pro-rata entitlement
- **Category**: Negative — sub-10-yr serious misconduct
- **Why it matters**: SA s.5(3) bars pro-rata for "serious and wilful misconduct" at sub-10-yr tenure. Aligns with NSW, QLD, WA. Diverges from VIC (which pays out regardless of reason).

**Inputs**

```yaml
employee:
  id: TC-SA-005
  legalName: MisconductSub10SAFixture
  startDate: 2019-05-25
  endDate: 2026-05-25                   # 7 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
warnings:
  - { code: sub_10yr_misconduct_excluded_sa, message: "Dismissal for serious and wilful misconduct under SA LSL Act 1987 s.5(3) — at sub-10-year tenure, no pro-rata entitlement is payable. At 10+ years, the full 13-week (or higher) entitlement is payable regardless of reason (SA mirrors NSW/VIC/QLD; SA does NOT mirror WA's partial-forfeiture). See TC-SA-024." }
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.serious-misconduct-excluded, pdfPage: 83 }
```

**Notes**

Critical engine branching: at sub-10-yr SA, misconduct returns $0 (parallel to NSW/QLD/WA). At 10+ yrs SA, the full entitlement is payable (parallel to NSW/VIC/QLD — NOT to WA's partial-forfeiture). This is the SA-vs-WA divergence at 10+ yrs.

---

### TC-SA-006 — 8 yrs PT dismissal not for misconduct, pro-rata 10.4 wks

- **Source**: APA p.84; SA LSL Act 1987 s.5(3)
- **Category**: Pro-rata at termination — PT employer dismissal not misconduct

**Inputs**

```yaml
employee:
  id: TC-SA-006
  legalName: PTDismissalSAFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: part_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 800.00              # 25 h/wk × $32/hr (current base hourly rate)
  normalWeeklyHours: 25
  hoursLast156Weeks: 3900                  # = 25 h/wk × 156 wks (steady PT pattern)
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: employer_initiated_not_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
weekly_avg_156w: 25.00                   # 3900 / 156 = 25 h/wk
value_of_week: 800.00                    # 25 × $32 (current base hourly rate)
value_of_day: 160.00
total_entitlement_weeks: 10.4000         # 8 × 1.3
total_entitlement_dollars: 8320.00
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination, pdfPage: 84 }
  - { section: SA LSL Act 1987 s.4,    rule: ordinary-pay.part-time-156wk-average, pdfPage: 85 }
```

**Notes**

PT-specific calculation per SafeWork SA — calculating-leave-full-time-and-part-time-workers: total hours worked in the prior 156 weeks ÷ 156 = weekly hours. Multiplied by current base hourly rate. For a steady-pattern PT employee the result is identical to "current weekly gross"; the divergence surfaces when the pattern varies (see TC-SA-043).

---

### TC-SA-007 — Casual 12 yrs, taking 13 wks at $40/hr × avg 32 h/wk (156-wk average)

- **Source**: APA p.85; SA LSL Act 1987 s.4 (as amended 2015), s.5(1); SafeWork SA — casual workers
- **Category**: Casual — 156-wk all-hours averaging × loaded hourly rate
- **Why it matters**: Verifies SA-unique 156-week (3-yr) averaging methodology (vs NSW 52-wk implicit, QLD 52-wk, VIC 3-tier, WA accrual-period-average).

**Inputs**

```yaml
employee:
  id: TC-SA-007
  legalName: CasualSATaking
  startDate: 2014-05-25                       # 12 yrs to 2026-05-25
  employmentType: casual
  statesOfService: [SA]
  governingJurisdiction: SA
  currentHourlyRate: 40.00                    # loaded casual rate (base hourly + 25% loading)
  hoursLast156Weeks: 4992                     # avg 32 h/wk × 156 wks
  wageHistory:
    - { periodStart: 2023-05-26, periodEnd: 2026-05-25, grossPay: 199680.00, frequency: other, periodDays: 1095 }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 13.0 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 15.6000             # 12 × 1.3 (continuous accrual; no step at 10)
weekly_avg_156w: 32.00                       # 4992 / 156 = 32 h/wk
value_of_week: 1280.00                       # 32 × $40 (loaded casual rate)
payable_for_taken_leave: 16640.00            # 13 × 1280
expected_citations:
  - { section: SA LSL Act 1987 s.5(1), rule: accrual.qualifying-period-10yr-13wks, pdfPage: 80 }
  - { section: SA LSL Act 1987 s.6,    rule: continuous-service.casual-regular-or-systematic, pdfPage: 85 }
  - { section: SA LSL Act 1987 s.4,    rule: ordinary-pay.casual-156wk-all-hours-average-with-loading, pdfPage: 86 }
```

**Notes**

Per SafeWork SA casual-workers guidance: "A casual worker's long service leave entitlement is based on the average of all hours worked, including overtime hours, in the 3 years (156 working weeks) immediately prior to taking long service leave." The "all hours including overtime" inclusion is **opposite to NSW/QLD/WA** (which exclude overtime from the hours average). The hourly rate, however, **excludes** overtime/penalty/shift premium rate components — only the base hourly rate (incl. casual loading) is applied. The asymmetry (hours include overtime, rate does not) is SA-specific and is the most subtle SA divergence.

---

### TC-SA-008 — 7.5 yrs FT, 6 wks of paid LSL previously taken

- **Source**: APA p.87; SA LSL Act 1987 s.5(3) + s.4
- **Category**: Termination + prior leave deduction

**Inputs**

```yaml
employee:
  id: TC-SA-008
  startDate: 2018-11-25
  endDate: 2026-05-25                        # 7.5 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1700.00
  priorLeaveTakenWeeks: 6                    # 6 wks of LSL taken in advance (rare in SA but legal where contract permits)
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.5000
gross_entitlement_weeks: 9.7500              # 7.5 × 1.3
prior_leave_taken_weeks: 6.0000
total_entitlement_weeks: 3.7500              # 9.75 - 6
value_of_week: 1700.00
total_entitlement_dollars: 6375.00
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination, pdfPage: 87 }
```

**Notes**

Prior-leave deduction is a generic engine concern, not SA-specific. Listed here because it surfaces in APA p.87 SA worked example. Note that taking LSL in advance is rarer in SA than in some states because the Act does not have an explicit leave-in-advance section; it occurs only where a contract or award authorises it.

---

### TC-SA-009 — 11.5 yrs FT termination, full entitlement 14.95 wks (continuous accrual past 10 yrs)

- **Source**: APA p.88; SA LSL Act 1987 s.5(1)
- **Category**: Full entitlement + continuous accrual past 10 yrs

**Inputs**

```yaml
employee:
  id: TC-SA-009
  startDate: 2014-11-25
  endDate: 2026-05-25                        # 11.5 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 2000.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.5000
total_entitlement_weeks: 14.9500             # 11.5 × 1.3
value_of_week: 2000.00
total_entitlement_dollars: 29900.00
expected_citations:
  - { section: SA LSL Act 1987 s.5(1), rule: accrual.continuous-1.3-per-year-after-10yrs, pdfPage: 88 }
```

**Notes**

SA accrual is continuous at 1.3 wks/yr — there is no discrete additional-accrual step at 10 yrs the way some commentators describe it. The 13-week figure at 10 yrs is the arithmetic outcome of 10 × 1.3 = 13. Same continuous-accrual pattern as QLD (per resolved TBD-QLD-01) and WA (per resolved TBD-WA-04), but with the higher 1.3/yr multiplier.

---

### TC-SA-010 — Casual 7 yrs taking pro-rata 9.1 wks at average rate

- **Source**: APA p.89; SA LSL Act 1987 s.5(3); SafeWork SA
- **Category**: Casual pro-rata 7+ yrs

**Inputs**

```yaml
employee:
  id: TC-SA-010
  startDate: 2019-05-25
  endDate: 2026-05-25                        # 7 yrs
  employmentType: casual
  statesOfService: [SA]
  governingJurisdiction: SA
  currentHourlyRate: 35.00
  hoursLast156Weeks: 4368                    # avg 28 h/wk × 156 wks
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
weekly_avg_156w: 28.00                       # 4368 / 156 = 28 h/wk
total_entitlement_weeks: 9.1000              # 7 × 1.3
value_of_week: 980.00                        # 28 × $35
total_entitlement_dollars: 8918.00
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.any-reason-except-misconduct-or-unlawful-termination, pdfPage: 89 }
  - { section: SA LSL Act 1987 s.4,    rule: ordinary-pay.casual-156wk-all-hours-average-with-loading, pdfPage: 86 }
```

---

## §B — Sub-7-year and 7–10-year qualifying-reason cases (s.5(3))

### TC-SA-011 — 6.9 yrs FT resignation, NO entitlement (sub-7-yr cliff)

```yaml
employee: { startDate: 2019-06-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1700.00, statesOfService: [SA], governingJurisdiction: SA }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  total_entitlement_weeks: 0
  total_entitlement_dollars: 0
  warnings: [{ code: sub_7yr_no_entitlement_sa, message: "Below 7 years of continuous service. No pro-rata entitlement is payable under SA LSL Act 1987 s.5(3). The 7-year threshold is the universal floor in SA." }]
  expected_citations:
    - { section: SA LSL Act 1987 s.5(3), rule: accrual.sub-7yr-no-entitlement }
```

---

### TC-SA-012 — 7.5 yrs FT employer-initiated dismissal not for misconduct, pro-rata 9.75 wks

```yaml
employee: { startDate: 2018-11-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, reason: employer_initiated_not_misconduct }
expected: { total_entitlement_weeks: 9.7500, total_entitlement_dollars: 14625.00 }   # 7.5 × 1.3 × 1500
```

---

### TC-SA-013 — 9 yrs FT illness-incapacity (employee-initiated), pro-rata 11.7 wks

```yaml
employee: { startDate: 2017-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: illness_incapacity, terminationInitiator: employee }
expected: { total_entitlement_weeks: 11.7000, total_entitlement_dollars: 19890.00 }   # 9 × 1.3 × 1700
```

**Notes**: Illness/incapacity is a qualifying reason in every state. SA does not distinguish employee-vs-employer-initiated for illness (unlike QLD s.95(3)(b)/(c)); both branches qualify.

---

### TC-SA-014 — 9 yrs FT illness-incapacity (employer-initiated dismissal on health grounds), pro-rata 11.7 wks

```yaml
employee: { startDate: 2017-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: illness_incapacity, terminationInitiator: employer }
expected: { total_entitlement_weeks: 11.7000, total_entitlement_dollars: 19890.00 }   # same as TC-SA-013
```

---

### TC-SA-015 — 8.5 yrs FT domestic pressing necessity (employee-initiated), pro-rata 11.05 wks

```yaml
employee: { startDate: 2017-11-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: domestic_pressing_necessity, terminationInitiator: employee }
expected: { total_entitlement_weeks: 11.0500, total_entitlement_dollars: 18785.00 }
```

**Notes**: "Pressing domestic necessity" is not a separately named qualifying reason in SA — it is subsumed under the general "any reason except misconduct or unlawful termination" rule of s.5(3). The case is included for parity with the NSW/QLD termination-reason enum and to demonstrate the engine routes correctly.

---

### TC-SA-016 — 8 yrs FT unfair dismissal (employer initiated, found unfair by tribunal), pro-rata 10.4 wks

```yaml
employee: { startDate: 2018-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: unfair_dismissal, terminationInitiator: employer }
expected: { total_entitlement_weeks: 10.4000, total_entitlement_dollars: 17680.00 }
```

**Notes**: Unfair dismissal qualifies in SA via the general "any reason except misconduct or unlawful termination" rule.

---

### TC-SA-017 — 8 yrs FT poor-performance dismissal (employer initiated, not misconduct), pro-rata 10.4 wks

```yaml
employee: { startDate: 2018-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: poor_performance, terminationInitiator: employer }
expected: { total_entitlement_weeks: 10.4000, total_entitlement_dollars: 17680.00 }
```

**Notes**: **SA-vs-QLD divergence.** In QLD, poor-performance dismissal is non-qualifying (s.95(3)(d) excludes "conduct/capacity/performance"). In SA, poor performance is NOT misconduct and is NOT unlawful-worker-termination, so the pro-rata payment is payable. Engine MUST NOT carry QLD's exclusion forward.

---

### TC-SA-018 — 8 yrs FT casual 7.5 yrs resignation, pro-rata 9.75 wks (casual continuity preserved)

```yaml
employee: { startDate: 2018-11-25, employmentType: casual, hoursLast156Weeks: 4680 }  # avg 30 h/wk
trigger: { kind: termination, reason: voluntary_resignation }
expected: { total_entitlement_weeks: 9.7500, weekly_avg_156w: 30.00, value_of_week: 30.00 × loaded_hourly_rate }
```

---

## §C — 10+ year full payout (s.5(1)) — including misconduct at 10+

### TC-SA-019 — 10 yrs exactly FT misconduct dismissal, **FULL 13 WEEKS payable**

- **Source**: SA LSL Act 1987 s.5(1); SafeWork SA — "full entitlement vests after 10 years"
- **Category**: 10+ yr full payout regardless of reason
- **Why it matters**: **CRITICAL SA-vs-WA divergence.** SA does NOT have a partial-forfeiture rule at 10+ yr misconduct. The full entitlement is payable. Parallel to NSW/VIC/QLD.

**Inputs**

```yaml
employee:
  startDate: 2016-05-25
  endDate: 2026-05-25                        # exactly 10 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1800.00
trigger: { kind: termination, reason: serious_misconduct, terminationDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 13.0000             # FULL — not partial
value_of_week: 1800.00
total_entitlement_dollars: 23400.00
warnings:
  - { code: sa_10yr_plus_misconduct_full_payout, message: "Dismissal for serious & wilful misconduct at 10+ years of continuous service. Under SA LSL Act 1987 s.5(1), the full 13-week entitlement is payable regardless of termination reason — SA does NOT mirror WA s.8(3) partial-forfeiture. The serious-misconduct exception in SA applies ONLY to the pro-rata branch (7-10 yrs), not to the full-entitlement branch." }
expected_citations:
  - { section: SA LSL Act 1987 s.5(1), rule: accrual.10yr-full-entitlement-regardless-of-reason }
```

**Notes**

Critical divergence. WA partial-forfeits the "accrual since last milestone" portion at 10+ yr misconduct (TC-WA-026, TC-WA-027). SA does NOT. SA pays out the full s.5(1) entitlement, including continuous-accrual portion since the 10-yr milestone. The misconduct exception in SA s.5(3) is explicitly worded to apply only to the pro-rata branch — once the worker has crossed the 10-yr threshold under s.5(1), misconduct does not reduce the entitlement.

---

### TC-SA-020 — 12.5 yrs FT misconduct dismissal, **FULL 16.25 WEEKS payable**

```yaml
employee: { startDate: 2013-11-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 16.2500             # 12.5 × 1.3 — continuous accrual
  total_entitlement_dollars: 27625.00
  warnings: [{ code: sa_10yr_plus_misconduct_full_payout }]
```

---

### TC-SA-021 — 10 yrs PT death, **FULL 13 WEEKS to personal representative**

```yaml
employee: { startDate: 2016-05-25, employmentType: part_time, hoursLast156Weeks: 3120, currentHourlyRate: 36.00 }  # avg 20 h/wk
trigger: { kind: termination, reason: death }
expected:
  total_entitlement_weeks: 13.0000
  weekly_avg_156w: 20.00
  value_of_week: 720.00                        # 20 × $36
  total_entitlement_dollars: 9360.00
  payment_recipient: "personal representative of the deceased worker"
```

---

### TC-SA-022 — 10.001 yrs FT (1 day past 10) FT resignation, 13.0013 weeks

```yaml
employee: { startDate: 2016-05-24, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }  # 10 yrs + 1 day
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 13.0013             # 10.001 × 1.3 (day-precise)
  total_entitlement_dollars: 23402.34
```

**Notes**: Confirms accrual is day-precise past the 10-yr threshold, not snapped to integer-anniversary 13.0. Asserts structural correctness, not exact display digits.

---

### TC-SA-023 — 10 yrs less 1 day FT misconduct, $0 (sub-10-yr misconduct cliff)

```yaml
employee: { startDate: 2016-05-26, endDate: 2026-05-25, employmentType: full_time }   # 1 day short of 10 yrs
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_10yr_misconduct_excluded_sa }]
```

**Notes**: Mirror of TC-SA-022 just below the 10-yr threshold. The cliff at exactly 10.0000 yrs is binary in SA — at 10 yrs exact and above, full entitlement; below, $0 if misconduct.

---

## §D — Serious & wilful misconduct + SA-unique "unlawful termination by worker"

### TC-SA-024 — 11 yrs FT misconduct, full 14.3 wks (mirror of TC-SA-019 at 11 yrs)

```yaml
employee: { startDate: 2015-05-25, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected: { total_entitlement_weeks: 14.3000, warnings: [{ code: sa_10yr_plus_misconduct_full_payout }] }
```

---

### TC-SA-025 — 8 yrs FT resignation with INSUFFICIENT NOTICE → $0 (SA-unique unlawful-worker-termination)

- **Source**: SA LSL Act 1987 s.5(3); SafeWork SA — "or if you unlawfully terminated your employment, such as failure to give the required amount of notice"
- **Category**: Negative — SA-unique unlawful-worker-termination
- **Why it matters**: SA has a **second disqualifier** under s.5(3) beyond serious misconduct: if the worker walks off the job without giving the contractually required notice. No other encoded state (NSW/VIC/QLD/WA) has this disqualifier.

**Inputs**

```yaml
employee:
  id: TC-SA-025
  startDate: 2018-05-25
  endDate: 2026-05-25                        # 8 yrs
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1700.00
  extraInputs:
    sa_worker_notice_compliance: false       # Worker did NOT give required contractual notice
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 0
total_entitlement_dollars: 0
warnings:
  - { code: unlawful_worker_termination_excluded_sa, message: "Voluntary resignation at 7-10 years with failure to give required notice. Under SA LSL Act 1987 s.5(3), pro-rata is forfeited where the worker has unlawfully terminated their employment (e.g. failure to give the contractually-required notice). This is an SA-unique disqualifier — no other Australian state encodes this." }
expected_citations:
  - { section: SA LSL Act 1987 s.5(3), rule: accrual.7-to-10yr.unlawful-worker-termination-excluded }
```

**Notes**

The engine relies on a new `extraInputs.sa_worker_notice_compliance: boolean` field (default `true` — assume notice was given). Per TBD-SA-04 RESOLUTION: SA-localised `extraInputs` pattern confirmed; no cross-state `TerminationReason` enum change. The form / bulk-CSV exposes a corresponding optional column for SA only.

---

### TC-SA-026 — 8 yrs FT resignation with proper notice, pro-rata 10.4 wks (positive control for TC-SA-025)

```yaml
employee: { startDate: 2018-05-25, currentWeeklyGross: 1700.00, extraInputs: { sa_worker_notice_compliance: true } }
trigger: { kind: termination, reason: voluntary_resignation }
expected: { total_entitlement_weeks: 10.4000, total_entitlement_dollars: 17680.00 }
```

---

### TC-SA-027 — 11 yrs FT resignation with insufficient notice, **FULL 14.3 WEEKS payable** (no s.5(3) bar at 10+ yrs)

```yaml
employee: { startDate: 2015-05-25, currentWeeklyGross: 1700.00, extraInputs: { sa_worker_notice_compliance: false } }
trigger: { kind: termination, reason: voluntary_resignation }
expected: { total_entitlement_weeks: 14.3000, total_entitlement_dollars: 24310.00 }
```

**Notes**: At 10+ yrs, the s.5(3) disqualifiers (misconduct OR unlawful-worker-termination) do not apply — only s.5(1) governs and pays out in full. SA-unique-disqualifier is a sub-10-yr concept only.

---

### TC-SA-028 — 9 yrs FT abandonment of employment (no formal notice given) → $0

```yaml
employee: { startDate: 2017-05-25, currentWeeklyGross: 1700.00, extraInputs: { sa_worker_notice_compliance: false } }
trigger: { kind: termination, reason: voluntary_resignation }
expected: { total_entitlement_weeks: 0, warnings: [{ code: unlawful_worker_termination_excluded_sa }] }
```

**Notes**: Abandonment (walking off without notice) is treated the same as unlawful-worker-termination. Same warning code.

---

## §E — Continuous service edge cases (s.6)

### TC-SA-029 — Unpaid leave 12 wks does not break continuity; entitlement-date moves out 12 wks

```yaml
employee:
  startDate: 2016-02-25
  endDate: 2026-05-25                        # nominal 10 yrs 3 mo on calendar
  employmentType: full_time
  serviceEvents:
    - { type: leave_without_pay, startDate: 2022-01-01, endDate: 2022-03-26 }  # 12 wks UPL
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 10.0000        # 10 yrs 3 mo − 12 wks UPL ≈ 10.0000
  total_entitlement_weeks: 13.0000            # 10 × 1.3
```

**Notes**: SA "extends-the-line" rule — UPL does not count as service but does not break continuity. The 12-wk UPL pushes the effective entitlement date out by 12 wks. Same conceptual rule as QLD s.134 "doesn't count as service" but different from NSW (excludes from lookback) and VIC (first 52 wks count, excess excluded).

---

### TC-SA-030 — Workers comp absence 26 wks counts as continuous service (no gap effect)

```yaml
employee:
  startDate: 2016-05-25
  endDate: 2026-05-25                        # 10 yrs
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2021-06-01, endDate: 2021-11-30 }  # 26 wks WC
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 10.0000        # WC counts in full
  total_entitlement_weeks: 13.0000
```

**Notes**: SafeWork SA guidance: "absences from work due to illness or injury (paid or unpaid sick leave, including for casual workers) are included" — covers both paid sick leave and WC. WC absence counts toward continuous service. NOTE this is the engine behaviour for **service** — separately, WC weeks are EXCLUDED from the 156-wk casual/PT averaging window (see TC-SA-049).

---

### TC-SA-031 — Paid parental leave (any duration) counts in full

```yaml
employee:
  startDate: 2016-05-25
  serviceEvents:
    - { type: paid_leave, startDate: 2020-01-01, endDate: 2020-07-01, note: "paid parental" }
trigger: { kind: termination, reason: voluntary_resignation }
expected: { years_of_continuous_service: 10.0000, total_entitlement_weeks: 13.0000 }
```

---

### TC-SA-032 — Unpaid parental leave does not count toward service but does NOT break continuity

```yaml
employee:
  startDate: 2015-05-25
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2019-01-01, endDate: 2019-12-31 }  # 52 wks
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 10.0000        # nominal 11 yrs - 52 wks UPL = 10.0 yrs
  total_entitlement_weeks: 13.0000
```

---

### TC-SA-033 — Re-employment within 2 months preserves continuity

```yaml
employee:
  startDate: 2014-05-25
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2020-05-25, endDate: 2020-07-15 }  # 51-day gap, ≤ 2 months
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 12.0000        # gap of 51 days does NOT break continuity in SA; but gap days do NOT count as service
  total_entitlement_weeks: 15.6000            # 12 × 1.3
```

---

### TC-SA-034 — Re-employment after 3 months (>2 mo) breaks continuity

```yaml
employee:
  startDate: 2014-05-25
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2020-05-25, endDate: 2020-09-25 }  # 4-month gap, > 2 mo
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 5.6667          # post-rehire only: 2020-09-25 to 2026-05-25
  total_entitlement_weeks: 0                    # below 7-yr pro-rata floor
  warnings: [{ code: gap_exceeds_state_tolerance, message: "Re-employment gap of 4 months exceeds SA's 2-month tolerance under s.6. Pre-gap service forfeited." }]
```

---

### TC-SA-035 — Industrial action does not break continuity but does not count toward service

```yaml
employee:
  startDate: 2016-05-25
  serviceEvents:
    - { type: industrial_action, startDate: 2021-06-01, endDate: 2021-07-01 }   # 4 weeks
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 9.9231          # 10 yr − 4 wks = 9.9231
  total_entitlement_weeks: 12.9000             # 9.9231 × 1.3 ≈ 12.90 (within 0.005 rounding)
```

---

### TC-SA-036 — Employer stand-down does not break continuity (same treatment as industrial action)

```yaml
employee:
  startDate: 2016-05-25
  serviceEvents:
    - { type: employer_stand_down, startDate: 2020-04-01, endDate: 2020-07-01 }  # 13 wks (covid-era stand-down)
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 9.7500          # 10 yr − 13 wks
  total_entitlement_weeks: 12.6750
```

---

## §F — Public holidays INCLUSIVE in LSL period (F11/AC13)

### TC-SA-037 — 13 wks LSL period with 4 PHs falling within → leave NOT extended; period ends as scheduled

- **Source**: SA LSL Act 1987 s.5 + SafeWork SA — "Weekends and public holidays count during the period of long service leave"
- **Category**: Taking-leave, PH-during-LSL — **the headliner SA divergence (F11/AC13)**
- **Why it matters**: SA is the ONLY encoded state to treat PHs as INCLUSIVE in the LSL period (counted as days of LSL). NSW/VIC/QLD/WA all treat PHs as exclusive (PH extends leave by 1 day per PH).

**Inputs**

```yaml
employee:
  id: TC-SA-037
  startDate: 2016-05-25
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1800.00
trigger:
  kind: taking_leave
  leaveStartDate: 2026-12-21                   # spans Christmas + Boxing Day + New Year + Australia Day (~4 SA PHs)
  leaveWeeks: 13.0
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.5833
total_entitlement_weeks: 13.7583              # 10.5833 × 1.3
leave_start: 2026-12-21
leave_end_calendar: 2027-03-22                # 13 weeks exactly — NOT extended by the 4 PHs
phs_within_leave_count: 4                     # informational
value_of_week: 1800.00
payable_for_taken_leave: 23400.00             # 13 × 1800 (the user is taking 13 wks)
expected_citations:
  - { section: SA LSL Act 1987 s.5, rule: trigger.taking-leave.ph-inclusive-no-extension }
  - { section: SA LSL Act 1987 s.4, rule: ordinary-pay.fixed-rate }
```

**Notes**

This is **the F11/AC13 reference fixture.** In NSW, this same leave would end on 2027-03-26 (extended by 4 days for 4 PHs). In SA, it ends on 2027-03-22. The engine MUST consult an SA public-holidays calendar to detect PHs within the leave window for the **informational `phs_within_leave_count`** field (used in the result UI to surface what PHs were absorbed), but **MUST NOT** extend the leave duration. Per impl-plan §6 T6.2: hardcoded SA PHs array for v1; auto-detect from leave dates.

---

### TC-SA-038 — 4 wks LSL period over Easter (2 PHs) → leave ends as scheduled, not extended

```yaml
employee: { startDate: 2016-05-25, currentWeeklyGross: 1500.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-03-29, leaveWeeks: 4.0 }      # spans Good Fri + Easter Mon (2 SA PHs)
expected:
  leave_end_calendar: 2027-04-26                 # 4 wks exactly — NOT extended
  phs_within_leave_count: 2
  payable_for_taken_leave: 6000.00               # 4 × 1500
```

---

### TC-SA-039 — Single-day LSL (1/5 of a week) starting on a PH → 0 days of leave consumed, 0 paid

```yaml
employee: { startDate: 2016-05-25, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-01-26, leaveWeeks: 0.2 }      # Australia Day (PH) only
expected:
  leave_days_consumed: 0                         # The PH is "during the leave" but consumes the leave day
  warnings: [{ code: ph_only_lsl_day_sa, message: "The single day requested is a public holiday. Under SA s.5 PH-inclusive rule, the day is treated as 1 day of LSL (counted against entitlement); payment is at the worker's ordinary daily rate as if working." }]
  payable_for_taken_leave: 360.00                # 1800 / 5
```

**Notes**: Per TBD-SA-09 RESOLUTION: a single-day LSL request on a PH counts as 1 day of LSL (engine charges entitlement). Literal reading of the inclusive rule; avoids gaming via PH-scheduled LSL.

---

### TC-SA-040 — 13 wks LSL period during a period with NO PHs (counterfactual control)

```yaml
employee: { startDate: 2016-05-25, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-08-01, leaveWeeks: 13.0 }     # no SA PHs Aug-Oct
expected:
  leave_end_calendar: 2027-10-31                 # 13 wks
  phs_within_leave_count: 0
  payable_for_taken_leave: 23400.00              # 13 × 1800
```

**Notes**: Positive control. Same calculation as TC-SA-037 but without any PHs in the window — the engine MUST return the same total weeks (13.0) regardless of PHs encountered. Demonstrates the PH-inclusive rule does not affect the entitlement, only the calendar end-date of the leave window.

---

## §G — Ordinary pay (s.4 — incl. higher-duties acting rule)

### TC-SA-041 — Fixed-rate FT, current weekly gross = value of week

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: taking_leave }
expected: { value_of_week: 2000.00, value_of_day: 400.00 }
```

---

### TC-SA-042 — Higher-duties acting rate, FT 10 yrs taking LSL while acting in senior role

- **Source**: SafeWork SA — full-time calculation, "If you are acting in a higher paying position when you take leave your ordinary weekly rate of pay is the new higher rate"
- **Category**: SA-unique higher-duties rule

**Inputs**

```yaml
employee:
  startDate: 2016-05-25
  employmentType: full_time
  statesOfService: [SA]
  governingJurisdiction: SA
  currentWeeklyGross: 1500.00                    # substantive role weekly rate
  extraInputs:
    sa_higher_duties_active: true                # currently acting in senior position
    sa_higher_duties_weekly_rate: 1900.00        # acting role rate
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 13.0 }
```

**Expected output**

```yaml
value_of_week: 1900.00                           # use higher acting rate
warnings:
  - { code: sa_higher_duties_rate_applied, message: "Worker is acting in a higher-paid position at the date LSL commences. Per SA LSL Act 1987 s.4 and SafeWork SA guidance, the higher (acting) weekly rate of pay applies as the ordinary weekly rate." }
payable_for_taken_leave: 24700.00                # 13 × 1900
expected_citations:
  - { section: SA LSL Act 1987 s.4, rule: ordinary-pay.higher-duties-acting-rate-sa-unique }
```

**Notes**

**SA-unique among the 5 encoded states.** NSW/VIC/QLD/WA do not have a statutory higher-duties rule for LSL (engine uses ordinary substantive-role rate in those states even where the employee is acting up). Per TBD-SA-07 RESOLUTION: SA-localised via `extraInputs.sa_higher_duties_active: boolean` + `extraInputs.sa_higher_duties_weekly_rate: number`. **NOT a DEV-CROSS-3 cross-state schema extension** — operator chose YAGNI; if NT/TAS/ACT genuinely need this concept later, retrofit is no harder than doing it now. Form / bulk-CSV exposes corresponding optional columns for SA only.

---

### TC-SA-043 — Varied PT hours, 156-wk averaging

```yaml
employee:
  employmentType: part_time
  hoursLast156Weeks: 4940                       # avg 31.66 h/wk (slightly varied)
  currentHourlyRate: 38.00
trigger: { kind: taking_leave }
expected:
  weekly_avg_156w: 31.6667                       # 4940 / 156
  value_of_week: 1203.33                         # 31.6667 × 38
```

---

### TC-SA-044 — PT with unpaid leave in lookback — 156-wk window EXTENDED backward

- **Source**: SafeWork SA — part-time / casual calculation: "Weeks on approved unpaid leave or weeks on workers' compensation are excluded from the calculation and substituted for a working week."

**Inputs**

```yaml
employee:
  employmentType: part_time
  hoursLast156Weeks_raw: 4524                    # actual 156 calendar wks — but includes 12 wks UPL
  hoursAfterSubstitution: 4920                   # window extended back to recapture 12 prior worked wks at avg 33 h/wk
  currentHourlyRate: 40.00
  serviceEvents:
    - { type: leave_without_pay, startDate: 2025-01-01, endDate: 2025-03-26 }  # 12 wks UPL inside the 156-wk window
trigger: { kind: taking_leave }
```

**Expected output**

```yaml
weekly_avg_156w_after_substitution: 31.5385      # 4920 / 156
value_of_week: 1261.54
warnings:
  - { code: sa_156wk_window_extended_for_upl, message: "156-week averaging window extended backward to substitute 12 weeks of unpaid leave with prior worked weeks, per SafeWork SA part-time / casual calculation methodology." }
```

**Notes**

SA-unique 156-wk-window-extension is the most subtle ordinary-pay arithmetic in the entire epic. The engine MUST detect UPL / WC weeks within the nominal 156-wk window and extend the window backward to include an equivalent number of prior worked weeks. **The denominator stays 156**, not the actual number of weeks reviewed (per SafeWork SA: "Divide this total number of hours by 156"). Engine must surface the extension via the warning code so the user understands the math.

---

### TC-SA-045 — Commission worker, 52-wk income lookback (SA-specific divergence from 156-wk for hours)

- **Source**: SafeWork SA — commission, target and per-piece workers

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 156000.00, frequency: weekly }  # incl. base + commission
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  value_of_week: 3000.00                         # 156000 / 52
  warnings:
    - { code: sa_commission_52wk_lookback_applied, message: "Worker paid on commission or part-fixed-rate-part-commission. Ordinary weekly rate calculated as 52-week (12-month) average of total income per SafeWork SA — commission / target / per-piece guidance. Bonuses (Christmas, target-achievement on top of an hourly rate) are excluded from the average per SafeWork SA." }
```

**Notes**

SA uses a **52-week** lookback for commission earners, NOT 156 weeks. The 156-wk window is for hours averaging (part-time / casual); the 52-wk window is for income averaging (commission / piece). Engine MUST select the correct window by employment classification. This is the SA-specific dual-window methodology.

---

### TC-SA-046 — Target-achievement bonus on top of hourly rate, bonus EXCLUDED from average

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 95000.00, note: "incl. $7,000 target-bonus paid Dec 2025" }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  value_of_week: 1700.00                         # normal hourly-rate worker; bonus EXCLUDED per SafeWork SA
  warnings:
    - { code: sa_bonus_excluded_from_average, message: "Target-achievement bonus or Christmas bonus identified in wage history is excluded from ordinary weekly rate calculation per SafeWork SA — commission / target / per-piece guidance. The worker remains a fixed-rate employee for ordinary-pay purposes." }
```

---

### TC-SA-047 — Piece-rate worker (paid by output), 52-wk income lookback

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 78000.00, note: "piece-rate" }
trigger: { kind: termination, reason: voluntary_resignation }
expected: { value_of_week: 1500.00 }              # 78000 / 52
```

---

## §H — Casual employees (s.4 156-wk + s.6 regular-or-systematic)

### TC-SA-048 — Casual 8 yrs, regular pattern, pro-rata 10.4 wks at 156-wk average rate

```yaml
employee:
  startDate: 2018-05-25
  employmentType: casual
  hoursLast156Weeks: 5304                          # avg 34 h/wk
  currentHourlyRate: 38.00                          # base $30.40 + 25% loading = $38
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  weekly_avg_156w: 34.00
  value_of_week: 1292.00                           # 34 × $38
  total_entitlement_weeks: 10.4000                 # 8 × 1.3
  total_entitlement_dollars: 13436.80
```

---

### TC-SA-049 — Casual with WC absence inside 156-wk window — window EXTENDED backward

```yaml
employee:
  employmentType: casual
  hoursLast156Weeks_raw: 4524                       # 12 wks WC reduced the actual hours
  hoursAfterSubstitution: 4920                      # window extended to recover 12 wks at avg 33 h/wk
  currentHourlyRate: 40.00
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2025-01-01, endDate: 2025-03-26 }  # 12 wks WC inside 156-wk window
trigger: { kind: taking_leave }
expected:
  weekly_avg_156w_after_substitution: 31.5385       # 4920 / 156
  value_of_week: 1261.54
  warnings:
    - { code: sa_156wk_window_extended_for_wc, message: "156-week averaging window extended backward to substitute 12 weeks of workers' compensation with prior worked weeks, per SafeWork SA casual / part-time calculation methodology." }
```

---

### TC-SA-050 — Casual with 4-month gap between contracts (seasonal shutdown) — continuity preserved

```yaml
employee:
  startDate: 2014-05-25
  employmentType: casual
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2022-12-15, endDate: 2023-04-15, note: "seasonal shutdown — restaurant closes January through March" }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 11.6667             # 12 yr − 4-mo gap
  warnings:
    - { code: sa_casual_seasonal_continuity_preserved, message: "Casual employment continuity preserved across a 4-month seasonal shutdown per SA LSL Act 1987 s.6 and SafeWork SA casual guidance ('seasonal variations, temporary shutdowns' typically do not break continuity)." }
```

**Notes**: SA does not encode a hard-month limit for casual continuity (unlike QLD's 3-month s.103). The "regular or systematic" test governs, and seasonal-shutdown gaps are explicitly listed as preserving continuity. This case sits outside the 2-month non-casual re-employment threshold but is preserved on the seasonal-shutdown basis per TBD-SA-02 RESOLUTION (3-mo heuristic without seasonal justification; up to 6 mo with).

---

### TC-SA-051 — Casual with 12-month gap (no seasonal justification) — continuity BROKEN

```yaml
employee:
  startDate: 2014-05-25
  employmentType: casual
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2020-05-25, endDate: 2021-06-01, note: "no seasonal justification" }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 4.9833              # post-rehire only
  total_entitlement_weeks: 0                       # below 7-yr floor
  warnings:
    - { code: gap_exceeds_state_tolerance, message: "Casual employment gap of 12 months is too long to be 'regular or systematic' under SA LSL Act 1987 s.6. Pre-gap service forfeited." }
```

**Notes**: Per TBD-SA-02 RESOLUTION: 12-month gap without seasonal justification clearly fails the 3-month engine heuristic. The actual SA test is case-by-case "regular or systematic" and could be litigated either way — the engine surfaces the forfeiture and the user can dispute via SAET.

---

### TC-SA-052 — Casual 10 yrs taking 13 wks, value-of-week at 156-wk average × loaded rate

```yaml
employee:
  startDate: 2016-05-25
  employmentType: casual
  hoursLast156Weeks: 4680                          # avg 30 h/wk
  currentHourlyRate: 42.50                          # base $34 + 25% loading
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 13.0 }
expected:
  weekly_avg_156w: 30.00
  value_of_week: 1275.00                           # 30 × $42.50
  payable_for_taken_leave: 16575.00                # 13 × $1275
```

---

## §I — 15-year and 20-year continuous-accrual (s.5(1))

### TC-SA-053 — 15 yrs FT resignation, full 19.5 weeks (continuous; no discrete step)

```yaml
employee: { startDate: 2011-05-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 19.5000                 # 15 × 1.3 — continuous accrual
  total_entitlement_dollars: 39000.00
```

---

### TC-SA-054 — 20 yrs FT resignation, full 26 weeks

```yaml
employee: { startDate: 2006-05-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 26.0000                 # 20 × 1.3
  total_entitlement_dollars: 52000.00
```

---

## §J — Cashing out (s.5 — non-blocking advisory)

### TC-SA-055 — Cash-out request at 12 yrs (post-accrual), ADVISORY

```yaml
employee: { startDate: 2014-05-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out, cashOutDate: 2026-05-25 }
expected:
  status: computed
  total_entitlement_weeks: 15.6000                 # 12 × 1.3
  total_entitlement_dollars: 28080.00
  warnings:
    - { code: sa_cashout_post_accrual_advisory, message: "Cashing out long service leave under SA LSL Act 1987 requires written agreement signed by both parties and is permitted only after the worker has completed 10 or more years of continuous service. Employer must provide a written statement showing entitlement, payment amount, period covered, and remaining leave. SA does not authorise involuntary cash-out — this is an employee-initiated election." }
  expected_citations:
    - { section: SA LSL Act 1987 s.5, rule: cashout.post-10yr-written-agreement-required }
```

**Notes**: Per TBD-SA-03 RESOLUTION: cite as `SA LSL Act 1987 s.5` at Act level only in v1 (documented limitation pending RES-3 quarterly review, parallel to TBD-WA-02). SafeWork SA and the Law Handbook SA describe the rule but do not cite a sub-section verbatim; AustLII s.5 page suggests cashing-out lives in s.5 (specifically s.5(3) read with s.5(4) or s.5 generally — exact sub-section to be confirmed in the quarterly review).

---

### TC-SA-056 — Cash-out request at 8 yrs (pre-10-yr) — ADVISORY warning "not authorised"

```yaml
employee: { startDate: 2018-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 10.4000                 # the engine still surfaces what the pro-rata WOULD be
  warnings:
    - { code: sa_cashout_pre_accrual_not_authorised, message: "Cashing out at sub-10-year tenure is NOT authorised under SA LSL Act 1987. The engine has surfaced the pro-rata value the worker would receive ON TERMINATION (1.3 wks × completed years) but no cash-out election can lawfully be made before 10 years of continuous service. If the worker is leaving the employer, change the trigger to 'termination'." }
```

---

### TC-SA-057 — Cash-out request at 5 yrs (sub-7-yr) — ADVISORY warning "no entitlement"

```yaml
employee: { startDate: 2021-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 0
  warnings:
    - { code: sa_cashout_no_entitlement_to_cash_out, message: "Worker has not yet reached the 7-year pro-rata threshold. There is no LSL entitlement to cash out. No cash-out election is authorised under SA LSL Act 1987 until 10+ years of continuous service have been completed." }
```

---

### TC-SA-058 — Cash-out request at 10 yrs exact — ADVISORY (just-eligible)

```yaml
employee: { startDate: 2016-05-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 13.0000
  warnings: [{ code: sa_cashout_post_accrual_advisory }]
```

---

## §K — Workers comp overlap with LSL rate

### TC-SA-059 — LSL taken while on WC reduced rate — engine pays at the literal s.4 rate + advisory

- **Source**: SA LSL Act 1987 s.4
- **Category**: WC-overlap-LSL — parallel to QLD/WA pattern

**Inputs**

```yaml
employee:
  startDate: 2016-05-25
  employmentType: full_time
  currentWeeklyGross: 1300.00                       # currently on reduced WC rate (was $1800 pre-injury)
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2026-04-01, endDate: 2026-05-25, note: "currently on WC" }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 13.0 }
```

**Expected output**

```yaml
value_of_week: 1300.00                              # literal current rate per s.4 — NO higher-of-rates uplift
warnings:
  - { code: sa_lsl_calculated_at_wc_reduced_rate_warning, message: "LSL has been calculated at the rate in force at the time leave is taken under SA LSL Act 1987 s.4. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; SA has no statutory higher-of-rates equivalent to VIC s.17." }
expected_citations:
  - { section: SA LSL Act 1987 s.4, rule: ordinary-pay.literal-rate-at-leave-time-no-wc-uplift }
```

**Notes**: Parallel to QLD's resolved TBD-QLD-05 and WA's resolved TBD-WA-05. SA s.4 has no higher-of-pre-injury-vs-current rule (unlike VIC s.17). The engine pays at the literal rate but emits the advisory. TBD-SA-08 RESOLVED — operator accepted PM-recommended path 2026-05-25.

---

## §L — Transfer of business (s.6)

### TC-SA-060 — Transfer of business preserves service; new employer assumes liability

```yaml
employee:
  startDate: 2014-05-25
  serviceEvents:
    - { type: transfer_of_business, startDate: 2020-05-25, endDate: 2020-05-25, note: "old employer sold to new employer; same job continued" }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-25 }
expected:
  years_of_continuous_service: 12.0000               # service preserved across transfer
  total_entitlement_weeks: 15.6000                   # 12 × 1.3
  warnings:
    - { code: transfer_of_business_continuity_preserved_sa, message: "Service deemed continuous across transfer of business per SA LSL Act 1987 s.6. New employer assumes LSL liability. Sale-of-business contract terms cannot displace this statutory rule." }
```

---

## §M — As-at snapshot trigger

### TC-SA-061 — 5 yrs as-at → accrued, not currently payable

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-25 }
employee: { startDate: 2021-05-25, employmentType: full_time, currentWeeklyGross: 1700.00 }
expected:
  total_entitlement_weeks: 6.5000                    # 5 × 1.3 (informational accrued value)
  payable_indicator: "accrued, not currently payable"
  warnings: [{ code: accrued_not_currently_payable, message: "Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable." }]
```

**Notes**: SA's universal accrual is 1.3 wks/yr from day one — the as-at view surfaces the running balance even sub-7-yr. The PAYABILITY is gated at 7 yrs (pro-rata) or 10 yrs (full), but the running accrual is computable as informational.

---

### TC-SA-062 — 11 yrs as-at → 14.3 wks (above qualifying threshold)

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-25 }
employee: { startDate: 2015-05-25, currentWeeklyGross: 1800.00 }
expected: { total_entitlement_weeks: 14.3000, payable_indicator: "payable" }
```

---

## §N — Cross-jurisdiction

### TC-SA-063 — SA + NSW service, NSW nominated → routed to NSW engine (8.6667 wks at 10 yrs, NOT 13)

```yaml
employee: { statesOfService: [SA, NSW], governingJurisdiction: NSW, startDate: 2016-05-25 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  state_used: NSW
  total_entitlement_weeks: 8.6667                    # NSW 1/60 ratio applied, NOT SA 1.3/yr
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in SA and NSW. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW." }
```

**Notes**: Critical cross-jurisdiction case. The 13-vs-8.6667-week divergence is the largest cross-state quantum in the entire E2 epic. Engine MUST route to the nominated state's accrual table and citation block.

---

### TC-SA-064 — SA + WA service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [SA, WA], governingJurisdiction: null }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings: [{ code: cross_jurisdiction_pending }]
```

---

# Bulk-mode test cases

### TC-SA-BULK-001 — 5-employee SA-only fixture, mixed tenures and triggers

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,gross_pay,period_frequency,reason
S01,pay_period,SA,2014-05-25,full_time,as_at,2026-05-25,98000.00,weekly,                              # 12 yr FT
S02,pay_period,SA,2018-05-25,full_time,termination,2026-05-25,78000.00,weekly,voluntary_resignation   # 8 yr FT resignation → pro-rata 10.4 wks (SA pays out at 7+)
S03,pay_period,SA,2017-05-25,part_time,as_at,2026-05-25,39000.00,weekly,                              # 9 yr PT as-at
S04,pay_period,SA,2015-05-25,casual,termination,2026-05-25,55000.00,other,voluntary_resignation       # 11 yr casual → 14.3 wks
S05,pay_period,SA,2020-05-25,full_time,termination,2026-05-25,78000.00,weekly,serious_misconduct      # 6 yr misconduct → $0
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  S01: { state_used: SA, total_entitlement_weeks: 15.6000, dollars: 29400.00 }              # 12 × 1.3 × 1885 (98000/52)
  S02: { state_used: SA, total_entitlement_weeks: 10.4000, dollars: 15600.00 }              # 8 × 1.3 × 1500 — resignation qualifies in SA
  S03: { state_used: SA, total_entitlement_weeks: 11.7000, dollars: 8775.00 }               # 9 × 1.3 × 750
  S04: { state_used: SA, total_entitlement_weeks: 14.3000, dollars: 15125.00 }              # 11 × 1.3, casual loaded rate
  S05: { state_used: SA, total_entitlement_weeks: 0.0000, dollars: 0.00 }                   # sub-10-yr misconduct → $0
all_rows_have_state_used_SA: true
```

---

### TC-SA-BULK-002 — 10-employee mixed NSW + VIC + QLD + WA + SA, with case-normalisation

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,...
NVQWS01,pay_period,NSW,2014-05-25,full_time,as_at,2026-05-25,...                            # 12 yr NSW → 8.6667 base + 2 × 1/60 wks ≈ 10.4 wks
NVQWS02,pay_period,VIC,2018-05-25,full_time,as_at,2026-05-25,...                            # 8 yr VIC → 6.9333 wks
NVQWS03,pay_period,QLD,2015-05-25,casual,as_at,2026-05-25,...                               # 11 yr QLD casual
NVQWS04,pay_period,WA,2014-05-25,full_time,as_at,2026-05-25,...                             # 12 yr WA (post-2022 regime)
NVQWS05,pay_period,SA,2016-05-25,full_time,as_at,2026-05-25,...                             # 10 yr SA → 13 wks
NVQWS06,pay_period,sa,2017-05-25,part_time,as_at,2026-05-25,...                             # lowercase — normalise
NVQWS07,pay_period,SA,2015-05-25,full_time,termination,2026-05-25,...,reason=serious_misconduct        # 11 yr misconduct → FULL 14.3 wks (SA 10+ yr full payout)
NVQWS08,pay_period,SA,2019-05-25,full_time,termination,2026-05-25,...,reason=voluntary_resignation,extraInputs.sa_worker_notice_compliance=false  # 7 yr resignation, no notice → $0
NVQWS09,pay_period,,2019-05-25,full_time,as_at,2026-05-25,...                               # EMPTY state — validation error
NVQWS10,pay_period,SA,2018-05-25,full_time,termination,2026-05-25,...,reason=voluntary_resignation     # 8 yr resignation → pro-rata 10.4 wks
```

**Expected output**

```yaml
total_rows: 10
status_breakdown: { computed: 8, blocked: 0, failed: 1 }
row_results:
  NVQWS01: { state_used: NSW, status: computed }
  NVQWS02: { state_used: VIC, status: computed }
  NVQWS03: { state_used: QLD, status: computed }
  NVQWS04: { state_used: WA, status: computed }
  NVQWS05: { state_used: SA, status: computed, total_entitlement_weeks: 13.0000 }           # SA-headliner 13 wks
  NVQWS06: { state_used: SA, status: computed }                                              # normalised
  NVQWS07: { state_used: SA, status: computed, total_entitlement_weeks: 14.3000 }           # FULL — SA 10+ yr misconduct full payout
  NVQWS08: { state_used: SA, status: computed, total_entitlement_weeks: 0, warnings: [{ code: unlawful_worker_termination_excluded_sa }] }
  NVQWS09: { status: failed, error: { code: state_missing_or_empty } }
  NVQWS10: { state_used: SA, status: computed, total_entitlement_weeks: 10.4000 }
```

---

### TC-SA-BULK-003 — Mixed-state cash-out advisory + hard-error matrix (5 states)

```csv
employee_id,row_type,state,trigger,trigger_date,...
CO-S01,pay_period,SA,cash_out,2026-05-25,...                  # ADVISORY (post-10-yr)
CO-S02,pay_period,SA,cash_out,2026-05-25,...                  # ADVISORY (sub-10-yr)
CO-V01,pay_period,VIC,cash_out,2026-05-25,...                 # HARD ERROR — s.34
CO-Q01,pay_period,QLD,cash_out,2026-05-25,...                 # ADVISORY — s.110
CO-W01,pay_period,WA,cash_out,2026-05-25,...                  # ADVISORY (post-accrual)
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 4, blocked: 0, failed: 1 }
row_results:
  CO-S01: { state_used: SA, status: computed, warnings: [{ code: sa_cashout_post_accrual_advisory }] }
  CO-S02: { state_used: SA, status: computed, warnings: [{ code: sa_cashout_pre_accrual_not_authorised }] }
  CO-V01: { state_used: VIC, status: failed, error: { code: vic_cashout_prohibited } }
  CO-Q01: { state_used: QLD, status: computed, warnings: [{ code: qld_cashout_requires_instrument_or_qirc }] }
  CO-W01: { state_used: WA, status: computed, warnings: [{ code: wa_cashout_post_accrual_advisory }] }
```

**Notes**

Demonstrates per-state cash-out branching across the 5 encoded states: SA = advisory (post-10-yr or sub-10-yr); VIC = hard error; QLD = advisory (s.110); WA = advisory (3-tier per resolved TBD-WA-03); NSW = not modelled (would hard-error if requested).

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **SA LSL Act 1987 s.3** — Interpretation / definitions (employee, employer, continuous service, ordinary weekly rate) | All TC-SA-NNN (implicit) |
| **SA LSL Act 1987 s.4** — Ordinary weekly rate of pay (incl. higher-duties acting rule + 156-wk averaging method post-2015 amendment) | TC-SA-041 → TC-SA-047, TC-SA-059 |
| **SA LSL Act 1987 s.5(1)** — 13 wks at 10 yrs + 1.3 wks per further year | TC-SA-001, TC-SA-009, TC-SA-019, TC-SA-020, TC-SA-053, TC-SA-054 |
| **SA LSL Act 1987 s.5(3)** — Pro-rata at termination + serious-misconduct + unlawful-worker-termination exception | TC-SA-002 → TC-SA-018, TC-SA-024 → TC-SA-028 |
| **SA LSL Act 1987 s.5** — Cashing out (Act-level citation only per TBD-SA-03 RESOLUTION — documented limitation pending RES-3 quarterly review) | TC-SA-055 → TC-SA-058 |
| **SA LSL Act 1987 s.5** — Death-of-worker, entitlement vests in personal representative | TC-SA-004, TC-SA-021 |
| **SA LSL Act 1987 s.5** — PH-INCLUSIVE in LSL period (F11/AC13) | TC-SA-037 → TC-SA-040 |
| **SA LSL Act 1987 s.6** — Continuous service / break tolerances / transfer of business | TC-SA-029 → TC-SA-036, TC-SA-050 → TC-SA-051, TC-SA-060 |
| **LSL (Calculation of Average Weekly Earnings) Amendment Act 2015 (SA)** — 156-wk averaging methodology with WC/UPL substitution | TC-SA-007, TC-SA-043, TC-SA-044, TC-SA-048, TC-SA-049, TC-SA-052 |
| **E2 spec F1 / F2 / AC1 / AC2** — per-state rule set + test suite | this file + encoded fixtures |
| **E2 spec F10 / AC12** — SA 13-wk first entitlement at 10 yrs | TC-SA-001, TC-SA-019, TC-SA-021 |
| **E2 spec F11 / AC13** — SA PH-inclusive in LSL period | TC-SA-037, TC-SA-038, TC-SA-039, TC-SA-040 |
| **E2 spec F13 / AC14** — Cross-jurisdictional governing-state nomination | TC-SA-063, TC-SA-064 |
| **E2 spec F17 / AC16** — Mixed-state bulk CSV with per-row state column | TC-SA-BULK-002 |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line — SIGNED OFF · Tracy Angwin (PM) · 2026-05-25 |

---

# Items flagged `TBD-SA-NN` — ✅ ALL RESOLVED 2026-05-25

All 12 TBDs were resolved by the operator on 2026-05-25. The verbatim binding text is in the **Resolutions** section near the top of this document. The detail below is retained as the reasoning that produced each resolution — historical context, not unresolved questions. Ordered by severity (Sev-1 = load-bearing; Sev-2 = engine-shape; Sev-3 = nice-to-have).

## TBD-SA-01 — [Sev-1, LOAD-BEARING] Dual-regime architecture · ✅ RESOLVED 2026-05-25 — NO (single regime)

**Question**: Does SA need a pre/post-2015 dual-regime (parallel to VIC s.57 or WA 2022-06-20) to handle the LSL (Calculation of Average Weekly Earnings) Amendment Act 2015 (SA)?

**PM recommendation**: **NO. Single regime.** The 2015 Amendment Act explicitly applies prospectively to all LSL taken/paid on or after commencement, INCLUDING in respect of absences occurring before commencement. This is a uniform forward-looking transitional rule — there is no need for two parallel rule sets. SA mirrors QLD's flat single-regime architecture.

**Engine impact if confirmed NO**: Impl-plan v0.3.2 §6 stands. No `rules-pre-X.ts` / `rules-post-X.ts` split. No `sa_regime_split_applied` warning code. No insufficient-granularity fallback. Effort estimate stays at M (3–5 days).

**Engine impact if reversed (operator says YES)**: Add ~1-2 dev-days for dual-regime scaffold + 4 regime-split fixtures + 2 insufficient-granularity fixtures (parallel to WA TC-WA-040..045).

---

## TBD-SA-02 — [Sev-2] Casual continuity gap threshold · ✅ RESOLVED 2026-05-25 — 3-mo / 6-mo (with seasonal justification)

**Question**: For casual employees, what specific gap-duration heuristic should the engine apply to detect a continuity break? SA's s.6 does NOT prescribe a hard month-cap for casuals (unlike QLD's 3-month s.103). The test is "regular or systematic" with seasonal-shutdown / temporary-closure tolerances.

**PM recommendation**: For v1, apply a 3-month heuristic for casual gaps WITHOUT a seasonal-shutdown justification (matches QLD's hard threshold and is operationally clean). Where the user provides a seasonal-shutdown signal (e.g. note: "restaurant closes Jan-Mar each year"), tolerate up to 6 months. Surface the `sa_casual_continuity_uncertain` advisory when the gap is 2-6 months without seasonal justification. The PM recommendation tracks SafeWork SA guidance examples but defers to the operator on the specific threshold.

**Engine impact**: 1 dev-day if PM-recommended approach is accepted. The `sa_casual_seasonal_continuity_preserved` warning code (TC-SA-050) is already drafted.

---

## TBD-SA-03 — [Sev-2] Cashing-out section reference · ✅ RESOLVED 2026-05-25 — Act-level only (documented limitation)

**Question**: Different secondary sources cite different section references for cashing-out in the SA LSL Act 1987. SafeWork SA and the Law Handbook SA describe the rule but do not cite a sub-section verbatim. Sprintlaw references "section 10" but that may be confusion with other states (s.10 is "leave in advance" in WA, for example). The AustLII s.5 page indicates the death-vesting clause is in s.5, suggesting cashing-out may also be in s.5.

**PM recommendation**: Cite as "SA LSL Act 1987 s.5" without sub-section reference in v1.0, matching the documented-limitation precedent from TBD-WA-02 (which cited "WCIM Act 2023 (WA)" at Act level only). One targeted research pass post-launch (RES-3 quarterly review) can verify the exact sub-section against the consolidated Act text.

**Engine impact**: No engine-code impact. The citation in `trigger-handlers.ts` will use `section: 'SA LSL Act 1987 s.5'` until verified — same documented-limitation pattern as WA's WCIM Act 2023 citation.

---

## TBD-SA-04 — [Sev-2] Unlawful-worker-termination representation · ✅ RESOLVED 2026-05-25 — SA-localised `extraInputs.sa_worker_notice_compliance`

**Question**: How should the engine represent SA's second sub-10-yr disqualifier ("worker failed to give required notice on resignation")?

**Options**:
- **(a)** New `TerminationReason` enum value `unlawful_worker_termination`. State-agnostic enum extension (parallel to DEV-CROSS-1 pattern). Cleanest but requires cross-state enum coordination + bulk-CSV column.
- **(b)** SA-specific `extraInputs.sa_worker_notice_compliance: boolean` field on `Employee` (default `true`). State-localised; no cross-state surface change. SA-only form/CSV column.
- **(c)** Combine: keep `reason: voluntary_resignation` and add an SA-localised `extraInputs.sa_worker_notice_compliance: boolean`. The engine's SA orchestrator checks the extraInputs field when reason is voluntary_resignation. Matches the ACT extraInputs pattern (Phase 7) for overtime hours.

**PM recommendation**: Option (c) — `extraInputs.sa_worker_notice_compliance: boolean` (default `true`). Localised to SA; no cross-state enum change; consistent with ACT's planned extraInputs pattern. Fixtures TC-SA-025 → TC-SA-028 are drafted on this assumption.

**Engine impact**: ½–1 dev-day for option (c). 1–2 dev-days for option (a) including the cross-state ripple. Option (b) is functionally the same as (c).

---

## TBD-SA-05 — [Sev-2] Workers Comp absence treatment · ✅ RESOLVED 2026-05-25 — counts as service AND triggers 156-wk substitution

**Question**: Does a WC absence count toward continuous service in SA, the same way it does in NSW/VIC/QLD?

**Evidence**: SafeWork SA — accruing-leave guidance explicitly lists "absences from work due to illness or injury (paid or unpaid sick leave, including for casual workers) are included" — but does not separately enumerate WC. The natural reading is that WC sits within the broader illness/injury bucket and counts.

**PM recommendation**: WC absence counts toward continuous service (same as NSW/VIC/QLD). It is, however, EXCLUDED from the 156-week casual/PT averaging window (per SafeWork SA part-time calculation: "Weeks on approved unpaid leave or weeks on workers' compensation are excluded from the calculation and substituted for a working week").

**Engine impact**: ½ dev-day. The `serviceEvents` walker treats `workers_comp_absence` as service-counting; the `value-of-week.ts` 156-wk window walker treats `workers_comp_absence` as a substitution trigger.

---

## TBD-SA-06 — [Sev-2] Cashing-out advisory granularity · ✅ RESOLVED 2026-05-25 — three distinct codes

**Question**: Should the engine emit one generic `sa_cashout_advisory` code (parallel to QLD's pre-resolution simple-advisory option) or three distinct codes per the WA pattern (`sa_cashout_post_accrual_advisory` / `sa_cashout_pre_accrual_not_authorised` / `sa_cashout_no_entitlement_to_cash_out`)?

**PM recommendation**: Three distinct codes — parallel to resolved TBD-WA-03 and resolved TBD-QLD-04. Stronger user awareness; modest engine complexity. Fixtures TC-SA-055 → TC-SA-058 are drafted on this assumption.

**Engine impact**: ½ dev-day for three-code branching vs one-code.

---

## TBD-SA-07 — [Sev-2] Higher-duties acting rate representation · ✅ RESOLVED 2026-05-25 — SA-localised `extraInputs.sa_higher_duties_*` (NOT DEV-CROSS-3)

**Question**: How should the SA-unique higher-duties acting rate be represented on `Employee`?

**Options**:
- **(a)** `extraInputs.sa_higher_duties_active: boolean` + `extraInputs.sa_higher_duties_weekly_rate: number`. Localised to SA. Same pattern as TBD-SA-04 unlawful-worker-termination.
- **(b)** Promote to dedicated `Employee` fields `higherDutiesActive?: boolean` + `higherDutiesWeeklyRate?: number`. State-agnostic — any future state that introduces a similar rule would consume them.

**PM recommendation (at draft time)**: Option (b) promote to `Employee` fields via DEV-CROSS-3.

**Operator decision 2026-05-25**: **Option (a) accepted — SA-localised via `extraInputs.sa_higher_duties_active` + `extraInputs.sa_higher_duties_weekly_rate`.** YAGNI principle — SA is the only state with a statutory higher-duties rule for LSL today; NSW/VIC/QLD/WA have no analogous provision. If NT/TAS/ACT genuinely need this concept later, retrofit is no harder than doing it now. **No new DEV-CROSS-3 dev-finding is created. T6.1 is unblocked immediately — no pre-flight cross-state PR is required.**

**Engine impact (option (a))**: 0 cross-state work; +½ dev-day to wire SA `extraInputs` reading (folded into the M (3–5 d) Phase 6 estimate).

---

## TBD-SA-08 — [Sev-3] WC overlap with LSL rate · ✅ RESOLVED 2026-05-25 — literal s.4 + advisory

**Question**: When an employee on WC at a reduced rate takes LSL, does SA apply the literal s.4 rate at leave time (yielding the reduced WC rate) or a higher-of-pre-injury-or-current rule like VIC s.17?

**Evidence**: SA s.4 has no s.17-equivalent. The natural reading is literal-rate-at-leave-time.

**PM recommendation**: Literal s.4 rate + non-blocking `sa_lsl_calculated_at_wc_reduced_rate_warning` advisory (parallel to resolved TBD-QLD-05 and TBD-WA-05). Fixture TC-SA-059 is drafted on this assumption.

**Engine impact**: ½ dev-day (matches QLD/WA pattern; reuses the trigger-handler WC-overlap check).

---

## TBD-SA-09 — [Sev-3] Single-day LSL on a PH · ✅ RESOLVED 2026-05-25 — counts as 1 day of LSL

**Question**: If a worker requests a single day of LSL falling on a public holiday, does the engine charge 1 day against entitlement (per the PH-inclusive rule) or zero days (PH is already a non-working day for which the worker is paid via the PH-loading mechanism)?

**Edge-case analysis**: The PH-inclusive rule says PHs falling WITHIN an LSL period count as days of LSL. The case of a single-day LSL request falling on a PH is right at the boundary — the worker has effectively requested "a day of LSL on a day they wouldn't be working anyway."

**PM recommendation**: Count it as 1 day of LSL (charge the entitlement; pay at ordinary daily rate). This is the literal reading of the inclusive rule and avoids unintentional gaming (where a worker could schedule all LSL days on PHs to consume zero entitlement). Fixture TC-SA-039 is drafted on this assumption.

**Engine impact**: 0 dev-days additional (already covered by the general PH-inclusive engine path).

---

## TBD-SA-10 — [Sev-3] SA public-holidays calendar source · ✅ RESOLVED 2026-05-25 — Public Holidays Act 1910 (SA)

**Question**: Per impl-plan v0.3.2 §6 T6.2, the engine consults a "hardcoded SA public-holidays array for v1; auto-detect from leave dates." What is the v1 source-of-truth for SA PHs?

**Available sources**:
- **SA Government Public Holidays Act 1910 (SA)** — statutory PH list (NYD, Australia Day, Adelaide Cup Day, Good Friday, Easter Saturday, Easter Sunday, Easter Monday, Anzac Day, Queen's/King's Birthday, Labour Day, Christmas Day, Proclamation Day).
- **Fair Work Ombudsman SA public holidays page** — operational summary, updated annually.
- **safework.sa.gov.au** — does not maintain a PH calendar, defers to the Public Holidays Act.

**PM recommendation**: Hardcode the SA PH list from the Public Holidays Act 1910 (SA) into `website/src/lib/lsl/states/sa/rules/public-holidays.ts`. Include the standard 12 SA PHs (incl. Adelaide Cup Day as the SA-unique PH — second Monday in March in metropolitan Adelaide; not all of SA observes it but the engine treats it as a SA PH for the inclusive-leave-counting rule). Re-validate annually as part of RES-3 quarterly review.

**Engine impact**: ½ dev-day (data entry + a date-arithmetic helper for Easter / Queen's Birthday dates).

---

## TBD-SA-11 — [Sev-3] Portable LSL schemes · ✅ RESOLVED 2026-05-25 — out of v1 scope (no advisory)

**Question**: SA has two separate portable LSL schemes that override the LSL Act 1987 for specific industries: (1) Construction Industry Long Service Leave Act 1987 (SA) — administered via SA PLSL (`saplsl.org.au`); (2) Portable Long Service Leave Act 2024 (SA) — community services workers, commenced October 2025. Should the engine surface an advisory when an employee's industry suggests they may fall under a portable scheme?

**PM recommendation**: OUT OF v1 SA engine scope — same convention as VIC industry awards, QLD industry-specific portable schemes, WA MyLeave construction scheme. Do NOT surface an advisory in v1; the calculator assumes the LSL Act 1987 (SA) governs. Re-evaluate in v2 if user surveys surface frequent confusion.

**Engine impact**: 0 dev-days.

---

## TBD-SA-12 — [Sev-3] Pre-1987 service · ✅ RESOLVED 2026-05-25 — counts; moot in practice

**Question**: SA LSL Act 1987 came into force in 1987. Does the Act recognise pre-1987 service performed under the predecessor Acts (the LSL Act 1957 and earlier industry-specific acts)?

**Evidence**: The Act does not contain an explicit transitional-savings provision excluding pre-1987 service; the natural reading is that continuous service performed before 1987 with the same employer DOES count under s.6.

**PM recommendation**: Pre-1987 service counts where the employee was continuously employed with the same employer from before 1987 to the present. In practice this is moot — an employee starting pre-1987 has 39+ years of post-1987 service to draw on, far above the 13-week first-entitlement threshold. The engine emits no advisory; the user-provided startDate is used as-is. **No fixture needed**; this is a documentary note for the v1 PM sign-off record.

**Engine impact**: 0 dev-days.

---

## Provisions deliberately deferred from v1 SA encoding

| Provision | Reason for deferral |
|---|---|
| **SA Public Holidays Act 1910 (SA) edge cases** — Adelaide Cup Day (metropolitan-only PH), Christmas Day part-day, Proclamation Day | The engine treats all SA PHs as full PHs for inclusive-leave-counting. Edge cases (part-day PHs like 7pm Christmas Eve) are deferred to v2. |
| **Construction Industry Long Service Leave Act 1987 (SA) — SA PLSL portable scheme** | Separate portable scheme. Out of v1 statutory engine scope. Same convention as VIC/QLD/WA industry schemes. |
| **Portable Long Service Leave Act 2024 (SA) — community services portable scheme (commenced Oct 2025)** | Separate portable scheme. Out of v1 statutory engine scope. |
| **Leave in advance** | The SA LSL Act 1987 does not have an explicit "leave in advance" provision (unlike WA s.10). Where a contract or award authorises leave in advance, the engine deducts pre-paid weeks from the total entitlement (handled via the generic `priorLeaveTakenWeeks` field — TC-SA-008). |
| **SAET dispute resolution** | The South Australian Employment Tribunal handles SA LSL disputes. Not a calculation question; out of v1 statutory engine scope. |
| **Working elsewhere during LSL** | SA Act has no s.27-equivalent (unlike WA). Out of v1 — no engine advisory. |
| **Employment records obligations** | Record-keeping obligations are administrative; not calculation. |

---

## Sign-off summary

All 12 TBDs were resolved by the operator on 2026-05-25:

- **TBD-SA-01** (Sev-1, LOAD-BEARING) — single regime confirmed. Impl-plan v0.3.2 §6 stands; no re-scope.
- **TBD-SA-04** (Sev-2) — SA-localised `extraInputs.sa_worker_notice_compliance` confirmed.
- **TBD-SA-07** (Sev-2) — SA-localised `extraInputs.sa_higher_duties_*` confirmed. **NOT DEV-CROSS-3.** T6.1 unblocked immediately with no pre-flight cross-state PR.
- **TBD-SA-02, -03, -05, -06, -08, -09, -10, -11, -12** (Sev-2/3) — all resolved per PM-recommended path with the inline detail in the **Resolutions** section near the top of this document.

Engine effort estimate stays at **M (3–5 days)** per impl-plan v0.3.2 §6. No DEV-CROSS-3 dev-finding is created. No new pre-flight cross-state PR.

---

## Signature line

```
Signed: Tracy Angwin (PM)
Date:   2026-05-25
```

> PM-only sign-off per E2 spec RES-6 / AC4. Sign-off completes T6.0. **T6.1 (SA rule-set scaffold) is UNBLOCKED immediately.** No pre-flight cross-state PR required — higher-duties and worker-notice are SA-localised via `extraInputs`.

---

*End of test-cases-sa.md v1.0 SIGNED OFF · Tracy Angwin (PM) · 2026-05-25.*
