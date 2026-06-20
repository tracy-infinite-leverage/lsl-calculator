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

### E5 · 2026-05-27 sub-spec refresh — operator decisions on E5.2 / E5.3 / E5.4 + PDF removal companion

The umbrella E5 spec v1.0 stands. The operator landed a major piece of scoping work 2026-05-27 covering CSV-based payroll data ingestion and PDF code removal. The four sub-specs that flow from it have been refined / scoped, **without revising the umbrella spec or its locked decisions**:

- **PDF Removal (companion to E5)** — `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md`. Sequenced **first** — independent of E5.1's auth slice. Deletes `/api/extract-pdf`, `/api/normalize-csv`, `website/src/lib/lsl/parsers/pdf/*`, `website/src/components/lsl/pdf-upload.tsx`, the `@anthropic-ai/sdk` dependency, and the `ANTHROPIC_API_KEY` env var. Closes the LAUNCH-GUARD hard gate by elimination — the platform was already CSV-only in v1; this strips the legacy LLM-extraction code so the dev team designs E5.4 ingestion against a CSV-only codebase from the start.
- **E5.2 Employee Masterfile + Customer Setup** — `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md`. Single-employer customers (no bureau in v1). Customer setup on the org (`employer_legal_name`, `abn`, `default_work_jurisdiction`, `default_pay_frequency`). Employee table with effective-dated history for `employment_type` / `pay_frequency` / `classification` / `hours_per_week` / `default_work_jurisdiction`. Per-employee `pay_frequency` (mixed within an org allowed). `sex` required for TAS (s.8(3) sex-specific retirement gate); `dob` required for NT (federal Age Pension age lookup). PII strip on TFN / bank / super columns before insert. `scheme` column reserved for v1.1 portable LSL (writes `state_lsl` only in v1; data model permits portable codes without migration).
- **E5.3 Pay-Code Mapping (auto-detection + wizard)** — `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md`. Column auto-detection by header name + pay-code value pattern, with a mapping wizard fallback. Inline wizard during first import, incremental on subsequent imports. Versioned mapping store — every change preserved; valuations capture `mapping_version_id` at run time so re-mapping cannot retroactively shift historical valuations. System-managed `pay_code_aliases` knowledge base seeded at launch (no LLM in v1; LLM-assisted suggestions deferred to v1.1 per umbrella spec).
- **E5.4 Pay-Period Ingestion (CSV, versioned, audited)** — `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md`. Generic CSV from any payroll source. Full historical onboarding (10+ years per tenured employee). Work-location-per-pay-period (`work_jurisdiction` field on every row — **authoritative for jurisdiction at valuation time, overrides masterfile default**). Versioned re-imports via `superseded_at` / `superseded_by_import_id` pattern; historical valuations replay against live-view-at-time. Partial commit on bad rows — valid rows land, invalid rows queue in `pay_period_exceptions` for review. Immutable `import_audit_log` (uploader, timestamp, SHA-256 file hash, row counts, mapping version, engine version, source-file storage pointer). PII strip at the boundary. Supabase hosted in **`ap-southeast-2` (Sydney)** — resolves the umbrella spec's "deferred compliance consideration" on data residency. Service-layer abstraction so v2 API ingestion can write through the same persistence path.

**What did not change in the umbrella spec:**
- Pay-bucket taxonomy (umbrella §6) is unchanged.
- Per-state engine-resolved bucket treatment is unchanged.
- v1 scope to the 8 Australian state/territory LSL Acts is unchanged. Portable LSL (construction / contract cleaning / coal) is **deferred to v1.1**; data model permits it without migration churn.
- Pricing, branding, deployment model — all unchanged.

**Open questions flagged in the sub-specs (do not block engineering kickoff):**
- E5.2 OQ-EMP-1: opening-balance UX (CSV column vs setup wizard vs both) — PM recommends both; needs operator confirmation before E5.5 valuations.
- E5.2 OQ-EMP-2: data retention after termination — PM recommends 7 years (Fair Work Act minimum); flag for legal review.
- E5.2 OQ-EMP-3: audit log retention — PM recommends indefinite for the org's lifetime.
- E5.3 OQ-MAP-1: wizard inline vs separate pre-import setup — PM recommends inline by default; JSON import as alternative.
- E5.4 OQ-ING-3: dedup uniqueness key — PM recommends `(org_id, employee_external_id, pay_period_end, pay_code_raw)`; **explicit dev-finding flagged to validate against real-world payroll exports before pilot**.

