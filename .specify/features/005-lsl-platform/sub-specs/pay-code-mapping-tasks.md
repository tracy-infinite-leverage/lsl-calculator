# Tasks — E5.3 · Pay-Code Mapping (v0.2 LOCKED)

**Spec:** `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` (v0.2 LOCKED 2026-06-01)
**Plan:** `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md` v1.0
**Generated:** 2026-06-01

**Legend:**
- `[P]` — parallelisable (no in-phase dependency).
- Sizes: S (≤ 4h), M (≤ 1 day), L (1–2 days), XL (2+ days).
- AC links reference acceptance criteria in the spec §7.

---

## Phase 0 — Pre-work + fixture assembly

### T0.1 — Confirm E5.2 schema final · S ✅ [x] (2026-06-02 — Phase 1 all 7 migrations live in prod; schema FK target available)
**Acceptance:** E5.2 PR #105 merged or schema confirmed stable; `employees` table columns `external_id` + RLS pattern available as FK target. Block Phase 1 until done.
**AC:** Foundation for AC-MAP-3 / AC-MAP-11.
**Owner:** Developer (10 min schema check).

### T0.2 — Stage Virtus fixtures · S [P] ✅ [x] (2026-06-02 — committed `273ec2d`; 5 fixture files anonymised + staged under `tests/fixtures/pay-code-mapping/virtus/`)
**Acceptance:** Files copied from `~/Downloads/Virtus Health - LSL calculation/Sample run/` into `tests/fixtures/pay-code-mapping/virtus/`. Includes 3-sheet `.xlsx` + 3 relational CSVs. Anonymised review pass (assert no obvious PII leaks survive — Virtus is a real customer).
**AC:** AC-MAP-13 + AC-MAP-14 + AC-MAP-15 fixture readiness.

### T0.3 — Assemble 10-fixture real-world set · M [P] ✅ [x] (2026-06-02 — committed `273ec2d`; 10 synthetic-but-representative fixtures spanning Xero/MYOB/KeyPay/ADP/Employment Hero shapes)
**Acceptance:** 10 representative payroll exports under `tests/fixtures/pay-code-mapping/realworld/` covering Xero / MYOB / KeyPay / ADP / Employment Hero shapes. PM-curated.
**AC:** AC-MAP-1 (≥ 90% accuracy threshold target).

### T0.4 — Define paired-fixture test harness · S [P] ✅ [x] (2026-06-02 — committed `273ec2d`; skeleton at `tests/lsl/mapping/llm-paired.test.ts`, assertions land Phase 3)
**Acceptance:** `tests/lsl/mapping/llm-paired.test.ts` skeleton that loads the same fixture twice — once with `ANTHROPIC_API_KEY` env set, once with it cleared — asserts proposal-set divergence. Skeleton only; real assertions land with Phase 3.
**AC:** AC-MAP-16 readiness.

---

## Phase 1 — Data layer + seeds (foundation; blocks Phase 2+)

### T1.1 — Migration: `pay_code_mappings` + `pay_code_mapping_versions` · M ✅ [x] (2026-06-02 — committed `9b41b78`; applied to Supabase branch `oahgcmqlqdfeqfibsfej` v`20260602021051`; advisors clean — zero new security lints)
**Acceptance:**
- Tables created per spec §4.1 + §4.2.
- RLS policies enabled: `org_id = (auth.jwt() ->> 'org_id')::uuid` on SELECT / INSERT / UPDATE.
- Versioning-invariant trigger: exactly-one-row-with-`effective_to IS NULL` per `(org_id, lower(raw_code))`.
- `UNIQUE (org_id, lower(raw_code))` constraint on `pay_code_mappings`.
- Migration files committed to `website/supabase/migrations/`.
**AC:** AC-MAP-5, AC-MAP-7, AC-MAP-11.
**Depends:** T0.1.

