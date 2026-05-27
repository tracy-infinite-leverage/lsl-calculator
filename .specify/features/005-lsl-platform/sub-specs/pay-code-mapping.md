# Feature Specification — LSL Platform · E5.3 Pay-Code Mapping (Column Auto-Detection + Wizard)

**Slug:** `lsl-platform-pay-code-mapping`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** **E5.3 · Pay-Code Mapping**
**Status:** **Scoped — APPROVED 2026-05-27** (operator decisions captured 2026-05-27; refined 2026-05-27 with locked decision on OQ-MAP-1)
**Author:** Product Manager (drafted 2026-05-27 from operator scoping brief 2026-05-27; locked-decisions update 2026-05-27)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** **E5.1 Auth + Tenancy + DB Scaffold** (RLS primitives) and **E5.2 Employee Masterfile** (foreign-key target for the customer's mapping table). E5.4 ingestion is the **consumer** of this layer (mapping must exist before pay periods can be valued).
**Sequence within E5:** Third after E5.1 + E5.2. E5.4 ingestion runs against this mapping layer.

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

The platform's ingestion pipeline is `customer CSV → raw pay codes → org-wide mapping → LSL buckets → engine input`. The mapping layer is where customer-specific payroll vocabulary (e.g. "OT15", "PUBHOL", "BONUS-Q4") becomes the deterministic bucket taxonomy the engines consume.

Three components:

1. **Auto-detection** — when a new CSV uploads (E5.4), the system inspects column headers and the distinct values seen in the `pay_code` column, scores each against known patterns + the customer's historical mappings, and **proposes** a mapping for each unfamiliar code.
2. **Mapping wizard** — a UI surface where the customer reviews proposed mappings, accepts / overrides them, and commits. The wizard runs **inline during first import** (covering the entire initial code list) and **incrementally on subsequent imports** (only covering codes the system hasn't seen for this customer).
3. **Versioned mapping store** — every change writes a new version row; the live mapping is the latest version per `(org_id, raw_code)`. A valuation references the mapping version that was current at the time the valuation ran, so historical valuations can be replayed against the mapping they actually used.

**Critical invariant.** A valuation cannot run for an employee whose relevant pay history contains any **unmapped** raw code. The platform returns a blocking error listing the unmapped codes and routes the user to the wizard. This is the umbrella spec's §5.3 MUST.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this sub-spec adds |
|---|---|---|
| Pay bucket taxonomy | Defined in umbrella spec §6 — fixed list of LSL buckets (Ordinary Time, Overtime — Regular, Overtime — Ad-hoc, Penalty Rates, Commission, Bonus — Discretionary, Bonus — Contractual, All-purpose Allowance, Single-purpose Allowance, Casual Loading, Leave — Annual / Personal / LSL / Workers Comp / Unpaid Parental / Unpaid Other, Termination Payment — LSL / Other, Excluded — Other). Engine layer applies per-state treatment. | This sub-spec exposes the bucket taxonomy as an enum in the mapping table. Bucket → engine treatment is unchanged. |
| Customer mapping | None. The public calc has no concept of per-customer mapping. | New tables: `pay_code_mappings`, `pay_code_mapping_versions`, `pay_code_aliases` (the auto-detection knowledge base). |
| Column auto-detection | `/api/normalize-csv` exists in the public calc (LLM-based) — being **deleted** by the PDF Removal sub-spec. | A new deterministic auto-detection layer based on header-name patterns and historical mappings. **No LLM dependency.** |
| Mapping wizard UI | None. | New `/app/mapping/*` surface. |

---

## 3. Scope boundary — v1 vs deferred

### In scope for v1

- `pay_code_mappings` table (current live mapping per `(org_id, raw_code)`).
- `pay_code_mapping_versions` table (full audit trail of every change).
- `pay_code_aliases` table (system-level knowledge base of known header / code patterns → suggested bucket).
- Auto-detection at import time:
  - **Column-header detection** — identifies which CSV column carries the pay code (e.g. `pay_code`, `earnings_code`, `payment_type`).
  - **Value-pattern detection** — for each distinct raw code value, scores against the customer's historical mappings (highest priority) and the system alias table (fallback).
- Mapping wizard UI:
  - Inline on first import — surfaces every distinct unmapped code with a proposed mapping (or "unknown" if no proposal); customer accepts / overrides; commits in one batch.
  - Incremental on subsequent imports — surfaces only new codes; existing codes flow through silently.
- Versioned mapping store — every change creates a new `pay_code_mapping_versions` row; the live row in `pay_code_mappings` is replaced.
- Admin-only edit of existing mapping (post-commit) — also versioned.
- Block-valuation rule (umbrella AC5.3.3) — surfaced as a structured error pointing to the wizard.
- Mapping export as JSON (umbrella §5.3 MAY).

### Out of scope for v1 (deferred)

- LLM-assisted mapping suggestions (umbrella spec — deferred to v1.1).
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

---

## 5. Auto-detection algorithm (v1, deterministic)

When a customer uploads a CSV in E5.4 ingestion, the system:

1. **Identify the pay-code column.**
   - Score each column header against `pay_code_aliases` rows where `pattern_kind = 'header_name'`.
   - Tie-break by the column's value cardinality (the pay-code column typically has 10–50 distinct values per pay period — not 1, not thousands).
   - If no header scores ≥ 0.7, the wizard prompts the customer to pick the column manually.
2. **Identify the gross-amount column.** Same approach (`amount`, `gross`, `pay_amount`, `value` patterns). Manual fallback if none.
3. **Identify the employee-id, pay-period-end, work-location columns** the same way.
4. **For each distinct raw code value seen in the CSV:**
   - If `(org_id, lower(raw_code))` exists in `pay_code_mappings` → resolved silently to the current mapping.
   - Else, score the raw code against `pay_code_aliases` rows where `pattern_kind` ∈ (`code_value`, `code_prefix`, `code_suffix`); highest-scoring proposal becomes the wizard's default. If no pattern scores ≥ 0.6 → wizard shows "unknown" and forces the user to pick.
5. **Surface every unresolved code** in the wizard (inline during first import; incremental afterwards).
6. **On wizard commit:** for each accepted / overridden code, write a new `pay_code_mapping_versions` row and update `pay_code_mappings.current_version_id`. **The pay-period rows do not commit to `pay_periods` until the wizard is committed.**

**Confidence thresholds.** The 0.7 / 0.6 numbers above are seeds — calibrate in impl-plan against real-world examples. Lower threshold = more user touches per import; higher threshold = more risk of silent mis-mapping. The wizard always shows the proposed bucket and asks for confirmation; the threshold only governs whether a proposal is made vs left blank.

**No LLM in the loop.** v1 auto-detection is pure pattern-match. v1.1 may layer LLM-assisted suggestions on top (umbrella spec — deferred). If/when that lands, it writes to the same `pay_code_mapping_versions` table with `source = 'llm_suggested'`.

---

## 6. Mapping wizard UX

### 6.1 First-import flow (inline)

After the CSV uploads and auto-detection runs, the user lands on `/app/import/{id}/mapping`:

- Header section: "We found 23 pay codes in your file. 18 we recognise; 5 need your attention."
- A table of **every distinct code** in the import:
  - **Code** column (the raw payroll value).
  - **Suggested bucket** dropdown (pre-filled if the algorithm proposed one; otherwise blank).
  - **Sample rows** mini-cell (shows the first 3 employees + pay periods + amounts using this code — helps the user identify what the code actually is).
  - **Status pill**: `auto-mapped` (from `pay_code_aliases`), `historical` (from prior org mapping), `needs review` (no proposal).
- **Bulk actions**: "Accept all auto-mappings", "Mark all unknown as Excluded — Other" (escape hatch, surfaces a warning).
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

---

## 7. Locked decisions (formerly open)

These were flagged as open questions in the 2026-05-27 first-pass scoping and were resolved by the operator on 2026-05-27.

| ID | Decision | Locked on | Rationale |
|---|---|---|---|
| **OQ-MAP-1** | **Inline on first import** is the default mapping wizard UX. JSON-import-of-mapping (umbrella §5.3 MAY) remains available as the "setup first, import later" alternative for advanced users (e.g. a consultant migrating a mapping from another platform). | 2026-05-27 | Customers have the CSV in hand when they're ready to import. A separate pre-import setup step would require them to predict every code they'll ever see, which they can't. Inline gives them the actual list and lets them map it once. Operator agreed with PM recommendation in §6.4. |

---

## 8. Open questions

| ID | Question | PM recommendation |
|---|---|---|
| **OQ-MAP-2** | Confidence threshold for auto-detection (currently 0.7 for column-header, 0.6 for code-value). Tune now or after pilot? | PM recommendation: **ship the seed values, recalibrate post-pilot.** Pattern table will accumulate real data. |
| **OQ-MAP-3** | Should the wizard show what the bucket *means* per state, given the engine resolves per-state treatment? E.g. inline tooltip: "Penalty Rates: counts as ordinary pay in QLD and TAS, excluded elsewhere." | PM recommendation: **yes, as a small "what this means" link**, deferred to UX polish. Not a launch gate. |
| **OQ-MAP-4** | Does the system seed `pay_code_aliases` ship with content tailored to specific payroll vendors (Xero, MYOB, KeyPay)? | PM recommendation: **no in v1 — keep seed generic** to avoid signalling vendor support. Vendor-specific aliases are a v1.1 enhancement, possibly bundled with E4 vendor connectors. |

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

---

*End of E5.3 sub-spec — scoped 2026-05-27, OQ-MAP-1 locked 2026-05-27, awaiting dev impl plan.*