**Sequencing recommendation:**
1. **PDF removal** — first, independent. Closes the LAUNCH-GUARD gate.
2. **E5.1 auth slice** — currently in flight on `feat/E5.1-auth-slice`; merge when QA signs off.
3. **E5.2 Employee Masterfile** — depends on E5.1 merged.
4. **E5.3 Pay-Code Mapping** — depends on E5.2 (FK target).
5. **E5.4 Pay-Period Ingestion** — depends on E5.1 + E5.2 + E5.3.
6. **E5.5 Valuations + Liability Reports** — depends on E5.4 having pay history persisted.
7. **E5.6 LSL Reconciliation** — depends on E5.5.

### E5 · 2026-05-31 sub-spec amendment — E5.3 + E5.4 reshaped to absorb real payroll-export shape

**Trigger.** Operator received a representative customer payroll export (Virtus Health — 3-sheet `.xlsx`, ~1,400 employees, IVF group with cross-state staff) on 2026-05-31. File analysis surfaced four structural gaps in the existing E5.3 + E5.4 sub-specs that would prevent end-to-end ingestion of real-world payroll data. **The umbrella E5 spec v1.0 stays. E5.2 proceeds unchanged on PR #105.** E5.3 + E5.4 sub-specs require amendment before dev kick-off.

**Why now.** The existing E5.3 + E5.4 sub-specs were drafted 2026-05-27 against an idealised generic-CSV shape. The Virtus file is `.xlsx` with three sheets (calculated-results / employee-master / payroll-export), has no per-pay-period wage history (only ordinary weekly hours + running balances), uses long-form state names (`"Tasmania"`) and prefixed employment-type codes (`"CA - Casual"`), and surfaces two unmodelled domain concepts (Cohort = cross-jurisdiction service grouping; Award/Instrument = enterprise agreement reference). No spec amount of "deterministic header-name matching" closes these gaps — they are shape gaps, not naming gaps.

**Amendment scope — E5.3 (Pay-Code Mapping):**
- **LLM-assisted column auto-detection promoted from v1.1 to v1.** The "no LLM in v1" decision in the current sub-spec (drafted before the PDF-removal companion shipped) is reopened. Determinstic header-pattern matching stays as the first pass; LLM-assisted suggestions become the second pass before the user falls through to the wizard. The `ANTHROPIC_API_KEY` env var (removed by the PDF-removal companion 2026-05-27) is reinstated for this path. The wizard remains the source of truth — LLM only proposes.
- **Multi-sheet Excel ingestion.** Accept `.xlsx` (and `.xlsm`) in addition to `.csv`. When the file contains multiple sheets, the user picks which sheet is the employee-master and which is the payroll-export (or the system proposes based on column-signature heuristics). Sheets are joined on a user-confirmed employee key column.
- **Value normalisation library.** Long-form state names (`"Tasmania"` → `TAS`, `"Victoria"` → `VIC`) and prefixed employment-type codes (`"CA - Casual"` → `casual`, `"PT - Part Time"` → `part_time`) become a deterministic normalisation pass that runs before the bucket mapping. Catalogue is org-versioned alongside `pay_code_mappings`.

**Amendment scope — E5.4 (Pay-Period Ingestion):**
- **Pay-component breakdown is mandatory — not just total gross pay.** The ingestion record changes from `(employee, period_end, pay_code, gross_amount)` to a typed-component shape per period (ordinary / overtime — regular / overtime — ad-hoc / penalty rates / commission / bonus — discretionary / bonus — contractual / all-purpose allowance / single-purpose allowance / casual loading / leave — annual / personal / LSL / workers comp / unpaid parental / unpaid other / termination — LSL / termination — other / excluded — other, mirroring the umbrella §6 bucket taxonomy). State-specific inclusion rules become deterministic against typed components rather than emitting "we assumed X was inside `gross`" warning codes. **The engine input contract changes — engine team has a dependency.**
- **Pay frequency is a first-class field on the import.** The system must know whether the file is weekly / fortnightly / monthly / mixed, because (a) per-period averaging windows are frequency-aware and (b) some state rules (TAS commission 3mo, SA commission 52wk, ACT commission 12mo) reference periods, not days. Detection sources, in order of preference: explicit user declaration at upload; explicit column in the file (`Pay Frequency`); inferred from period-start / period-end gap analysis across rows. Mixed frequencies within one file are permitted (mirrors masterfile per-employee `pay_frequency`) but every row must resolve to one frequency.
- **Hours-based input mode.** When the file carries `ordinary_weekly_hours` (or equivalent) plus an ordinary rate but no per-period wage rows, the system runs in hours-mode: weekly gross = `hours × rate`, with the same typed-component shape on top. This is the dominant export shape for payroll systems like Micropay that don't expose per-period wage breakdowns at the export layer. Hours-mode and per-period-wage-mode are mutually exclusive per employee per import; the system detects which is available and routes accordingly.
- **Multi-sheet Excel + value normalisation** — inherited from the E5.3 amendment above. The two sub-specs share the same ingestion entry point.

