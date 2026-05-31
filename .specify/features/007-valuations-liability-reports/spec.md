# Feature Specification — E5.5 · Valuations + Liability Reports

**Slug:** `valuations-liability-reports`
**Feature number:** 007
**Status:** **v0.1 SCOPED — 2026-05-31** (re-authored from operator's Round-1 OQ decisions; never previously persisted)
**Author:** Product Manager (re-author 2026-05-31 after forensic discovery that the original spec was never committed to disk)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** E5.1 (Auth + Tenancy + DB Scaffold) ✅ shipped 2026-05-28 · E5.2 (Employee Masterfile) ☐ scoped · E5.3 (Pay-Code Mapping) ☐ scoped · E5.4 (Pay-Period Ingestion) ☐ scoped
**Parent epic:** E5 · LSL Platform (umbrella, spec v1.0 at `.specify/features/005-lsl-platform/spec.md`)
**Sibling sub-specs:** E5.6 · LSL Reconciliation (downstream — consumes valuation primitives this spec ships)

---

## 0. Why this spec exists (and why it didn't yesterday)

This sub-spec covers E5.5 of the LSL Platform umbrella epic — on-demand valuations of LSL entitlement for any employee at any date, and roll-up liability reports as at any chosen date.

**Provenance:** The 2026-05-30 EOD handoff describes operator Round-1 decisions on three open questions (OQ-VAL-1 / OQ-LIA-1 / OQ-LIA-2) and a still-open Round-2 question (OQ-LIA-2a) **as if** they were embedded in a live spec at `.specify/features/007-valuations-liability-reports/spec.md`. Forensic check 2026-05-31 confirmed that file never existed on any branch, any commit, or any stash — the spec drafting work was never persisted. This document re-authors the spec from the recorded operator decisions so the project artefact base has ground truth on disk.

**Status semantics:** v0.1 = scoped, decisions captured, open questions named, ready for `/speckit-clarify` if the operator wants a clarify pass before plan/tasks; ready for `/dev-feature-plan` if the operator wants to skip clarify and go straight to plan.

---

## 1. Executive summary

E5.5 is the first true *product deliverable* of the LSL Platform — the moment a payroll manager can log in, pick an employee, pick a date, and get a defensible LSL valuation backed by the persistent data layer that E5.1–E5.4 establishes.

Two surface areas:

1. **On-demand valuations.** Pick an employee, a valuation date, and a reason (`taking_leave` or `termination_payout`). The system runs the correct state's rules engine against the persisted pay history + masterfile + mapping. Returns weekly value, daily value, total entitlement, and a citation block linking to the statute sections that drove the result.

2. **Liability reports (as at any chosen date).** Pick a date, pick a scope (one employee / tag-filter / whole org). The system runs every in-scope employee's accrual + valuation and rolls them up. Output: a sortable on-screen report + a PDF + a CSV. Cached by `(org_id, as_at_date, scope_filter)` so a re-run is instant; cache invalidated by any masterfile / mapping / pay-period edit that touches the scope.

**Commercial framing.** Liability reporting is the auditor-persona buyer's first encounter with the platform's recurring value — it is the line item that makes the platform a permanent fixture rather than a one-shot tool. The valuation primitive shipped here is also load-bearing for E5.6 (reconciliation) which compares paid-amount-on-record against engine-computed valuation per historical event.

**What this spec does *not* cover:**
- Pay-code mapping UI or ingestion UI (those are E5.3 / E5.4 surface areas, called as services here).
- Reconciliation (variance per historical payment) — that is E5.6.
- PDF report design tokens / templates — that's E6.5/E6.6 work; this spec captures the *requirements* a PDF report must satisfy (page layout, methodology footer, page-X-of-Y), not how they're rendered.
- Portable LSL schemes (NT, ACT building & construction, etc. portable-fund variants) — out of scope for v1 per E5 umbrella decision; `scheme` column on `employees` reserves the future enum.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this spec adds |
|---|---|---|
| Rules engines | All 8 Australian jurisdictions live (NSW + VIC + QLD + WA + SA + ACT + TAS + NT — E2 ✅ shipped 2026-05-27). Engines are stateless, take a single `Employee` input, return weekly/daily/total entitlement + citations. | Nothing — the engines are reused as-is. This spec adds the *orchestration layer* that pulls `Employee` inputs out of the persisted masterfile + pay history + mapping and feeds them into the engine. |
| Single-calc UI | Live at `www.lslcalculator.com.au` for anonymous, stateless trial. | Sits unchanged. The platform valuation page is a separate `/app/*` surface. |
| Masterfile | ☐ Scoped under E5.2; not yet implemented. `employees` table including `default_work_jurisdiction`, `tags`, `start_date`, `end_date`, `retention_expires_at`, opening-balance fields. | Nothing — consumed as a foreign-key source. |
| Pay-code mapping | ☐ Scoped under E5.3. Per-org raw-code → LSL-bucket map. | Nothing — consumed as a lookup at engine-call time. |
| Pay-period data | ☐ Scoped under E5.4. One row per `(employee_id, pay_period_end, pay_code)` with gross amount. | Nothing — consumed as the historical pay stream the engine needs. |
| `tags` column on `employees` | ☐ Newly scope-amended into E5.2 v1 (2026-05-29 operator decision per OQ-LIA-1 below). | Consumed as a filter dimension for liability roll-ups. |
| PDF rendering | `@react-pdf/renderer@4.5.1` is installed in `website/package.json`. No platform PDF templates exist yet — `docs/product/epic-status.md` flags react-pdf as the recommended library (E6 analyze pass MEDIUM finding). | This spec captures the *requirements* for the liability-report PDF (page layout, methodology footer, page-X-of-Y, A4); rendering work belongs to E6.5/E6.6. |
| `valuations` cache table | None today. | New. Persists `(org_id, employee_id, valuation_date, reason)` → result for on-demand valuations, and `(org_id, as_at_date, scope_filter_hash)` → roll-up rows for liability reports. Cache invalidated by writes to masterfile / mapping / pay-period data within scope. |

**Critical finding — engines are stateless and per-state.** The valuation orchestrator must (a) resolve which state's engine to call for a given employee (per pay period's `work_jurisdiction` for accrual, then per **operator-nominated jurisdiction for cross-state valuation** — OQ-VAL-1 below), (b) assemble the `Employee` input record (start_date, end_date, opening balance, classification, hours_per_week effective at each pay period, sex for TAS retirement gate, dob for NT federal Age Pension gate), (c) call the engine, and (d) attach citations. The engine itself does not change.

