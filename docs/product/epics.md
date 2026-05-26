# Epics — LSL Calculator

These are thematic bundles of work. Each epic makes a bet on user behavior — a specific problem that, if solved, unlocks a meaningful outcome. Epics are not a sprint backlog.

> **Sources**: APA *Long Service Leave Masterclass* (January 2026, 158pp, in `docs/features/LSL-training.pdf`) + each state's LSL legislation as primary source. Citations in the form `(NSW LSA s.4(2); PDF p.13)` refer to the relevant Act section and PDF page.
>
> **Sequence (updated 2026-05-26)**: build order is **E1 ✅ → E2 🔄 (6/8 states live) → E5 (LSL Platform, new) → E4**. Epic numbers are identities, not strict build order; see the Sequence Argument at the end.
>
> **2026-05-26 changes**: **E3 (NSW Audit Upload and Variance Report) is retired** — fully absorbed into E5.6 on a persistent multi-tenant base. **E1 Phase 7 (opt-in single-user logins) is cancelled** — the public calc stays anonymous-only permanently; all authenticated experience lives in E5.

---

## E1 · NSW Calculator

**The problem:** Australian payroll managers calculating LSL for an NSW employee — and auditors verifying it after the fact — currently work from the *Long Service Leave Act 1955* (NSW) by hand. The Act defines three distinct pay-pattern categories (fixed-rate-fixed-hours, fixed-rate-varied-hours, varied-rate), each with its own "greater of" comparison between current rate, 12-month average, and 5-year average. APA's own training shows that mainstream payroll systems, which compute `hours × hourly rate`, produce errors of 3–34% against the correct figure: in one worked example, a 12-year casual-to-FT transition is **underpaid $3,316.64 on a correct $9,880.04 payout** (PDF pp.139–141).

**The mechanism:** Encode the NSW LSA as a deterministic rules engine that selects the correct pay-pattern category, runs the lookback comparisons, and returns the legislated "value of a week" with a citation block linking each computed value to the section of the Act that produced it. Expose it through two modes inside the APA portal (working default: standalone + deep-link): a single-employee form for a specific event, and a bulk-employee upload (CSV or PDF of any payroll report) for snapshot / audit calculations across many employees in one pass.

**What it bundles:**
- **Pay-pattern classifier**: identifies which of the three NSW categories applies (NSW LSA s.4(5); PDF pp.18–23)
- **NSW rules engine**: lookback comparisons (current weekly gross / 12-month average / 5-year average); accrual table (10 yrs → 8.6667 wks, +4.3333 wks per 5 yrs); pro-rata thresholds on termination (5 yrs limited grounds, 10 yrs any reason) (NSW LSA s.4(2); PDF pp.13, 25)
- **Continuous-service rules**: paid leave + Workers Comp + transmission-of-business count; unpaid parental leave + industrial action + employer-initiated re-hire gap >2 months do not (NSW LSA s.4(11), s.4(6); Workers Comp Act 1987 s.49; PDF pp.14–16)
- **Single mode**: form-based entry for one employee with a specific trigger (taking leave / termination / as-at). Output: value of a week + value of a day + total entitlement with citation block.
- **Bulk mode**: CSV or PDF upload of any payroll report containing many employees' wage histories. Output: results table with one row per employee, per-row citation expansion, CSV + multi-page-PDF export. Default trigger = `as_at` (snapshot at upload date), user can override per row.
- **Pay-cycle normalisation**: weekly / fortnightly / monthly / other gross totals normalised to weekly averages before the rules engine runs.
- **PDF extraction**: vendor-agnostic LLM-based extraction (default vendor: Anthropic Claude API, no-retention enterprise tier) with mandatory editable preview before any calculation.
- **Gross-only inputs**: the calculator does NOT decompose into pay components. The user provides gross figures consistent with NSW LSA s.3(2) "ordinary pay"; pay-component decomposition / bonus high-income-threshold / salary sacrifice handling are OUT of v1.
- **Citation block**: every numeric output traces to the rule that fired, the LSA section, and the PDF page.
- **NSW gold-standard test suite**: PDF worked examples + 8 edge cases from the research brief + ≥2 bulk-mode multi-employee fixtures. PM signs off before development. Single failing case blocks deploy.

