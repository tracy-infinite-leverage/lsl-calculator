# Feature Specification — LSL Platform · E5.3 Pay-Code Mapping (Column Auto-Detection + Wizard)

**Slug:** `lsl-platform-pay-code-mapping`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** **E5.3 · Pay-Code Mapping**
**Status:** **Amended v0.2 — LOCKED 2026-06-01** — all v0.2 OQs (OQ-MAP-5 / OQ-MAP-6 / OQ-MAP-7) resolved by operator 2026-06-01; ready for impl-plan + tasks. Prior approval: v0.1 APPROVED 2026-05-27; v0.2 DRAFTED 2026-05-31.
**Author:** Product Manager (drafted 2026-05-27; amended v0.2 2026-05-31 from Virtus Health payroll-file analysis)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** **E5.1 Auth + Tenancy + DB Scaffold** (RLS primitives) and **E5.2 Employee Masterfile** (foreign-key target for the customer's mapping table). E5.4 ingestion is the **consumer** of this layer (mapping must exist before pay periods can be valued).
**Sequence within E5:** Third after E5.1 + E5.2. E5.4 ingestion runs against this mapping layer.

---

## Amendment v0.2 — 2026-05-31 (DRAFT)

**Trigger.** Operator analysed a representative customer payroll export 2026-05-31 (Virtus Health — multi-employer IVF group, ~1,400 employees, 10 ABNs, cross-state staff). Two distinct shapes observed:

1. **Single-`.xlsx` reconciliation summary** — 3 sheets (calculated-results / employee-master / payroll-export). Sheet headers use long-form state names (`"Tasmania"`), prefixed employment-type codes (`"CA - Casual"`, `"FP - Full Time Salaried"`), and surface two unmodelled concepts: **Cohort** (cross-jurisdiction grouping like `VIC-TAS`) and **LSL Instrument / Award** (16 distinct values mixing EBA names, award names, common law contracts).
2. **Three-CSV relational shape** — `PayHistory` (per-period `Pay Code` + `Units` + `Amount` + `Pay Run`) + `PayRateHistory` (effective-dated `Hourly` + `Annual` + `FTE Salary`) + `PositionHistory` (effective-dated state + employment-type + classification + hours). This is the **richer ingestion source** that the v0.1 sub-specs did not anticipate.

**What changed in this spec (all sections marked `[AMENDED 2026-05-31]`):**

- §1 / §2 / §3 — generic-CSV scope **extended to `.xlsx` and multi-file relational drops**.
- §3 — **LLM-assisted column auto-detection promoted from v1.1 to v1** (deterministic header-pattern matching stays as first pass; LLM is second pass before user falls through to wizard). Reinstates `ANTHROPIC_API_KEY` env var dependency that the PDF-Removal companion deleted 2026-05-27.
- §3 + new §4.4 — **value normalisation library** (long-form state names → 8-code enum; prefixed employment-type codes → masterfile enum; case + whitespace + hyphen variants). Catalogue is org-versioned.
- §5 — **auto-detection algorithm extended**: multi-file relational shape (join key resolution); sheet-selection step for `.xlsx` with multiple candidate sheets; LLM second-pass before wizard fallback.
- §6 — **wizard UX extended** with sheet-picker, multi-file relationship picker, and LLM-suggestion review state.
- §7 — new acceptance criteria AC-MAP-13 (Excel multi-sheet), AC-MAP-14 (multi-file relational), AC-MAP-15 (value normalisation), AC-MAP-16 (LLM-assist behaviour).
- §8 — six new open questions (renumbered to OQ-MAP-5..OQ-MAP-10 to avoid collision with existing OQ-MAP-2..4).

**Engine input contract is unchanged by this spec.** The bucket → state engine treatment stays as it was. The contract change (typed pay components vs single `gross_amount`) lives in the E5.4 amendment — this spec just continues to deliver `bucket` values to the engine; E5.4 owns how the period record is shaped.

**What did NOT change:**

- §0 / umbrella §5.3 load-bearing decision (mapping is org-wide; bucket → state treatment engine-resolved) — unchanged.
- §6.4 / §7 — OQ-MAP-1 (inline-on-first-import) — still locked.
- §7 acceptance criteria AC-MAP-1..AC-MAP-12 — unchanged at the contract layer.

---

---

## 0. Why this spec exists

The umbrella E5 spec §5.3 names the mapping layer in nine bullets. The operator's 2026-05-27 decisions refine it:

- **Generic CSV** from any payroll source — no provider-specific importers in v1.
- **Column auto-detection by header name**, with a mapping wizard as the fallback when auto-detection misses or a new code appears.
- **One-time per-customer setup**: every distinct raw code is mapped once; the system auto-learns and suggests defaults for unfamiliar codes on subsequent imports.
- **Per-customer (per-org) mapping**, versioned — every change preserved, latest used by default.

The umbrella spec's load-bearing decision stays: **mapping (raw code → bucket) is org-wide; bucket → state treatment is engine-resolved per-state at valuation time.** This sub-spec does not revisit that.

---

## 1. Executive summary

The platform's ingestion pipeline is `customer file(s) → raw pay codes → org-wide mapping → LSL buckets → engine input`. The mapping layer is where customer-specific payroll vocabulary (e.g. "OT15", "PUBHOL", "BONUS-Q4", "ORD", "LSL") becomes the deterministic bucket taxonomy the engines consume.

**[AMENDED 2026-05-31]** Four components in v0.2:

1. **Auto-detection** — when a new file uploads (E5.4), the system inspects column headers, sheet names (for `.xlsx`), inter-file relationships (for multi-file CSV drops), and the distinct values seen in the `pay_code` column. For each surface it runs two passes: (a) **deterministic** scoring against `pay_code_aliases` patterns + the customer's historical mappings, then (b) **LLM-assisted** suggestion for anything below the deterministic confidence threshold. Both surfaces feed **proposals** into the wizard — the system never auto-commits.
2. **Value normalisation** — long-form state names (`"Tasmania"` → `TAS`), prefixed employment-type codes (`"CA - Casual"` → `casual`, `"FP - Full Time Salaried"` → `full_time`), case + whitespace + hyphen variants, and similar surface-form-to-canonical-enum mappings happen here. Catalogue is org-versioned alongside `pay_code_mappings`.
3. **Mapping wizard** — a UI surface where the customer reviews proposed mappings, accepts / overrides them, and commits. The wizard runs **inline during first import** (covering the entire initial code list + sheet + file selections) and **incrementally on subsequent imports** (only covering codes / shapes the system hasn't seen for this customer).
4. **Versioned mapping store** — every change writes a new version row; the live mapping is the latest version per `(org_id, raw_code)`. A valuation references the mapping version that was current at the time the valuation ran, so historical valuations can be replayed against the mapping they actually used.

**Critical invariant.** A valuation cannot run for an employee whose relevant pay history contains any **unmapped** raw code or unresolved value-normalisation token. The platform returns a blocking error listing the unmapped surfaces and routes the user to the wizard. This is the umbrella spec's §5.3 MUST, extended to value-normalisation tokens in v0.2.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this sub-spec adds |
|---|---|---|
| Pay bucket taxonomy | Defined in umbrella spec §6 — fixed list of LSL buckets (Ordinary Time, Overtime — Regular, Overtime — Ad-hoc, Penalty Rates, Commission, Bonus — Discretionary, Bonus — Contractual, All-purpose Allowance, Single-purpose Allowance, Casual Loading, Leave — Annual / Personal / LSL / Workers Comp / Unpaid Parental / Unpaid Other, Termination Payment — LSL / Other, Excluded — Other). Engine layer applies per-state treatment. | This sub-spec exposes the bucket taxonomy as an enum in the mapping table. Bucket → engine treatment is unchanged. |
| Customer mapping | None. The public calc has no concept of per-customer mapping. | New tables: `pay_code_mappings`, `pay_code_mapping_versions`, `pay_code_aliases` (the auto-detection knowledge base). **[AMENDED 2026-05-31]** Plus `value_normalisation_aliases` (state names, employment-type codes) — see §4.4. |
| Column auto-detection | `/api/normalize-csv` exists in the public calc (LLM-based) — **deleted** by the PDF Removal sub-spec 2026-05-27 (`ANTHROPIC_API_KEY` env var removed). | **[AMENDED 2026-05-31]** A new auto-detection layer with deterministic pattern-match as the first pass + LLM-assisted second pass for low-confidence surfaces. **`ANTHROPIC_API_KEY` reinstated** in v1 — the env var that PDF-Removal deleted comes back for this path. **Wizard remains the source of truth — LLM only proposes; nothing auto-commits.** |
| File-shape support | Public calc accepts a single CSV file. | **[AMENDED 2026-05-31]** v0.2 adds `.xlsx` / `.xlsm` (multi-sheet — user picks the payroll-export sheet) and **multi-file relational drops** (`PayHistory` + `PayRateHistory` + `PositionHistory` joined on a user-confirmed employee key). See §5. |
| Value normalisation | None. The public calc accepts only the strict 8-code state enum and a fixed employment-type vocabulary. | **[AMENDED 2026-05-31]** Surface-form-to-canonical normalisation. Long-form state names, prefixed employment-type codes, whitespace + case + hyphen variants. Catalogue is org-versioned. Wizard surfaces every unrecognised value before commit. |
| Mapping wizard UI | None. | New `/app/mapping/*` surface. **[AMENDED 2026-05-31]** Extended in v0.2 with sheet-picker step + file-relationship picker step + LLM-suggestion review state. |

---

## 3. Scope boundary — v1 vs deferred

### In scope for v1 **[AMENDED 2026-05-31]**

- `pay_code_mappings` table (current live mapping per `(org_id, raw_code)`).
- `pay_code_mapping_versions` table (full audit trail of every change).
- `pay_code_aliases` table (system-level knowledge base of known header / code patterns → suggested bucket).
- **[AMENDED 2026-05-31]** `value_normalisation_aliases` table — surface-form → canonical-enum for state names and employment-type codes (§4.4).
- **[AMENDED 2026-05-31]** `.xlsx` + `.xlsm` ingestion in addition to `.csv`. Multi-sheet handling: when more than one sheet is present, the system proposes which sheet is the payroll-export based on column-signature heuristics; user picks (or confirms) in the wizard.
- **[AMENDED 2026-05-31]** Multi-file relational drops — the wizard accepts a set of related files (e.g. one for pay periods, one for rate history, one for position history) and lets the user confirm the join key (typically `Employee ID`). The system proposes the relationship based on shared key columns.
- Auto-detection at import time (two passes):
  - **Pass 1 — deterministic.**
    - **Column-header detection** — identifies which column carries the pay code (e.g. `pay_code`, `earnings_code`, `payment_type`, `Pay Code`).
    - **Sheet-name + sheet-shape detection** — for `.xlsx`, score sheet names against `pay_code_aliases` patterns; tie-break by column-signature match (e.g. a sheet containing `Employee ID` + `Pay Period End` + `Pay Code` + `Amount` is the payroll-export sheet).
    - **Value-pattern detection** — for each distinct raw code value, score against the customer's historical mappings (highest priority) and the system alias table (fallback).
    - **Value-normalisation detection** — for state-name and employment-type columns, score each unique surface form against `value_normalisation_aliases`.
  - **Pass 2 — LLM-assisted (`ANTHROPIC_API_KEY` reinstated in v1).** For any surface that Pass 1 scores below the deterministic threshold, the system calls Anthropic Claude API (no-retention enterprise tier per existing umbrella terms) with the unresolved surfaces and proposes mappings. **The wizard surfaces LLM proposals with a distinct visual marker — `llm_suggested` — and the user must explicitly accept.** Behaviour, opt-in vs opt-out default, cost-cap, latency budget — open question (OQ-MAP-5 below).
- Mapping wizard UI:
  - Inline on first import — surfaces every distinct unmapped code + every unresolved state/employment-type value + every sheet/file selection with a proposed mapping (or "unknown" if no proposal); customer accepts / overrides; commits in one batch.
  - Incremental on subsequent imports — surfaces only new surfaces; existing surfaces flow through silently.
  - **[AMENDED 2026-05-31]** Wizard now has a sheet-picker step (Excel) and a file-relationship step (multi-file) BEFORE the column-detection step.
- Versioned mapping store — every change creates a new `pay_code_mapping_versions` row; the live row in `pay_code_mappings` is replaced. Same versioning applies to `value_normalisation_aliases` (org-scoped overrides).
- Admin-only edit of existing mapping (post-commit) — also versioned.
- Block-valuation rule (umbrella AC5.3.3) — surfaced as a structured error pointing to the wizard. **[AMENDED 2026-05-31]** Extended to unresolved value-normalisation tokens.
- Mapping export as JSON (umbrella §5.3 MAY). **[AMENDED 2026-05-31]** Export now also covers org-scoped `value_normalisation_aliases` overrides so a consultant can migrate the full normalisation context.

### Out of scope for v1 (deferred)

- ~~LLM-assisted mapping suggestions (umbrella spec — deferred to v1.1).~~ **[AMENDED 2026-05-31 — moved INTO v1 scope above. The 2026-05-27 "no LLM in v1" decision is reopened by the operator on 2026-05-31. Real customer-file complexity (mixed-prefix employment types, long-form state names, sheet/file selection) makes the deterministic-only path too brittle for go-live. LLM is second-pass-after-deterministic, never auto-commit.]**
- Cross-org mapping share (a consultant publishes their mapping to another org). v1 workaround: export JSON + manual import.
- Per-employee mapping overrides — mapping is org-wide. If a customer needs different treatment for a code under different conditions, they restructure the code in their payroll system (operational concern, not a platform concern in v1).
- Mapping wizard inside the standalone public calc — the public calc remains stateless.
- Bulk "find and replace" raw-code edits (e.g. customer renames `OT15` to `OT_15X` in their payroll system mid-year). v1 workaround: archive the old code, map the new one — both versions are preserved in `pay_code_mapping_versions`. Forward valuations use the new code; historical valuations against pay periods that hold the old code still resolve via the versioned mapping.
- Multi-bucket fractional mapping (e.g. "code X is 70% ordinary, 30% bonus"). Not requested. Out of scope.

---

## 4. Data model — entities and fields

### 4.1 `pay_code_mappings` table (live view, one row per code per org)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. Indexed. |
| `raw_code` | text | yes | The customer's payroll code value. Case-preserved but compared case-insensitively. **Composite key** with `org_id`: `UNIQUE (org_id, lower(raw_code))`. |
| `bucket` | enum | yes | One of the LSL buckets from umbrella spec §6. |
| `current_version_id` | uuid (FK → `pay_code_mapping_versions.id`) | yes | Points to the live version. |
| `archived_at` | timestamptz | no | Nullable. If set, the code is archived (not used for new imports but historical pay periods still resolve via versioned mapping). |
| `created_at` | timestamptz | yes | First creation timestamp for this (org, code) pair. |
| `updated_at` | timestamptz | yes | Trigger-maintained. |

### 4.2 `pay_code_mapping_versions` table (immutable history)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `mapping_id` | uuid (FK → `pay_code_mappings.id`) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | Denormalised for RLS. |
| `raw_code` | text | yes | Snapshot at version time. |
| `bucket` | enum | yes | Snapshot at version time. |
| `effective_from` | timestamptz | yes | When this version became current. |
| `effective_to` | timestamptz | no | When this version was superseded. Null = current. |
| `change_reason` | text | no | Free-text admin note. |
| `created_by` | uuid (FK → `auth.users.id`) | yes | |
| `created_at` | timestamptz | yes | |
| `source` | enum | yes | One of `auto_detection_accepted`, `wizard_override`, `admin_edit`, `import_json`. Captures how the version came to be. |

**Versioning invariant.** For any `(org_id, raw_code)` pair, exactly one version row has `effective_to IS NULL` at any time. The `pay_code_mappings.current_version_id` always points to that row.

**Valuation reference.** A valuation persists the `mapping_version_id` for every distinct pay code in its averaging window (umbrella AC5.5.2). Replaying the valuation later resolves codes against those captured versions, not the current ones — so a historical valuation never silently shifts because someone re-mapped a code.

### 4.3 `pay_code_aliases` table (system-level knowledge base, shared across orgs)

This is a **system-managed** table — orgs do not write to it. It carries known patterns the auto-detection layer consults when no org-historical mapping exists for a code.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `pattern_kind` | enum | yes | One of `header_name`, `code_value`, `code_prefix`, `code_suffix`. |
| `pattern` | text | yes | The literal string or simple-wildcard pattern (e.g. `ORDINARY*`, `*-OT`, `PAYCODE`). |
| `bucket` | enum | yes | The bucket this pattern suggests. |
| `confidence` | numeric(3,2) | yes | 0.0–1.0. Drives ranking when multiple patterns match. |
| `source` | enum | yes | One of `system_seed`, `usage_learned`. v1 ships `system_seed` only; `usage_learned` is reserved for v1.x. |
| `created_at` | timestamptz | yes | |

**RLS:** `pay_code_aliases` is read-only for all authenticated users (no `org_id` column). Writable only by the platform team via migration.

**Seed content.** The dev impl plan seeds this table with the obvious patterns the operator will recognise: `ORDINARY*` → Ordinary Time, `OT*` → Overtime — Ad-hoc (Regular OT is operator-flagged), `PEN*` / `*-PEN` → Penalty Rates, `COMM*` → Commission, `BON*` → Bonus — Discretionary (Contractual flagged), `CAS_LOAD` / `25_LOAD` → Casual Loading, `LSL*` → Leave — Long Service, `WC*` / `WORKERSCOMP*` → Leave — Workers Comp, `PARENTAL*` → Leave — Unpaid Parental, `TFN`/`TAX_FILE`/`BSB`/etc → **excluded from import entirely** (these are PII strip patterns, surfaced for safety).

### 4.4 `value_normalisation_aliases` table (system + org seed, value-form → canonical enum) **[AMENDED 2026-05-31]**

Surfaces in customer payroll files frequently use non-canonical value forms — `"Tasmania"` rather than `"TAS"`, `"CA - Casual"` rather than `"casual"`, `"FP - Full Time Salaried"` and `"FP - Full-time Salaried"` (same intent, hyphen variance) and `"Part Time"` (no prefix). v1 introduces a deterministic normalisation pass before any other validation runs.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | no | Null = system-managed; non-null = org-scoped override. Org overrides shadow system rows of the same `(target_field, surface_form)`. |
| `target_field` | enum | yes | One of `work_jurisdiction`, `employment_type`, `pay_frequency`. Extensible. |
| `surface_form` | text | yes | The raw value seen in customer files. Case-insensitive compared; whitespace + hyphen normalised. |
| `canonical_value` | text | yes | The masterfile enum value (`TAS`, `casual`, `weekly`, etc.). |
| `confidence` | numeric(3,2) | yes | 0.0–1.0. System rows ship at 0.95+; org rows at 1.0 (explicit user confirmation). |
| `source` | enum | yes | One of `system_seed`, `wizard_confirmed`, `llm_suggested`, `admin_edit`. |
| `created_at` | timestamptz | yes | |
| `created_by` | uuid | no | Null for system rows. |

**RLS:** Org-scoped rows visible only to that org; system rows read-only globally. Writes scoped to org admin/payroll_user.

**Seed content.** State names (all 8 jurisdictions × long-form + short-form + common typos), employment-type prefixes (`FP - `, `FT - `, `PP - `, `PT - `, `PC- `, `CO - `, `CA - ` + their hyphenless variants), pay-frequency words (`weekly`, `fortnightly`, `bi-weekly`, `monthly`, `4-weekly`, etc.). The dev impl plan ships the full seed list referencing the Virtus fixture as the canonical surface-form test set.

**Versioning.** Org-scoped rows are versioned via the same `pay_code_mapping_versions` pattern (or a parallel `value_normalisation_aliases_versions` table — dev decides at impl-plan time). Pay-period rows reference the version that was active at insert time so a later re-mapping cannot retroactively shift historical valuations.

---

## 5. Auto-detection algorithm (v1) **[AMENDED 2026-05-31]**

When a customer uploads file(s) in E5.4 ingestion, the system runs the steps below in order. **Pass 1 is deterministic. Pass 2 is LLM-assisted and only fires for surfaces Pass 1 left unresolved.** Both passes feed the wizard — the system never auto-commits.

### 5.1 File-shape detection (new in v0.2)

0. **Determine file shape.**
   - **Single CSV** → straight through to step 1.
   - **Single `.xlsx` / `.xlsm` with one sheet** → straight through to step 1.
   - **`.xlsx` / `.xlsm` with multiple sheets** → score each sheet's column signature against `pay_code_aliases` `pattern_kind = 'header_name'`. The sheet whose top 5 headers match the payroll-export pattern wins. **If two or more sheets tie or both score ≥ 0.7 → wizard surfaces a sheet-picker.** (Open question OQ-MAP-6 — should the wizard ALWAYS show the sheet-picker for confirmation, even when one sheet wins decisively?)
   - **Multi-file relational drop** (the customer uploads 2–4 files together) → the system identifies the shared key column (typically `Employee ID`) and proposes a join — one file as payroll-period source, others as rate-history / position-history. Wizard confirms the relationship before any code-mapping work runs. If the system cannot identify a shared key with confidence ≥ 0.7, the wizard surfaces a relationship picker.

### 5.2 Column auto-detection (Pass 1, deterministic)

1. **Identify the pay-code column.**
   - Score each column header against `pay_code_aliases` rows where `pattern_kind = 'header_name'`.
   - Tie-break by the column's value cardinality (the pay-code column typically has 10–50 distinct values per pay period — not 1, not thousands).
   - If no header scores ≥ 0.7, defer to Pass 2 (LLM-assist) before falling through to the wizard manual-pick.
2. **Identify the gross-amount column.** Same approach (`amount`, `gross`, `pay_amount`, `value`, `Amount` patterns). Pass-2 fallback if none.
3. **Identify the employee-id, pay-period-end, work-location columns** the same way.
4. **Identify the units (hours) column** **[AMENDED 2026-05-31]** — `units`, `hours`, `Hours`, `Normal Hours Paid`, `Fixed Ordinary Weekly Hours`. Required for hours-mode in E5.4.
5. **Identify the pay-frequency column** **[AMENDED 2026-05-31]** — `pay_frequency`, `Pay Frequency`, `frequency`, `pay_cycle`. Pass-2 fallback if none. E5.4 spec §5 covers what happens when no frequency column exists (user declaration / inference fallback chain).

### 5.3 Value-normalisation pass (new in v0.2)

6. **For each column whose header indicates a `target_field` of `value_normalisation_aliases`** (state column, employment-type column, pay-frequency column), collect the unique surface forms and score each against `value_normalisation_aliases`.
   - `(org_id, target_field, lower(surface_form))` match → resolved silently to the org-scoped canonical value.
   - Else, `(NULL, target_field, lower(surface_form))` system-managed match → proposed in the wizard with `source = 'system_seed'` (one-click accept).
   - Else, defer to Pass 2.

### 5.4 Value-pattern detection for pay codes (Pass 1, deterministic)

7. **For each distinct raw code value seen in the file:**
   - If `(org_id, lower(raw_code))` exists in `pay_code_mappings` → resolved silently to the current mapping.
   - Else, score the raw code against `pay_code_aliases` rows where `pattern_kind` ∈ (`code_value`, `code_prefix`, `code_suffix`); highest-scoring proposal becomes the wizard's default. If no pattern scores ≥ 0.6 → defer to Pass 2.

### 5.5 LLM-assisted pass (Pass 2, new in v0.2)

8. **For every surface left unresolved by Pass 1:** the system batches them and calls Anthropic Claude API once per import (single round-trip, structured-output JSON response). Each suggestion lands in the wizard as a row with `source = 'llm_suggested'` and a confidence score. **The wizard renders these visually distinct from deterministic suggestions** — operator sees the difference, must explicitly accept or override.

   Cost-cap behaviour, opt-in vs opt-out, latency budget, and what happens when the LLM is unreachable — see open question **OQ-MAP-5** in §8.

   On accept, the system writes the resolution to the appropriate versioned table (`pay_code_mapping_versions` with `source = 'llm_suggested'`, or `value_normalisation_aliases` with `source = 'llm_suggested'` and `org_id` set). The system **never auto-promotes** an `llm_suggested` row to a system seed — operator review at platform level is the only path to system-seed promotion.

### 5.6 Wizard surface + commit

9. **Surface every unresolved surface** in the wizard (inline during first import; incremental afterwards) — sheet picks, file relationships, columns, normalisation values, pay codes — in one logical wizard journey with clear progress (e.g. step 1 of 5).
10. **On wizard commit:** for each accepted / overridden surface, write a new versioned row in the appropriate table (`pay_code_mapping_versions`, `value_normalisation_aliases`, sheet/file mappings persisted on the `imports` row). **The pay-period rows do not commit to `pay_periods` until the wizard is committed.**

**Confidence thresholds.** The 0.7 / 0.6 numbers above are seeds — calibrate in impl-plan against real-world examples (Virtus fixture is the primary calibration target). Lower threshold = more user touches per import; higher threshold = more risk of silent mis-mapping. The wizard always shows the proposed bucket and asks for confirmation; the threshold only governs whether a proposal is made vs left blank vs sent to LLM.

**LLM in the loop — second pass only, never auto-commit.** The 2026-05-27 "no LLM in v1" decision is reopened on 2026-05-31. v1 uses deterministic pattern-match as the first pass; LLM-assisted suggestions as the second pass for surfaces below the deterministic threshold. The wizard is still the source of truth — every LLM suggestion requires explicit accept. See §3 (PDF-Removal companion reverse-coupling) and OQ-MAP-5.

---

## 6. Mapping wizard UX

### 6.1 First-import flow (inline) **[AMENDED 2026-05-31]**

After the file(s) upload and auto-detection runs, the user lands on `/app/import/{id}/wizard` — a multi-step wizard. The steps that have nothing unresolved are auto-confirmed and shown as a one-line "looks good, click to review" affordance; the user only spends time on the steps that need them.

**Step order:**

1. **File shape** (only shown if `.xlsx` multi-sheet or multi-file relational drop): pick the payroll-export sheet / confirm the file relationships. The system's proposal is pre-selected; user confirms or overrides.
2. **Columns**: confirm pay-code / amount / units / employee-id / pay-period-end / work-jurisdiction / pay-frequency columns. Pre-filled from Pass 1 + Pass 2.
3. **Value normalisation**: confirm state-name forms (`"Tasmania"` → `TAS`), employment-type prefixes (`"CA - Casual"` → `casual`), pay-frequency forms. Pre-filled where confidence is high; LLM-suggested rows marked.
4. **Pay-code mapping** (the original v0.1 wizard surface):

- Header section: "We found 23 pay codes in your file. 18 we recognise; 3 we have a suggestion for; 2 need your attention."
- A table of **every distinct code** in the import:
  - **Code** column (the raw payroll value).
  - **Suggested bucket** dropdown (pre-filled if the algorithm proposed one; otherwise blank).
  - **Sample rows** mini-cell (shows the first 3 employees + pay periods + amounts using this code — helps the user identify what the code actually is).
  - **Status pill**: `auto-mapped` (from `pay_code_aliases`), `historical` (from prior org mapping), `llm_suggested` (Pass 2 — visually distinct), `needs review` (no proposal).
- **Bulk actions**: "Accept all deterministic auto-mappings", "Accept all LLM suggestions" (separate button — operator chooses whether to trust LLM batch), "Mark all unknown as Excluded — Other" (escape hatch, surfaces a warning).
- **Commit** button (blocked until every row has a bucket).
- **Save and resume later** — saves the in-progress mappings to a draft state; the user can come back to it without re-uploading.

### 6.2 Subsequent-import flow (incremental)

After auto-detection on a later import:

- If every code resolves silently against the customer's existing `pay_code_mappings` → no wizard surface; the import proceeds straight to dry-run preview.
- If new codes appear → a banner on the dry-run page: "3 new codes need mapping before this import can commit." Click → wizard surfaces only the new codes. Existing codes are not shown.

### 6.3 Admin edit flow

Under `/app/mapping/`:

- Lists all `pay_code_mappings` for the org with current bucket.
- Search / filter by code or bucket.
- Click a row → edit dialog with bucket dropdown + free-text change reason + commit. Writes a new version row. Invalidates any cached valuation/report whose captured `mapping_version_id` no longer matches current (umbrella AC5.3.5).

### 6.4 Wizard timing — inline on first import (locked 2026-05-27)

**Locked decision (2026-05-27, resolves OQ-MAP-1):** the mapping wizard runs **inline during first import** as the default UX. JSON-import-of-mapping (umbrella §5.3 MAY) remains available as the "setup first, import later" alternative for advanced users.

Reasoning:

- The customer has the CSV in hand when they're ready to import.
- A separate pre-import setup step requires them to predict every code they'll ever see, which they can't.
- Inline gives them the actual list and lets them map it once.
- If the customer wants to prep the mapping ahead of time, they can use the JSON import path (umbrella §5.3 MAY) — that's the equivalent of "setup first, import later". This path is for advanced users (e.g. a consultant migrating a mapping from another platform).

This decision is final for v1. See §7 *Locked decisions*.

---

## 7. Acceptance criteria

- **AC-MAP-1** Auto-detection identifies the pay-code column from the CSV header with ≥ 90% accuracy on a fixture set of 10 representative real-world payroll exports (assembled by PM ahead of impl-plan).
- **AC-MAP-2** Auto-detection proposes a bucket for every code that matches a `pay_code_aliases` row scoring ≥ 0.6.
- **AC-MAP-3** The mapping wizard surfaces every unmapped code on first import; commit is blocked until every code has a bucket.
- **AC-MAP-4** On subsequent imports, codes already mapped flow through without wizard surface; only new codes prompt the wizard.
- **AC-MAP-5** Every mapping change (create, edit, archive) writes a `pay_code_mapping_versions` row with `created_by`, `created_at`, `source`, `change_reason` (optional), and the prior version is closed via `effective_to`.
- **AC-MAP-6** A valuation request for an employee whose relevant pay history contains an unmapped code returns a structured error containing `{ kind: 'unmapped_codes', codes: [...] }` and a link to the wizard. Verified by automated test.
- **AC-MAP-7** A valuation persists `mapping_version_id` for every distinct code in its averaging window (covered jointly with E5.5 AC5.5.2 — this spec's contribution is the column surface).
- **AC-MAP-8** Per-state bucket treatment is preserved at the engine layer — a code mapped to "Penalty Rates" counts as ordinary pay when valuing a QLD or TAS employee and is excluded for NSW/VIC/WA/SA/ACT/NT (umbrella AC5.3.4). This is an engine-layer test; this spec's contribution is delivering the bucket value to the engine.
- **AC-MAP-9** Editing an existing mapping (admin only) invalidates any cached valuation/report whose captured `mapping_version_id` no longer matches current — verified by automated test on the cache layer (E5.5).
- **AC-MAP-10** JSON export of a customer's current mappings produces a portable file that can be JSON-imported into a different org with identical resulting `pay_code_mappings` rows (one wizard skip per re-imported code).
- **AC-MAP-11** RLS prevents a user in Org 1 from reading or writing any row in `pay_code_mappings` or `pay_code_mapping_versions` belonging to Org 2, validated by automated cross-tenant security tests in CI.
- **AC-MAP-12** `pay_code_aliases` is read-only at the API surface (no org-writable mutation path).
- **AC-MAP-13** **[AMENDED 2026-05-31]** Excel multi-sheet ingestion — `.xlsx` and `.xlsm` files upload successfully; the wizard surfaces a sheet-picker when more than one sheet exists and the system's first-choice score is below the configured threshold or when OQ-MAP-6 resolves "always show". On commit, the chosen sheet name is persisted on the `imports` row so a re-import remembers the prior selection. Verified against the Virtus 3-sheet `.xlsx` fixture (Sheet3 is the payroll-export shape).
- **AC-MAP-14** **[AMENDED 2026-05-31]** Multi-file relational ingestion — uploading 2–4 related files (e.g. `PayHistory` + `PayRateHistory` + `PositionHistory`) is accepted; the wizard surfaces a relationship-picker showing the proposed join key (typically `Employee ID`). On commit, the file relationship is persisted on the `imports` row. Verified against the Virtus 3-CSV fixture set.
- **AC-MAP-15** **[AMENDED 2026-05-31]** Value normalisation — long-form state names (`"Tasmania"` → `TAS`, `"Victoria"` → `VIC`, all 8 jurisdictions × long-form), prefixed employment-type codes (`"CA - Casual"` → `casual`, `"FP - Full Time Salaried"` → `full_time`, `"PT - Part-time Salary"` → `part_time`, hyphen + whitespace variants), and pay-frequency words (`"Weekly"` → `weekly`, `"Bi-weekly"` → `fortnightly`) are recognised via system-managed `value_normalisation_aliases`; the wizard surfaces every unrecognised form before commit. Verified against the Virtus payroll-export sheet (Sheet3 of the canonical fixture — 12 distinct employment-type values, 7 long-form state values).
- **AC-MAP-16** **[AMENDED 2026-05-31]** LLM-assisted second pass — for every surface left unresolved after Pass 1 (deterministic), Anthropic Claude API is invoked once per import; the response populates the wizard with `source = 'llm_suggested'` rows visually distinct from deterministic suggestions. The wizard requires explicit acceptance per LLM row (or via the explicit "Accept all LLM suggestions" bulk button). Cost-cap, latency budget, opt-in behaviour, and unreachable-LLM fallback resolved per OQ-MAP-5. No LLM call is ever made for a surface the deterministic pass already resolved with confidence ≥ threshold. Verified by paired-fixture: same import with `ANTHROPIC_API_KEY` set vs unset — LLM-set version surfaces additional proposals, unset version falls through cleanly to manual wizard pick for the same surfaces.

---

## 7a. Locked decisions (formerly open)

These were flagged as open questions in the 2026-05-27 first-pass scoping and were resolved by the operator on 2026-05-27.

| ID | Decision | Locked on | Rationale |
|---|---|---|---|
| **OQ-MAP-1** | **Inline on first import** is the default mapping wizard UX. JSON-import-of-mapping (umbrella §5.3 MAY) remains available as the "setup first, import later" alternative for advanced users (e.g. a consultant migrating a mapping from another platform). | 2026-05-27 | Customers have the CSV in hand when they're ready to import. A separate pre-import setup step would require them to predict every code they'll ever see, which they can't. Inline gives them the actual list and lets them map it once. Operator agreed with PM recommendation in §6.4. |

---

## 8. Open questions

### Open since v0.1 (2026-05-27) — unchanged

| ID | Question | PM recommendation |
|---|---|---|
| **OQ-MAP-2** | Confidence threshold for auto-detection (currently 0.7 for column-header, 0.6 for code-value). Tune now or after pilot? | PM recommendation: **ship the seed values, recalibrate post-pilot.** Pattern table will accumulate real data. |
| **OQ-MAP-3** | Should the wizard show what the bucket *means* per state, given the engine resolves per-state treatment? E.g. inline tooltip: "Penalty Rates: counts as ordinary pay in QLD and TAS, excluded elsewhere." | PM recommendation: **yes, as a small "what this means" link**, deferred to UX polish. Not a launch gate. |
| **OQ-MAP-4** | Does the system seed `pay_code_aliases` ship with content tailored to specific payroll vendors (Xero, MYOB, KeyPay)? | PM recommendation: **no in v1 — keep seed generic** to avoid signalling vendor support. Vendor-specific aliases are a v1.1 enhancement, possibly bundled with E4 vendor connectors. |

### Locked 2026-06-01 (formerly v0.2 open)

**Numbering note:** The 2026-05-31 amendment scope in `docs/product/epics.md` listed these as `OQ-MAP-2` and `OQ-MAP-3` — but those IDs are already in use in this spec for unrelated questions. They were renumbered to **OQ-MAP-5 / OQ-MAP-6**. A third question, **OQ-MAP-7**, was surfaced during amendment drafting (PII strip on Excel sheets the customer didn't pick). All three locked by operator 2026-06-01.

| ID | Question | Decision | Locked on |
|---|---|---|---|
| **OQ-MAP-5** | LLM-assisted column/value mapping — opt-in vs default-on; cost-cap; latency budget; `ANTHROPIC_API_KEY` unset behaviour. | **LOCKED 2026-06-01 — PM recommendation accepted.** **Default-on with per-org opt-out toggle** on the org settings page. **Cost-cap: $0.05 per import** (single batched call; prompt fits in one round-trip). **Latency budget: 10 seconds** — if Anthropic doesn't respond in that window, fall through to manual wizard with a soft notice. When `ANTHROPIC_API_KEY` is unset, no LLM call is attempted, no error raised; wizard surfaces "LLM assistance unavailable — proceeding with deterministic suggestions only" and user picks manually. | 2026-06-01 |
| **OQ-MAP-6** | Excel multi-sheet sheet-picker — unconditional confirmation vs skip-when-decisive? | **LOCKED 2026-06-01 — PM recommendation accepted.** **Show the sheet-picker on first import unconditionally** (onboarding customer benefits from explicit confirmation). On subsequent imports from the same uploader against the same file signature, **skip the picker** and use the prior choice silently. The `imports` row persists the sheet-name choice for re-import detection. | 2026-06-01 |
| **OQ-MAP-7** | For `.xlsx` files, are sheets the customer did NOT select also scanned for PII (TFN / bank / super patterns)? | **LOCKED 2026-06-01 — PM recommendation accepted.** **Scan ALL sheets for PII column names at upload time.** Refuse to store the source file (or store it with offending sheets stripped) if any sheet contains a known PII header. Defence-in-depth aligns with the per-value regex flag pattern already specced. | 2026-06-01 |

---

## 9. Risks and dependencies

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RM-1 | Auto-detection mis-maps a code silently and a valuation runs against a wrong bucket. | High | Wizard **never auto-commits** — the customer must accept every proposal. The wizard's "accept all auto-mappings" button is a deliberate one-click confirmation, not a silent commit. AC-MAP-3 covers this. |
| RM-2 | Mapping change after a valuation has been run produces an inconsistent historical valuation. | High | Valuations capture `mapping_version_id` (AC-MAP-7). Replays resolve against captured versions, not current. AC-MAP-9 covers cache invalidation. |
| RM-3 | A customer renames codes between imports (e.g. "OT15" → "OT_15X"). | Medium | Both codes are independent rows in `pay_code_mappings`; both versions live in `pay_code_mapping_versions`. Forward pay periods carry the new code → uses new mapping. Historical pay periods carry the old code → use the old mapping. No data loss. |
| RM-4 | Code with an unfortunate name shadows a PII pattern (e.g. a customer has a real pay code `TFN_ADJ` for "Tax File Number adjustment"). | Low | The TFN strip rule is on **column** names, not pay-code **values**. Pay-code values are never matched against PII patterns. Wizard would show this code as `needs review`. |
| RM-5 | The bucket taxonomy itself shifts (umbrella spec §6 adds / removes buckets). | Medium | Bucket additions are a single migration: new enum value. Bucket removal would require mapping migration (re-map every code to the surviving buckets) — this is a deliberate decision by the platform team and would be coordinated with engine team. Stable interface assumed for v1. |
| RM-6 | A customer never accepts a wizard proposal and abandons the import mid-flow. | Low | Draft state (§6.1 "Save and resume later") preserves work. Abandoned drafts older than 30 days are auto-cleaned (impl detail). |
| RM-7 | The customer's CSV contains a `pay_code` column with mixed-case values (`OT15` and `ot15`) that should map identically. | Low | `UNIQUE (org_id, lower(raw_code))` constraint normalises case at the mapping layer. Pay-period rows preserve case; lookup normalises. |

---

## 10. References

- `.specify/features/005-lsl-platform/spec.md` v1.0 §5.3, §6 (bucket taxonomy), §8 AC5.3.*.
- `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md` — E5.2 foreign-key target.
- `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md` — E5.4 consumer of this mapping layer.
- `website/src/lib/lsl/engine/normalise.ts` — engine input normalisation; the bucket → state treatment lives below this layer.
- `docs/research/lsl-pay-components-deep-research.md` v2.0 — canonical pay-bucket reference, source of umbrella spec §6.
- **[AMENDED 2026-05-31]** `~/Downloads/Virtus Health - LSL calculation/Sample run/` — canonical real-world test fixture set surfacing the structural gaps this amendment closes. Two shapes:
  - `Virtus Health LSL - Sample run.xlsx` (3 sheets: 1,386 / 1,717 / 1,384 rows) — reconciliation-summary shape; Sheet3 holds payroll-export columns with long-form states + prefixed employment types.
  - `Virtus SAMPLE PayHistorySampleFile(in).csv` + `…PayRateHistorySampleFile(in).csv` + `…PositionHistorySampleFile(in).csv` — the richer 3-CSV relational shape (per-period `Pay Code` + `Units` + `Amount` + `Pay Run`; effective-dated rate history; effective-dated position history). Dev impl plan treats this as the canonical multi-file relational fixture; the `.xlsx` is the canonical Excel-multi-sheet fixture.

---

*End of E5.3 sub-spec — v0.1 scoped 2026-05-27, OQ-MAP-1 locked 2026-05-27. v0.2 amended 2026-05-31; **OQ-MAP-5 / OQ-MAP-6 / OQ-MAP-7 LOCKED 2026-06-01**. Spec is LOCKED — ready for impl-plan + tasks generation.*