---

## 3. Scope boundary — v1 vs deferred

### In scope for v1

1. **On-demand valuations.** Pick employee + valuation date + reason. Returns weekly/daily/total + citations.
2. **Single-employee liability snapshot.** Same as on-demand valuation but with `as_at` date semantics (accrual frozen at `as_at`).
3. **Multi-employee liability report.** Scope filter: `whole_org` | `tag_filter` (one or more tags, AND/OR semantics — see Open Q OQ-LIA-3 below). Returns one row per in-scope employee + roll-ups (per tag, per jurisdiction, grand total).
4. **PDF export** of liability reports (A4, methodology footer per E6.5/E6.6 requirements; full footer on p1, short footer on p2+; page X of Y; no draft watermark).
5. **CSV export** of liability reports (one row per employee — same columns as the on-screen table; no roll-ups).
6. **Cached results** for liability reports keyed by `(org_id, as_at_date, scope_filter_hash)`. Cache hits return in < 200ms. Cache invalidated by any write to masterfile / mapping / pay-period data within scope (write triggers a row-level invalidation on the cache table).
7. **Citation block** on every valuation — links to the statute section(s) that drove the computation, sourced from the existing engine output.
8. **Cross-state valuation for employees with continuous service across multiple jurisdictions:** operator manually nominates which jurisdiction governs the valuation. One valuation = one engine call = one jurisdiction. (OQ-VAL-1 locked.)
9. **Terminated employees in `as_at` reports:** rows are included with `$0` LSL value if `end_date <= as_at`. (OQ-LIA-2 locked.)
10. **Tag-based liability filtering.** Requires `tags` v1 column on `employees` (E5.2 scope-amend 2026-05-29). (OQ-LIA-1 locked.)

### Out of scope for v1 (deferred)