**New domain concepts surfaced — disposition TBD by PM:**
- **Cohort** (Virtus example: `VIC-TAS`, `NSW-QLD`) — a cross-jurisdiction service grouping. Possibly redundant against the existing `states` (multi) + `governing_jurisdiction` model, possibly a first-class concept driving per-cohort calc rules. PM decision required.
- **Award / LSL Instrument** (Virtus example: `MIVFS2022`, `TIVF2024`) — enterprise agreement reference. Possibly metadata pass-through, possibly the key for an award-rate lookup table that hours-mode depends on. PM decision required.

**What this changes for sequencing:**
- E5.2 unchanged — Phase 1 dev work on PR #105 proceeds.
- E5.3 + E5.4 sub-specs require PM amendment + operator approval before dev kick-off.
- E5.5 (valuations) unchanged at the spec layer, but engine input contract change above means the valuation pipeline reads typed components from E5.4 — implementation detail for E5.5 dev.
- E4 (payroll integrations) gains an upstream dependency: connector field-mapping must produce the new typed-component shape, not a single `gross_amount`.

**Open questions for operator (PM amended sub-specs 2026-05-31, OQ IDs renumbered to OQ-MAP-5..7 / OQ-ING-8..11 to avoid collision with v0.1 IDs).** Operator decisions locked 2026-06-01:

- **OQ-MAP-5 LLM-assisted mapping** → **LOCKED 2026-06-01 — PM recommendation.** Default-on with per-org opt-out toggle. Cost-cap $0.05 per import. Latency budget 10 seconds, then fall through to manual wizard. When `ANTHROPIC_API_KEY` is unset → no call, no error, wizard shows "LLM assistance unavailable — proceeding with deterministic suggestions only".
- **OQ-MAP-6 Excel sheet-picker** → **LOCKED 2026-06-01 — PM recommendation.** Sheet-picker unconditional on first import (onboarding clarity). On subsequent imports with the same file signature, skip silently. `imports` row persists the choice.
- **OQ-MAP-7 PII scan across Excel sheets** → **LOCKED 2026-06-01 — PM recommendation.** Scan ALL sheets for PII column names at upload time. Refuse source-file storage (or store with offending sheets stripped) if PII headers appear anywhere.
- **OQ-ING-8 Hours-mode rate source** → **LOCKED 2026-06-01 — option (a) only (narrower than PM rec).** v1 hours-mode requires a `Rate` column on the per-employee record. No `PayRateHistory` companion file support in v1. No masterfile manual fallback in v1. Per-award lookup deferred to v1.1 alongside OQ-ING-10. Rows without resolvable rate queue to `pay_period_exceptions` with `failure_reasons = ['hours_mode_rate_unresolvable']`. Virtus is unaffected — Virtus has per-period wage rows in `PayHistory`, so it bypasses hours-mode entirely.
- **OQ-ING-9 Cohort** → **LOCKED 2026-06-01, REVISED 2026-06-01 after PR #105 schema verification.** Cohort is **derived at runtime** from the employee's distinct per-pay-period `work_jurisdiction` values — NOT stored as a separate field on `employees`. The PR #105 merged schema confirms this architecture: `employees.default_work_jurisdiction TEXT` (singular) + `pay_periods.work_jurisdiction` (per-row, authoritative for valuation per E5.4 spec §1). A "VIC-TAS" cohort employee naturally has some pay-period rows with `work_jurisdiction = 'VIC'` and some with `'TAS'`. The file value `VIC-TAS` on an employee row is a **hint** (used by E5.3 to flag the employee as cross-jurisdiction and to ensure later ingestion will see both states), not a stored field. Override of PM's pass-through recommendation stands; **the earlier "parsed as `states = ['VIC', 'TAS']` on the employee record" wording was an over-reach against the merged schema and is superseded by this revision.**
- **OQ-ING-10 Award/LSL Instrument** → **LOCKED 2026-06-01 — PM recommendation.** Pass-through `lsl_instrument_label text` on `employees` and `pay_periods` (free-form, optional) in v1. v1.1 introduces an `awards` table when portable LSL or E4 vendor connectors need it. Surface the instrument value in valuation citation blocks for traceability.
- **OQ-ING-11 E5.5 engine-input contract coordination** → **LOCKED 2026-06-01 — PM recommendation (sequencing).** Operator approves this amendment first (done); PM writes an addendum (or v0.2) to the E5.5 sub-spec referencing E5.4 §4.5 + AC-ING-21; **then** E5.5 Phase 1 dev work starts.

