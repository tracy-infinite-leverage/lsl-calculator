# HANDOFF — E5.2 Phase 2 → Phase 3

**From:** Developer agent (Task 2.9 verification gate dispatch 2026-06-01)
**To:** next developer dispatch (Phase 3 — server actions / route handlers)
**Status:** Phase 2 closed. Phase 3 unblocked. No outstanding blockers.
**Spec ref:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md`
**Plan ref:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md` §Phase 3
**Impl-plan ref:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md` §5

---

## 1. Module API surface — what Phase 3 imports from `@/lib/data/employee/*`

All modules return `Result<T, ServiceError>` from `types.ts`. Route handlers MUST exhaustively switch on `result.error.kind`.

### `types.ts`
- `Result<T, E = ServiceError>` — discriminated union.
- `ok<T>(data: T): Result<T>`, `err(kind, message, options?): Result<never>` — constructors.
- `ServiceErrorKind` — 13-variant union (see §3 for the HTTP mapping table).
- `ServiceError = { kind, message, field?, detail? }`.

### `org-setup.ts` (Task 2.5)
- `validateOrgSetup(payload: OrgSetupPayload): Result<ValidatedOrgSetup>` — pure validator (Zod-style); use this server-side before `saveOrgSetup`.
- `getOrgSetup(supabase, orgId): Promise<Result<OrgSetupRow>>` — single-row read.
- `saveOrgSetup(supabase, orgId, payload): Promise<Result<SaveOrgSetupSuccess>>` — validates + writes; surfaces `OrgSetupWarning[]` on success (e.g. `abn_check_digit_invalid`).

### `pii-strip.ts` (Task 2.3)
- `stripPiiHeaders(headers, rows): { strippedColumns, headers, rows }` — pure header-allowlist strip.
- `flagSuspectTfn(values): string[]` — pure per-value 9-digit-TFN flag (dedup + whitespace tolerant).

### `masterfile-csv.ts` (Task 2.4)
- `parseMasterfileCsv(input: string): Result<ParsedMasterfile>` — pure parser. Returns `{ validRows, rowErrors, rowWarnings, strippedColumns, suspectTfnFlags, newTagsToCreate }`.

**Phase 3 owes:** `commitMasterfile(supabase, orgId, parsed, opts): Result<ImportResult>` — wraps the multi-table write across `tags.bulkCreateFromImport` → `createEmployee` (loop) → `import_audit_log` insert. Not yet implemented; lives in Phase 3 Task 3.1.

### `employees.ts` (Task 2.6 + scope-trimmed 2.8 ops)
- `createEmployee(supabase, orgId, payload, opts?): Promise<Result<CreateEmployeeSuccess>>` — INSERT + opens initial history segment (`change_reason='initial'`). Returns `{ employee, warnings: EmployeeWriteWarning[] }`.
- `updateEmployee(supabase, employeeId, patch, opts?): Promise<Result<UpdateEmployeeSuccess>>` — UPDATE in place OR UPDATE + `appendHistorySegment` when an effective-dated field is in the patch. Two-step non-atomic PostgREST — see §6.
- `getEmployee(supabase, employeeId): Promise<Result<EmployeeRow>>`.
- `listEmployees(supabase, orgId, filters?): Promise<Result<ListEmployeesSuccess>>` — fluent PostgREST builder for status (active/archived/all), pagination, sort.
- `archiveEmployee(supabase, employeeId, opts): Promise<Result<...>>` — soft-delete; sets `archived_at` + `end_date`; triggers `retention_expires_at` population via DB trigger.
- `reactivateEmployee(supabase, employeeId, opts): Promise<Result<...>>` — clears `archived_at` + `end_date`; clears `retention_expires_at` via DB trigger.
- `getOpeningBalance(supabase, employeeId): Promise<Result<OpeningBalance | null>>` — scope-trim absorption from 2.8.
- `clearOpeningBalance(supabase, employeeId, opts): Promise<Result<...>>` — scope-trim absorption from 2.8.

### `history.ts` (Task 2.7)
- `appendHistorySegment(supabase, args): Promise<Result<HistorySegment>>` — close-old-open-new pattern. Returns the new open segment.
- `getHistory(supabase, employeeId, asOf?): Promise<Result<HistorySegment[]>>` — full segment list; filters application-side to the segment containing `asOf` if supplied.
- `getCurrentSegment(supabase, employeeId): Promise<Result<HistorySegment | null>>` — convenience for `effective_to IS NULL`.

### `opening-balance.ts` (Task 2.8)
- `reconcileOpeningBalance(args): ReconciledOpeningBalance` — **pure**, policy-agnostic. Inputs: `csvValue` + `wizardValue`. Wizard-wins semantics. Used by `employees.ts` at the call site after the policy-column lookup.
- `validateOpeningBalance(input): Result<OpeningBalance>` — pure validator.

### `tags.ts` (Task 2.8b)
- `createTag(supabase, orgId, name, userId): Promise<Result<TagRow>>` — `23505` → `duplicate_tag_name`.
- `getTag(supabase, tagId): Promise<Result<TagRow>>`.
- `listTags(supabase, orgId, filters?): Promise<Result<TagRow[]>>` — `ilike` prefix filter + range pagination; usage counts computed on demand via `getTagUsageCount` per row (Q5 resolution — no `usage_count_cached`).
- `renameTag(supabase, tagId, newName): Promise<Result<TagRow>>` — DB trigger cascades to `employees.tags` arrays.
- `deleteTag(supabase, tagId): Promise<Result<{ id: string }>>` — DB trigger cascades to `employees.tags` arrays.
- `getTagUsageCount(supabase, orgId, name): Promise<Result<number>>` — uses the GIN index from Migration 2 via `.contains('tags', [name])`.
- `normaliseTagName(input): string` — pure helper. Trim → lowercase → collapse whitespace.

### `core.ts` (Task 2.1 — under `@/lib/lsl/parsers/csv/core`)
- `splitQuotedRow(line: string): string[]`
- `trimNormalise(value: string): string`
- `parseCsvHeader(line: string): string[]`
- `splitCsvLines(input: string): string[]`

---

## 2. Phase 3 route handler scope (per impl-plan §5)

Files under `website/src/app/app/api/` (codebase convention is `/app/...`, not `(authed)` — corrected 2026-05-31 per PR #94 review Q6a).

| Route | Method | Service called | AC coverage hit |
|---|---|---|---|
| `/api/org-setup` | POST | `saveOrgSetup` | AC-EMP-1 |
| `/api/employees/import/preview` | POST (multipart) | `parseMasterfileCsv` (dry-run, no commit) | AC-EMP-2 (preview), AC-EMP-7 (strip), AC-EMP-10 (warnings) |
| `/api/employees/import/commit` | POST (multipart + import_id) | `commitMasterfile` (NEW — Phase 3 builds it) | AC-EMP-2 (commit), AC-EMP-4 (dupe partial-success), AC-EMP-7 (audit row), AC-EMP-14 (tags auto-create in same txn) |
| `/api/employees` | GET (paginated) | `listEmployees` | — (list shape) |
| `/api/employees` | POST | `createEmployee` | AC-EMP-3, AC-EMP-4, AC-EMP-8, AC-EMP-11 |
| `/api/employees/[id]` | GET | `getEmployee` | — |
| `/api/employees/[id]` | PATCH | `updateEmployee` | AC-EMP-5 (effective-dated branching) |
| `/api/employees/[id]` | DELETE | `archiveEmployee` | AC-EMP-6 |
| `/api/employees/[id]/reactivate` | POST | `reactivateEmployee` | AC-EMP-6 |
| `/api/employees/[id]/history` | GET | `getHistory` | AC-EMP-5 |

Plus tags surfaces (impl-plan §5 doesn't enumerate them — likely needed for the Phase 4 tag-edit page Task 4.9b):
- `/api/tags` GET / POST — `listTags` / `createTag`
- `/api/tags/[id]` PATCH / DELETE — `renameTag` / `deleteTag`

**Pattern (per impl-plan §5):** each handler ≤ 30 lines. Parse → auth-check (via E5.1 `proxy.ts` which provides the session) → call service → respond.

**Mandatory before opening Phase 3 PR:**
- Read `docs/learnings/E5.1-phase-6-deployment-gotchas.md` — `'use server'` rule + Next.js 16 `proxy.ts` cookie API drift.
- Run `npm run build` locally — pre-built production failure modes from PR #68/#69/#70 are documented; do not re-introduce.

---

## 3. ServiceError → HTTP status mapping (load-bearing for Phase 3)

Route handlers MUST exhaustively switch on `result.error.kind`. The mapping below is documented in `types.ts` as a comment for reference.

| `ServiceErrorKind` | HTTP status | When emitted | Notes |
|---|---|---|---|
| `validation_failed` | **400** | Generic input-shape problem (malformed UUID, missing required field, etc.) | Surface `field` in response body if present |
| `invalid_jurisdiction` | **400** | `default_work_jurisdiction` not in the 8-code enum | Narrow discriminant — field name implicit |
| `invalid_employment_type` | **400** | `employment_type` not in the 5-value enum | Narrow discriminant |
| `invalid_pay_frequency` | **400** | `pay_frequency` not in the 4-value enum | Narrow discriminant |
| `invalid_scheme` | **400** | `scheme != 'state_lsl'` in v1 | Narrow discriminant; v1.1 will accept portable values |
| `pii_header_rejected` | **400** | A CSV header matched the strip allowlist (TFN / bank / super) | Surface stripped column names; row processing continues |
| `parse_failed` | **400** | CSV header / structural error | |
| `rls_denied` | **403** | PostgREST `42501` | Log the operation + user; do NOT echo PostgREST detail to client |
| `not_found` | **404** | PostgREST `PGRST116` or UPDATE affecting 0 rows | |
| `duplicate_external_id` | **409** | `23505` on `UNIQUE (org_id, lower(employee_external_id))` | Surface `field: "employee_external_id"` |
| `duplicate_tag_name` | **409** | `23505` on `UNIQUE (org_id, name)` in tags | Surface `field: "name"` |
| `history_overlap` | **409** | `23P01` on `employee_history` EXCLUDE constraint | RPC race condition — see §6 |
| `db_error` | **500** | Unexpected PostgREST error | Log full detail server-side; client sees generic message |

**Compile-time safety:** adding a new variant to `ServiceErrorKind` triggers a TS exhaustiveness error in every consumer's switch — desired.

---

## 4. `EmployeeWriteWarning` channel (non-error signals)

Successful service-layer responses carry an optional `warnings: EmployeeWriteWarning[]` array. Phase 3 route handlers pass this through to the response body; Phase 4 surfaces as Sonner Toast (informational, not blocking).

Current taxonomy from `employees.ts`:

| Warning | Source | Phase 4 surfacing |
|---|---|---|
| `tas_missing_sex` | `createEmployee` / `updateEmployee` when TAS employee has no `sex` field | Toast: "Warning: TAS employee missing sex. Valuation will fail until provided." |
| `nt_missing_dob` | Same, NT + `dob` | Toast: "Warning: NT employee missing dob. Valuation will fail until provided." |
| `csv_value_overwritten` | `updateEmployee` when wizard write displaces a CSV value | Toast: "Wizard value saved. CSV value overwritten per opening-balance policy." |
| `csv_opening_balance_skipped_per_policy` | `createEmployee` / `updateEmployee` when policy is `setup_wizard` and CSV path attempted opening-balance write | Toast: "CSV opening-balance skipped — org policy is setup_wizard." |
| `wizard_opening_balance_skipped_per_policy` | Same, policy `csv_field` and wizard path | Toast: "Wizard opening-balance skipped — org policy is csv_field." |

Org-setup precedent:
- `OrgSetupWarning = 'abn_check_digit_invalid'` (from `org-setup.ts`) — save succeeds, but mod-89 check digit failed; surface for operator awareness.

**Phase 3 wiring:** route handlers do NOT translate warnings to HTTP status. The response is 200 with `{ data, warnings: [...] }`. Phase 4 Toast component reads from `warnings[]`.

---

## 5. Policy-column behaviour for `organisations.opening_balances_method` (Decision 1)

Spec amended 2026-06-01 via PR #119 — `opening_balances_method` is **load-bearing** (governs which paths may write to `employees.opening_balance_*`).

Implemented in `employees.ts` at `createEmployee` + `updateEmployee` call sites:

| Policy | CSV write | Wizard write |
|---|---|---|
| `setup_wizard` | strip + warn `csv_opening_balance_skipped_per_policy` | allow |
| `csv_field` | allow | strip + warn `wizard_opening_balance_skipped_per_policy` |
| `both` | allow | allow (warn `csv_value_overwritten` on collision per AC-EMP-12) |
| `none` / NULL | **reject** `validation_failed` with `field: 'opening_balance_*'` | **reject** same |

**Phase 3 implication:** the route handler `POST /api/employees/import/commit` MUST pass `source: 'csv'` in the `opts` argument to `createEmployee`; the wizard route handlers (`POST/PATCH /api/employees`) pass `source: 'wizard'`. The policy lookup happens inside the service layer — Phase 3 does not duplicate it.

**Optimization preserved:** `createEmployee` short-circuits the policy lookup unless at least one opening-balance field is present in the payload. Phase 3 should NOT pre-fetch the policy in the route handler.

---

## 6. RPC-vs-PostgREST decision (v1 keep PostgREST atomic)

`updateEmployee` performs the effective-dated update across **two non-atomic PostgREST calls**:

1. `UPDATE employees SET ...`
2. `INSERT INTO employee_history (...) VALUES (...)` (via `appendHistorySegment`)

Concurrent writers race-condition into `23P01` on the EXCLUDE GIST constraint (`history_overlap`) and the caller retries.

**v1 decision:** keep PostgREST atomic. Capture the brief consistency window as a known limitation in the spec's RE-N risk register.

**Phase 3 implication:** route handlers wrap both calls in a single HTTP request handler with try/catch. On `history_overlap`, surface as 409 with retry guidance to the caller. The brief window where the `employees` row is updated but the new `employee_history` segment isn't yet visible is bounded by one PostgREST round-trip and limited by RLS visibility (org members only).

**v1.1 refactor candidate:** introduce `update_employee_with_history(employee_id, patch, effective_from)` Postgres RPC. The call-site refactor in `employees.ts` is mechanical — both writes already feed identical arguments. Requires one new migration. NOT a Phase 3 task.

---

## 7. Scope-trim absorption — `getOpeningBalance` / `clearOpeningBalance`

These two operations originally lived in `opening-balance.ts` (Task 2.8 scope) but were absorbed into `employees.ts` (Task 2.6) per operator ratification 2026-05-31.

**Phase 3 implication:** the route handler for opening-balance read/clear hits `employees.ts`, not `opening-balance.ts`. The pure reconciler in `opening-balance.ts` is policy-agnostic and used internally by `employees.ts`.

If Phase 3 needs a dedicated `/api/employees/[id]/opening-balance` route (impl-plan §5 doesn't enumerate one — opening-balance writes ride on `PATCH /api/employees/[id]`), it would call `getOpeningBalance` / `clearOpeningBalance` from `employees.ts`.

---

## 8. AC-EMP-* items deferred to Phase 3 (application layer)

| AC | Phase 2 status | Phase 3 owes |
|---|---|---|
| **AC-EMP-9** (cross-tenant RLS) | Partial — `42501` → `rls_denied` translation asserted in unit tests; DB-level verified at Migration 2 apply | Integration test against a Supabase branch (Task 3.2). Two orgs, two users; assert User A cannot read/write User B's employees / employee_history / tags. |
| **AC-EMP-13** (retention cascade) | DB-level verified at Migration 4 + 5 apply (PR #110) | Integration test against a Supabase branch (Task 3.2). Set `end_date`, fast-forward via `update`-then-`select` of `retention_expires_at`, call `purge_expired_employees()`, assert cascade. |
| AC-EMP-1, AC-EMP-2, AC-EMP-3, AC-EMP-4, AC-EMP-5, AC-EMP-6, AC-EMP-7, AC-EMP-8, AC-EMP-10, AC-EMP-11, AC-EMP-12, AC-EMP-14 | Unit-level service-layer coverage complete | Route-level integration coverage (Task 3.2) — at least one passing integration test per AC. |

**Phase 1 deferred tasks (1.7 / 1.8 / 1.9):** these three integration tests were deferred from Phase 1 to Phase 2 (folder didn't exist), then practically subsumed by Phase 2 unit-level SQLSTATE translation coverage + DB-level migration smoke tests. Phase 3 Task 3.2 picks them up properly as part of the AC-EMP-9 / AC-EMP-13 integration coverage. The three task entries in `tasks.md` remain marked DEFERRED — leave as-is; Phase 3 verification gate (Task 3.4) will tick them.

---

## 9. Operational guardrails for Phase 3

### Vercel build hygiene (mandatory — added 2026-05-31 per impl-plan amendment)

Phase 3 introduces server-action files. Before opening the Phase 3 PR:
1. Read `docs/learnings/E5.1-phase-6-deployment-gotchas.md` in full.
2. Run `npm run build` locally — production build must pass.
3. Verify no `'use server'` directives are placed in files imported by client components.
4. Verify no edge-runtime imports in server-action files.

PR #68 / #69 / #70 hotfixes document the failure modes. Do not re-introduce.

### Supabase MCP hygiene

- Production main (`woxtujkxatosbirikxtq`) is READ-ONLY. Use the test branch (`pjjalownnwnikjqtjhgu`) for any integration probe or branch creation.
- For Task 3.2 integration tests, create a fresh Supabase branch via `mcp__2ac7599f-...__create_branch` at suite start, seed two orgs + two users, run tests, `mcp__2ac7599f-...__delete_branch` at suite end.
- Run `mcp__2ac7599f-...__get_advisors` after Task 3.2's branch fixture exercises the indexes — the 4 INFO unused-index lints should clear (`employees_org_id_idx`, `employees_retention_expires_at_idx`, `employees_tags_gin_idx`, `employee_history_employee_effective_idx`).

### Service-role key surface (Task 3.3)

Grep for `SUPABASE_SERVICE_ROLE_KEY` in `website/src/app/`. Expected: zero usages outside of explicitly-required server-side paths. Phase 2 service layer uses the user's authenticated Supabase client (RLS-scoped); the service-role key has no business in route handlers either. `pg_cron` runs the deletion job, not application code.

---

## 10. Test surface baseline going into Phase 3

| Surface | Count | Status |
|---|---|---|
| Phase 2 service-layer unit tests | 284 | ✅ pass |
| Full repo Vitest | 3026 pass / 32 skipped | ✅ pass |
| `tsc --noEmit` | clean | ✅ |
| `eslint src/lib/data/employee` | clean | ✅ |
| Production main migrations | 12 applied (5 E5.1 + 7 E5.2) | ✅ |
| Advisors (test branch) | 0 new security; 4 new INFO unused-index (will clear in Phase 3 integration tests) | accepted |

---

## 11. Recommended Phase 3 dispatch sequencing

| Wave | Tasks | Effort | Notes |
|---|---|---|---|
| **A** | 3.1 (route handlers) | L (4–6 hrs) | Build all 9+ handlers + the `commitMasterfile` service step + the tags routes. Single dispatch — they share the auth-check pattern. |
| **B** | 3.2 (integration suite) | L (4–6 hrs) | Supabase branch fixture; full AC-EMP-* HTTP coverage; clears the deferred 1.7/1.8/1.9 contracts. |
| **C** | 3.3 (service-role-key review) | S (≤ 2 hrs) | Grep + document. Can run in parallel with Wave B. |
| **D** | 3.4 (verification gate + PR) | S (≤ 2 hrs) | Final tick; mirrors this Phase 2 close-out pattern. |

**Total Phase 3 effort:** M (8–12 hrs) per impl-plan §5. Within band.

---

## 12. Where Phase 2 artefacts live

For the Phase 3 dispatch's reference:

- **COMPLETION.md** — `docs/engineering/changes/2026-05-31-E5.2-phase-2-service-layer/COMPLETION.md` (the close-out doc for this phase).
- **WAVE-B-HANDOFF.md** — same folder. Documents the Wave B (Tasks 2.6 + 2.7) decisions: PostgREST atomic, policy-column-driven opening-balance, ServiceError enum diff.
- **TASK-2.8b-FINDINGS.md** — same folder. Documents the tags service decisions: cascade-trigger reliance, `getTagUsageCount` GIN-index pattern, dropped `usage_count_cached`.
- **HANDOFF.md** — same folder. The original Task 2.4 close-out + Wave A queueing.
- **Phase 1 COMPLETION.md** — `docs/engineering/changes/2026-05-31-E5.2-phase-1-migrations/COMPLETION.md` (the DB-layer close-out pattern Phase 2 + Phase 3 mirror).

---

*End of HANDOFF-PHASE-3. Phase 3 is fully unblocked. Estimated effort: M (8–12 hrs) across 4 waves.*