- **Portable LSL schemes** (`scheme` column reserves the future enum but only `state_lsl` ships).
- **Automated cross-state valuations** (multi-engine split of one employee's service period — explicitly rejected per OQ-VAL-1; user manually nominates).
- **Reconciliation / variance reports** — E5.6.
- **Branded PDF templates** — E6.5 (foundation) / E6.6 (per-family).
- **Liability forecast** (project liability forward to a future date) — v1 is as-at only.
- **Multi-currency valuations** — AUD only.
- **Bulk valuation export** (run a valuation for every employee in one click outside a liability report) — the liability report path covers this functionally.
- **Liability comparison reports** (delta between two `as_at` dates) — v1.1.

---

## 4. Data model — entities and fields

### 4.1 `valuations` table (new)

Caches both on-demand valuations and liability-report rows. The same row can serve either role — a liability-report query is just a batch of on-demand valuations cached together.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK → `organisations`. RLS isolation key. |
| `employee_id` | uuid | FK → `employees`. |
| `valuation_date` | date | The "as at" or "leave start" / "termination" date the engine ran against. |
| `reason` | text | `taking_leave` \| `termination_payout` \| `as_at_liability` |
| `jurisdiction` | text | The engine that ran (`nsw` \| `vic` \| `qld` \| `wa` \| `sa` \| `act` \| `tas` \| `nt`). For cross-state employees this is the operator-nominated jurisdiction (OQ-VAL-1). |
| `weeks` | numeric(10,4) | Total weeks of LSL entitlement at `valuation_date`. |
| `weekly_value` | numeric(14,2) | AUD per week. |
| `daily_value` | numeric(14,2) | AUD per day. |
| `total_value` | numeric(14,2) | AUD — `weeks * weekly_value * 5` (or engine-specific equivalent). |
| `citations` | jsonb | Array of `{section: string, act: string, url?: string, summary: string}` from the engine output. |
| `engine_version` | text | Git SHA of `website/src/lib/lsl/` at run time — pins reproducibility. |
| `inputs_hash` | text | SHA-256 of the canonical `Employee` input record. Cache key for "have we computed this exact valuation before?" |
| `created_at` | timestamptz | When this valuation row was written. |
| `superseded_at` | timestamptz | When a write to upstream data invalidated this row. NULL = still valid. |
| `superseded_by` | uuid | If recomputed, the new row's ID. NULL = still valid. |

RLS: `org_id = (auth.jwt() ->> 'org_id')::uuid` on read; same on insert.

Index: `(org_id, employee_id, valuation_date, reason)` for on-demand lookups; `(org_id, valuation_date, superseded_at)` for liability roll-ups.

### 4.2 `liability_report_runs` table (new)

Captures the metadata for a multi-employee liability report execution so the UI can show "you generated this report at 10:13am yesterday — re-open or re-run?" and so PDFs can be regenerated from the same inputs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `org_id` | uuid | FK → `organisations`. |
| `as_at_date` | date | The "as at" date the report ran against. |
| `scope_type` | text | `whole_org` \| `tag_filter` \| `single_employee` |
| `scope_filter` | jsonb | `{tags: ['team-finance'], employee_id?: uuid, mode: 'AND' \| 'OR'}` — null for `whole_org`. |
| `scope_filter_hash` | text | SHA-256 of the canonical scope filter — cache key. |
| `valuation_ids` | uuid[] | Array of `valuations.id` rows produced by this run. |
| `total_rows` | int | Count of in-scope employees. |
| `total_value` | numeric(14,2) | Grand-total AUD. |
| `pdf_object_path` | text | Supabase Storage path to the rendered PDF (when ready — async). NULL while rendering. |
| `csv_object_path` | text | Supabase Storage path to the rendered CSV. |
| `status` | text | `pending` \| `complete` \| `failed` \| `superseded` |
| `error_message` | text | Populated when `status = failed`. |
| `created_at` | timestamptz | |
| `superseded_at` | timestamptz | NULL = still valid. |

RLS: `org_id` isolation as above.

---

## 5. Validation rules

V1. The valuation date for an on-demand valuation MUST be on or after the employee's `start_date`. (If `<`, return a validation error — engine can't accrue against pre-employment time.)
V2. `reason = termination_payout` MUST be paired with a `valuation_date >= start_date AND valuation_date >= MIN(pay_period_end)`. (If no pay history, return validation error pointing at E5.4 ingestion.)
V3. `reason = termination_payout` MUST set `valuation_date = end_date` automatically if `end_date` is present; user override allowed only if the operator explicitly confirms (this prevents accidental valuation at the wrong date for a terminated employee).
V4. For cross-state employees (more than one distinct `work_jurisdiction` across their pay history): the UI MUST prompt the operator to nominate which jurisdiction governs this valuation. Default = the jurisdiction at `valuation_date - 1 day`. (OQ-VAL-1.)
V5. `as_at` liability reports MUST include all `employees` rows where `start_date <= as_at` AND (`end_date IS NULL` OR `end_date <= as_at`). Terminated rows show `total_value = $0`. (OQ-LIA-2.)
V6. Liability report scope filters MUST validate that referenced tags exist in the org's `employees.tags` set; unknown tags return a validation error with the closest matches. (OQ-LIA-1.)
V7. PDF and CSV export MUST be regeneratable from the underlying `valuations` rows — if a render fails, retry must produce byte-identical output (given `engine_version` is pinned per row).
V8. Cache invalidation: any write to `employees`, `employee_history`, `pay_periods`, or `pay_code_mappings` within scope MUST set `superseded_at = now()` on all `valuations` rows whose `inputs_hash` would now compute differently. A trigger on each upstream table flips the bit; a background job recomputes on next read or on a scheduled basis.
V9. RLS: a user's `org_id` JWT claim MUST match every read and write to `valuations` and `liability_report_runs`. Cross-tenant reads return zero rows (per E5.1 AC-AUTH-13).
V10. Citation block: every `valuations.citations` array MUST be non-empty (the engine never returns a result without at least one section reference). Empty array = engine bug; fail loudly.