**Multi-employer / multi-ABN — DEFERRED TO v1.1 2026-06-01 (operator decision).** Virtus carries 10 distinct `Payroll Company` values = one corporate group, 10 ABNs. The 2026-05-27 E5.2 lock-in stands: v1 = one org = one ABN = one employer. **v1 ships without multi-employer support.** Virtus cannot be a v1 pilot customer — they need v1.1 multi-employer to onboard. Trade-off accepted: lowest scope risk; accept loss of the canonical test customer as a v1 pilot. v1.1 backlog: amend E5.2 to add `employer` as a first-class entity below `organisation`. PM to record this scope boundary in the E5.4 sub-spec "out of scope" subsection and in the umbrella E5 spec's "explicitly out of scope" list (umbrella v1.0 stays; just append).

_Canonical test fixtures: `/Users/tracyangwin/Downloads/Virtus Health - LSL calculation/Sample run/` — **5 files**, not 1. Primary ingestion path: 3 CSVs (`PayHistorySampleFile.csv`, `PayRateHistorySampleFile.csv`, `PositionHistorySampleFile.csv`). Hours-mode test path: the single `.xlsx` workbook. Reconciliation E5.6 fixture: `LSL taken.xlsx`. (PM corrected the earlier "single xlsx" framing 2026-05-31.)_

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

## E6 · LSL Sub-Brand UI System + Report Pipeline

**The problem:** The product today is functional but visually generic — default shadcn styling, no brand identity, no sub-brand wordmark, reports are basic in-browser HTML. A CFO who downloads a liability report has to retype it into Word before sending to the board; a payroll manager on the public calc has no signal that this tool is part of the APA family; an APA consultant working across multiple client tenants has no persistent indicator of which client they're acting on, and zero affordance for the mis-tenant action that one day causes a real-money payroll error.

**The mechanism:** Layer an APA-aligned sub-brand identity ("LSL Calculator by APA" — sibling-product posture, comparable to Xero Practice Manager) on top of the existing Next.js + Tailwind + shadcn stack as design tokens + component variants — never hard-coded in component CSS — then apply that system to the public calc, the `/app/*` platform shell (E5.2 onward), and a server-side PDF pipeline producing A4 board-ready reports with branded letterhead, methodology footer, and page numbering. Engines, citation blocks, and the 2214/2214 LSL test suite are untouched; the design system rides above the rules layer and never below it.

**What it bundles:**
- **E6.1 Sub-brand identity** — wordmark + "by Australian Payroll Association" lockup + icon style direction. Designer-deliverable. Fallback: if wordmark blocks > 14 days, E6.2 proceeds with APA primary wordmark placeholder.
- **E6.2 Design system tokens + core component library** — Tailwind theme extension with APA palette (navy `#48608a`, gold `#d9a428`, white primary; extended palette + advisory teal); Montserrat / Source Sans Pro type pairing; shadcn variant overrides for Button / Input / Table / Card / Modal / Toast / and the rest of the primitive set. **Hard gate to E5.2 implementation.**
- **E6.3 `/app` workspace shell** — top nav, sidebar, tenant switcher with persistent "Acting as: <client>" indicator visible whenever active tenant ≠ home org, breadcrumbs, opinionated empty states, loading states, keyboard-first navigation. Destructive write actions under non-home-tenant context require a confirm dialog naming the active tenant.
- **E6.4 Public calculator re-skin** — apply the design system to `www.lslcalculator.com.au` end-to-end: state selector, single-employee form, bulk-upload entry, result + breakdown screens. **Zero engine changes. Zero test regressions** (2214/2214 LSL + 92 Playwright across 4 browsers stay green).
- **E6.5 Report pipeline foundation** — server-side PDF generation, A4 templates, branded letterhead (sub-brand wordmark + APA lockup + report title + timestamp), methodology footer block on every page (calc methodology version + state-engine version + data-as-at date + "calculated, not advice" + APA contact), Page X of Y, print stylesheet. **A4 only.** No draft / preview watermarks.
- **E6.6 Report templates per family** — four templates: single-employee (wraps existing public-calc Cat A/B/C result + citation block), bulk-upload summary (wraps existing public-calc multi-employee table), E5.5 liability (org-wide accrued LSL — ships as E5.5 delivers), E5.6 reconciliation (variance vs org-recorded liability — ships as E5.6 delivers). E5.5 + E5.6 templates lead with a one-page exec summary (3-column for liability, single headline for reconciliation, per PM lean in OQ-11).
- **WCAG 2.2 AA** across web surfaces; tagged PDFs with reading order; full PDF/UA deferred to v1.1.
- **Desktop-first.** Public calc retains mobile-responsive posture; `/app/*` best-effort mobile; tablet not a first-class form factor.
- **Sequencing:** E6.1 → E6.2 (hard gate to E5.2) → E6.3 + E6.4 in parallel → E6.5 → E6.6 (last two templates trail E5.5 / E5.6 delivery). E5.1 auth is **explicitly carved out** and ships with default shadcn — no re-skinning.