**What success looks like:** A payroll manager handling an NSW LSL event opens the calculator, completes a defensible single-employee calculation in ≤30 seconds; an auditor running bulk verification across 100 NSW employees gets a citation-backed results table in under 90 seconds. **100% accuracy on the gold-standard test suite is the launch gate; a single failing case blocks deployment.** Specifically: the APA training's worked example for the 12-year casual-to-FT transition (PDF p.141) must return $9,880.04 exactly, not the $6,563.40 a system formula returns.

**Why it goes first:** It is the smallest end-to-end slice that proves the wedge. The NSW LSA contains every structural element that recurs across the other seven states (lookback comparison, pay-pattern categories, pro-rata thresholds), so a working NSW engine is the architectural template for E2. Bulk mode in E1 is the foundation E3 (audit variance) builds on. Until NSW works end-to-end with citations, the wedge ("deterministic, defensible, legislation-traceable") is a claim, not a product.

_Spec: `.specify/features/001-nsw-calculator/spec.md` (v0.4.0)_
_Dev findings: `.specify/features/001-nsw-calculator/dev-findings.md`_

---

## E3 · Audit Upload and Variance Report — 🗑️ RETIRED 2026-05-26

**Status:** Retired. Fully absorbed into **E5.6 · LSL Reconciliation** on a persistent multi-tenant base.

**What changed:** E3's mechanism (CSV of historical LSL payments → replay through the engine → variance report) is strictly a subset of what E5.6 does on top of a persisted pay-history layer. The reconciliation feature in E5 has the same engine output, the same auditor-readable PDF, and adds: persisted history (so the same payment can be re-reconciled when new pay data lands), `cannot_verify` semantics for under-evidenced rows, and multi-tenant isolation. There is no value in maintaining E3 as a separate epic.

**What was lost:** Nothing material. E3 had no written spec at `.specify/features/003-*/spec.md` and no code ever shipped under its banner. The auditor-persona buyer remains the highest-value commercial signal — now served by E5.6 instead.

_See `docs/product/epic-status.md` "Obsolete / won't fix" section for the retirement record._

---

## E2 · All-State Coverage

