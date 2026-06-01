# Implementation Plan — E5.3 · Pay-Code Mapping (v0.2 LOCKED)

**Spec:** `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` (Amended v0.2 — LOCKED 2026-06-01)
**Plan version:** v1.0 — 2026-06-01
**Author:** Product Manager
**Sequence within E5:** Third — runs after E5.1 (shipped) + E5.2 (in PR #105). E5.4 ingestion is the consumer; E5.3 + E5.4 land in lockstep but E5.3 must be schema-complete + wizard-functional before E5.4 dry-run preview lights up.

---

## 1. Strategy

E5.3 delivers four interlocking pieces in five engineering phases:

1. **Data layer** — four new tables (`pay_code_mappings`, `pay_code_mapping_versions`, `pay_code_aliases`, `value_normalisation_aliases`) with RLS + versioning + cross-tenant isolation. Migration-only phase; no UI yet. Lands first because every other phase reads from it.
2. **Auto-detection — Pass 1 deterministic** — column-header pattern match + value-pattern match + sheet-shape detection + file-relationship detection + value-normalisation. Pure-function library, fully unit-testable. Lands second because Pass 2 + wizard depend on its proposal output.
3. **Auto-detection — Pass 2 LLM-assist** — Anthropic Claude API client (typed JSON output, single batched call per import, cost-cap $0.05, latency budget 10s, fail-soft when `ANTHROPIC_API_KEY` unset). Lands third because the wizard needs to render `llm_suggested` rows distinctly.
4. **Wizard UI** — multi-step `/app/import/{id}/wizard` route: file shape (sheet picker + file relationship picker) → columns → value normalisation → pay-code mapping → commit. Inherits APA brand styling from E6 (already shipped). Lands fourth, against the auto-detection contract.
5. **JSON import/export + admin edit** — `/app/mapping/*` surface for post-commit admin edits + bulk JSON portability. Lands last because the wizard is the primary value driver.

The plan is **TDD-compatible** — every phase has a paired test fixture set (built ahead of impl, driven by the Virtus fixtures referenced in spec §10).

**Cross-spec dependency.** E5.4 ingestion §5 step 4 reads E5.3's mapping wizard commit. The E5.4 dry-run preview (step 7) reads E5.3's pay-code resolution results. Sequencing: Phase 1 + 2 of E5.3 MUST land before E5.4 Phase 2 (ingestion pipeline) can be plumbed end-to-end. Phase 3 + 4 of E5.3 can land in parallel with E5.4 Phase 2–3.

---

## 2. Design decisions

### 2.1 Schema — four tables, three with versioning

| Table | Versioning model | Why |
|---|---|---|
| `pay_code_mappings` | Live view; `current_version_id` points to live row in `pay_code_mapping_versions`. | Fast `WHERE org_id = ? AND lower(raw_code) = ?` lookup at ingest time. |
| `pay_code_mapping_versions` | Append-only; `effective_to IS NULL` = current. | Historical valuations replay against captured `mapping_version_id`. |
| `pay_code_aliases` | Single-version (system-managed; migrations only). | Read-only knowledge base; no per-org versioning needed. |
| `value_normalisation_aliases` | Versioned via parallel `value_normalisation_aliases_versions` table (NOT shared with mapping versions — the row shapes diverge enough to keep them separate). | Org-scoped overrides need replay-able version pinning; pay-period rows reference `value_normalisation_version_id`. |

**Decision pinned:** parallel `value_normalisation_aliases_versions` rather than mixing with `pay_code_mapping_versions`. Cleaner FK semantics; smaller blast radius if either schema evolves.

### 2.2 Pass 1 / Pass 2 boundary — deterministic first, LLM only on residual

The wizard surfaces **one row per unresolved surface**. Each row carries `source ∈ {auto_mapped, historical, llm_suggested, needs_review}`. The dev contract is: deterministic Pass 1 fills `source = auto_mapped` or `historical`; LLM Pass 2 fills `source = llm_suggested`; surfaces neither resolved nor LLM-suggested fill `source = needs_review`.

**Confidence thresholds** (spec §5):
- Column-header detection: ≥ 0.7 → propose; < 0.7 → defer to Pass 2.
- Value-pattern detection: ≥ 0.6 → propose; < 0.6 → defer to Pass 2.
- Value-normalisation: exact-match against org rows = silent; system-row match = propose with `source = system_seed`; else defer to Pass 2.

Seeds. Pass 2 is gated by org-level toggle (default ON) + `ANTHROPIC_API_KEY` presence.

### 2.3 LLM call — single batched round-trip per import

Architecture: one `POST /v1/messages` call per import with structured-output JSON schema. Anthropic Claude Sonnet 4 model (or current Sonnet at impl time). Prompt template lives in `website/src/lib/lsl/llm/prompts/mapping-suggest.ts` — versioned with the codebase, not in a database.

**Cost-cap enforcement.** Before the call, compute estimated cost from token count of the candidate-surface payload. If estimate > $0.05, **fall through to wizard manual pick** without calling Anthropic. After the call, record actual cost in `import_audit_log` for the org admin to inspect. (No hard kill mid-call — the cost cap is a pre-flight gate.)

**Latency budget.** 10-second `AbortController` timeout. On timeout: log the abort, treat as fall-through to manual wizard, no error surfaced beyond a soft notice. Audit log captures the abort event.

**`ANTHROPIC_API_KEY` unset.** Detected at module-import time via `process.env`. If unset, the LLM client is a no-op stub that returns empty proposals. Wizard surfaces "LLM assistance unavailable — proceeding with deterministic suggestions only" once per session (toast). No exceptions raised at any layer.

### 2.4 Excel ingestion — `xlsx` library; multi-sheet PII scan

Use the existing `xlsx` (SheetJS) library if already vendored, else `@sheetjs/community` (no Apache-license restrictions for this use case). Sheet enumeration → for each sheet, extract row 1 headers + first 20 data rows for column-signature scoring + PII scan.

**PII scan across ALL sheets (OQ-MAP-7 lock).** Even sheets the user does not pick for ingestion are scanned. If any header in any sheet matches the PII pattern set (TFN / bank / super — same set as E5.2 §5), the upload is **rejected at the wizard's file-upload step** with a clear error: "This file contains a sheet with TFN/bank/super headers (Sheet: '{name}', columns: {list}). Remove these columns or upload a different file."

**Alternate behaviour:** the wizard offers a "strip offending sheets and proceed" button (admin-only). Decision: ship rejection-only for v1; the strip-and-proceed is a v1.1 UX softening. **Pinned**: rejection-only.

### 2.5 Wizard step persistence — server-driven, draft state on `imports`

The wizard's 5-step state lives on the `imports` row (`status ∈ {pending_mapping, pending_review, dry_run, committed, partial_committed, abandoned}` per E5.4 §4.1). Each step's resolutions persist back to `imports.wizard_state` (new JSONB column added in this plan's migrations) so the user can navigate back to a prior step without losing work.

**Save-and-resume** = the `imports.status = 'pending_review'` row with `wizard_state` populated. Re-entering the wizard rehydrates from this row.

### 2.6 Knowledge-base seeds

Two seed files in `website/supabase/migrations/`:
- `pay_code_aliases_seed.sql` — ~60 rows covering ordinary / overtime / penalty / leave / commission / bonus / casual loading / termination / PII-strip patterns. Each row is `(pattern_kind, pattern, bucket, confidence, source = 'system_seed')`.
- `value_normalisation_aliases_seed.sql` — ~80 rows covering 8 states × long-form + short-form + common typos; ~30 employment-type prefixes (`FP - `, `FT - `, `CA - `, etc. + hyphenless variants); 12 pay-frequency words.

Seeds are loaded via migration so they're deterministic and reviewable in PRs.

### 2.7 RLS — uniform across all three org-scoped tables

`pay_code_mappings` + `pay_code_mapping_versions` + `value_normalisation_aliases` (where `org_id IS NOT NULL`) all use the standard E5.1 RLS pattern: `org_id = (auth.jwt() ->> 'org_id')::uuid` on SELECT / INSERT / UPDATE. `pay_code_aliases` + system-managed rows in `value_normalisation_aliases` (`org_id IS NULL`) are read-only for all authenticated users; writable only via service-role migration.

---

## 3. Phases

### Phase 0 — Pre-work + fixture assembly (S, blocking)

- **0.1** Confirm E5.2 PR #105 schema is final for `employees` (E5.3 references `lower(raw_code)` uniqueness similar to E5.2; align constraint patterns).
- **0.2** Stage Virtus fixture files in `website/src/lib/data/` (already present per git status). Build canonical test fixtures from them:
  - `fixtures/virtus-3sheet.xlsx` (the multi-sheet workbook — Sheet3 is the payroll-export)
  - `fixtures/virtus-payhistory.csv` + `fixtures/virtus-payratehistory.csv` + `fixtures/virtus-positionhistory.csv` (the 3-CSV relational drop)
- **0.3** Assemble the 10 representative real-world payroll exports referenced in AC-MAP-1 (PM-curated; sourced from Tracy's existing client CSVs + 3–4 public sample exports). Stored under `tests/fixtures/pay-code-mapping/`.
- **0.4** Define the test harness for paired-fixture tests (LLM-set vs LLM-unset behaviour for the same input).

### Phase 1 — Data layer + seeds (M, foundation)

- **1.1** Migration: create `pay_code_mappings` + `pay_code_mapping_versions` with RLS policies + versioning invariant trigger (exactly-one-effective_to-null per `(org_id, lower(raw_code))`).
- **1.2** Migration: create `pay_code_aliases` (read-only RLS) + seed file with ~60 rows.
- **1.3** Migration: create `value_normalisation_aliases` + `value_normalisation_aliases_versions` (RLS scoped to org for non-null `org_id`; system rows readable to all).
- **1.4** Migration: seed `value_normalisation_aliases` with system rows for 8 states (long + short + typos) + ~30 employment-type prefixes + 12 pay-frequency words.
- **1.5** Migration: add `wizard_state JSONB` + `sheet_name TEXT` + `file_relationship JSONB` to `imports` table (E5.4 §4.1 — additive columns, no breaking change to E5.4 spec).
- **1.6** TypeScript types: regenerate via `mcp__supabase__generate_typescript_types`; export from `website/src/lib/db/types.ts`.
- **1.7** Cross-tenant RLS tests in CI — paired test for each new table verifying Org A user cannot SELECT / INSERT / UPDATE Org B rows.

### Phase 2 — Auto-detection Pass 1 (deterministic) (L, blocking for E5.4)

- **2.1** Library scaffold: `website/src/lib/lsl/mapping/detect/` with submodules `file-shape.ts`, `columns.ts`, `value-normalise.ts`, `pay-codes.ts`. Each exports a pure function `(input, aliases) → proposal[]`.
- **2.2** File-shape detection — single CSV / single Excel sheet / multi-sheet Excel / multi-file relational. Sheet-signature scoring via header set + first-N-row column profile. Join-key resolution for multi-file (typically `Employee ID` — extensible).
- **2.3** Column auto-detection — pay code / amount / units / employee-id / pay-period-end / work-jurisdiction / pay-frequency. Score against `pay_code_aliases` `pattern_kind = 'header_name'`. Tie-break by value-cardinality heuristic.
- **2.4** Value-normalisation detection — for state / employment-type / pay-frequency columns: scan unique surface forms, score against `value_normalisation_aliases`. Org-scoped rows shadow system rows.
- **2.5** Pay-code value-pattern detection — for each distinct raw code, score against `pay_code_aliases` `pattern_kind ∈ (code_value, code_prefix, code_suffix)`. Highest-scoring proposal wins; below-threshold surfaces flagged for Pass 2.
- **2.6** Unit tests per module with the Virtus fixtures as the gold set. Threshold-calibration test: AC-MAP-1 (≥ 90% on the 10-fixture set).
- **2.7** Integration test: full Pass 1 against the Virtus 3-sheet Excel — expect Sheet3 selected, columns auto-mapped, all 7 long-form state values resolved, all 12 employment-type prefixes resolved, residual pay codes flagged for Pass 2.

### Phase 3 — Auto-detection Pass 2 (LLM-assisted) (M, parallel with Phase 2 tail)

- **3.1** Anthropic client wrapper: `website/src/lib/lsl/llm/anthropic-client.ts` — env-key detection, no-op stub if unset, single-batched-call pattern, structured-output JSON schema validation.
- **3.2** Prompt template: `website/src/lib/lsl/llm/prompts/mapping-suggest.ts` — versioned; carries the bucket taxonomy + value-normalisation target enums. Input: residual surfaces. Output: `{ surfaces: [{ id, suggestion, confidence, reasoning }] }`.
- **3.3** Cost-cap gate — token estimator runs pre-call; abort if estimate > $0.05; record outcome in `import_audit_log`.
- **3.4** Latency gate — `AbortController` with 10s timeout; abort logged; fall through to wizard manual pick.
- **3.5** `ANTHROPIC_API_KEY`-unset handling — no-op stub returns empty proposals; toast surface added to wizard layout.
- **3.6** Org-settings opt-out toggle: add `orgs.llm_assist_enabled BOOLEAN DEFAULT true` migration (additive to E5.1 schema). Wizard reads this before invoking Pass 2.
- **3.7** Cost-tracking instrumentation: per-import cost (estimated + actual) written to `import_audit_log` for org admin visibility.
- **3.8** Paired-fixture test (AC-MAP-16) — same import with key set vs unset.
- **3.9** Update `.env.example` with `ANTHROPIC_API_KEY` and a note explaining the soft-fall-through behaviour (reinstates the env var that PDF-Removal removed).
- **3.10** Update `docs/launch/LAUNCH-GUARD.md` to reflect that `ANTHROPIC_API_KEY` is now a soft-required production env var (set = LLM assist on; unset = wizard-only path, no error).

### Phase 4 — Wizard UI (L, parallel with Phase 3)

- **4.1** Route + layout: `/app/import/[id]/wizard` — multi-step shell with step indicator (1 of 5), back/next nav, save-and-resume button.
- **4.2** Step 1 — File shape: sheet picker (Excel multi-sheet) + file relationship picker (multi-file). Pre-selected from Pass 1 proposals; user confirms or overrides.
- **4.3** Step 2 — Columns: table of detected columns with confirm/edit controls. LLM-suggested rows visually distinct (`Pill: AI suggestion`).
- **4.4** Step 3 — Value normalisation: table of unresolved surface forms (`"Tasmania"` → `TAS` etc.) with accept/edit controls. Per OQ-MAP-9 lock: `Cohort` columns map to `states` target field; hyphenated values like `VIC-TAS` are split on `-` at the column-detection stage and each side normalised via system state aliases. Renders multi-state result as multi-select pill set in the wizard.
- **4.5** Step 4 — Pay-code mapping: the table from spec §6.1. Status pills (`auto-mapped` / `historical` / `llm_suggested` / `needs review`). Bulk-action buttons: "Accept all deterministic auto-mappings", "Accept all LLM suggestions" (separate; explicit), "Mark all unknown as Excluded — Other".
- **4.6** Step 5 — Commit: summary screen with row counts + commit button + cancel button. Commit triggers transactional write to `pay_code_mapping_versions` (and `value_normalisation_aliases` for any org-scoped overrides) + flips `imports.status` accordingly.
- **4.7** Save-and-resume — every step write persists `imports.wizard_state` JSONB; re-entry rehydrates.
- **4.8** Block-valuation error surface — when E5.5 returns `{ kind: 'unmapped_codes', codes: [...] }`, the error UI links to `/app/import/{id}/wizard?step=4` with the codes pre-highlighted.
- **4.9** Accessibility: keyboard navigation across all 5 steps; ARIA labels per shadcn defaults; APA brand tokens from E6 design system.
- **4.10** E2E test: Virtus 3-sheet Excel + 3-CSV relational, end-to-end wizard flow → commit → assert `pay_code_mappings` + `value_normalisation_aliases` rows present + `imports.status = 'committed'`.

### Phase 5 — Admin edit + JSON import/export (M, post-MVP polish)

- **5.1** `/app/mapping/` list page — `pay_code_mappings` rows with search/filter, current bucket, "last changed" + "changed by".
- **5.2** Edit dialog — bucket dropdown + change-reason text + commit. Writes new `pay_code_mapping_versions` row. Triggers cache invalidation in E5.5 (via the trigger from E5.5 V8; this phase just ensures the write happens).
- **5.3** JSON export — `pay_code_mappings` + org-scoped `value_normalisation_aliases` as a single portable JSON blob. Schema versioned (`schema_version: '1.0'`).
- **5.4** JSON import — file upload + dry-run preview (proposed rows + diffs against existing) + commit.
- **5.5** AC-MAP-10 verified: export from Org A, import into Org B, assert same `pay_code_mappings` rows with `source = 'import_json'`.
- **5.6** Audit log surface — for each `pay_code_mappings` row, show the version history (`pay_code_mapping_versions` timeline) inline in the edit dialog.

### Phase 6 — Cross-cutting tests + acceptance verification (S, gate to E5.4 dry-run dependency)

- **6.1** AC-MAP-1 through AC-MAP-16 — automated test suite, one test per AC.
- **6.2** AC-MAP-13 — Virtus 3-sheet Excel fixture end-to-end.
- **6.3** AC-MAP-14 — Virtus 3-CSV relational fixture end-to-end.
- **6.4** AC-MAP-15 — value-normalisation fixture sweep (all 12 employment-type values, all 7 long-form state values).
- **6.5** AC-MAP-16 — paired LLM-set/unset fixture.
- **6.6** Cross-tenant RLS sweep on all new tables.

---

## 4. Risks + open engineering questions

| ID | Risk / question | Mitigation |
|---|---|---|
| RE-1 | LLM cost overrun at scale (50 imports/day × 50 orgs = ~$3.75/day, manageable but unbounded). | Pre-flight token estimator + per-import cost-cap. Add per-org daily cost-cap as a v1.1 enhancement if real usage warrants. |
| RE-2 | `xlsx` library's PII scan is slow on large workbooks. | Stream-parse mode (only row 1 + first 20 rows for signature; skip the rest if no PII headers in row 1). |
| RE-3 | OQ-MAP-9 (Cohort = `states[]`) implies the value-normalisation step splits hyphenated values. The split rule needs careful handling for state codes that happen to contain `-` (none today, but extensible). | Pin to `-` split character; document in `value_normalisation_aliases` system rows. Add a test case for the edge. |
| RE-4 | Threshold calibration (0.7 / 0.6 — OQ-MAP-2 still open) may need tuning post-pilot. | Tune via the 10-fixture set in Phase 0; ship the seed values; OQ-MAP-2 recalibration is a v1.1 task. |
| RE-5 | `value_normalisation_aliases_versions` decision (parallel table vs reuse mapping versions) was pinned to parallel in this plan. If the dev team disagrees, surface as a Phase 1 design issue before migrations land. | Document in Phase 1.3 — easy to flip before migrations run. |
| RE-6 | LAUNCH-GUARD update (Phase 3.10) needs operator sign-off because it reverses a 2026-05-23 simplification. | PM coordinates with operator before the LAUNCH-GUARD edit. |

---

## 5. Effort sizing

| Phase | Sizing | Notes |
|---|---|---|
| Phase 0 — Pre-work | S (~0.5 day) | Fixture assembly mostly mechanical. |
| Phase 1 — Data layer | M (~1.5 days) | 5 migrations + RLS tests + seed files. |
| Phase 2 — Pass 1 detection | L (~3 days) | 5 detection modules + comprehensive unit tests + calibration. |
| Phase 3 — Pass 2 LLM | M (~2 days) | Client wrapper + prompt + cost/latency gates + tests. |
| Phase 4 — Wizard UI | L (~3 days) | 5 wizard steps + save/resume + a11y + E2E. |
| Phase 5 — Admin edit + JSON | M (~1.5 days) | Polish layer. |
| Phase 6 — Cross-cutting AC verification | S (~1 day) | Test sweep. |
| **Total** | **~12.5 dev-days** | Parallelisable: Phase 3 + Phase 4 can run together (different developers), trimming to ~10 days wall-clock with 2 devs. |

---

## 6. Sequencing within E5

```
E5.1 ✅ → E5.2 ☐ PR #105 → E5.3 (this plan) → E5.4 (impl-plan paired) → E5.5 Phase 1
                                ↓                       ↓
                          Phase 1+2 (schema +    Phase 1+2 of E5.4 dependent
                          deterministic detect)  on E5.3 Phase 1+2 landed
                                ↓                       ↓
                          Phase 3+4+5 of E5.3   Phase 3+4 of E5.4 can land
                          can land in parallel   in parallel with E5.3 Phase 3+
                          with E5.4 Phase 2+    4+5
```

E5.3 Phase 1 + 2 is the **critical path enabler** — E5.4 cannot wire its ingestion pipeline end-to-end without E5.3's mapping + normalisation contracts in place. Phases 3 / 4 / 5 of E5.3 are parallelisable with E5.4 mid-phase work.

---

## 7. References

- Spec: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` v0.2 LOCKED 2026-06-01.
- Umbrella: `.specify/features/005-lsl-platform/spec.md` v1.0 §5.3 + §6.
- Companion: `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md` v0.2 LOCKED 2026-06-01 (consumer).
- Engine: `website/src/lib/lsl/engine/normalise.ts` (downstream of this layer).
- Fixtures: `~/Downloads/Virtus Health - LSL calculation/Sample run/` (canonical real-world set).
- LAUNCH-GUARD: `docs/launch/LAUNCH-GUARD.md` — updated in Phase 3.10.

---

*Plan v1.0 — 2026-06-01. Ready for `speckit-tasks` (tasks file lives alongside this one). Dev kick-off can proceed once E5.2 PR #105 merges + this plan is reviewed.*