**What success looks like:**
1. First-time public-calc user completes a calculation without reading help: median time-to-first-result ≤ 60 seconds on `/` at re-skin launch + 30 days.
2. Payroll manager runs a full E5.6 reconciliation in ≤ 9 full-page navigations end-to-end.
3. CFO downloads a liability or reconciliation PDF and sends it to the board without Word/Excel touch-up. (Measured by qualitative interview with ≥ 3 pilot CFOs at launch + 60 days.)
4. APA consultant switching between client tenants produces **zero mis-tenant action incidents** in the first 90 days of consulting-team usage — the persistent "Acting as" indicator + confirm dialog on destructive non-home-tenant actions are the load-bearing controls.
5. Automated axe-core audit on `/`, `/app/*`, and each report HTML preview returns zero "serious" or "critical" violations.
6. Brand-credibility recall: when shown the LSL Calculator alongside three other APA products, ≥ 80% of payroll-manager interviewees recognise the LSL Calculator as part of the APA family without being told (n ≥ 5).
7. 2214/2214 LSL suite + 92 Playwright tests stay green on every E6 PR. **Zero engine regression is a hard merge gate.**

**Why it goes in parallel with E5.1 and gates E5.2:** The public calc shipping unstyled-relative-to-APA is a credibility tax on every customer conversation the APA channel is having today. Holding the design-system work until E5 is feature-complete means a stylistically generic auth surface for E5.2 onward — the load-bearing customer surface for the SaaS business — which compounds the credibility tax. The system token layer + core components MUST exist before E5.2 implementation starts so platform features land with brand identity from day one rather than retrofit; everything downstream of E6.2 (the shell, the public re-skin, the report pipeline) parallelises trivially because each is additive to a stable token layer. Sequencing-wise E6 is therefore *parallel with E5* — not "after E5" — and the only hard cross-epic constraint is E6.2 ready before E5.2 implementation kickoff.

_Spec: `.specify/features/006-ui-design-system/spec.md` **v0.4 APPROVED 2026-05-27** (operator signed off on all 12 remaining OQs; ready for developer handoff)_
_Dev findings: `.specify/features/006-ui-design-system/dev-findings.md` (0 HIGH, 1 MEDIUM, 2 LOW)_

---

## E8 · Payroll Knowledge Assessment

> **Status:** 📋 **v0.5 SPEC LOCKED — operator-signed-off 2026-06-10.** Phase-split into v0.5 (assessment lead-magnet — ships standalone now) + v1.0 (recommender layer — ships when ≥ 6 APA courses exist). Question bank locked (35 Qs × 6 categories). Nine v0.5 OQs operator-resolved; four OQs (OQ-KA-9/11/12/13) explicitly deferred to v1.0; two new OQs (OQ-KA-14/15) carried as non-blocking. Ready for developer planning on v0.5 only.

**The problem (v0.5):** Payroll managers and team leads have nowhere to self-diagnose their own knowledge gaps across the load-bearing compliance domains — Fair Work, Super, Payroll Tax, Leave, Terminations, and end-of-year STP. The cost of not knowing isn't abstract: an SG-rate miss is an SG-charge plus interest; an LSL accrual error is the entire variance E5.6 is designed to surface; a wrongly-classified termination payment is a tax-office finding. Industry bodies publish general guidance and run paid workshops; neither produces a personalised "here's where you specifically are weak" diagnostic in 10 minutes for free. Adjacent to the respondent's problem is the operator's: the APA video-course catalogue does not yet exist as of 2026-06-10. There are six categories of payroll-compliance pain we *could* film a course for; we don't know which to film first. A diagnostic completed by hundreds of payroll managers tells us — directly, by category-level failure rates — which course will have the largest addressable market on day one. v0.5 is the diagnostic instrument *and* the market-research instrument; v0.5 itself produces the signal that unlocks v1.0.

