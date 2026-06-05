# Tasks — E5.2 Employee Masterfile + Customer Setup

**Spec:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md`
**Impl plan:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md`
**Branch (planning):** `feat/E5.2-employee-masterfile-plan-rebased` (supersedes the stale `feat/E5.2-employee-masterfile-plan`; do not commit downstream code; operator reviews this plan first)
**Status:** **DRAFT — rebased + amended 2026-05-31; follow-up amend 2026-05-31 per PR #94 review** (original 2026-05-28; rebased onto post-E5.1-Phase-6 + post-E6.2 main; amended for `tags` v1 column per OQ-LIA-1 resolution; E6.2 gate cleared; PR #94 review Q1/Q3/Q4/Q5/Q6a/Q6b resolved)

---

## Conventions

- `[P]` = task can run in parallel with siblings in the same phase (no shared file, no shared DB write).
- `[E6.2-cleared]` = task was previously gated on E6.2 (originally annotated `[GATED-E6.2]` in the 2026-05-28 draft). **E6.2 ✅ SHIPPED 2026-05-30 — gate open.** Historical marker preserved so plan diff is auditable.
- Effort sizes: `S` ≤ 2 hrs · `M` 2–4 hrs · `L` 4–8 hrs · `XL` > 8 hrs.
- Every task cites the spec acceptance criterion(a) (`AC-EMP-*`) it satisfies, or the impl-plan section that motivates it.
- Tests are first-class tasks — they precede the code task they verify (TDD discipline per project rules).
- Migrations are sequential within Phase 1 — no `[P]` between them.
- **`'use server'` rule (added 2026-05-31):** any Phase 3 / Phase 4 task that creates a server-action file MUST first read `docs/learnings/E5.1-phase-6-deployment-gotchas.md` and MUST run `npm run build` locally before opening the PR. Pre-built production failure modes (PR #68/#69/#70 hotfixes) are documented; do not re-introduce.

---

## Phase 0 — Pre-Planning (spike + ratification)

Authorisable immediately on operator sign-off. Total: **S (1–2 hrs)**.

### Task 0.1 · Spike: validate `employee_external_id` shape against real-world payroll exports

- **Size:** S
- **Cites:** DEV-EMP-2 (impl-plan §0); OQ-ING-3 (E5.4 spec §8)
- **Output:** A short markdown note appended to the impl plan's §0 documenting:
  - Max observed length of "employee ID / employee number" in Xero / MYOB / KeyPay / Employment Hero exports.
  - Character set + case-sensitivity observation.
  - Leading-zero stability.
  - Recommendation: ratify default (`text`, trimmed, `UNIQUE (org_id, lower(...))`) OR amend Migration 2 before it lands.
- **Fixture source:** Tracy's existing client CSVs from austpayroll.com.au (per OQ-ING-3 PM recommendation).
- **Acceptance:** Spike note exists; operator has reviewed; default ratified or amended.
- **Throwaway:** No code lands on `main`. The spike note is the only artefact.

### Task 0.2 · Operator ratification of DEV-EMP-1 through DEV-EMP-6

- **Size:** S
- **Cites:** Impl-plan §0
- **Output:** Operator marks each finding as **ratified** or **amended** in the impl plan.
- **Blocker:** All HIGH findings (DEV-EMP-1, DEV-EMP-2) must be ratified before Phase 1 starts. MED findings (DEV-EMP-3, DEV-EMP-4, DEV-EMP-5) may be ratified later but their defaults are assumed in Phase 1 unless changed.
- **Acceptance:** Phase 1 cannot start without DEV-EMP-1 and DEV-EMP-2 ratified.

---

## Phase 1 — Database layer

Seven migrations, sequential (revised 2026-05-31 — Migration 7 added for `tags` v1 scope amendment). RLS and trigger tests live here. **L+ (14–18 hrs)**.

### Task 1.1 · Write Migration 1 — extend `organisations` for customer setup ✅ [x]

- **Size:** M
- **Cites:** Spec §4.1; AC-EMP-1
- **File:** `website/supabase/migrations/20260531112558_extend_organisations_customer_setup.sql`
- **Adds 6 columns** (`employer_legal_name`, `employer_trading_name`, `abn`, `default_work_jurisdiction`, `default_pay_frequency`, `opening_balances_method`) + CHECK constraints per impl-plan §3.1.
- **NOT NULL deferred** until setup wizard backfills (Phase 4).
- **Apply via** `mcp__2ac7599f-...__apply_migration` against project `woxtujkxatosbirikxtq`.
- **Verify via** `mcp__supabase__get_advisors` (security + performance) — zero new lints.
- **Acceptance:** Migration applied; advisors clean; `organisations` columns visible via `mcp__supabase__list_tables`. **[x] Done 2026-05-31 on Supabase branch `e52-phase-1-employees-schema` (`pjjalownnwnikjqtjhgu`); advisors clean (zero new lints — pre-existing E5.1 INFO/WARN unchanged); CHECK constraints smoke-tested via inline DO block. Awaiting production apply.**

### Task 1.2 · Write Migration 2 — create `employees` table ✅ [x]

- **Size:** L
- **Cites:** Spec §4.2; AC-EMP-3, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-9, AC-EMP-11, **AC-EMP-14** (tags)
- **File:** `website/supabase/migrations/20260531113015_create_employees.sql`
- **Implements:** All **24 columns** per spec §4.2 (note: plan said "23 columns" — actual count is 24; stale plan count, all spec fields + tags present), all CHECK constraints per impl-plan §3.1, `UNIQUE (org_id, lower(employee_external_id))`, **5 indexes** (`(org_id)`, `(org_id, archived_at)`, `(retention_expires_at) WHERE retention_expires_at IS NOT NULL`, `USING GIN (tags)`, plus the case-insensitive UNIQUE), `tg_set_updated_at` trigger, RLS enabled + 4 policies (SELECT / INSERT / UPDATE / DELETE).
- **Includes** seed comment block on each column for self-documentation.
- **Acceptance:** Migration applied; advisors clean; RLS active; `mcp__supabase__list_tables` confirms; `\d employees` shows `tags` column and GIN index. **[x] Done 2026-05-31 on Supabase branch `e52-phase-1-employees-schema` (`pjjalownnwnikjqtjhgu`); advisors clean (2 accepted INFO-level FK-unindexed lints on `created_by`/`updated_by`, same pattern as E5.1 precedent; zero new security lints); 11-step constraint smoke test passed; full RLS cross-tenant isolation test passed (SELECT/UPDATE/DELETE/INSERT all enforced). Awaiting production apply.**

### Task 1.3 · Write Migration 3 — create `employee_history` table ✅ [x]

- **Size:** M
- **Cites:** Spec §4.3; AC-EMP-5
- **File:** `website/supabase/migrations/20260531171530_create_employee_history.sql`
- **Implements:** All 13 columns per spec §4.3, EXCLUDE GIST constraint per impl-plan §1.4, `(employee_id, effective_from)` index, FK to `employees` with `ON DELETE CASCADE` (needed by AC-EMP-13), `org_id` denormalised for RLS perf, RLS + 4 policies.
- **Acceptance:** Migration applied; advisors clean; cascade FK verified by manual SQL probe. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`; advisors clean (0 new lints — `btree_gist` installed into `extensions` schema, not public, to avoid `extension_in_public` WARN — see FINDING-2.md); EXCLUDE-constraint smoke test passed (2 non-overlapping segments accepted; overlapping third rejected with `exclusion_violation`). Awaiting production apply.**

### Task 1.4 · Write Migration 4 — `retention_expires_at` trigger ✅ [x]

- **Size:** S
- **Cites:** AC-EMP-13; spec §4.2 + §7 OQ-EMP-2
- **File:** `website/supabase/migrations/20260531171545_employee_retention_trigger.sql`
- **Implements:** `tg_set_retention_expires_at()` function per impl-plan §3.1, attached BEFORE INSERT OR UPDATE OF `end_date` on `employees`.
- **Acceptance:** Migration applied; advisors clean. Manual probe: insert employee with `end_date = '2030-01-01'` → `retention_expires_at` is `2037-01-01`. Clear `end_date` → `retention_expires_at` becomes NULL. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`; advisors clean (0 new lints); smoke test asserted INSERT case → `2037-01-01 00:00:00+00` and UPDATE → NULL. Awaiting production apply.**

### Task 1.5 · Write Migration 5 — `purge_expired_employees` function + pg_cron schedule ✅ [x]

- **Size:** M
- **Cites:** AC-EMP-13
- **File:** `website/supabase/migrations/20260531171600_purge_expired_employees_function.sql`
- **Implements:** `purge_expired_employees()` `SECURITY DEFINER` function per impl-plan §3.1, `REVOKE EXECUTE` from public/anon/authenticated. `cron.schedule(...)` daily at 16:00 UTC (≈ 02:00 AEST / 03:00 AEDT).
- **Verify pg_cron is enabled** — check `mcp__supabase__list_extensions`; enable if absent. **`pg_cron` was NOT installed on the project at start of Phase 1; migration installs via `create extension if not exists pg_cron;`. Surfaces a doc drift in impl-plan §0 DEV-EMP-3 (claimed pg_cron was already in use for HIBP — it is not).**
- **Acceptance:** Migration applied; advisors clean; `cron.job` table shows the scheduled job. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`; advisors clean (0 new lints — the new SECURITY DEFINER function did NOT trip `anon_security_definer_function_executable` because EXECUTE is revoked from anon/authenticated/public); `cron.job` row confirmed (`jobname=purge-expired-employees-daily`, `schedule=0 16 * * *`, `active=true`); end-to-end smoke test asserted purge returned ≥1, employee row gone, and `employee_history` child row removed via FK CASCADE. Awaiting production apply.**

### Task 1.6 · Write Migration 6 — Storage bucket + RLS for source CSV uploads ✅ [x]

- **Size:** M
- **Cites:** Spec §5 (CSV file preservation); DEV-EMP-4
- **File:** `website/supabase/migrations/20260531171615_employee_masterfile_storage_bucket.sql`
- **Implements:** Insert into `storage.buckets` (name `employee-masterfile-uploads`, private, 50 MB cap, MIME allowlist `text/csv` / `application/vnd.ms-excel` / `text/plain`). Two RLS policies on `storage.objects` for that bucket — SELECT (any org_member of folder's org); INSERT (admin/payroll_user of folder's org). No UPDATE/DELETE client policy — retention removal runs server-side.
- **Acceptance:** Migration applied; bucket visible via Supabase dashboard; advisors clean. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`; advisors clean (0 new lints); bucket + 2 storage policies verified via probe. Awaiting production apply.**

### Task 1.6b · Write Migration 7 — `tags` dictionary table + cascade triggers ✅ [x] *(added 2026-05-31 — v1 scope amendment)*

- **Size:** M
- **Cites:** Spec §4.4 (tags dictionary table); AC-EMP-14; OQ-LIA-1 resolution; E5.5 dependency
- **File:** `website/supabase/migrations/20260531171630_create_tags_dictionary.sql`
- **Implements:** `public.tags` table (id, org_id, name, created_at, created_by; `UNIQUE (org_id, name)`; CHECK on name format — 1–50 chars, trimmed, lowercased). RLS policies on `public.tags` matching org_id pivot. Cascade triggers: `tg_cascade_tag_rename` (AFTER UPDATE OF name on tags → array_replace on every employees.tags), `tg_cascade_tag_delete` (BEFORE DELETE on tags → array_remove on every employees.tags). **The GIN index on `employees.tags` lives in Migration 2** (it lives with the column it indexes — conventional; Migration 2 is where the column is created). Migration 7 does NOT redeclare it. **`usage_count_cached` column is NOT included** (dropped 2026-05-31 per PR #94 review Q5 — usage counts are computed on demand via `cardinality(employees.tags)` for the org-settings tag-edit page, avoiding row-lock contention from a maintenance trigger during bulk imports).
- **Acceptance:** Migration applied; `mcp__supabase__list_tables` shows `tags`; advisors clean; manual smoke test of cascade triggers (insert tag → attach to 2 employees → rename → verify employees reflect rename → delete → verify employees no longer carry it) passes. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`; advisors clean (1 new accepted INFO lint on `tags_created_by_fkey` — same audit-column FK precedent as `employees.created_by`/`updated_by`/`employee_history.created_by`); 10-case smoke test passed (4 CHECK rejections + 1 UNIQUE + rename cascade across 2 employees + delete cascade preserving sibling tag). Awaiting production apply.**

### Task 1.7 · Integration test — retention cascade end-to-end [DEFERRED to Phase 2]

- **Size:** M
- **Cites:** AC-EMP-13
- **File:** `website/src/lib/data/employee/__tests__/retention-cascade.integration.test.ts`
- **Test fixture:** Supabase branch created via `mcp__2ac7599f-...__create_branch`. Seed: 1 org, 1 employee with `end_date`, 1 stub `employee_history` row. Manually set `retention_expires_at` to a past timestamp. Call `public.purge_expired_employees()` directly. Assert employee + history rows gone; `import_audit_log` rows (if any) remain.
- **Acceptance:** Test passes against the Supabase branch. Branch deleted at end of suite.
- **DEFERRED 2026-05-31** — application-layer integration test requires the Vitest harness + Supabase client wiring under `website/src/lib/data/employee/__tests__/`, which doesn't exist yet (Phase 2 service layer creates that folder). The DB-level cascade contract has already been smoke-tested inline during Migration 5 application on the branch (employee row + FK-cascaded `employee_history` rows confirmed removed by `public.purge_expired_employees()`; see commit `8ad07ed`). Re-author as a Vitest integration test in Phase 2 when the service-layer folder exists.

### Task 1.8 · Integration test — cross-tenant RLS isolation [DEFERRED to Phase 2]

- **Size:** M
- **Cites:** AC-EMP-9
- **File:** `website/src/lib/data/employee/__tests__/rls-cross-tenant.integration.test.ts`
- **Test fixture:** Supabase branch with 2 orgs, 2 users (each linked to one org via `org_members`). User A inserts an employee. User B attempts SELECT / UPDATE / DELETE. All denied by RLS.
- **Acceptance:** Test passes; documented in QA checklist for E5.2 sign-off.
- **DEFERRED 2026-05-31** — same reason as Task 1.7. The DB-level cross-tenant isolation was already verified inline during Migration 2 application (PR #105 commit `b508f04`) — two synthetic auth.users + two orgs + full SELECT/UPDATE/DELETE/INSERT cross-tenant matrix under `set local role authenticated; set local request.jwt.claim.sub`. Re-author as a Vitest integration test in Phase 2.

### Task 1.9 · Integration test — `employee_history` overlap rejection [DEFERRED to Phase 2]

- **Size:** S
- **Cites:** Spec §4.3 EXCLUDE constraint
- **File:** `website/src/lib/data/employee/__tests__/history-overlap.integration.test.ts`
- **Test:** Insert two history rows for same employee with overlapping date ranges. Second insert fails with Postgres `23P01`.
- **Acceptance:** Test passes; error caught and translated by service layer (Task 2.6 verifies translation).
- **DEFERRED 2026-05-31** — same reason. Already smoke-tested at the DB layer during Migration 3 (commit `c1cd9bc` — three overlapping segments, third rejected with `exclusion_violation` SQLSTATE 23P01). Re-author as a Vitest integration test in Phase 2 alongside Task 2.6 (service-layer error translation), since the two share the error-code-translation contract.

### Task 1.10 · Phase 1 verification gate ✅ [x]

- **Size:** S
- **Cites:** Impl-plan §3.2
- **Output:** All **7 migrations** applied (revised 2026-05-31 — added Migration 7 for `tags` v1 scope amend); advisors run after each; zero unaddressed lints. `pg_cron` job listed. **Tags cascade smoke test** (per Task 1.6b acceptance) recorded as passed.
- **Acceptance:** Migrations on `feat/E5.2-employee-masterfile-impl` (the implementation branch, separate from this planning branch). PR opened for Phase 1 alone (decoupled from Phase 2 to keep PRs reviewable). Phase 2 starts when Phase 1 PR merges. **[x] Done 2026-05-31 on Supabase branch `pjjalownnwnikjqtjhgu`. All 7 migration files committed. Advisor final state: 0 new security lints, 1 new INFO performance lint on `tags_created_by_fkey` (accepted, audit-column FK precedent). `cron.job` shows `purge-expired-employees-daily` at `0 16 * * *`. `btree_gist` + `pg_cron` extensions installed. Tags cascade smoke test passed (10 cases incl. 4 CHECK rejections, 1 UNIQUE rejection, rename cascade, delete cascade preserving siblings). Tasks 1.7/1.8/1.9 deferred to Phase 2 — see notes per task. See `docs/engineering/changes/2026-05-31-E5.2-phase-1-migrations/COMPLETION.md`.**

---

## Phase 2 — Service layer

Pure functions, Vitest unit tests, Zod schemas. **L (16–20 hrs)**.

### Task 2.1 [P] · Extract shared CSV parsing primitives into `core.ts` ✅ [x]

- **Size:** S
- **Cites:** DEV-EMP-5
- **File:** `website/src/lib/lsl/parsers/csv/core.ts` (new) + refactor of `bulk.ts` to use it.
- **Verify:** Existing `bulk.test.ts` continues to pass with zero changes to assertions.
- **Acceptance:** No regression in existing tests; `core.ts` exports `parseCsvHeader`, `splitQuotedRow`, `trimNormalise`. **[x] Done 2026-05-31. `core.ts` exports `splitQuotedRow`, `trimNormalise`, `parseCsvHeader`, `splitCsvLines`. `bulk.ts` refactored to import from `./core` — local `parseCSVLine` function removed. All 14 existing CSV parser tests (bulk + single) green; `tsc --noEmit` clean.**

### Task 2.2 [P] · `types.ts` and `ServiceError` enum ✅ [x]

- **Size:** S
- **Cites:** Impl-plan §1.6
- **File:** `website/src/lib/data/employee/types.ts`
- **Acceptance:** Discriminated-union `Result<T, ServiceError>` exported; `ServiceError` enum covers all error kinds enumerated in impl-plan §1.6. **[x] Done 2026-05-31. `ServiceErrorKind` exports 13 variants in 5 families (validation, duplicates, history, auth/lookup, catch-all). `Result<T,E>` discriminated union + `ok()` / `err()` constructors. Route-handler HTTP mapping documented inline for Phase 3. `tsc --noEmit` clean. See PR body for the enum-shape ratification request.**

### Task 2.3 · PII strip — `pii-strip.ts` + tests (TDD) ✅ [x]

- **Size:** M
- **Cites:** AC-EMP-7; spec §5; impl-plan §1.5
- **Test first** (`pii-strip.test.ts`): table-driven, all header patterns, plus a per-value 9-digit TFN flag. Tests fail.
- **Implementation:** `stripPiiHeaders(headers, rows)` + `flagSuspectTfn(values)`.
- **Acceptance:** All tests green; AC-EMP-7 verified at unit level. (Integration verification via Task 3.2.) **[x] Done 2026-05-31. TDD red → green: 40 unit tests in `__tests__/pii-strip.test.ts` cover both layers (A: column-name allowlist, table-driven across all TFN / bank / super patterns + protected `tags` column + benign-name regression cases; B: per-value 9-digit TFN flag with dedup + whitespace tolerance). `pii-strip.ts` implements `stripPiiHeaders` + `flagSuspectTfn`. `tsc --noEmit` clean.**

### Task 2.4 · Masterfile CSV parser — `masterfile-csv.ts` + tests (TDD) ✅ [x]

- **Size:** L (revised 2026-05-31 — added `tags` column parsing path)
- **Cites:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-10, **AC-EMP-14** (tags pipe-delimited list); spec §5 validation rules
- **Test first** (`masterfile-csv.test.ts`): happy path + every spec §5 validation rule (8 MUSTs + 2 SHOULDs + the new tags MUST). **Tags-specific test cases:** (a) pipe-delimited list parses correctly; (b) leading/trailing whitespace stripped per tag; (c) tags lowercased on parse; (d) unknown tags auto-created in the dictionary in the same import transaction; (e) empty/NULL `tags` column is valid (no tags attached).
- **Implementation:** `parseMasterfileCsv(input: string)` returns `Result<ParsedMasterfile>` where `ParsedMasterfile` includes valid rows, row-level errors, stripped PII columns, TFN warnings, ABN warning (mod-89), TAS/NT field warnings, **and new-tags-to-create count + names list**.
- **Reuses** Task 2.1's `core.ts`.
- **Reuses** Task 2.3's `pii-strip.ts`.
- **Acceptance:** All test cases pass; coverage on every validation rule from spec §5 including the tags rule.

### Task 2.5 [P] · Org-setup service — `org-setup.ts` + tests ✅ [x]

- **Size:** M
- **Cites:** AC-EMP-1
- **Test first** (`org-setup.test.ts`): valid payload writes; invalid ABN rejected; invalid jurisdiction rejected; RLS-denied error surfaced.
- **Implementation:** `updateOrgSetup(supabase, orgId, payload)`. Uses Zod schema. Mutates `organisations` columns from Task 1.1.
- **Acceptance:** Tests pass. **[x] Done 2026-05-31 via PR #118 — `getOrgSetup` + `saveOrgSetup` + `validateOrgSetup` shipped; 52 Vitest cases (Hand-wave summary: required-field validation, ABN format + check-digit soft warning, jurisdiction enum (8 codes), pay-frequency enum, opening-balances-method enum, trading name, getOrgSetup error paths, saveOrgSetup happy + 11 error paths); two architectural decisions surfaced for ratification — narrow `ServiceError` discriminants (`invalid_jurisdiction` / `invalid_pay_frequency`) extending the Task 2.2 taxonomy; PostgREST `23514` (CHECK violation) → `validation_failed` (defence-in-depth).**

### Task 2.6 · Employee CRUD service — `employees.ts` + tests (TDD) ✅ [x]

- **Size:** L
- **Cites:** AC-EMP-3, AC-EMP-4, AC-EMP-6, AC-EMP-8, AC-EMP-10, AC-EMP-11
- **Test first** (`employees.test.ts`): create / read / update (effective-dated branching) / archive / reactivate / list. `23P01` (EXCLUDE violation from Task 1.9) is caught and translated. `23505` (UNIQUE violation on `(org_id, lower(employee_external_id))`) caught and translated to `duplicate_external_id`. `scheme != 'state_lsl'` rejected at v1 validator.
- **Implementation:** Full CRUD + soft-delete + reactivate. Calls Task 2.7 (`recordEffectiveDatedChange`) when an effective-dated field changes.
- **Acceptance:** Tests pass; AC-EMP-3, AC-EMP-4, AC-EMP-6, AC-EMP-8, AC-EMP-11 verified. **[x] Done 2026-06-01 via PR #121 (Wave B) — `createEmployee` / `updateEmployee` / `getEmployee` / `listEmployees` / `archiveEmployee` / `reactivateEmployee` + scope-trim absorption of `getOpeningBalance` / `clearOpeningBalance` from Task 2.8; 57 / 57 Vitest cases; `23505` → `duplicate_external_id` and `42501` → `rls_denied` and `23P01` → `history_overlap` translation paths asserted; AC-EMP-3, -4, -6, -8, -10, -11 unit-level verified; policy-column-driven opening-balance write gate per PR #119 (`opening_balances_method` → `setup_wizard`/`csv_field`/`both`/`none`); `EmployeeWriteWarning` channel ratified for non-error signals (`tas_missing_sex`, `nt_missing_dob`, `csv_value_overwritten`, `csv_opening_balance_skipped_per_policy`, `wizard_opening_balance_skipped_per_policy`). See `docs/engineering/changes/2026-05-31-E5.2-phase-2-service-layer/COMPLETION.md` + `WAVE-B-HANDOFF.md`.**

### Task 2.7 · Effective-dated history service — `history.ts` + tests (TDD) ✅ [x]

- **Size:** M
- **Cites:** AC-EMP-5
- **Test first** (`history.test.ts`): `recordEffectiveDatedChange` closes the open segment and opens a new one in a single transaction; overlap rejection; cascade on archive.
- **Implementation:** Per impl-plan §1.4, 4-step pattern wrapped in `BEGIN ... COMMIT`. Uses Supabase RPC or `pg_transaction` pattern as documented in the Supabase client library version.
- **Acceptance:** Tests pass; AC-EMP-5 verified. **[x] Done 2026-06-01 via PR #121 (Wave B) — `appendHistorySegment` (close-old-open-new), `getHistory` (with `asOf` filter), `getCurrentSegment`; 31 / 31 Vitest cases; `23P01` → `history_overlap` translation asserted; AC-EMP-5 unit-level verified. **RPC-vs-PostgREST decision:** v1 keeps PostgREST atomic (two non-atomic calls UPDATE→INSERT; EXCLUDE GIST constraint is the safety net) per WAVE-B-HANDOFF.md §"RPC-vs-PostgREST decision"; v1.1 RPC refactor candidate (mechanical call-site refactor; requires one migration).**

### Task 2.8 · Opening-balance reconciliation — `opening-balance.ts` + tests (TDD) ✅ [x]

- **Size:** S
- **Cites:** AC-EMP-12
- **Test first** (`opening-balance.test.ts`): paired-tests per AC-EMP-12 (CSV value + wizard value → wizard wins; CSV only → CSV wins; wizard only → wizard wins; neither → null).
- **Implementation:** `reconcileOpeningBalance(csvValue, wizardValue)`.
- **Acceptance:** Tests pass; AC-EMP-12 verified at unit level. **[x] Done 2026-05-31 via PR #117 — pure reconciler shipped, policy-agnostic (both candidates pass in); 28 Vitest cases. Two scope-trims absorbed into Task 2.6 per operator ratification 2026-05-31: `getOpeningBalance(employeeId)` + `clearOpeningBalance(employeeId)` (need Supabase + employee-row lifecycle that Task 2.6 owns). One design decision ratified via PR #119 spec amend: `organisations.opening_balances_method` promoted from "reporting aid" to **load-bearing** — drives collision resolution at the Task 2.6 call site (four behavioural states: `setup_wizard` / `csv_field` / `both` / `none`).**

### Task 2.8b · Tags dictionary service — `tags.ts` + tests (TDD) ✅ [x] *(added 2026-05-31 — v1 scope amendment; refined 2026-05-31 per PR #94 review Q5)*

- **Size:** M
- **Cites:** Spec §4.4; AC-EMP-14; OQ-LIA-1 resolution
- **Test first** (`tags.test.ts`): (a) create tag — succeeds + dictionary row present; (b) create duplicate within org — fails with `duplicate_tag_name` ServiceError; (c) create same name in different org — succeeds (RLS-isolated); (d) rename tag — verify cascade trigger updated all referencing `employees.tags` arrays; (e) hard-delete tag — verify cascade trigger removed it from all `employees.tags` arrays; (f) list tags for org — returns sorted-by-name **with usage counts computed on demand via `cardinality(employees.tags)`** (Q5 resolution 2026-05-31 — no denormalised cache); (g) bulk-create-from-import — accepts an array of names + an `import_audit_log_id`, auto-creates absent names, returns the canonical id-by-name map.
- **Implementation:** `tags.ts` exports `createTag(orgId, name, userId)`, `renameTag(orgId, tagId, newName, userId)`, `deleteTag(orgId, tagId, userId)`, `listTags(orgId)` — the list path joins `tags` with an aggregate over `employees.tags` using `cardinality()` / `unnest()` to compute per-tag usage counts at query time, and `bulkCreateFromImport(orgId, names, userId, importAuditLogId)`. The bulk path is called by Task 2.4's CSV parser when it encounters unknown tags in a `tags` CSV column.
- **Note on the dropped `usage_count_cached` (Q5, 2026-05-31):** the prior amend specified a denormalised counter column maintained by a row-level trigger on every `employees.tags` write. PR #94 review surfaced row-lock contention against `tags` rows on a 5k-employee bulk import. Resolution: drop the cache; compute counts on demand at the org-settings tag-edit page (low-traffic, sub-second cost acceptable). The bulk import path no longer touches `tags` rows during the row-write loop.
- **Acceptance:** Tests pass; AC-EMP-14 cascade behaviour verified at integration level (Task 1.6b smoke); list-tags usage counts match `cardinality(employees.tags)` ground truth. **[x] Done 2026-06-01 via PR #123 (Wave C) — `createTag` / `getTag` / `listTags` / `renameTag` / `deleteTag` / `getTagUsageCount` / `normaliseTagName` shipped; 40 / 40 Vitest cases; `23505` → `duplicate_tag_name` translation asserted; service layer relies on Migration 7 cascade triggers (`tg_cascade_tag_rename_on_tags`, `tg_cascade_tag_delete_on_tags`) — does NOT touch `employees.tags` from rename/delete paths; `getTagUsageCount` uses GIN-index-supported `.contains('tags', [name])` with `count: 'exact'` HEAD request (Q5 pattern preserved); cascade behaviour re-verified live on Supabase test branch (3 / 3 assertions passed). See `TASK-2.8b-FINDINGS.md`.**

### Task 2.9 · Phase 2 verification gate ✅ [x]

- **Size:** S
- **Output:** All service-layer tests green; coverage report shows ≥ 90% on the new `website/src/lib/data/employee/` directory.
- **Acceptance:** PR for Phase 2 opens, decoupled from Phase 3 for review. **[x] Done 2026-06-01 (Wave D — this dispatch). Test surface re-run: 284 / 284 Phase 2 unit tests pass (pii-strip 40, masterfile-csv 36, org-setup 52, opening-balance 28, employees 57, history 31, tags 40); full repo Vitest 3026 passed / 32 skipped / 0 failed; `tsc --noEmit` clean; `eslint src/lib/data/employee` clean. AC-EMP-* coverage: 12 / 14 fully covered at unit level; AC-EMP-9 partial (RLS translation paths asserted; full HTTP cross-tenant deferred to Phase 3 Task 3.2); AC-EMP-13 DB-layer verified at Migration 4 + 5 apply (route-level deferred to Phase 3 Task 3.2). Two architectural patterns ratified for Phase 3: (a) narrow `ServiceError` discriminants per field (`invalid_jurisdiction` / `invalid_pay_frequency` / `duplicate_external_id` / `history_overlap` / `duplicate_tag_name` extending Task 2.2's 13-variant union; HTTP mapping table in HANDOFF-PHASE-3.md §3); (b) `EmployeeWriteWarning` channel for non-error signals (rides on per-success `warnings: []` field; route handlers pass through to Phase 4 Toast). Supabase advisors clean (0 new security; 4 new INFO unused-index lints expected — will clear in Phase 3 integration tests). Production main UNTOUCHED. See `docs/engineering/changes/2026-05-31-E5.2-phase-2-service-layer/COMPLETION.md` + `HANDOFF-PHASE-3.md`.**

---

## Phase 3 — Server actions / route handlers

Thin wrappers around Phase 2. Integration tests against a Supabase branch. **M (8–12 hrs)**.

### Task 3.1 · Route handlers under `website/src/app/app/api/` *(path corrected 2026-05-31 per PR #94 review Q6a — codebase convention is `/app/...`, not `(authed)`)*

- **Size:** L
- **Cites:** Impl-plan §5
- **Files:** All 9 routes/actions per impl-plan §5 table.
- **Pattern:** Each handler ≤ 30 lines: parse → auth-check (via E5.1 `proxy.ts` provides session) → call service → respond.
- **Acceptance:** Handlers exist; basic happy-path manual probe via `curl` works against `next dev` running locally (developer-only; CI tests in Task 3.2).

### Task 3.2 · Integration test suite for routes — Supabase-branch fixture

- **Size:** L
- **Cites:** AC-EMP-1 through AC-EMP-13 end-to-end (route-level coverage)
- **File:** `website/src/app/app/api/**/__tests__/*.integration.test.ts`
- **Test fixture:** Single Supabase branch created at suite start, two orgs, two users seeded. All AC tests run against this branch. Branch deleted at suite end.
- **AC-EMP-9 verification (cross-tenant RLS via real HTTP)** lives here in addition to Task 1.8 (which verifies at DB level).
- **AC-EMP-12 (opening-balance reconciliation paired test)** lives here in addition to Task 2.8 (which verifies at unit level).
- **AC-EMP-13 (retention cascade)** lives here in addition to Task 1.7.
- **Acceptance:** All AC-EMP-* acceptance criteria have at least one passing integration test that cites them.

### Task 3.3 · Service-role-key surface review

- **Size:** S
- **Cites:** IM-5 (impl-plan §7); `website/AGENTS.md` hard rule
- **Output:** Grep for `SUPABASE_SERVICE_ROLE_KEY` in `website/src/app/`. Document any usage with justification. Expected: zero usages outside of explicitly-required server-side paths (none in E5.2 — pg_cron handles the deletion job).
- **Acceptance:** Documented grep result; zero unjustified usages.

### Task 3.4 · Phase 3 verification gate + PR

- **Size:** S
- **Output:** All AC-EMP-* covered by integration tests; PR opened for Phases 1–3 cumulatively (or individually, operator preference).
- **Acceptance:** CI green; PR ready for operator review.

---

## Phase 4 — UI (E6.2 cleared 2026-05-30 — authorisable when Phase 3 completes)

**Previously gated on E6.2.** **E6.2 ✅ SHIPPED 2026-05-30** — design system tokens (Tailwind v4 CSS-first, PR #58) + core component variants (Button/Input/Table/Tabs/Dialog/Badge/Alert/Card/Tooltip/Accordion/Sonner Toast — PR #61/63/64/66/79/80/81/82/84) are on main. Every task below carries the `[E6.2-cleared]` marker (historical context preserved). The total Phase 4 effort with the tags scope amendment is **XL+ (27–36 hrs)** — 8 surfaces incl. tag multi-select picker (Task 4.3 / 4.4) and the new org-settings tag-edit page (Task 4.10 — added 2026-05-31).

### Task 4.1 [E6.2-cleared] · Customer-setup wizard at `/app/setup`

- **Size:** M
- **Cites:** AC-EMP-1
- **Implements:** 5-field form (employer legal name, ABN, default work jurisdiction, default pay frequency, optional trading name). Uses Zod schema from Task 2.5. Forces completion on first login (middleware redirect when required fields are NULL on the org row).
- **Acceptance:** AC-EMP-1 verified end-to-end via Playwright.

### Task 4.2 [E6.2-cleared] · Employee list at `/app/employees`

- **Size:** L
- **Cites:** Spec §3 in-scope
- **Implements:** `@tanstack/react-table` + `@tanstack/react-virtual` (already in deps). Columns per impl-plan §6. Pagination, sort, filter (archived / active / all).
- **Acceptance:** List renders 1,000+ rows without jank; filters work.

### Task 4.3 [E6.2-cleared] · Manual single-employee add at `/app/employees/new`

- **Size:** M
- **Cites:** AC-EMP-3
- **Implements:** Form using the same Zod schema as `createEmployee` service. Shows helper text for the DEV-EMP-1 mapping caveats (`salaried` → engine `full_time`, `hourly` → engine `casual`).
- **Acceptance:** AC-EMP-3 verified via Playwright.

### Task 4.4 [E6.2-cleared] · Employee detail / edit + effective-dated history view at `/app/employees/[id]`

- **Size:** L
- **Cites:** AC-EMP-5
- **Implements:** Field edit (history-aware — surfaces "this will create a history segment" when an effective-dated field changes). History panel listing prior segments. Archive / reactivate controls.
- **Acceptance:** AC-EMP-5, AC-EMP-6 verified via Playwright.

### Task 4.5 [E6.2-cleared] · CSV upload wizard at `/app/employees/import`

- **Size:** XL
- **Cites:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-10
- **Implements:** Multi-step wizard — file pick → dry-run preview (row count, validation errors, stripped PII columns, flagged TFN values, ABN warning, TAS/NT field warnings) → confirm → commit. Shows row-level errors inline. Allows download of error-report CSV.
- **Acceptance:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-10 verified end-to-end via Playwright.

### Task 4.6 [E6.2-cleared] · Opening-balance setup wizard

- **Size:** M
- **Cites:** AC-EMP-12
- **Implements:** Accessible from each employee row. Captures `opening_balance_weeks`, `opening_balance_taken_weeks`, `opening_balance_as_at_date`. Surfaces existing CSV-imported values for review. Operator-entered values override CSV (per impl-plan §0).
- **Acceptance:** AC-EMP-12 verified via Playwright.

### Task 4.7 [E6.2-cleared] · Archive + reactivate controls (across list + detail)

- **Size:** S
- **Cites:** AC-EMP-6
- **Implements:** Archive button on detail page; reactivate button on archived-employee view. Confirmation modal warns about retention timer start.
- **Acceptance:** AC-EMP-6 verified via Playwright.

### Task 4.8 [E6.2-cleared] · UI accessibility + responsive sweep

- **Size:** M
- **Cites:** Project rule (AGENTS.md axe + Playwright)
- **Implements:** Axe-core checks on every Phase 4 page; responsive checks at standard breakpoints; keyboard-only flow tested for the upload wizard.
- **Acceptance:** Zero axe violations; documented in QA sign-off.

### Task 4.9b [E6.2-cleared] · Org-settings tag-edit page at `/app/settings/tags` *(added 2026-05-31 — v1 scope amendment)*

- **Size:** M
- **Cites:** Spec §4.4; AC-EMP-14
- **Blocked-by (added 2026-05-31 per PR #94 review Q4):** E6.2 follow-up Combobox / Command / Popover primitive wave (see `.specify/features/006-ui-design-system/tasks.md` Task 2.12). The rename Dialog's tag-name input is a plain Input, but the affected-employees preview uses a Combobox-style searchable list. Cannot start this task until the E6.2 primitive wave lands.
- **Implements:** A `/app/settings/tags` route listing every tag in the org's dictionary with **usage count badge per row computed on demand via `cardinality(employees.tags)`** (Q5 resolution 2026-05-31 — no denormalised cache; the org-settings page reads tag counts via a view or service-layer aggregate at render time). Two row actions: (a) **rename** — opens a Dialog (E6.2 brand variant) with new-name input + a preview of affected employees (top 10 + total count); on confirm, calls Task 2.8b's `renameTag` service; surface Sonner Toast on success. (b) **delete** — opens a Dialog with affected-employees preview; explicit type-name-to-confirm gate; on confirm, calls `deleteTag` service; Toast on success. Page uses E6.2 Table + Badge + Dialog primitives.
- **Acceptance:** AC-EMP-14 cascade behaviour verifiable via this UI (axe-clean); manual smoke test passes; Playwright happy-path covers rename + delete; usage counts match `cardinality(employees.tags)` ground truth.

### Task 4.10 [E6.2-cleared] · Employee tags filter + chip display on list page *(added 2026-05-31 — v1 scope amendment)*

- **Size:** S (filter integration only — the Combobox primitive itself is ~L of work, now owned by the E6.2 follow-up wave)
- **Cites:** Spec §4.2 (tags column); AC-EMP-14; E5.5 OQ-LIA-1 dependency
- **Blocked-by (added 2026-05-31 per PR #94 review Q4):** E6.2 follow-up Combobox / Command / Popover primitive wave (see `.specify/features/006-ui-design-system/tasks.md` Task 2.12). The original 2026-05-31 amend silently assumed Combobox was already in E6.2; it was not. Operator decision 2026-05-31 — Combobox primitives ship as an E6.2 follow-up, not inside this S-sized task. Cannot start this task until that E6.2 task lands.
- **Implements:** Tag-filter Combobox above the employee list (multi-select from the org's dictionary, AND semantics default per E5.5 OQ-LIA-3) — **consumes** the E6.2 Combobox primitive; does NOT build it. Each employee row renders their tags as Badge chips (E6.2 brand variant — already shipped) — overflow handled with "+N more" Tooltip (E6.2 brand variant — already shipped) when > 3 tags. Filter state mirrored to URL query params for shareable links.
- **Acceptance:** Filter narrows the list as expected; chips render axe-clean; deep-linking from URL works.

### Task 4.9 [E6.2-cleared] · Phase 4 verification gate + PR

- **Size:** S
- **Output:** All Phase 4 tests green; Playwright suite includes coverage for all AC-EMP-* not already covered by Phase 3 integration tests.
- **Acceptance:** PR for Phase 4 opens; QA handoff via `dev-qa-delegation`.

---

## Dependency graph (compact)

```
Phase 0 ──► Phase 1 (1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.6b → [1.7, 1.8, 1.9] → 1.10)
                │
                ▼
            Phase 2 (2.1 [P] · 2.2 [P]) → 2.3 → 2.4 → 2.5 [P] → 2.6 → 2.7 → 2.8 → 2.8b → 2.9
                │
                ▼
            Phase 3 (3.1 → 3.2 → 3.3 → 3.4)
                │
                ▼
       ┌────────┴────────┬─────────────────────────────────────────┐
       │                 │                                         │
   merge to main    E6.2 ✅ cleared 2026-05-30 (gate open)    E6.2 follow-up Combobox wave
                                                              (006-ui-design-system Task 2.12)
                                                              MUST be merged for Tasks 4.9b + 4.10
                                                                       │
                                                                       ▼
                     Phase 4 (4.1 [P] · 4.2 [P] · 4.3 [P] · 4.4 · 4.5 · 4.6 · 4.7 · 4.8 · 4.9b · 4.10 · 4.9)
                                  └─ Tasks 4.9b + 4.10 specifically blocked on the Combobox wave (added 2026-05-31 per PR #94 review Q4)
```

---

## Acceptance criteria coverage matrix

| AC | Unit test (Phase 2) | Integration test (Phase 3) | E2E test (Phase 4) |
|---|---|---|---|
| AC-EMP-1  (org setup) | 2.5 | 3.2 | 4.1 |
| AC-EMP-2  (CSV dry-run + commit) | 2.4 | 3.2 | 4.5 |
| AC-EMP-3  (manual add) | 2.6 | 3.2 | 4.3 |
| AC-EMP-4  (duplicate external_id rejected) | 2.4, 2.6 | 3.2 | 4.5 |
| AC-EMP-5  (effective-dated edit) | 2.7 | 3.2 | 4.4 |
| AC-EMP-6  (archive soft-delete) | 2.6 | 3.2 | 4.4, 4.7 |
| AC-EMP-7  (PII strip) | 2.3, 2.4 | 3.2 | 4.5 |
| AC-EMP-8  (scheme = state_lsl only) | 2.6 | 3.2 | — |
| AC-EMP-9  (cross-tenant RLS) | — | 1.8, 3.2 | — |
| AC-EMP-10 (TAS sex / NT dob warnings + engine block) | 2.4 | 3.2 | 4.5 |
| AC-EMP-11 (schema forward-compat for portable LSL) | 2.6 (validator) | — | — |
| AC-EMP-12 (opening-balance dual-path wizard-wins) | 2.8 | 3.2 | 4.6 |
| AC-EMP-13 (7-year retention cascade) | — | 1.7, 3.2 | — |

**Every AC has at least one passing test before E5.2 closes.**

---

## Effort summary (revised 2026-05-31 — recalibrated per PR #94 review Q3)

| Phase | Sizing | Hours | Gating |
|---|---|---|---|
| Phase 0 | S | 1–2 | — |
| Phase 1 (7 migrations incl. `tags`) | L+ | 14–18 | After Phase 0 |
| Phase 2 (services incl. tags service + tags CSV path) | L | 19–24 | After Phase 1 |
| Phase 3 (routes + integration tests) | M | 8–12 | After Phase 2 |
| Phase 4 (UI — 8 surfaces incl. tag picker + tag-edit page) | XL+ | 27–36 | After Phase 3 (E6.2 ✅ cleared; Combobox primitive wave in E6.2 follow-up) |
| **Total (revised)** | — | **70–95** | ≈ 9–12 working days |

Backend-only (Phases 0–3): **42–56 hrs**. Authorisable immediately.

**Note on the Phase 2 delta (Q3 recalibration 2026-05-31):** the original 2026-05-31 amend left Phase 2 at 16–20 hrs despite adding Task 2.8b (M = 2–4 hrs) AND bumping Task 2.4 M → L (~+2 hrs for the tags CSV parsing path + 5 new test cases). PR #94 review surfaced the under-count; corrected to 19–24 hrs.

---

*End of E5.2 tasks file — original draft 2026-05-28 on `feat/E5.2-employee-masterfile-plan`. Rebased onto post-E5.1-Phase-6 + post-E6.2 main 2026-05-31 on `feat/E5.2-employee-masterfile-plan-rebased`. Tags v1 scope amendment landed in this rebase per OQ-LIA-1 (E5.5 dependency). Awaiting operator review.*
