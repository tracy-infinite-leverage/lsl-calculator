# Feature Specification — LSL Platform (Authenticated, Persistent, Multi-Tenant)

**Slug:** `lsl-platform`
**Feature number:** 005
**Status:** **v1.0 APPROVED — 2026-05-26**
**Author:** Product Manager (drafted from owner's 7-point brief 2026-05-26; decisions locked by owner 2026-05-26)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** E1 (NSW) shipped · E2 (all-state coverage) — 6 of 8 states live (NSW, VIC, QLD, WA, SA, ACT); TAS + NT still to ship under E2 Phases 8–9
**Supersedes / replaces:** E1 Phase 7 opt-in logins — **cancelled 2026-05-26**. The public `lslcalculator.com.au` calc stays anonymous-only permanently. All authenticated experience now lives inside this platform. E3 (NSW audit-replay CSV) — **retired 2026-05-26**, absorbed into E5.6.

---

## 1. Executive summary

The LSL Calculator today is a **stateless tool**: a payroll manager opens the page, types or pastes employee data, gets a defensible number with citations, and closes the tab. Nothing persists between sessions.

This spec defines a **stateful, authenticated, multi-tenant platform** sitting on top of the existing state-by-state rules engines. The platform lets each client organisation:

1. **Sign in** to a private workspace (org + users).
2. **Bulk-import historical pay data** for every employee, broken down by raw pay code.
3. **Map their raw pay codes** to the LSL ordinary-pay buckets the rules engine understands (Ordinary Time, Overtime, Commission, Bonus, Penalty Rates, Leave sub-types, Allowance sub-types). Mapping is per-org, persists, and applies retrospectively.
4. **Maintain a master file** of employees (state, employee number, start date, classification, etc.) — the inputs the rules engine cannot synthesise from pay history alone.
5. **Drip-feed each pay run** into the same workspace so the data layer stays current with no re-upload of history.
6. **Run on-demand valuations** of LSL for any employee at any date, for either *taking the leave* or *paying out on termination* — the engine picks the right state rules, the right pay buckets, and the right averaging window.
7. **Produce liability reports** — total accrued LSL value per employee, rolled up to teams/cost centres/the whole org, as at any chosen date.
8. **Upload historical LSL payments already made** and have the platform reconcile each against what the engine says it *should have been* — producing a variance report regulators and auditors will accept.

This is the natural commercial path for the product: it converts the calculator from a single-event tool (priced like a calculator) into a payroll-data-of-record system (priced like SaaS, paid annually, sticky).

**Epic structure:** Umbrella epic E5 with six sub-epics, sequenced. See §3.

**Headline commercial signal:** point 7 (reconciliation) is the single highest-value capability — it is the auditor-persona buyer that the existing product strategy has already identified (`product.md` §11, hypothesis 1). The platform makes it a recurring product rather than a one-off CSV upload.

**Brand identity:** the platform is the **APA-branded** authenticated surface of the product. It lives at the same domain as the public calculator under the `/app/*` path. The public `/` path keeps the existing "LSL Calculator" identity for unauthenticated trial; the `/app/*` path carries APA brand identity end-to-end (logo, palette, voice). See §10 for branding requirements.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this spec adds |
|---|---|---|
| Rules engines | 6 of 8 states live (NSW, VIC, QLD, WA, SA, ACT). TAS + NT in flight under E2 Phases 8–9. | Nothing — the engines are reused as-is. |
| Single calc UI | Live at `www.lslcalculator.com.au`. Stateless form. | Sits alongside the platform. The free / unauthenticated single-calc page remains for non-customer trial. It is **anonymous-only forever** — no "save my calc" feature on the public page. |
| Bulk upload | Live (CSV + PDF with LLM extraction). Stateless — one upload, one report, no persistence. | The public bulk upload is unchanged. The **platform ingestion paths are CSV-only in v1** — see §5.4. PDF ingestion into the platform is explicitly **deferred** beyond v1. |
| Authentication | None. E1 Phase 7 had scoped Supabase email/password as a single-user "save my calc" feature; that is now **cancelled** in favour of this platform. | **Org-level auth** with role-based access. There is no parallel single-user save feature on the public page. |
| Database | **None wired.** `website/supabase/` does not exist. `website/package.json` contains zero `@supabase/*` dependencies. `website/.env.example` does not exist either. Supabase is a *committed direction* in the project's `CLAUDE.md` stack section, but no integration code has shipped. | The entire database layer is greenfield. |
| LLM extraction (`/api/extract-pdf`, `/api/normalize-csv`) | Live, depends on `ANTHROPIC_API_KEY` per `docs/launch/LAUNCH-GUARD.md`. **The public calc continues to depend on this for its existing PDF and auto-normalised-CSV paths.** | The **platform itself does not depend on `ANTHROPIC_API_KEY`** in v1 — there is no PDF ingestion path into the platform, and the optional LLM-assisted mapping suggestion is deferred to v1.1. LAUNCH-GUARD remains binding for the public calc but is not a v1 platform dependency. |
| Roadmap epics | E1 ✅ · E2 🔄 (6/8 states) · E3 ☐ (audit CSV — was next) · E4 ☐ (payroll integrations) | E3 is **retired** and absorbed into E5.6 (decision locked 2026-05-26). E4 remains future work — once a client has on-platform pay data the API-integration value proposition is to *replace the manual pay-run upload* (E5.4). |

**Critical finding — Supabase is not wired.**
- `website/supabase/` does not exist.
- `website/package.json` has no `@supabase/supabase-js`, no `@supabase/auth-helpers-*`, no `@supabase/ssr`.
- No code under `website/src` imports anything from `supabase`.
- The Supabase MCP plugin *is* available globally per `~/.claude/rules/global-engineering.md` — i.e. the agent team can talk to a Supabase project once one is created. But there is no project to talk to today.

**Implication:** Sub-epic E5.1 (auth + DB scaffold) is greenfield and load-bearing. Every other sub-epic blocks on it.

---

## 3. Epic structure

**E5 is an umbrella epic with six sub-epics, sequenced.** (Decision locked 2026-05-26.)

Why not one epic? Each sub-epic is 1–3 weeks of work and has its own acceptance criteria, its own UI surface, and its own deployment risk. Treating them as a single epic loses progress visibility and makes it impossible to ship value incrementally. Why not six independent epics? They share a data model and an auth boundary — coordinating them as sibling sub-epics under a shared umbrella keeps the cross-cutting design consistent.

| Sub-epic | Scope | Why this sequence |
|---|---|---|
| **E5.1 · Auth + Tenancy + DB Scaffold** | Supabase project provisioned. Organisation + User + RoleMembership tables with RLS. Supabase Auth (email/password) signup, login, password reset, email verification. Org creation flow (**one org per signup** in v1). Role gating (admin / payroll user / read-only). | Everything else blocks on this. No other sub-epic touches the database without RLS in place. |
| **E5.2 · Employee Masterfile** | Employee record (state, employee_number, start_date, end_date, classification, FT/PT/casual, salaried/hourly, etc.). CSV/Excel upload, manual single-employee add, edit, archive. Validation against the existing `Employee` schema in `website/src/lib/lsl/`. | Pay data is meaningless without the employee record it attaches to. Masterfile is the foreign key target. |
| **E5.3 · Pay-Code Mapping** | Raw pay codes (per-org). Mapping UI that shows each unmapped code and asks the user to assign it to one of a fixed list of LSL buckets. **The raw-code → bucket mapping is org-wide** — payroll systems use the same code identifiers consistently for an organisation. **The bucket → state treatment is resolved by the engine per-state** at valuation time — e.g. the "Penalty Rates" bucket counts as ordinary pay for QLD and TAS employees and is excluded for NSW/VIC/WA/SA/ACT/NT employees. The user does not need to map a code separately for each state; the engine layer applies the per-state divergence. Mapping persists, applies retrospectively when historical data lands, and applies prospectively to all future imports. Bulk "map all unmapped" workflow. Mapping audit trail (who changed what, when, why). | Pay data is also meaningless without the mapping that tells the engine which bucket each line counts toward. Mapping comes before bulk ingestion so the user maps small (10–50 raw codes) rather than after ingesting a year of pay runs with no mapping. |
| **E5.4 · Pay-Period Ingestion** | Historical bulk import: **CSV only in v1.** One row per employee per pay period per pay code, with gross amount. Recurring per-pay-run import: same CSV channel, idempotent on `(employee_id, pay_period_end, pay_code)`. Import validation, dry-run preview, error report, partial commits. **No PDF ingestion in v1** — deferred to a later phase. | Once mapping + masterfile exist, ingestion is the dam-breaker — once a client uploads a year of history they are committed. |
| **E5.5 · Valuations + Liability Reports** | On-demand: pick employee + start date + (optional) end date + reason (taking_leave / termination_payout). System runs the right state's rules engine against the persisted pay data + masterfile + mapping. Returns weekly value, daily value, total entitlement, citation block. Liability snapshot: pick a single date + scope (one employee / a tag/group / whole org). System runs every employee's accrual + valuation, sums it, produces a PDF + CSV report. Cached results so a re-run for the same as-at date is instant. | First true *product* deliverable — payroll manager logs in, runs a calc, gets paid value. |
| **E5.6 · LSL Reconciliation** | Upload all LSL payments made (taken or paid-on-termination), historical, **via CSV only**. For each payment, system re-runs the engine at the prescribed historical date and produces variance per row: paid amount vs computed correct amount, +/- $, the rule(s) and Act section(s) that drove the computed value. PDF + CSV export. **Supersedes and replaces legacy epic E3 (retired 2026-05-26).** | The highest-value commercial feature. Goes last because it needs every other layer underneath it. |

**Cross-epic dependencies:**
- **Supersedes E1 Phase 7 (cancelled 2026-05-26).** The public `lslcalculator.com.au` calc stays anonymous-only forever. There is no "save my calculation" feature for unauthenticated visitors. All authenticated experience is the platform.
- **Replaces E3 (retired 2026-05-26).** E3's audit-CSV scope is fully absorbed by E5.6 on a persistent multi-tenant base.
- **E2 (all-state)** continues to ship in parallel — it is on its own track. The platform *needs* E2 finished (TAS + NT) before it can credibly claim "any state" coverage, but E5.1 through E5.4 can be built and tested against the 6 live states.
- **E4 (payroll integrations)** remains future work, now upgraded in value: API integrations replace manual pay-run uploads (E5.4) rather than manual CSV variance uploads (legacy E3). Same epic, better insertion point.

---

## 4. Scope boundary — v1 vs deferred

### In scope for v1

- Auth (email + password only, no SSO, no OAuth, no magic links). Supabase Auth.
- **One org per signup**; admin can invite users into their org. (Multi-org-per-user deferred.)
- Three roles: `admin` (everything), `payroll_user` (create/edit data, run calcs and reports), `read_only` (run calcs and view reports, no data edits).
- Employee masterfile — CSV + Excel + manual entry. State, employee_number, start_date, end_date (optional), classification, employment_type, hours_per_week.
- Pay-code mapping — per-org, audited, retrospective + prospective. Bucket-to-state treatment resolved by engine. Validation that every distinct code has a mapping before a valuation can run.
- Pay-period ingestion — **CSV only**, manual upload, idempotent.
- On-demand valuation — per employee, per date, taking_leave or termination_payout.
- Liability report — per employee, per org-wide as-at date. **Definition: `accrued_weeks × weekly_value`. No actuarial vesting probability in v1.**
- Reconciliation — upload historical LSL payments (CSV), get variance report.
- 6 states: NSW, VIC, QLD, WA, SA, ACT (re-use existing engines as-is). TAS + NT supported once E2 ships them.
- Audit trail on every mapping change, every employee edit, every imported pay period, every valuation run.
- **APA brand identity** applied to the entire `/app/*` surface (see §10).
- Scale target: **10,000 employees per org**, 7 years of fortnightly pay data per employee.
- **7-day grace window** on org deletion before hard-delete.

### Deferred (post-v1)

- **PDF ingestion** into the platform (historical bulk, recurring pay-period, LSL-taken reconciliation upload). v1 is CSV-only across all three ingestion paths. Reconsider once v1 ships.
- **LLM-assisted pay-code mapping suggestions** — deferred to v1.1 once we see real client raw-code lists and can build a benchmark.
- **Future-date projection mode** on liability reports ("liability as at 12 months from now"). Deferred to v2.
- **Multi-org-per-user** (a payroll consultant servicing 12 client orgs from one login). v1 workaround: separate login per client.
- SSO, SAML, OAuth, Google/Microsoft sign-in.
- API-based pay-run ingestion (this is E4).
- Direct integrations with Xero / MYOB / KeyPay / ADP (this is E4).
- Write-back of valuation results into the client's payroll system (explicitly out of scope per `product.md` §7).
- Mobile-native experience (responsive web only).
- Cross-jurisdictional governing-state heuristics (this is RES-5 in E2, already deferred).
- Workflow features: approval chains, comments, e-sign on reconciliation reports.
- **Australian data-residency hosting**. v1 uses Supabase default region; deferred compliance consideration, revisit when a client makes residency a hard requirement.
- **Reconciliation-only commercial tier**. Folded into the broader pricing/strategy discussion (see §14).

---

## 5. Requirements (MUST / SHOULD / MAY)

### 5.1 Authentication and tenancy

- **MUST** use Supabase Auth (email + password). No SSO, no OAuth, no magic links in v1.
- **MUST** require a verified email address for every user account.
- **MUST** enforce that all data (employees, pay periods, mappings, valuations, reports) is scoped to a single organisation via Postgres Row-Level Security policies on every tenant table.
- **MUST** support three roles: `admin`, `payroll_user`, `read_only`.
- **MUST** allow an `admin` to invite a new user by email, with a role selected at invite time.
- **MUST** allow an `admin` to deactivate a user (soft delete — preserve audit trail).
- **MUST** implement password reset via email.
- **MUST** enforce minimum password strength aligned with Supabase Auth defaults (length ≥ 12 characters or equivalent policy).
- **MUST** record `created_at`, `updated_at`, and `created_by` / `updated_by` on every tenant-owned record.
- **MUST** enforce **one org per signup** in v1. Multi-org-per-user is deferred.
- **SHOULD** support an org-level "data export" endpoint so a client can leave the platform with their data intact.
- **SHOULD** support an org-level "delete my org" admin action that hard-deletes all tenant data, returns a tombstone receipt, and is irreversible after a **7-day grace window**.
- **MAY** support MFA via TOTP (Supabase Auth has this built-in; cheap to enable).

### 5.2 Employee masterfile

- **MUST** store one record per employee, scoped to one org, with at minimum: `employee_number` (org-unique string), `state` (one of the 8 jurisdictions), `start_date`, `end_date` (nullable), `classification` (free text), `employment_type` (full_time / part_time / casual), `hours_per_week` (nullable for casual / variable).
- **MUST** support CSV and Excel upload with a documented schema.
- **MUST** validate state against the 8-jurisdiction enum the engines already use.
- **MUST** reject duplicate `employee_number` within an org; allow the same number across orgs.
- **MUST** preserve historical masterfile changes — an employee's `state` or `employment_type` can change over time, and the engine must know the value as at the historical pay period being valued.
- **SHOULD** auto-detect column names from common payroll-system exports (the existing CSV-normalisation flow already does this for the single-calc path — reuse).
- **MAY** support per-employee notes / tags for org-internal grouping (cost-centre, team, location).

### 5.3 Pay-code mapping

- **MUST** maintain a per-org list of raw pay codes, populated automatically as pay-period imports land.
- **MUST** present each unmapped raw code to an `admin` or `payroll_user` for mapping to one of a fixed set of LSL buckets (see §6).
- **MUST** treat **mapping (raw code → bucket) as org-wide** — a code maps to a single bucket per org. The user does not map a code differently for different states.
- **MUST** resolve **bucket → state treatment at the engine layer** at valuation time. The engine knows, for any given employee, what the bucket means under that employee's state law. Example: the "Penalty Rates" bucket counts as ordinary pay for QLD and TAS employees and is excluded for NSW/VIC/WA/SA/ACT/NT employees. The user does not need to know this — the engine does.
- **MUST** persist mappings and apply them retrospectively to historical pay data — i.e. mapping a code today changes how historical pay periods are valued going forward, with a clear audit trail of the change.
- **MUST** prevent a valuation from being run for an employee if any pay code present in that employee's relevant pay history is unmapped — return a blocking error listing the unmapped codes.
- **MUST** record the user, timestamp, and previous/new mapping on every change.
- **MAY** support exporting and importing a mapping configuration as JSON, so a payroll consultant can clone a known-good mapping across multiple client orgs.

*(LLM-assisted mapping suggestions deferred to v1.1.)*

### 5.4 Pay-period ingestion

- **MUST** accept **CSV uploads only** in v1 (Excel acceptable if it parses through the same CSV pipeline; PDF is explicitly excluded). Schema: one row per (employee, pay_period_end, pay_code, gross_amount). Hours optional.
- **MUST** validate every imported row: employee exists, pay_period_end parses, gross_amount is numeric.
- **MUST** show a dry-run preview before commit, with row count, distinct-employee count, distinct-pay-code count (and flag of how many of those codes are new and require mapping), and any validation errors.
- **MUST** be idempotent on `(employee_id, pay_period_end, pay_code)` — re-importing the same pay run does not double-count.
- **MUST** allow partial commits: rows that fail validation are rejected, rows that pass are committed, with a downloadable error CSV.
- **MUST** record the user, timestamp, source file name, and row count on every successful import.
- **SHOULD** flag suspicious imports (e.g. a pay_period_end more than 7 years before the current date, gross_amount > $1M, an employee with 50+ pay codes when their org averages 8).
- **MAY** support a "scheduled import" stub (placeholder UI that flags the future API-integration path).

*(PDF ingestion deferred. Reconsider after v1 ships.)*

### 5.5 Valuations

- **MUST** allow an authorised user to pick: employee, leave_start_date (or termination_date), trigger (`taking_leave` / `termination_payout` / `as_at`), optional leave_end_date.
- **MUST** dispatch to the correct state's rules engine based on the employee's masterfile `state` as at the trigger date.
- **MUST** apply the per-org pay-code mapping when constructing the rules engine's pay history input. The engine layer applies the per-state bucket treatment.
- **MUST** return the engine's full output: weekly value, daily value, total entitlement, citation block.
- **MUST** persist every valuation as a record with: inputs, outputs, engine version, mapping version, masterfile version-snapshot, run_by, run_at.
- **MUST** support re-running a stored valuation against current engine + mapping versions and showing the diff if values change.
- **SHOULD** allow tagging a valuation as `draft` / `signed_off` and locking signed-off valuations against in-place changes.
- **MAY** support PDF export of an individual valuation result for client files / payroll evidence.

### 5.6 Liability reports

- **MUST** allow scoping by: single employee, list of employees (CSV upload of `employee_number`s OR tag selection), whole org.
- **MUST** accept an as-at date — the report computes accrued LSL value for every in-scope employee as if today were that date.
- **MUST** return: per-employee row with accrued_weeks, weekly_value, accrued_value_total, citation block; org totals; engine version; mapping version.
- **MUST** export as PDF (auditor-readable) and CSV (downstream-readable).
- **MUST** define liability as `accrued_weeks × weekly_value` (the simple definition) where `weekly_value` is per the engine for the trigger `as_at` (matching the existing E1 `as_at` mode semantics — see `epic-status.md` E1 v0.5.0 scope, "accrued, not currently payable"). **No actuarial vesting probability in v1.** The report MUST clearly label entitlement that is not yet currently payable, to avoid the auditor mis-reading accrued-not-vested as a current obligation.
- **SHOULD** cache report results by `(scope, as_at, engine_version, mapping_version)` and serve cached results instantly on re-run.
- **MAY** support a "delta" report between two as-at dates showing how liability moved and which employees drove the movement.

*(Future-date projection mode deferred to v2.)*

### 5.7 Reconciliation

- **MUST** accept a **CSV** of historical LSL payments with: employee_number, payment_date, leave_start_date, leave_end_date (or termination_date), reason (`taking_leave` / `termination_payout`), amount_paid, currency.
- **MUST** for each row, re-run the relevant state's engine against the persisted pay history at the prescribed historical date and compute the correct amount.
- **MUST** produce a variance per row: amount_paid, correct_amount, variance_$, variance_%, verdict (correct / under / over / cannot_verify), citation block, list of rules that fired.
- **MUST** export as PDF (signature-ready) and CSV (downstream-readable).
- **MUST** persist the reconciliation run with: scope, inputs file hash, outputs, run_by, run_at, engine version, mapping version, masterfile-version snapshot.
- **MUST** clearly mark `cannot_verify` rows where the persisted pay history does not cover the prescribed averaging window for that historical payment (i.e. the client onboarded after the payment was made and never imported the relevant pay periods).
- **SHOULD** allow filtering a reconciliation result to "show me only variances ≥ $X" for executive summaries.
- **SHOULD** support exporting a reconciliation result with a tamper-evident hash (e.g. SHA-256 of canonical CSV) for audit trail integrity.

### 5.8 Non-functional

- **MUST** isolate tenant data via RLS on every tenant table. No application-level "WHERE org_id = ?" filtering is acceptable as the primary defence.
- **MUST** preserve a full audit trail on every mapping change, every employee record change, every imported pay run, every valuation, every report run, every reconciliation run.
- **MUST** continue to enforce 100% gold-standard test suite pass on every state engine — the platform changes the *input pipeline* to the engines, not the engines themselves, and the engine launch gate from E1/E2 (`product.md` §12) still binds.
- **MUST** support at least **10,000 employees per org** and 7 years of fortnightly pay data per employee (~ 1.8M pay-line rows per org) without query-time degradation on liability reports.
- **MUST** apply **APA brand identity** to the entire `/app/*` surface (logo, palette, typography, voice) — see §10.
- **SHOULD** publish a documented data-retention policy and align the privacy notice (the privacy notice was updated 2026-05-23 for the stateless calc — a platform handling persistent employee PII will need a separate enterprise-tier notice).
- **MAY** support optional at-rest field-level encryption on PII columns (`employee_number`, `start_date`) beyond Supabase's default disk encryption.

**Note on `ANTHROPIC_API_KEY`:** the platform itself has no v1 dependency on this key. There is no PDF ingestion into the platform; LLM-assisted mapping is deferred. The public `lslcalculator.com.au` calc continues to depend on the key for its existing PDF and auto-normalised-CSV paths per `LAUNCH-GUARD.md`, but the platform does not. If PDF ingestion or LLM mapping returns in a later phase, this dependency returns with them.

**Note on data residency:** Supabase default region is acceptable for v1. Australian residency (Supabase `ap-southeast-2`) is a **deferred compliance consideration**, revisited when a client makes it a hard requirement.

---

## 6. Pay-bucket taxonomy

The mapping UI presents the user with a fixed list of LSL buckets, grounded in the research document at `docs/research/lsl-pay-components-deep-research.md` and the existing per-state engine implementations.

**Reading the table:** a code maps to a bucket once, at the org level. The "per-state treatment varies?" column documents what the engine layer does with that bucket under each state's law — the user does not need to know this when mapping. The engine resolves it at valuation time.

| Bucket | What the user maps to it | Per-state treatment varies? |
|---|---|---|
| Ordinary time earnings | Base salary, regular wage for normal hours | No — ordinary pay everywhere |
| Overtime — regular | Predictable, rostered overtime | **Yes** — counts as ordinary in WA + ACT for variable-hours employees, excluded elsewhere |
| Overtime — ad-hoc | Unplanned overtime | No — excluded everywhere except WA s.7 if "regular" |
| Penalty rates — shift / weekend / public-holiday loadings | Shift penalty, Saturday penalty, etc. | **Yes** — INCLUDED in QLD and TAS, excluded in NSW/VIC/WA/SA/ACT/NT |
| Commission | Sales commission, results-based bonus | **Yes** — different averaging windows per state (NSW greater-of, QLD ÷ 52.179, TAS 3 months, WA 365 days) |
| Bonus — discretionary | One-off discretionary bonus | **Yes** — included in NSW only below the $183,100 high-income threshold and only against a 4-criteria test; included in ACT/VIC if contractual; absolutely excluded in TAS (s.11(2)(h)) |
| Bonus — contractual | Bonus payable under contract | **Yes** — generally included where contractual |
| All-purpose allowance | Allowances absorbed into a single ordinary rate | **Yes** — included in TAS; treatment varies elsewhere |
| Single-purpose allowance | Tool, vehicle, uniform, meal, travel allowance | Generally excluded across most states |
| Casual loading | The 25% loading paid to casuals in lieu of leave entitlements | INCLUDED in all 8 jurisdictions where casuals get LSL |
| Leave — annual | Annual leave taken | Treated as service, not pay |
| Leave — personal/carer's | Sick / carer's leave taken | Treated as service, not pay |
| Leave — long service | LSL already taken | Treated specially — extends accrual window in 6 jurisdictions, inclusive in SA + NT |
| Leave — workers comp | Workers compensation absence | **Yes** — counts as service in some states but with date cutoffs (WA only from 1 Jul 2024; ACT only from 9 Jun 2023; NT does NOT count) |
| Leave — unpaid parental | Unpaid parental leave | Generally does NOT count as service |
| Leave — unpaid other | Other unpaid leave | Generally does NOT count |
| Termination payment — LSL | LSL paid on termination | Subject of reconciliation (§5.7) |
| Termination payment — other | Redundancy, notice, accrued AL paid out | Excluded from LSL ordinary pay |
| Excluded — other | Anything the user wants to explicitly exclude | Excluded |

---

## 7. Success criteria

The platform is a success when:

1. **A new client onboards in under 90 minutes** from signup → first defensible valuation. (Signup → org creation → invite a colleague → upload masterfile → upload 24 months pay history → map their raw pay codes → run first valuation.)
2. **A liability report on 1,000 employees runs in under 60 seconds** end-to-end, cached.
3. **A reconciliation report on a year of LSL payments (typically 30–80 rows for a mid-sized employer) returns variance verdicts in under 90 seconds.**
4. **100% engine-correctness is preserved** — the existing gold-standard test suite (`product.md` §12) continues to pass at 100%; the platform's `pay history × mapping → engine input` pipeline is itself covered by a regression test suite of at least 50 fixtures derived from the existing single-calc test cases.
5. **Tenant isolation has zero leakage** — automated security tests assert no cross-tenant read or write is possible via the API, RLS, or any combination.
6. **Reconciliation surfaces a real-money finding on at least one pilot client** — i.e. the variance report identifies at least one under- or over-paid LSL event that the client did not already know about, within the first 90 days of pilot. (This is the falsification test for `product.md` hypothesis 1.)

---

## 8. Acceptance criteria (per sub-epic)

These are the gates a sub-epic must pass to be marked Stage 4 · Tested.

### E5.1 · Auth + Tenancy + DB Scaffold

*Auth slice has a focused sub-spec at `.specify/features/005-lsl-platform/sub-specs/auth.md` for early developer pickup.*

- **AC5.1.1** A new user can sign up with email + password, verify their email via the magic link, and log in.
- **AC5.1.2** On first login the user is prompted to create an org; org creation succeeds and the user is the org's first `admin`. **One org per user is enforced** — a second org-creation attempt from the same user is blocked.
- **AC5.1.3** An `admin` can invite a user by email + role; the invitee receives an email, accepts, sets their password, and lands in the org with the assigned role.
- **AC5.1.4** RLS prevents User A in Org 1 from reading any row in any tenant table belonging to Org 2, validated by an automated cross-tenant security test in CI.
- **AC5.1.5** Password reset flow works end-to-end (request → email → reset → re-login).
- **AC5.1.6** An `admin` can deactivate a user; the user can no longer log in; their historical audit trail entries are preserved.
- **AC5.1.7** The privacy notice is revised to cover platform-tier data handling (org admins, persistent PII, retention, export, deletion).
- **AC5.1.8** Org deletion places the org in a 7-day grace state; hard-delete occurs after 7 days and produces a tombstone receipt.

### E5.2 · Employee Masterfile

- **AC5.2.1** Manual single-employee add validates all required fields and creates a record.
- **AC5.2.2** CSV upload accepts a documented schema, validates every row, shows a dry-run preview with errors flagged, and commits only valid rows on confirm.
- **AC5.2.3** Excel upload behaves identically to CSV.
- **AC5.2.4** Duplicate `employee_number` within the same org is rejected at the row level with a clear error.
- **AC5.2.5** A change to an employee's `state` or `employment_type` is persisted as a new effective-dated record; the prior record is preserved for historical valuation accuracy.
- **AC5.2.6** Deleting (archiving) an employee soft-deletes — audit and historical data preserved.

### E5.3 · Pay-Code Mapping

- **AC5.3.1** Every distinct raw pay code seen in any imported pay period appears in the unmapped-codes list until mapped.
- **AC5.3.2** Mapping a code to a bucket persists, is audit-logged with user + timestamp + previous-value, and applies retrospectively to all pay periods.
- **AC5.3.3** A valuation request for an employee with any unmapped code in the relevant averaging window returns a blocking error listing the unmapped codes — does not silently exclude them.
- **AC5.3.4** The engine layer correctly applies per-state bucket treatment at valuation time: a code mapped to "Penalty Rates" counts as ordinary pay when valuing a QLD or TAS employee and is excluded when valuing a NSW/VIC/WA/SA/ACT/NT employee — verified by automated test against the existing per-state engine suites.
- **AC5.3.5** Changing an existing mapping is permitted (admin only) and invalidates any cached valuation/report that used the old mapping.

### E5.4 · Pay-Period Ingestion

- **AC5.4.1** CSV upload validates schema and shows a dry-run preview with row count, distinct-employee count, distinct-pay-code count (and unmapped-codes subset).
- **AC5.4.2** Excel upload (parsed through the CSV pipeline) behaves identically.
- **AC5.4.3** Re-importing a file containing the same `(employee, pay_period_end, pay_code)` rows does not duplicate data.
- **AC5.4.4** A row referencing an `employee_number` not in the masterfile is rejected with a clear error and does not block other rows.
- **AC5.4.5** Every successful import creates an `ImportRun` audit record with source file metadata.
- **AC5.4.6** PDF upload is explicitly **not supported** in v1 — the UI surfaces a "CSV only in v1" message if a PDF is attempted.

### E5.5 · Valuations + Liability Reports

- **AC5.5.1** A valuation request returns a result identical to the existing single-calc page when fed the same inputs through the persisted pipeline, validated against the existing engine test suites for all 6 live states. This is the load-bearing correctness test — any drift between the platform valuation and the stateless engine result is a Sev-1.
- **AC5.5.2** Valuations are stored with full input snapshot, engine version, mapping version, and masterfile version.
- **AC5.5.3** Re-running a stored valuation against current versions shows the diff if any value differs.
- **AC5.5.4** Liability report at as-at date X for the whole org returns a row per employee with correct accrued_weeks, weekly_value, accrued_value_total, with citation block.
- **AC5.5.5** Liability report exports as PDF (auditor-readable, signed/dated) and CSV.
- **AC5.5.6** Liability report on 1,000 employees completes in under 60s (warm) / under 5 minutes (cold, first run).
- **AC5.5.7** Liability is computed as `accrued_weeks × weekly_value` — no actuarial vesting probability factor applied.

### E5.6 · LSL Reconciliation

- **AC5.6.1** Reconciliation CSV upload validates and dry-run-previews.
- **AC5.6.2** Each historical payment produces a variance row with verdict, calculated correct amount, variance_$, variance_%, citation block.
- **AC5.6.3** Rows where pay history is insufficient (averaging window not covered) return `cannot_verify` with a clear reason — they do NOT default to "correct".
- **AC5.6.4** PDF export is one variance row per page (or grouped sensibly), signature-ready.
- **AC5.6.5** Reconciliation report can be re-run with a new pay-history upload and the variance verdicts update accordingly.

---

## 9. Risks and dependencies

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Supabase is unwired. Greenfield DB layer. | High | E5.1 explicitly scoped; no other sub-epic starts until it ships. Use Supabase MCP plugin via the dev agent for provisioning. |
| R2 | TAS + NT engines not yet shipped (E2 Phases 8–9 still pending). | Medium | Platform launches with 6-state coverage; UI clearly indicates TAS/NT pending; existing E2 epic continues in parallel. |
| R3 | The platform's `pay history × mapping → engine input` pipeline is a NEW failure surface that could break the 100% accuracy gate. | High | Every sub-epic acceptance criterion includes an equivalence test against the stateless engine. AC5.5.1 is the explicit gate. AC5.3.4 covers the per-state bucket-treatment correctness. |
| R4 | Privacy / PII handling materially escalates from the stateless calc (no server-side employee data) to persistent multi-tenant payroll history. | High | Privacy notice revision is in AC5.1.7. May warrant a legal review pass before pilot. Australian residency is deferred but on the radar (see §5.8). |
| R5 | Reconciliation depends on the client having historical pay data going back far enough to cover the prescribed averaging window for each historical payment. Many clients won't. | Medium | `cannot_verify` is explicit (AC5.6.3); platform does not silently approve under-evidenced rows. |
| R6 | Concurrent rules-engine changes (E2 finishing TAS + NT, ongoing legislative monitoring under RES-3) will produce engine-version churn. Valuations + reports stored with `engine_version` is the mitigation. | Low | AC5.5.2 + AC5.5.3 already cover this. |
| R7 | Pricing model not yet set. Platform-tier SaaS pricing is a separate decision from the unauthenticated calc's per-licence price (`product.md` §10). Reconciliation-only tier is part of the same open question. | Medium | Out of scope for this spec — Tracy + APA board to land before pilot. Does not block engineering. |
| R8 | The existing free unauthenticated calc remains as a public trial; users may think the trial loses their data and conflate it with the platform. | Low | UX work; APA brand identity on `/app/*` is the primary delineation. Distinct visual identity from the public calc is the mitigation. |
| R9 | CSV-only ingestion in v1 is friction for clients with PDF-only payroll exports. | Medium | Public calc still accepts PDF for one-off use. Platform documentation will name the supported CSV formats explicitly. PDF ingestion is a known v1.x candidate. |
| R10 | APA brand assets need to be assembled and applied. The current site uses LSL Calculator identity; APA identity may not yet exist as a coded design system. | Medium | Designer agent owns the brand-system handoff. Brand application is part of E5.1 acceptance — the auth surfaces ship APA-branded. |

---

## 10. Branding and visual identity

The platform is an **APA-branded** product surface. This is a deliberate strategic choice — the platform's buyer is an APA member or APA-affiliated payroll professional, and the brand association is part of the value proposition.

**Scope of APA branding:**
- All authenticated pages (everything under `/app/*`) carry APA visual identity: logo, primary colour palette, typography, button styles, voice and tone.
- The public unauthenticated calculator at `/` keeps the existing "LSL Calculator" identity. The two surfaces are visually distinct so users do not confuse them.
- The login page (`/app/login` or equivalent) is APA-branded — it's the first impression for a returning customer.
- Email templates sent by Supabase Auth (verification, invitation, password reset) carry APA branding.
- PDF exports (valuation, liability report, reconciliation report) carry APA branding in the header/footer.

**Where the brand assets come from:**
- The Designer agent owns the APA brand system. If a coded design system for APA does not yet exist, designer-design-system produces one as a precondition for E5.1's UI surfaces shipping.
- Logo, palette, typography tokens are stored under `docs/brand/style-guide.md` per the project's design-system convention.

**Domain and routing:**
- The platform lives at the **same domain** as the public calculator — `www.lslcalculator.com.au` — under the path `/app/*`.
- The public calc remains at `/`. No separate subdomain in v1.
- Fewer DNS / cert / CORS artefacts than a separate `app.lslcalculator.com.au` subdomain. Reconsider only if a future requirement forces it.

---

## 11. What this spec deliberately does not do

- Does not write the impl plan or tasks — that's the next phase (`/dev-feature-plan`).
- Does not create GitHub issues — that's after the impl plan (`/pm-to-issues`).
- Does not propose schema DDL — the data model section names entities and key relationships but stops short of `CREATE TABLE`. Recommended next: pass to the developer agent for impl plan, which will produce schema design grounded in Supabase + RLS patterns.
- Does not change the existing E1/E2 engines. Reuses them as black-box dependencies.
- Does not address pricing (open commercial decision — see §14).
- Does not address marketing, sales, or partner-channel rollout.
- Does not include PDF ingestion into the platform (deferred beyond v1).
- Does not include LLM-assisted mapping (deferred to v1.1).
- Does not include future-date liability projection (deferred to v2).

---

## 12. Decisions locked (2026-05-26)

This section replaces an earlier "open questions" list. All 15 open questions plus the E1 Phase 7 disposition are resolved.

| ID | Decision | One-line rationale |
|---|---|---|
| **OQ-1** | Umbrella E5 with 6 sub-epics (E5.1–E5.6). | Shared data model + auth boundary makes umbrella the right primitive; sub-epic granularity preserves progress visibility. |
| **OQ-2** | E3 (NSW audit-replay CSV) **retired**, absorbed into E5.6. | Reconciliation on a persistent multi-tenant base strictly dominates the one-shot CSV variance report; no value in maintaining E3 as a separate epic. |
| **OQ-3** | Supabase Auth (email + password). | Project stack already commits to Supabase; using Supabase Auth gets RLS for free and avoids a second auth vendor. |
| **OQ-4** | One org per signup in v1; multi-org-per-user deferred. | Multi-tenancy is the load-bearing v1 capability; multi-org-per-user is a v2 expansion for consultant workflows. Workaround in v1: separate login per client. |
| **OQ-5** | Per-state-aware mapping — **resolved as engine-layer concern, not UI mapping concern**. | Mapping (raw code → bucket) is org-wide; bucket → state treatment is engine-resolved per-state. User maps a code once; engine does the rest. Cleanest separation of concerns. |
| **OQ-6** | Simple liability definition (`accrued_weeks × weekly_value`). | Matches what mid-market payroll teams compute; actuarial vesting (AASB 119) is a future report variant, not v1. |
| **OQ-7** | No future-date projection in v1; deferred to v2. | Today + historical as-at dates are enough to prove value. Projection adds engine assumptions about future pay growth that v1 doesn't need. |
| **OQ-8** | 10,000 employees per org enough for v1. | Covers the expected first-12-months client population. Re-design only if a single client materially exceeds this. |
| **OQ-9** | Pricing model (per-org/month vs /year, tiers) — **open commercial decision**, not a v1 engineering blocker. | Decision deferred until close to v1 launch. Does not block any sub-epic. Reconciliation-only tier (OQ-15) is part of the same decision. |
| **OQ-10** | Manual upload only in v1; automation belongs to E4 (API integrations). | Keeps v1 scope tight. Email-attachment automation would be a halfway feature with worse fidelity than E4. |
| **OQ-11** | LLM-assisted mapping deferred to v1.1. | Ship v1 without it; build a benchmark once we see real client raw-code lists. |
| **OQ-12** | Standalone platform with **APA branding**, same domain as the public calc under `/app/*`. | Fewer DNS/cert artefacts than a subdomain; APA brand identity is the strategic anchor for the platform's buyer. |
| **OQ-13** | 7-day org deletion grace window. | Aligns with mainstream SaaS norms. |
| **OQ-14** | Supabase default region for v1; Australian residency deferred. | Not a v1 blocker. Revisit when a client makes residency a hard requirement. |
| **OQ-15** | Reconciliation-only commercial tier — folded into the OQ-9 pricing/strategy discussion. | Same open commercial decision. No v1 engineering implication. |
| **E1 Phase 7** | **Cancelled outright (Option C).** Public calc stays anonymous-only forever; platform is the only authenticated experience. | Phase 7's single-user "save my calc" feature is strictly less valuable than the platform's org-level workspace. No replacement on the public surface. |

---

## 13. References

- `docs/product/product.md` v0.1 (Tracy, 2026-05-21) — product strategy.
- `docs/product/epics.md` — current epic structure. E5 added 2026-05-26; E3 retired; E1 Phase 7 cancelled.
- `docs/product/epic-status.md` — current pipeline state. Updated 2026-05-26 with E5 entry + E3 retirement + Phase 7 cancellation.
- `docs/research/lsl-pay-components-deep-research.md` v2.0 (2026-05-25) — the canonical pay-bucket taxonomy reference. §6 of this spec is grounded in §1 of that doc.
- `docs/launch/LAUNCH-GUARD.md` — `ANTHROPIC_API_KEY` requirement; applies to the public calc only. Platform does not depend on it in v1.
- `.specify/features/001-nsw-calculator/spec.md` v0.5.0 — E1 spec. Phase 7 cancelled.
- `.specify/features/002-all-state-coverage/spec.md` v0.3.1 — E2 spec; engines reused as-is.
- `website/src/lib/lsl/` — existing engine code. Six state directories exist (nsw, vic, qld, wa, sa, act). TAS + NT pending.

---

*End of spec v1.0 APPROVED 2026-05-26.*