**The mechanism (v0.5 — what ships now):** A free, browser-based, stateless 35-question multiple-choice assessment on the public marketing surface at `lslcalculator.com.au/assessment`. Six categories of six (one of five) questions each, one question per screen, no back-tracking. Before scoring, the respondent picks a time-commitment bucket (≤ 1 hour / half-day 2–4h / 1 full day 6–8h / multi-day > 1 day) — collected but not yet acted on by a recommender, because there are no courses to recommend yet. At the end, an **email gate** reveals the results: per-category sub-scores with the weakest domain called out at the top ("Your biggest gap is Terminations — you got 2/6 correct"), citations on incorrect answers only, and a closing line — "Detailed course recommendations are coming soon — we'll email you when they're ready." That sentence is the consent hook for the v1.0 re-engagement broadcast. Underneath: the question bank lives in a Supabase `assessment_questions` table edited via a thin admin UI under `/app/admin/assessment` — versioned with in-flight session pinning, audit-logged, "Publish" action puts new versions live without breaking in-flight respondents. Five FY-dated items carry a `currency_year` field that hard-gates serving them after 1 July until the operator refreshes via the admin UI. Email capture writes the email + per-category sub-scores + weakest-category tag + time-bucket into the existing email-marketer pool — the weakest-category tag is the precision-targeting hook for v1.0's per-category re-engagement broadcast.

**The mechanism (v1.0 — what ships later):** When ≥ 6 APA courses exist (one per category) with stable `course_id` / `title` / `duration_bucket` / `booking_url`, the recommender layer goes live on top of v0.5. The results page gains booking-link CTAs filtered by the respondent's declared time budget; the email-marketer pool fires a re-engagement broadcast to every v0.5 respondent targeted by weakest-category tag. v1.0 is purely additive — no v0.5 surface changes, no respondent migration, no schema reshape.

**What it bundles (v0.5):**
- **Question bank (locked).** 35 questions × 6 categories. Canonical source at `.specify/features/008-knowledge-assessment/question-bank.md`. Locked 2026-06-10.
- **Surface — public only (OQ-KA-1 resolved).** Single surface at `lslcalculator.com.au/assessment`. No `/app/*` placement in v0.5 — that's a post-v1.0 revisit.
- **Scoring rubric — per-category sub-scores with weakest-domain callouts (OQ-KA-2 resolved).** Six bars on the results page, one per category, weakest called out at top. No pass/fail. No Beginner/Competent/Expert bands.
- **Email-gate position — end (OQ-KA-3 resolved).** Email captured immediately before the score is revealed; the 10-minute investment + the personalised gap analysis carrot maximises capture rate.
- **Citation depth — incorrect answers only (OQ-KA-4 resolved).** Every wrong answer surfaces a one-line citation to Fair Work / ATO / state-revenue authority. Correct answers get a green tick without extra clutter.
- **FY-rollover SLA — 1 July refresh + hard `currency_year` gate (OQ-KA-5 resolved).** Annual refresh task on 1 July; any FY-dated question without an updated `currency_year` is paused-until-published (returns `null` to the rendering layer rather than serving stale content). Admin UI exposes a `currency_review_due` filter that lists the five FY-dated items in one query.
- **Re-take policy — unrestricted, options shuffled, no lockout (OQ-KA-6 resolved).** Same-email re-takes allowed without limit; option order is shuffled per attempt to disincentivise pure memorisation while preserving the legitimate "I want to share this with my whole team" and "I took the courses, let me re-test" use cases.
- **Content-edit surface — Supabase + thin admin UI under `/app/admin/assessment` (OQ-KA-7 resolved — HR-1).** Operator edits a question, clicks "Publish", new sessions see the new version. Markdown bank stays as the human-readable source-of-record reference.
- **Edit-propagation — versioned, in-flight pinned, "Publish" action (OQ-KA-8 resolved — HR-1).** Every response row stores the `version_id` it was scored against. Same versioning pattern E5.3 uses for pay-code mappings — implementation pattern already proven inside this codebase.
- **Time-commitment buckets — four (OQ-KA-10 resolved).** `≤ 1 hour` / `half-day (2–4 hours)` / `1 full day (6–8 hours)` / `multi-day (>1 day)`. Stored as typed enum on the response row; bucket boundaries align with how APA already structures training so the v1.0 recommender's `duration_bucket` field maps one-to-one.
- **Weakest-category tagging into the email-marketer pool (OQ-KA-15 PM recommendation, adopted by default for v0.5).** At completion time, write the email + per-category sub-scores + weakest-category tag + time-bucket as merge fields into the existing email-marketer pool. This is a no-op for v0.5 UI but is the load-bearing precision-targeting hook for the v1.0 re-engagement broadcast — collecting it now means v1.0 ships with historical segmentation data on every v0.5 respondent.
- **"Coming soon" close on the results page.** Single closing sentence acknowledging the time-budget input ("we'll match you to courses that fit your time") + the consent hook for v1.0.