### T1.2 — Migration: `pay_code_aliases` + system seed · M [P after T1.1] ✅ [x] (2026-06-02 — committed `bb74d78`; applied v`20260602021306`; 71-row system seed loaded; advisors clean)
**Acceptance:**
- Table created per spec §4.3 (read-only RLS — `pay_code_aliases` is globally readable; INSERT/UPDATE denied at policy level).
- Seed migration `pay_code_aliases_seed.sql` with ~60 rows covering: ordinary (`ORD*`, `ORDINARY*`), overtime (`OT*`, `*-OT`), penalty (`PEN*`, `*PEN*`), commission (`COMM*`), bonus (`BON*`), leave (`LSL*`, `WC*`, `PARENTAL*`, `ANN_LV*`, `PERS_LV*`), casual loading (`CAS_LOAD`, `25_LOAD`), termination (`TERM*`, `ETP_*`), PII-strip patterns (`TFN`, `TAX_FILE*`, `BSB`, `BANK_ACC*`, `SUPER_MEMBER*`).
- Each row carries `confidence` 0.6–0.95 calibrated against the 10-fixture set.
**AC:** AC-MAP-2, AC-MAP-12.

### T1.3 — Migration: `value_normalisation_aliases` + `value_normalisation_aliases_versions` · M [P after T1.1] ✅ [x] (2026-06-02 — committed `1f497ca`; applied v`20260602021511`; both tables created with versioning trigger mirroring T1.1 pattern; advisors clean)
**Acceptance:**
- Tables created per spec §4.4. Versioning via parallel `_versions` table (NOT shared with `pay_code_mapping_versions`).
- RLS: org-scoped rows visible to that org only; system rows (`org_id IS NULL`) read-only globally.
- Versioning trigger mirrors T1.1 pattern.
**AC:** AC-MAP-15 foundation.

### T1.4 — Seed `value_normalisation_aliases` system rows · M [P after T1.3] ✅ [x] (2026-06-02 — committed `be8b312`; applied v`20260602045645`; 66 system rows seeded — 26 jurisdictions + 27 employment-type prefixes + 13 pay-frequency words at confidence 0.95/0.90; advisors clean)
**Acceptance:** Seed migration with rows for:
- **States** (`target_field = 'work_jurisdiction'`): 8 jurisdictions × `{long-form, short-form, common typo}` ≈ 28 rows. Examples: `Tasmania` → `TAS`, `Tas` → `TAS`, `TAS` → `TAS`, `Tasmainia` → `TAS`.
- **Employment types** (`target_field = 'employment_type'`): ~30 rows. Prefixed: `CA - Casual` → `casual`, `FP - Full Time Salaried` → `full_time`, `FT - Full Time` → `full_time`, `PT - Part Time` → `part_time`, `PT - Part-time Salary` → `part_time`. Hyphenless variants for each.
- **Pay frequencies** (`target_field = 'pay_frequency'`): `weekly` → `weekly`, `Weekly` → `weekly`, `fortnightly` → `fortnightly`, `bi-weekly` → `fortnightly`, `monthly` → `monthly`, `4-weekly` → `4-weekly`, `4 weekly` → `4-weekly`.
- All rows ship at `confidence = 0.95`, `source = 'system_seed'`.
**AC:** AC-MAP-15.

### T1.5 — Migration: extend `imports` with wizard state columns · S [P after T1.1] ⏸ [DEFERRED 2026-06-02 to E5.4 Phase 1] — the `imports` table is owned by E5.4 and does not yet exist on the Supabase branch. T1.5 will land alongside E5.4 Phase 1 imports-table creation (E5.4 builds the table WITH these E5.3 columns from the start) rather than E5.3 stubbing the table. T1.5's columns are not needed by E5.3 Phase 2 (auto-detection Pass 1) so the deferral is non-blocking.
**Acceptance:**
- Add columns to `imports` (defined in E5.4 §4.1 — additive, no breaking change):
  - `wizard_state JSONB DEFAULT '{}'::jsonb`
  - `sheet_name TEXT` (Excel sheet picker result)
  - `file_relationship JSONB` (multi-file relationship picker result)
  - `llm_cost_estimated NUMERIC(6,4) DEFAULT 0`
  - `llm_cost_actual NUMERIC(6,4) DEFAULT 0`