---

## 6. Acceptance criteria

### AC-VAL-1 — On-demand valuation: leave-taking
Given an authenticated user with masterfile + mapping + ≥ 1 pay period loaded for `EMP-001`, when the user picks `EMP-001`, `valuation_date = 2026-03-15`, `reason = taking_leave`, then the system returns weekly value, daily value, total entitlement, and ≥ 1 citation within 5 seconds (cold) / 200ms (warm cache).

### AC-VAL-2 — On-demand valuation: termination payout
Same as AC-VAL-1 but `reason = termination_payout`. If the employee has an `end_date`, `valuation_date` is auto-populated to `end_date` and locked unless operator explicitly overrides (V3).

### AC-VAL-3 — Cross-state employee nomination (OQ-VAL-1 locked)
Given `EMP-002` has pay periods with `work_jurisdiction ∈ {nsw, vic}` across their service, when the user starts a valuation, the UI shows a "this employee has worked in multiple states — which jurisdiction governs this valuation?" prompt with `[NSW] [VIC]` radio. The default selection is the jurisdiction effective at `valuation_date - 1 day`. The operator's nomination is recorded in `valuations.jurisdiction`. The chosen engine runs against the *entire* service period (no engine-split mid-service).

### AC-VAL-4 — Citation surfacing
Every valuation result page renders the `citations` array as a footnoted reference block beneath the value table. Each citation shows section number, act name, and a one-line summary. (E6 wordmark + brand styling out of scope here — that's E6.5 work.)

### AC-LIA-1 — Whole-org liability snapshot
Given 50 employees + masterfile + pay history loaded, when the user picks `as_at = 2026-03-31`, `scope = whole_org`, the system produces an on-screen report listing all 50 employees + grand-total in < 30 seconds (cold). Roll-ups by jurisdiction and tag appear above the per-row table.

### AC-LIA-2 — Tag-filtered liability (OQ-LIA-1 locked, tags-v1)
Given 50 employees, 12 of whom have `tags @> ARRAY['team-finance']`, when the user picks `as_at = 2026-03-31`, `scope = tag_filter`, `tags = ['team-finance']`, the system produces a 12-row report.

### AC-LIA-3 — Terminated employees silent-$0 (OQ-LIA-2 locked)
Given `EMP-099` has `end_date = 2025-12-15`, when the user runs a liability report at `as_at = 2026-03-31`, the row for `EMP-099` appears with `total_value = $0.00`. (No row hidden, no warning — the row is present and $0 by statute. The UX safety-net around this rule is the still-open OQ-LIA-2a in §8.)

### AC-LIA-4 — PDF export (rendering deferred to E6.5/E6.6)
The PDF download button kicks off an async render. When complete, the PDF is A4, has a methodology footer (full on page 1, short on subsequent pages), page X of Y, no draft watermark. **Stub PDF (system-default styling) is acceptable for v1 — branded PDF lives in E6.5/E6.6.**

### AC-LIA-5 — CSV export
The CSV download button returns a CSV with one row per employee. Header row: `employee_external_id, full_name, jurisdiction, weeks, weekly_value, daily_value, total_value, citations_count`. UTF-8, BOM-less, RFC 4180 quoting.

### AC-LIA-6 — Cache invalidation
After a successful liability report run, modify one pay period for one in-scope employee. Re-run the same report (same `as_at`, same scope). The result for that one employee MUST recompute (different value vs the prior run); the other 49 rows MUST be served from cache (warm path). The cache invalidation MUST NOT recompute employees outside the scope of the edit.

### AC-LIA-7 — RLS isolation
A user in `org_A` MUST NOT see any valuations, liability report runs, or rendered PDFs/CSVs belonging to `org_B`. Verified by an integration test that explicitly issues a cross-tenant SELECT and expects zero rows. (Companion to E5.1 AC-AUTH-13.)

### AC-LIA-8 — Idempotent re-run
Running the same liability report twice in a row (no upstream writes between) MUST return byte-identical results (same totals, same per-row values, same PDF SHA, same CSV SHA). Engine determinism is the source of this guarantee; the cache merely accelerates it.

---

## 7. Locked decisions (formerly open)

| OQ | Question | Decision (locked 2026-05-29 by operator, re-recorded here 2026-05-31) | Rationale |
|---|---|---|---|
| **OQ-VAL-1** | How to handle employees whose continuous service crossed state boundaries during their employment? Auto-split (run multiple engines and concatenate) or manual nomination (operator picks one jurisdiction)? | **Manual nomination.** UI prompts the operator to pick which jurisdiction governs the valuation. Default = jurisdiction effective at `valuation_date - 1 day`. One valuation = one engine call. | Auto-split is statutorily ambiguous (no Australian jurisdiction has reciprocal-recognition rules that map cleanly to a code-level split). Manual nomination puts the decision in the operator's hands and produces a single defensible result the engine fully owns. Auto-split deferred to v1.1 at earliest, and only if operator demand emerges. |
| **OQ-LIA-1** | Should liability reports support filtering by `tags`? | **Yes — tags ship as v1.** Required as a filter dimension on liability reports. This scope-amends E5.2 (masterfile): `tags` becomes a v1 column on `employees`. | Liability roll-ups by team / cost-centre are the primary CFO-persona ask; doing this without tags forces every customer to encode team membership in `default_work_jurisdiction` or `classification`, both of which the engine already consumes for other purposes. Cheap to add (one text[] column + a GIN index), high value. |
| **OQ-LIA-2** | How should liability reports treat terminated employees (`end_date <= as_at`)? | **Strict $0.** Terminated rows appear with `total_value = $0.00`. No exclusion, no warning. | Aligns with the LSL Act statutory accrual model: an employee with `end_date` no longer accrues; their entitlement was payable at `end_date` and is statutorily $0 thereafter. Hiding the row would (a) make the report's total-headcount mismatch the masterfile's, and (b) silently drop rows the auditor needs to see were "considered and computed to $0". |

---

## 8. Open questions

### Round 2 (still open — flagged for future operator decision, NON-BLOCKING for v0.1 → plan/tasks handoff)

**OQ-LIA-2a — Terminated-employee silent-$0 UX safety net.** With OQ-LIA-2 locked at strict $0, a terminated employee appears in an `as_at` report with $0 LSL value. There is a risk the user doesn't realise the row is intentionally $0 (by statute) vs an engine bug. Three options the operator has floated:

| Option | UX | Trade-off |
|---|---|---|
| (a) **Always-on banner** above every liability report. "Terminated employees are included with $0 LSL value per s.X of the relevant Act. [n] terminated employees in scope at as-at date." | Low-friction, always visible, can't be missed. | Adds noise to every report even when no terminated rows are in scope. |
| (b) **Filter chip** "Hide terminated rows" — defaults to ON. User opts back in to seeing them. | Cleaner default view, auditor toggles to see the full set. | Hides rows by default — risk that an auditor running the report doesn't realise terminated rows exist (unless the count is shown). |
| (c) **Both** — banner + filter chip, with the banner showing the count and the chip controlling visibility. | Safest. Acknowledges the rows exist regardless of visibility state. | Most UI surface. |

**Recommendation (PM):** (c). The cost is small (one banner + one chip); the auditor-persona buyer is precisely the persona who needs both signals.

**Status: NOT BLOCKING.** v0.1 → plan/tasks → impl can proceed assuming option (c); if operator picks (a) or (b) later, the change is one-component swap.

### Round 3 (newly raised in this re-author, NON-BLOCKING)

**OQ-LIA-3 — Tag filter semantics (AND vs OR).** When the user picks multiple tags in the liability-report scope filter, do we AND them (employee must have ALL selected tags) or OR them (employee with ANY selected tag)? The `scope_filter.mode` field in `liability_report_runs` (§4.2) accepts both; the UI can default to one and offer a toggle. Default recommendation: **AND** (matches set-membership intuition; OR via "union of reports" is also discoverable).

**Status: NOT BLOCKING.** v0.1 → plan can proceed assuming AND-default; the field is in the schema so this is a UI-only decision.

**OQ-LIA-4 — Liability report scheduling.** Should liability reports be schedulable (run automatically at month-end / year-end and email the PDF)? This is a productisation question (recurring reports are a clear SaaS hook). v1 is on-demand only; scheduling is v1.1+. **Status: out of scope for v0.1.** Recorded for future roadmap.

**OQ-VAL-2 — Valuation date defaults for `as_at_liability` reason.** When a user runs a single-employee liability snapshot (one of three valid reasons), should `valuation_date` default to today, end-of-prior-month, or end-of-prior-financial-year? Reporting cadence question. **Status: NOT BLOCKING.** Default to end-of-prior-month for v0.1; revisit if user behaviour suggests otherwise.

---

## 9. Risks and dependencies

| Risk / dependency | Impact | Mitigation |
|---|---|---|
| **E5.2 masterfile not yet shipped (`tags` v1 column not present)** | Cannot ship E5.5 without the column. | E5.5 plan must reference the masterfile sub-spec amendment (operator decision 2026-05-29). E5.2 dev work blocks E5.5 implementation. |
| **E5.3 mapping not yet shipped** | Cannot ship E5.5 — engine cannot run without mappings to resolve raw pay codes to LSL buckets. | E5.5 sequenced after E5.3. |
| **E5.4 ingestion not yet shipped** | Cannot ship E5.5 — engine has nothing to compute against. | E5.5 sequenced after E5.4. |
| **Engine determinism / version pinning** | If a future engine bug fix changes the valuation for the same inputs, a re-render of the same `liability_report_runs` row would produce a different PDF — auditor confusion. | `valuations.engine_version` stores the git SHA at compute time. A new engine version triggers cache invalidation (see V8) rather than silent recompute on existing rows. Auditors can see "this row was computed against engine v X" in the citation footer. |
| **PDF render performance at scale** | A whole-org liability report for 500+ employees could take 30+ seconds to render. | Async render path — operator gets an in-app notification when the PDF is ready. CSV stays sync (CSV is cheap). Performance budgets defined in AC-LIA-1 (on-screen) and out of scope for PDF (which is async by design). |
| **PDF visual quality is a stub in v1** | Operator-visible PDF will look generic until E6.5/E6.6 brand templates land. | Documented explicitly in AC-LIA-4. Acceptable for v1 because the data integrity is the load-bearing signal, not the visual; E6.5/E6.6 graduate the same data through branded templates. |
| **Liability cache invalidation correctness** | An incorrect invalidation rule could silently return stale numbers to an auditor. | Trigger-based invalidation on upstream tables (employees, employee_history, pay_periods, pay_code_mappings). Cache-hit responses include the `valuations.created_at` timestamp so any audit query can see the freshness. Integration tests cover the invalidation paths per AC-LIA-6. |

---

## 10. References

- **Parent epic:** `.specify/features/005-lsl-platform/spec.md` v1.0 (umbrella E5).
- **Masterfile sub-spec:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md` — defines the `employees` schema this spec consumes. **Scope amend pending:** `tags` text[] v1 column (OQ-LIA-1 locked 2026-05-29).
- **Mapping sub-spec:** `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md`.
- **Ingestion sub-spec:** `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md`.
- **Engines:** `website/src/lib/lsl/engine/` (core orchestrator), `website/src/lib/lsl/states/{nsw,vic,qld,wa,sa,act,tas,nt}/` (per-state rules), `website/src/lib/lsl/dispatch.ts` (engine selector).
- **E6.5 PDF foundation:** `.specify/features/006-ui-design-system/spec.md` §8.5 — methodology footer, A4, page-X-of-Y requirements.
- **Scoping brief:** `docs/product/scoping/E5.5-valuations-liability.md` — companion document with business-context Round-1 / Round-2 detail.
- **Operator decision log:** captured in `docs/standup/2026-05-30-eod-handoff.md` (originally) and persisted here 2026-05-31 after spec-on-disk forensic finding.

---

*v0.1 re-authored by product-manager agent 2026-05-31. Awaits operator review → optional `/speckit-clarify` pass → `/dev-feature-plan` to produce impl-plan + tasks.*