**What it bundles (v1.0 — deferred until ≥ 6 APA courses exist):**
- **Course catalogue ingestion** — Supabase / YAML / external CMS / APA-API decision waits on the actual catalogue existing (OQ-KA-9).
- **Recommender layer** — intersects (gap profile × declared time bucket × catalogue), ranked by gap severity × priority weight × duration-ascending.
- **Booking-link CTAs on the results page** — the closing "coming soon" sentence is replaced with a ranked list of recommended-course buttons.
- **Re-engagement broadcast** — email-marketer fires a per-weakest-category broadcast to every v0.5 respondent ("based on your gap profile and the time budget you told us about, here's what we recommend").
- **Recommender fallbacks (OQ-KA-11/12/13)** — mapping granularity, empty-recommendation (100% score), and zero-time-budget edge cases all resolved at v1.0 spec time against the real catalogue shape.

**What success looks like (v0.5):**
1. **≥ 300 completed responses in the first 90 days** — the statistical-significance floor below which the per-category failure histogram is noise. This is the load-bearing metric, because v0.5's purpose is dual: lead-magnet + market-research signal.
2. **Completion rate ≥ 50%** on assessments started (industry benchmark for a 10-minute quiz-style lead magnet is 40–60%; we target the upper half because the audience is high-intent).
3. **Completion-to-email-capture ≥ 60%** with end-gating; this gates the actual capture volume, not just intent.
4. **Weakest-category histogram informs course-production decision by day 90** — the operator can point to one category and say "this is the course we're filming first" with statistical confidence. If all six cluster within ±5pp, that's also a useful answer — film the broadest course first.
5. **No FY-dated question is wrong on 1 July of any FY** — annual-refresh SLA is a hard launch gate.
6. **No question, option, or category-mapping change requires a code deploy** — HR-1 is a hard launch gate; the operator must be able to fix a production typo in under 5 minutes.

**What success looks like (v1.0 — measurable only after v1.0 ships):**
- **≥ 5% click-through to a recommended course's booking URL within 7 days** of receiving the re-engagement broadcast.

**Why the phase split:** The original epic assumed a populated APA course catalogue. That assumption is dead as of 2026-06-10 — there are no APA video courses yet. Rather than block the whole feature on course production, v0.5 ships the lead-magnet now and treats v0.5 itself as the market-research instrument that tells the operator which course to film first. The phase split is *not* technical scope reduction — it's the only sequencing that respects the actual dependency graph (catalogue must exist before recommender can be specified; respondent data must exist before catalogue priorities can be ranked; v0.5 is the cheapest way to get respondent data). v1.0 is purely additive on top of v0.5 — no v0.5 surface changes, no respondent migration, no schema reshape.

**Sequence (parallel-track to E5/E6 — not blocking, not blocked):**
- v0.5 depends on **E6.4 (public re-skin tokens)** for visual coherence with the LSL Calculator brand on the public surface.
- v0.5 depends on **E5.1 auth (already shipped)** because the admin UI lives under `/app/admin/assessment` (per OQ-KA-7) — the auth slice gates the admin surface, not the public assessment surface.
- v0.5 does **not** depend on E5.2 / E5.3 / E5.4 / E5.5 / E5.6 — different data shape, different surface, no shared engine.
- v0.5 build sequence: developer plans v0.5 only (`speckit-plan` + `speckit-tasks` scoped to v0.5 acceptance criteria) → implement the public assessment page + admin UI + Supabase tables + email-marketer wiring → ship → collect 90 days of respondent data → v1.0 spec work triggered the moment ≥ 6 APA courses exist.