- Migration noted as cross-spec — E5.4 references this row but E5.3 owns these particular columns.
**AC:** AC-MAP-13 + AC-MAP-14 persistence layer.

### T1.6 — Migration: `orgs.llm_assist_enabled` opt-out toggle · S [P after T1.1] ✅ [x] (2026-06-02 — committed `59a0692`; applied as `orgs_llm_assist_enabled`; single additive ALTER TABLE; advisors clean)
**Acceptance:** `ALTER TABLE organisations ADD COLUMN llm_assist_enabled BOOLEAN NOT NULL DEFAULT true`. Org admin UI surface added in Phase 4.
**AC:** AC-MAP-16 + OQ-MAP-5 lock (default-on with opt-out).

### T1.7 — Regenerate TypeScript types + export from `website/src/lib/db/types.ts` · S ✅ [x] (2026-06-02 — committed `6dee75c`; first Database-typed file in project; 756 lines incl. convenience aliases `MappingRow`/`MappingVersionRow`/`PayCodeAliasRow`/`ValueNormaliseAliasRow`/`ValueNormaliseAliasVersionRow` + E5.2 re-exports)
**Acceptance:** `mcp__supabase__generate_typescript_types` run after T1.1–T1.6 land. Resulting `Database` type exported. Imports of `MappingRow` / `MappingVersionRow` / `ValueNormaliseAliasRow` available across `website/src/lib/`.
**Depends:** T1.1, T1.2, T1.3, T1.4, T1.5, T1.6.

### T1.8 — Cross-tenant RLS test suite · M [P] ✅ [x] (2026-06-02 — committed `5a353c8`; suite at `website/src/__tests__/db-rls/pay-code-mapping.test.ts` covers all 4 org-scoped E5.3 tables × SELECT/INSERT/UPDATE cross-tenant assertions; `pay_code_aliases` excluded as system-managed read-only; runs against remote lsl-platform per E5.1 DEV-AUTH-4 precedent)
**Acceptance:** `tests/db/rls/pay-code-mapping.test.ts` — for each new table, paired test asserts Org A user CANNOT SELECT/INSERT/UPDATE Org B rows. Test suite runs in CI on every push.
**AC:** AC-MAP-11.
**Depends:** T1.7.

---

## Phase 2 — Auto-detection Pass 1 (deterministic; blocks E5.4 ingestion wire-up)

### T2.1 — Scaffold `website/src/lib/lsl/mapping/detect/` · S ✅ [x] (2026-06-05 — folder + barrel exports + four typed pure-function skeletons + `types.ts` + `scaffold.test.ts` smoke test; tsc/eslint/test/build all clean; T2.2–T2.5 will fill bodies behind these contracts)
**Acceptance:** Folder + barrel exports + module skeletons (`file-shape.ts`, `columns.ts`, `value-normalise.ts`, `pay-codes.ts`). Each exports a typed pure function signature.
**Depends:** T1.7.

### T2.2 — Implement file-shape detection · M
**Acceptance:**
- `detectFileShape(files) → { shape: 'csv'|'excel-single'|'excel-multi'|'multi-file-relational', sheets?: SheetInfo[], proposedSheet?: string, fileRelationship?: { joinKey, primary, companions } }`.
- Sheet-signature scoring against `pay_code_aliases` `pattern_kind = 'header_name'`.
- Multi-file join-key resolution — identifies shared column (typically `Employee ID`).
- Unit tests: Virtus 3-sheet Excel returns `excel-multi` with Sheet3 as `proposedSheet`. Virtus 3-CSV set returns `multi-file-relational` with `joinKey = 'Employee ID'`.
**AC:** AC-MAP-13, AC-MAP-14.
**Depends:** T2.1, T0.2.