**The problem:** Most Australian employers operate across multiple states. A NSW-only calculator + audit is a credible Phase-1 wedge but an incomplete product. Each remaining state has its own legislation with structural differences from NSW — including some that are dangerous to mis-encode (VIC criminalises cashing out; ACT counts overtime hours for part-time/casual ordinary-pay calc, *inverting* NSW's rule; WA has dual continuous-service regimes either side of 20 June 2022).

**The mechanism:** Replicate the E1 NSW rules-engine pattern for each of the remaining seven jurisdictions (VIC, QLD, WA, SA, TAS, ACT, NT), with per-state gold-standard test suites derived from each state's LSA + the worked examples in the APA training. Each new state is a content/data milestone, not a UI rewrite. The UI gains a state selector; the citation block updates to reference the relevant state's Act.

**What it bundles:**
- **VIC** rules: 7-year qualifying period, 12-week break tolerance, cashing-out as criminal offence (s.67), pre/post Nov-2018 continuous-service regimes (LSL Act 2018 (Vic); PDF pp.32–48). *Highest behavioural divergence from NSW.*
- **QLD** rules: 10-year, restricted cashing-out (requires award/EA permission or QIRC approval), 3-month break tolerance (IR Act 2016 (Qld) Ch.2 Pt.3 Div.9; PDF pp.49–64)
- **WA** rules: 10-year, dual continuous-service regimes either side of 20 Jun 2022, Workers Comp counting only from 1 Jul 2024 (LSL Act 1958 (WA); PDF pp.65–79). *Encoding risk: same employee may have two regimes applied across their tenure.*
- **SA** rules: 10-year → **13 weeks** (most generous accrual), PHs inclusive of LSL (vs NSW exclusive), cashing-out permitted in writing (LSA 1987 (SA); PDF pp.80–94)
- **TAS** rules: 10-year, cashing-out permitted after entitlement, no advance leave, 3-month break tolerance (LSL Act 1976 (Tas); PDF pp.95–108)
- **ACT** rules: 7-year qualifying period (lowest), **overtime hours count for part-time/casual ordinary-pay** (inverts NSW), termination paid within 90 days vs NSW immediate (LSL Act 1976 (ACT); PDF pp.109–123). *High mis-coding risk.*
- **NT** rules: 10-year → 13 weeks, cashing-out prohibited (s.12), strongest restriction on working elsewhere during LSL (s.16) (LSL Act 1981 (NT); PDF pp.124–136)
- **Per-state gold-standard test suites**: each suite derived from that state's worked APA examples + edge cases unique to that state
- **Multi-state employer support**: a "governing jurisdiction" selector that lets the user nominate which state's law applies for an employee with cross-jurisdictional service (the "sufficiently connected" test — PDF p.138 — is legal judgement, not arithmetic; calculator must surface ambiguity rather than choose silently)
- **Cross-state regression suite**: every change runs every state's suite; any break blocks merge
- **State selector in UI**: extended from NSW-only to all 8; citation block dynamically references the active state's Act
- **State-prioritisation order (RES-1, committed 2026-05-23)**: **VIC → QLD → WA → SA → ACT → TAS → NT** (population-weighted, VIC first on divergence-risk — cashing-out criminalisation + dual regime). Out-of-sequence development requires explicit operator override.
- **Bulk mode mixed-state from day one (RES-4)**: CSV must carry a per-row `state` column from v1; no single-state-only interim mode. Row-level validation surfaces unrecognised/empty states as errors; valid rows in the same batch still process.
- **Sign-off authority (RES-6)**: PM-only per-state sign-off; no APA-engaged specialist co-signer. Per-state launch gate = PM signoff on `test-cases.md` + automated suite 100% green in CI on merge commit.
- **Legislation monitoring (RES-3)**: Manual, owned by Tracy personally for all 8 jurisdictions, quarterly cadence (1 Mar / 1 Jun / 1 Sep / 1 Dec) + on-trigger override on gazetted amendments. No automated watch.
- **Deferred to v2 (RES-5)**: cross-jurisdictional governing-state advisory heuristic. F13 manual nomination remains MUST in v1; F14 legal-judgement caveat is the sole advisory text surfaced.

**What success looks like:** All 8 states encoded; each state's gold-standard suite passes at 100%; the UI state selector exposes every state; the multi-state-employer governing-jurisdiction selector is in production with explicit "this is a legal judgement, not a computed default" framing.

**Why it goes third in build order:** Cross-state expansion is the obvious customer-base expansion path. The original sequence argument (below) had E2 follow E3 v1 so it could inherit real demand signal from NSW audit-replay customers. **Operator override 2026-05-23**: spec E2 in parallel with E1 finishing so it is queued by the time NSW ships. Risk acknowledged — NSW Phase 3–7 work may shift the rules-engine pattern and force E2 spec re-work; the operator has accepted that risk to compress the timeline.

_Spec: `.specify/features/002-all-state-coverage/spec.md` v0.3.0 (all 6 OQs resolved 2026-05-23, ready for `dev-feature-plan`)_
_Dev findings: `.specify/features/002-all-state-coverage/dev-findings.md` (0 HIGH, 6 MEDIUM, 5 LOW)_

---

## E5 · LSL Platform (Authenticated, Persistent, Multi-Tenant)

**Supersedes:** E1 Phase 7 (cancelled 2026-05-26), E3 (retired 2026-05-26).

**The problem:** The current calculator is a **stateless tool** — a payroll manager pastes data, gets a number, closes the tab. Every calculation starts from scratch. There is no place for an organisation to keep its employee masterfile, its pay history, its pay-code mappings, or the audit trail of who calculated what when. For a single ad-hoc termination payout that is fine. For the actual customer workflow — running quarterly liability reports across a thousand employees, reconciling a year of past LSL payments before a board audit, or simply not re-uploading the same 24 months of pay history every time a new pay run lands — the stateless model is an architectural ceiling on what the product can charge for. APA's training material frames LSL as a *chronic* payroll-data-quality problem (Health Check, PDF p.137); a chronic problem needs a persistent system of record, not a calculator.

**The mechanism:** Stand up an authenticated multi-tenant SaaS layer on top of the existing per-state rules engines. Each client organisation gets a private workspace with: Supabase Auth (email + password, three roles), an employee masterfile, a pay-code mapping table (org-wide raw-code → bucket, with per-state bucket treatment resolved by the engine), persisted pay-period history (CSV-only ingestion in v1, idempotent), on-demand valuations that re-use the existing engines unchanged, liability reports computed against any as-at date, and the headline feature — reconciliation, which uploads historical LSL payments and produces a per-row variance verdict against what the engine says was correct. The platform lives at the same domain as the public calc, under `/app/*`, branded as APA. Every other layer of the product — engines, citation blocks, brand of correctness — is reused as-is.

**What it bundles:**
- **E5.1 · Auth + Tenancy + DB Scaffold** — Supabase provisioned. Organisation + User + RoleMembership tables with Postgres Row-Level Security on every tenant table. Supabase Auth (email/password only — no SSO, no OAuth, no magic links in v1). One org per signup; admin invites users; three roles (`admin`, `payroll_user`, `read_only`). 7-day grace window on org deletion before hard-delete. **Load-bearing — every other sub-epic blocks on this.**
- **E5.2 · Employee Masterfile** — CSV + Excel + manual entry. Effective-dated state and employment-type changes are preserved so historical valuations see the right value at the right time. Soft delete preserves audit trail.
- **E5.3 · Pay-Code Mapping** — The user maps each distinct raw pay code to one of a fixed list of LSL buckets (Ordinary Time, Overtime — Regular, Penalty Rates, Commission, Bonus — Contractual, Casual Loading, Leave — Workers Comp, etc.). **Mapping is org-wide** — the same code maps to the same bucket regardless of the employee's state. **Bucket → state treatment is engine-resolved per-state** at valuation time. Example: the "Penalty Rates" bucket counts as ordinary pay when the engine values a QLD or TAS employee and is excluded for everyone else. The user does not need to know this; the engine does. Mapping is audited, retrospective, and blocks valuations when codes are unmapped.
- **E5.4 · Pay-Period Ingestion** — **CSV only in v1.** One row per (employee, pay_period_end, pay_code, gross_amount). Idempotent — re-importing the same pay run does not double-count. Dry-run preview shows row count, distinct-employee count, distinct-pay-code count, and the unmapped-codes subset before commit. Partial commits accepted with a downloadable error CSV. **PDF ingestion is deferred** beyond v1.
- **E5.5 · Valuations + Liability Reports** — Pick an employee and a trigger; the platform dispatches to the right state's engine, returns the engine's full output with citation block, and persists every valuation with input snapshot + engine version + mapping version. Liability snapshot scopes by single employee, employee list, or whole org at any as-at date. **Liability is `accrued_weeks × weekly_value`** — the simple definition. No actuarial vesting probability in v1. PDF and CSV export, with cached results for re-runs.
- **E5.6 · LSL Reconciliation** — CSV upload of historical LSL payments. For each row the platform re-runs the relevant state's engine against the persisted pay history at the prescribed historical date and produces a variance verdict: `correct` / `under` / `over` / `cannot_verify`, with the variance amount, the rules that fired, and the Act sections that drove the computed value. `cannot_verify` is explicit — under-evidenced rows never default to "correct". PDF (signature-ready) and CSV export. **This is the headline commercial feature** — the auditor-persona buyer identified in `product.md` §11 hypothesis 1 buys this, not the calc.
- **APA brand identity** end-to-end on `/app/*` — logo, palette, typography, voice, email templates, PDF exports. The public calc at `/` keeps the existing "LSL Calculator" identity for unauthenticated trial. Two surfaces, one domain, distinct visual identities.
- **Tenant isolation** via Postgres RLS as primary defence — no application-level `WHERE org_id = ?` filtering. Automated cross-tenant security test in CI is part of the launch gate.
- **Engine reuse, unchanged** — the platform's pipeline is `pay history × mapping → engine input`; the engines themselves are reused as black-box dependencies. The 100% gold-standard test suite from E1/E2 continues to bind.

**What success looks like:**
1. A new client onboards in **under 90 minutes** from signup to first defensible valuation (signup → org creation → invite a colleague → upload masterfile → upload 24 months pay history → map raw pay codes → run first valuation).
2. A liability report on **1,000 employees runs in under 60 seconds**, cached.
3. A reconciliation report on **a year of LSL payments (30–80 rows for a mid-sized employer) returns variance verdicts in under 90 seconds**.
4. **100% engine-correctness preserved** — the platform's `pay history × mapping → engine input` pipeline is covered by a regression suite of ≥50 fixtures derived from existing single-calc test cases. Any drift between platform valuation and stateless engine result is a Sev-1.
5. **Zero cross-tenant leakage** — automated security tests assert no cross-tenant read or write is possible via the API, RLS, or any combination.
6. **Reconciliation surfaces a real-money finding on at least one pilot client within 90 days of pilot** — the variance report identifies at least one under- or over-paid LSL event the client did not already know about. This is the falsification test for `product.md` hypothesis 1.

**Why it goes after E2 (in parallel with E2's tail end):** E5 reuses the engines unchanged but needs at least 6 states live to be a credible product; 6 are now live and TAS + NT (E2 Phases 8–9) can ship in parallel with E5.1–E5.4. The platform changes the *input pipeline* to the engines, not the engines themselves, so the architectural risk is contained to the new data + auth + mapping layer. E5.1 (Supabase scaffold) is greenfield — Supabase is named in `CLAUDE.md` but no integration code has shipped, so the dev team starts from zero on that surface. E4 (payroll integrations) waits until E5 has a stable pay-period ingestion path; E4 then replaces manual CSV uploads with API integrations at a strictly better value proposition than the legacy E3-replacement E4 would have been.

**What this epic deliberately does not do:**
- PDF ingestion into the platform (deferred beyond v1 — the public calc still accepts PDF for one-off use)
- LLM-assisted pay-code mapping (deferred to v1.1 once we see real client raw-code lists)
- Future-date liability projection (deferred to v2)
- Multi-org-per-user (deferred; v1 workaround is a separate login per client)
- SSO, SAML, OAuth, Google/Microsoft sign-in (deferred)
- API integrations with payroll vendors (that's E4)
- Write-back into client payroll systems (explicitly out of scope per `product.md` §7)
- Australian data residency (Supabase default region in v1; deferred compliance consideration)
- Pricing decisions (open commercial decision; does not block engineering)

_Spec: `.specify/features/005-lsl-platform/spec.md` **v1.0 APPROVED 2026-05-26**. All 15 open questions plus E1 Phase 7 disposition resolved — see spec §12 for the locked decision table._

---

## E4 · Payroll System Integrations

**The problem:** Manual CSV uploads (E3) and manual single-employee data entry (E1) are friction that scale linearly with calculation volume. They also create a data-quality risk: every hand-typed start date, hand-entered pay component, or hand-edited CSV is a place where the calculator's correctness can be undermined by bad inputs to a correct rules engine. The eventual mature product reads directly from the payroll system of record.

**The mechanism:** Build read-only OAuth/API connectors to the major Australian payroll platforms. Map payroll-platform fields to the NSW-LSA-s.8-derived schema used by E1 + E3. On each calculation or audit run, pull live data from the payroll system rather than asking the user to enter it.

**What it bundles:**
- **First payroll-vendor connector** (vendor TBD; selection based on APA-member share — likely Xero, MYOB, KeyPay, or ADP)
- **OAuth/API authentication flow** per vendor
- **Field-mapping engine**: payroll-platform field → rules-engine input. Includes telemetry on missing/ambiguous fields by vendor so the gaps are visible across the customer base
- **Connectors for second and third vendors**
- **Refresh model**: explicit user-triggered refresh (not background sync) so the auditor's report is reproducible from a specific timestamp
- **Read-only by design**: API tokens scoped to read; no write-back into client payroll under any circumstance (see §7 of `product.md`)
- **Fallback to CSV**: every customer can still use the E3 CSV flow if their vendor isn't supported

**What success looks like:** A payroll manager whose company runs on a supported platform completes an LSL calculation or audit run with zero manual data entry beyond selecting the employee(s) and the trigger. The rules engine receives the same inputs it would receive from a perfect CSV, traced by field provenance ("this current rate came from vendor X's `current_pay_rate` field at timestamp T").

**Why it goes last:** API integrations are higher engineering cost, require vendor partnerships, and depend on E2 (cross-state) being mature so the connector design doesn't have to be reworked when the rules engine changes shape. **New insertion point (2026-05-26)**: E4 now replaces manual **pay-period uploads** in E5.4 rather than legacy E3 CSV audit uploads — a strictly better value proposition. Until E5 ships, the platform's CSV ingestion covers the need at lower fidelity but full state coverage.

_Spec: `.specify/features/004-payroll-integrations/spec.md` (not yet written)_

---

## Sequence argument

**Updated 2026-05-26.** The original sequence had E1 → E3 v1 (NSW audit) → E2 → E3 v2 → E4. E3 is now retired in favour of E5, and the sequence has compressed:

1. **E1 (NSW Calculator)** — Phase 1, ✅ shipped 2026-05-24. Proved the rules engine + citation block + 100% accuracy gate on NSW. The architectural template for everything that follows.
2. **E2 (All-state coverage)** — Phase 2, 🔄 in flight. **6 of 8 states live** as of 2026-05-25 (NSW + VIC + QLD + WA + SA + ACT). TAS + NT remain. Each new state is a content/data milestone, not a UI rewrite.
3. **E5 (LSL Platform)** — Phase 3, 📋 approved 2026-05-26, awaiting impl plan. Six sub-epics sequenced (E5.1 Auth + DB → E5.2 Masterfile → E5.3 Mapping → E5.4 Ingestion → E5.5 Valuations + Liability → E5.6 Reconciliation). **Absorbs the retired E3** (reconciliation on a persistent multi-tenant base is strictly more valuable than one-shot CSV variance reports). **Replaces the cancelled E1 Phase 7** (no single-user "save my calc" on the public surface; org-level workspace is the only authenticated experience). Can run in parallel with E2's tail end (TAS + NT) once E5.1's Supabase scaffold lands.
4. **E4 (Payroll integrations)** — Phase 4. Replaces manual pay-run uploads in E5.4 with read-only OAuth/API connectors to major Australian payroll vendors. Waits until E5 has a stable ingestion path so the connector design doesn't have to be reworked.

**Why this sequence?** E1 proved the wedge. E2 expands the wedge to every Australian employer. E5 is where the product becomes a SaaS — auth, persistence, multi-tenant, reconciliation as the headline commercial feature. E4 is the friction-removal pass that makes the SaaS sticky. The original E1 → E3 NSW slice → E2 logic was right for a 2025 product that wasn't going to charge SaaS pricing; once E5 enters the picture, the legacy E3 audit-CSV scope is a strict subset of E5.6, so retiring it is the correct move.

**What changed from the original argument:** The original argument said "expanding state coverage before proving the second buyer (the auditor) leaves the more differentiated revenue stream un-validated for an extra phase". That logic stands — except the differentiated revenue stream is now **reconciliation on a persistent platform (E5.6)**, not one-shot NSW audit CSVs (legacy E3). E5.6 reaches the same auditor-persona buyer on a strictly better foundation.