**Carried open questions (non-blocking for v0.5 dev kickoff):**
- **OQ-KA-14 · paid-acquisition test vs organic-only.** ~$500 paid budget test (LinkedIn + Meta) to push enough volume through v0.5 inside 90 days to hit ≥ 300 completions, vs organic-only. Decision deferred until v0.5 is built and ready for traffic — current `lslcalculator.com.au` organic volume informs the choice.
- **OQ-KA-15 · cohort tagging for v1.0 re-engagement.** PM recommendation: tag weakest-category at v0.5 completion-time into the email-marketer pool so v1.0 ships with precise targeting available. **Adopted by default in v0.5 — see "What it bundles (v0.5)" above.** Flagged here so the email-marketer agent designs the segmentation up front.

_Spec: `.specify/features/008-knowledge-assessment/spec.md` **v0.5 SPEC LOCKED — operator-signed-off 2026-06-10**_
_Question bank: `.specify/features/008-knowledge-assessment/question-bank.md` (locked 2026-06-10)_
_Course mapping data shape: `.specify/features/008-knowledge-assessment/course-mapping.md` (held in placeholder until v1.0 — populate against real APA catalogue per OQ-KA-9)_

---

## Sequence argument

**Updated 2026-05-27.** The original sequence had E1 → E3 v1 (NSW audit) → E2 → E3 v2 → E4. E3 was retired in favour of E5 (2026-05-26); E6 was added in parallel with E5 (2026-05-27). The sequence as of today:

1. **E1 (NSW Calculator)** — Phase 1, ✅ shipped 2026-05-24. Proved the rules engine + citation block + 100% accuracy gate on NSW. The architectural template for everything that follows.
2. **E2 (All-state coverage)** — Phase 2, ✅ shipped 2026-05-27. All 8 jurisdictions live (NSW + VIC + QLD + WA + SA + ACT + TAS + NT). Each new state was a content/data milestone, not a UI rewrite.
3. **E5 (LSL Platform)** — Phase 3, 📋 in flight. E5.1 auth slice on `feat/E5.1-auth-slice`; E5.2 / E5.3 / E5.4 sub-specs scoped; PDF-removal companion approved 2026-05-27. Six sub-epics sequenced (E5.1 Auth + DB → E5.2 Masterfile → E5.3 Mapping → E5.4 Ingestion → E5.5 Valuations + Liability → E5.6 Reconciliation). **Absorbs the retired E3.** **Replaces the cancelled E1 Phase 7** (no single-user "save my calc" on the public surface; org-level workspace is the only authenticated experience).
4. **E6 (LSL Sub-Brand UI System + Report Pipeline)** — Phase 3 in parallel with E5. Sub-brand identity ("LSL Calculator by APA") + design system tokens + component library + `/app/*` shell + public-calc re-skin + A4 PDF report pipeline for four report families. **E5.1 is explicitly carved out** and ships unstyled; **E6.2 is the hard gate to E5.2 implementation kickoff**. E6.4 (public re-skin) and E6.5 (report foundation) are independent of E5 progress and ship as soon as E6.2 is ready.
5. **E4 (Payroll integrations)** — Phase 4. Replaces manual pay-run uploads in E5.4 with read-only OAuth/API connectors to major Australian payroll vendors. Waits until E5 has a stable ingestion path so the connector design doesn't have to be reworked.

**Why this sequence?** E1 proved the wedge. E2 expanded the wedge to every Australian employer. E5 is where the product becomes a SaaS — auth, persistence, multi-tenant, reconciliation as the headline commercial feature. **E6 runs in parallel with E5 because the design-system token layer is a hard gate to E5.2** — landing platform features unstyled is a credibility tax that compounds across every subsequent feature, and retrofitting brand identity onto already-shipped components is strictly more expensive than designing against tokens from day one. E4 is the friction-removal pass that makes the SaaS sticky once E5 is live.

**What changed from the prior argument (2026-05-27):** Two things. First, E2 shipped — all 8 states live — so the "expand state coverage before E5" branch of the original argument is now resolved; E5 is the only forward branch on the calc side. Second, E6 was added as a sibling to E5 rather than a follow-up because the brand-credibility cost of shipping E5.2 unstyled compounds — every new platform feature shipped before E6.2 lands becomes a retrofit liability. Treating E6 as parallel-with-E5 rather than after-E5 keeps the brand identity ahead of the feature surface area, which is the cheaper-overall sequence.