### T2.3 — Implement column auto-detection · M [P]
**Acceptance:**
- `detectColumns(headers, sampleRows, aliases) → { payCode?: ColumnRef, amount?, units?, employeeId?, periodEnd?, jurisdiction?, frequency? }` each with `confidence`.
- Tie-break via value-cardinality heuristic (pay-code columns have 10–50 distinct values per period).
- Threshold-gating per spec §5.2 (≥ 0.7 → propose; else defer to Pass 2).
- Unit tests against the 10-fixture set — assert ≥ 90% accuracy on pay-code column identification.
**AC:** AC-MAP-1.
**Depends:** T2.1, T0.3.

### T2.4 — Implement value-normalisation detection · M [P]
**Acceptance:**
- `detectValueNormalisations(column, aliases) → ProposalRow[]`.
- For state / employment-type / pay-frequency columns: scan unique surface forms.
- Org-scoped rows shadow system rows (per spec §4.4).
- **OQ-ING-9 / OQ-MAP-9 lock implementation [REVISED 2026-06-01 post PR #105 schema verification]**: Cohort is **derived at runtime** from per-pay-period `work_jurisdiction` values — NOT stored as a `states[]` array on the employee row. When the detector encounters a column whose header pattern matches `cohort` or whose values contain hyphenated state pairs like `VIC-TAS`, it:
  1. Splits on `-` and validates each side against the state aliases (for parsing-confidence scoring + early ingestion-time validation of cross-jurisdiction employees).
  2. Returns the cohort label as a **`crossJurisdictionFlag`** annotation on the employee row — flagging the system to expect work_jurisdiction values from each parsed state in subsequent pay-period ingestion.
  3. Does NOT return a `states: ['VIC', 'TAS']` array as a target field on `employees` — the merged schema has singular `default_work_jurisdiction`, and `pay_periods.work_jurisdiction` is the authoritative per-period state at valuation time. The canonical distinct-jurisdictions set per employee is derived from their pay-period rows at valuation time (E5.5 engine input).
  4. Document this branch in the function's JSDoc — explicit reference to OQ-ING-9 / OQ-MAP-9 lock + the PR #105 verified architecture.
- Unit tests: Virtus state values (`Tasmania`, `Victoria`, etc.) resolve to canonical 8-code enum. Virtus employment types (`CA - Casual`, `FP - Full Time Salaried`, etc.) resolve to masterfile enum.
- **OQ-ING-9 / OQ-MAP-9 test**: `Cohort` column with value `VIC-TAS` returns a proposal row carrying `{ crossJurisdictionFlag: true, hintedJurisdictions: ['VIC', 'TAS'] }` — NOT a stored `states` array. The hinted jurisdictions are used by Phase 2 ingestion to validate that subsequent pay-period work_jurisdiction values for this employee fall within the hinted set; downstream they are not persisted as an employee-level field.
**AC:** AC-MAP-15.
**Depends:** T2.1, T1.4.

### T2.5 — Implement pay-code value-pattern detection · M [P]
**Acceptance:**
- `detectPayCodes(distinctCodes, orgMappings, aliases) → ProposalRow[]`.
- Existing-org-mapping match → silent resolution (status `historical`).
- Else score against `pay_code_aliases` `pattern_kind ∈ (code_value, code_prefix, code_suffix)`.
- Below 0.6 → defer to Pass 2.
- Unit tests: against the 10-fixture set, assert recall + precision on the seeded pattern set.
**AC:** AC-MAP-2.
**Depends:** T2.1, T1.2.

### T2.6 — Calibration sweep + threshold validation · S
**Acceptance:** Run all detect modules against the 10-fixture set; assert AC-MAP-1 (≥ 90% pay-code column accuracy). If below, tune seed `confidence` values in `pay_code_aliases` (NOT thresholds — thresholds are pinned per spec §5).
**AC:** AC-MAP-1.
**Depends:** T2.2, T2.3, T2.4, T2.5.

### T2.7 — Integration test: full Pass 1 against Virtus 3-sheet Excel · M
**Acceptance:** End-to-end Pass 1 invocation against `tests/fixtures/pay-code-mapping/virtus/3-sheet.xlsx` produces:
- `proposedSheet = 'Sheet3'`
- 7 long-form state values resolved
- 12 employment-type prefixes resolved
- Residual pay codes flagged as `needs_review` (for Pass 2)
**AC:** AC-MAP-13, AC-MAP-15.
**Depends:** T2.2, T2.3, T2.4, T2.5.

---

## Phase 3 — Auto-detection Pass 2 (LLM-assisted; parallel with Phase 4)

### T3.1 — Anthropic client wrapper · M
**Acceptance:**
- `website/src/lib/lsl/llm/anthropic-client.ts` exports `createMappingClient(apiKey?: string)` → `{ suggest(surfaces): Promise<ProposalRow[]> }`.
- If `apiKey` absent / empty → returns no-op stub (`suggest` resolves to `[]`, no network call).
- Single batched call per import.
- Structured-output JSON schema validation on response; malformed responses return `[]` (fail-soft).
- Cost-cap pre-flight: token estimate via `tiktoken` or equivalent; abort if > $0.05 with reason `'cost_cap_exceeded'`.
- Latency budget via `AbortController` with 10s timeout; abort reason `'timeout'`.
- All abort + success outcomes returned in a structured result for audit logging.
**AC:** AC-MAP-16, OQ-MAP-5 lock.

### T3.2 — Prompt template · S
**Acceptance:**
- `website/src/lib/lsl/llm/prompts/mapping-suggest.ts` — versioned template carrying:
  - The umbrella §6 bucket enum (19 buckets) with one-line each.
  - The value-normalisation target enums (states + employment-types + pay-frequencies).
  - Input shape: `{ surfaces: [{ id, kind, raw, samples }] }`.
  - Output schema: `{ surfaces: [{ id, suggestion, confidence, reasoning }] }`.
- Prompt template version pinned (`PROMPT_VERSION = '1.0'`) for replay determinism.
**Depends:** T3.1.

### T3.3 — Cost-cap + latency gate wiring · M
**Acceptance:**
- Pre-call: token estimator → cost projection → gate. If gate trips, return empty result with reason `cost_cap_exceeded`; record in `import_audit_log` event (`llm_assist_skipped`, payload includes estimate).
- During call: `AbortController` with 10s timeout. On abort, record `llm_assist_timed_out`.
- Post-call (success): record actual cost (input tokens + output tokens × current pricing) in `imports.llm_cost_actual`.
**AC:** AC-MAP-16.
**Depends:** T3.1.

### T3.4 — Org opt-out gate · S [P]
**Acceptance:**
- Pass 2 invocation reads `orgs.llm_assist_enabled` before any client work.
- If `false`, skip Pass 2 silently; record `llm_assist_disabled_by_org` audit event.
- Org admin UI toggle added in Phase 4.
**AC:** OQ-MAP-5 lock.
**Depends:** T1.6.

### T3.5 — `ANTHROPIC_API_KEY`-unset detection + toast · S [P]
**Acceptance:**
- Module-level detection at server boot: if env var absent, set a runtime flag `LLM_ASSIST_AVAILABLE = false`.
- Wizard layout (Phase 4) reads this flag and surfaces a one-time-per-session toast: "LLM assistance unavailable — proceeding with deterministic suggestions only".
- No exceptions thrown anywhere in the LLM code path when the key is absent.
**AC:** AC-MAP-16, OQ-MAP-5 lock.

### T3.6 — Paired-fixture test (AC-MAP-16) · M
**Acceptance:** Test `tests/lsl/mapping/llm-paired.test.ts` runs Pass 1 + Pass 2 against the Virtus 3-sheet Excel:
- Run 1: `ANTHROPIC_API_KEY` set (use a recorded fixture via VCR-style replay; no live calls in CI).
- Run 2: `ANTHROPIC_API_KEY` unset.
- Assert: Run 1 has > 0 `source = 'llm_suggested'` proposals; Run 2 has 0; both runs produce a valid wizard surface (no exceptions).
**AC:** AC-MAP-16.
**Depends:** T3.1–T3.5.

### T3.7 — Update `.env.example` · S [P]
**Acceptance:** Add `ANTHROPIC_API_KEY=` with comment block explaining the soft-fall-through behaviour. Note that the var was previously removed (PDF-Removal sub-spec) and is being reinstated by E5.3 v0.2.
**Depends:** T3.5.

### T3.8 — Update `docs/launch/LAUNCH-GUARD.md` · S
**Acceptance:**
- LAUNCH-GUARD note added: `ANTHROPIC_API_KEY` is now a soft-required production env var for the platform path (`/app/import/*`). Set = LLM assist on; unset = wizard-only path, no error, soft notice to user.
- Pre-launch checklist updated to include "verify ANTHROPIC_API_KEY in Vercel Production env" as a step (was previously already there for the public calc path; re-affirmed).
**Depends:** Operator sign-off (PM coordinates).

---

## Phase 4 — Wizard UI (parallel with Phase 3)

### T4.1 — Route + layout shell · M
**Acceptance:**
- `/app/import/[id]/wizard/page.tsx` with multi-step shell (5 steps).
- Step indicator + back/next nav + "save and resume later" button.
- Layout uses shadcn + APA brand tokens (already shipped in E6).
- Server-side data fetch: load `imports.wizard_state` on mount → rehydrate step state.
**AC:** Foundation for AC-MAP-3 + AC-MAP-13 + AC-MAP-14 + AC-MAP-15 + AC-MAP-16.
**Depends:** T1.7.

### T4.2 — Step 1: File shape · M
**Acceptance:**
- Sheet picker (radio list) when `shape = 'excel-multi'`. Pre-selected with `proposedSheet`. User confirms or overrides. On confirm: persists `imports.sheet_name`.
- File relationship picker when `shape = 'multi-file-relational'`. Shows proposed join key + primary file + companion files. User confirms or overrides. On confirm: persists `imports.file_relationship`.
- Auto-skip when `shape ∈ {'csv', 'excel-single'}` (one-line "looks good" affordance, click-through allowed).
- **OQ-MAP-6 lock implementation**: sheet picker shows unconditionally on **first import for this `(org, file-signature)`** combination. On subsequent imports with the same uploader + file signature, skip the picker and use the prior `imports.sheet_name`. File signature = SHA-256 of headers across all sheets.
**AC:** AC-MAP-13, AC-MAP-14.
**Depends:** T4.1, T2.2.

### T4.3 — Step 2: Columns · M [P after T4.1]
**Acceptance:**
- Table of detected columns with confirm/edit dropdowns.
- LLM-suggested rows visually distinct: "AI suggestion" pill, different background tint.
- Required columns enforced: pay-code / amount / employee-id / period-end / jurisdiction. Frequency + units required if file is hours-mode candidate.
- Block "Next" until all required columns resolved.
**AC:** AC-MAP-1 wizard surface.
**Depends:** T4.1, T2.3, T3.1.

### T4.4 — Step 3: Value normalisation · M [P after T4.1]
**Acceptance:**
- Table of unresolved surface forms grouped by `target_field` (states / employment-types / pay-frequencies).
- For each row: surface form, proposed canonical, confidence, source pill (`system_seed` / `llm_suggested` / `needs_review`), accept/edit control.
- Bulk "Accept all system seeds" button.
- Bulk "Accept all LLM suggestions" button (separate; explicit).
- **OQ-MAP-9 multi-state handling**: rows that resolved to `states = [X, Y]` render as a multi-select pill set; user can edit the set inline.
- On commit: write accepted rows to `value_normalisation_aliases` with `org_id` set + `source = 'wizard_confirmed'` or `'llm_suggested'`.
**AC:** AC-MAP-15.
**Depends:** T4.1, T2.4, T3.1.

### T4.5 — Step 4: Pay-code mapping (the core surface) · L
**Acceptance:**
- Table per spec §6.1:
  - Code column (raw value).
  - Suggested bucket dropdown.
  - Sample rows mini-cell (first 3 employee + period + amount).
  - Status pill: `auto-mapped` / `historical` / `llm_suggested` / `needs_review`.
- Bulk actions:
  - "Accept all deterministic auto-mappings"
  - "Accept all LLM suggestions" (separate button — visually distinct from deterministic)
  - "Mark all unknown as Excluded — Other" (escape hatch with warning toast)
- Commit blocked until every row has a bucket.
- On commit: transactional write to `pay_code_mapping_versions` rows + update `pay_code_mappings.current_version_id` per code.
**AC:** AC-MAP-3, AC-MAP-5, AC-MAP-16.
**Depends:** T4.1, T2.5, T3.1.

### T4.6 — Step 5: Commit summary · M
**Acceptance:**
- Summary screen with: rows-to-commit count, new mappings count, new normalisation aliases count, residual `needs_review` count (must be zero to commit).
- Commit button: triggers transactional write across `pay_code_mapping_versions`, `value_normalisation_aliases`, `imports.status = 'pending_review'` (handing off to E5.4 dry-run preview).
- Cancel button: returns to dashboard; `imports.status = 'abandoned'` (no commits).
**AC:** AC-MAP-3, AC-MAP-5.
**Depends:** T4.2, T4.3, T4.4, T4.5.

### T4.7 — Save-and-resume persistence · S [P after T4.1]
**Acceptance:** Every step transition writes to `imports.wizard_state` JSONB. Step 1 onwards refers to this state on rehydration. Test: complete steps 1–3, refresh browser, land back on step 3 with prior decisions intact.
**Depends:** T4.1.

### T4.8 — Block-valuation error link · S [P]
**Acceptance:** When the E5.5 valuation endpoint returns `{ kind: 'unmapped_codes', codes: [...] }`, the result UI links to `/app/import/{import_id}/wizard?step=4&highlight={codes}`. The wizard step 4 reads the `highlight` query and visually highlights those rows.
**AC:** AC-MAP-6.
**Depends:** T4.5 + E5.5 error surface (cross-spec; can stub until E5.5 lands).

### T4.9 — Org-admin LLM toggle UI · S [P]
**Acceptance:** Settings page (`/app/settings/org/page.tsx`) adds a toggle bound to `orgs.llm_assist_enabled`. Admin-only (RLS + role check). Tooltip explains: "LLM assistance suggests mappings for unresolved pay codes and value-normalisation surfaces. Toggle off to use deterministic detection only. ~$0.05 per import when on."
**AC:** OQ-MAP-5 lock.
**Depends:** T1.6.

### T4.10 — E2E test: Virtus end-to-end · L
**Acceptance:** Playwright test: upload Virtus 3-sheet Excel → wizard step 1 (sheet picker) → step 2 (columns) → step 3 (normalisation) → step 4 (pay codes) → step 5 (commit) → assert DB state (rows in `pay_code_mappings`, `value_normalisation_aliases`, `imports.status = 'pending_review'`). Repeat for Virtus 3-CSV relational drop.
**AC:** AC-MAP-13, AC-MAP-14, AC-MAP-15.
**Depends:** T4.6, T0.2.

---

## Phase 5 — Admin edit + JSON import/export

### T5.1 — `/app/mapping/` list page · M
**Acceptance:** Server-rendered list of `pay_code_mappings` with search/filter by code or bucket, columns: raw_code, current bucket, last-changed-at, changed-by, archived flag. Pagination at 50 rows/page.
**AC:** AC-MAP-9.
**Depends:** T1.7.

### T5.2 — Edit dialog · M [P after T5.1]
**Acceptance:**
- Dialog: bucket dropdown + change-reason textarea + commit + cancel.
- Commit writes new `pay_code_mapping_versions` row with `source = 'admin_edit'`.
- E5.5 cache invalidation fires via trigger (not this task's responsibility — E5.5 owns the trigger; this task only ensures the write happens).
- Inline version history timeline showing every prior version for this `raw_code`.
**AC:** AC-MAP-5, AC-MAP-9.
**Depends:** T5.1.

### T5.3 — JSON export endpoint · S [P]
**Acceptance:** `/api/mapping/export` returns `{ schema_version: '1.0', org_id, exported_at, mappings: [...], normalisation_aliases: [...] }`. Includes `pay_code_mappings` (live rows) + org-scoped `value_normalisation_aliases`. Excludes `pay_code_mapping_versions` history (export is a portability snapshot, not an audit dump).
**AC:** AC-MAP-10.

### T5.4 — JSON import flow · M
**Acceptance:**
- Upload JSON file at `/app/mapping/import`.
- Dry-run preview: rows-to-add, rows-to-update (with old → new bucket diff), rows-skipped.
- Commit: writes `pay_code_mapping_versions` rows with `source = 'import_json'`. Existing rows that diff become new versions; identical rows are no-ops.
**AC:** AC-MAP-10.
**Depends:** T5.3.

### T5.5 — AC-MAP-10 round-trip verification · S
**Acceptance:** Test: export from Org A → import into Org B (test fixture) → assert `pay_code_mappings` for Org B contains identical rows with `source = 'import_json'`.
**Depends:** T5.4.

---

## Phase 6 — Cross-cutting tests + acceptance verification

### T6.1 — AC-MAP-1 through AC-MAP-16 verification suite · M
**Acceptance:** One test file per AC under `tests/specs/pay-code-mapping/`. CI gate: all 16 must pass before merge.
**Depends:** Phase 1 + 2 + 3 + 4 done.

### T6.2 — Cross-tenant RLS sweep · S [P]
**Acceptance:** Run T1.8 suite + add: cross-tenant test for the wizard route (Org A user accessing Org B's `/app/import/{id}/wizard` is denied at the page-load level via RLS on `imports`).
**AC:** AC-MAP-11.
**Depends:** T1.8.

### T6.3 — Performance gate · S [P]
**Acceptance:** Pass 1 detection on the Virtus 3-sheet Excel (1717 rows on Sheet3) completes in < 500ms cold, < 100ms warm. Pass 2 LLM call (when invoked) completes in < 10s p95.
**Depends:** Phase 2 + 3 done.

### T6.4 — Documentation pass · S
**Acceptance:** Update `CLAUDE.md` agent-routing trigger phrases if any new ones emerged. Update `docs/engineering/changes/{date}-e5.3-pay-code-mapping/` with the engineering handoff doc.
**Depends:** Phase 5 done.

---

## Summary

| Phase | Task count | Parallelisable | Est. days |
|---|---|---|---|
| Phase 0 — Pre-work | 4 | 3 | 0.5 |
| Phase 1 — Data layer + seeds | 8 | 5 | 1.5 |
| Phase 2 — Pass 1 detection | 7 | 3 | 3 |
| Phase 3 — Pass 2 LLM | 8 | 3 | 2 |
| Phase 4 — Wizard UI | 10 | 5 | 3 |
| Phase 5 — Admin + JSON | 5 | 2 | 1.5 |
| Phase 6 — Cross-cutting | 4 | 3 | 1 |
| **Total** | **46** | **24 parallelisable** | **~12.5 dev-days** |

**Critical path** (longest in-phase chain):

T0.1 → T1.1 → T1.7 → T2.1 → T2.2 → T2.6 → T2.7 → T4.1 → T4.2 → T4.5 → T4.6 → T4.10 → T6.1

≈ 13 sequential nodes. With 2 devs running Phase 3 (LLM) + Phase 4 (UI) in parallel, wall-clock collapses to ~10 working days from a clean start.

---

*Tasks v1.0 — 2026-06-01. Dev kick-off requires: (1) E5.2 PR #105 merged or schema confirmed, (2) operator sign-off on LAUNCH-GUARD update (T3.8), (3) PM hand-off via standup briefing.*
