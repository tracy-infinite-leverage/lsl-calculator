# Tasks — E5.2 Employee Masterfile + Customer Setup

**Spec:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md`
**Impl plan:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md`
**Branch (planning):** `feat/E5.2-employee-masterfile-plan` (do not commit; operator reviews first)
**Status:** **DRAFT** — awaiting operator review

---

## Conventions

- `[P]` = task can run in parallel with siblings in the same phase (no shared file, no shared DB write).
- `[GATED-E6.2]` = task is **BLOCKED-BY E6.2 merge to main**. Do not start until the design system lands.
- Effort sizes: `S` ≤ 2 hrs · `M` 2–4 hrs · `L` 4–8 hrs · `XL` > 8 hrs.
- Every task cites the spec acceptance criterion(a) (`AC-EMP-*`) it satisfies, or the impl-plan section that motivates it.
- Tests are first-class tasks — they precede the code task they verify (TDD discipline per project rules).
- Migrations are sequential within Phase 1 — no `[P]` between them.

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

Six migrations, sequential. RLS and trigger tests live here. **L (12–16 hrs)**.

### Task 1.1 · Write Migration 1 — extend `organisations` for customer setup

- **Size:** M
- **Cites:** Spec §4.1; AC-EMP-1
- **File:** `website/supabase/migrations/{ts}_extend_organisations_customer_setup.sql`
- **Adds 6 columns** (`employer_legal_name`, `employer_trading_name`, `abn`, `default_work_jurisdiction`, `default_pay_frequency`, `opening_balances_method`) + CHECK constraints per impl-plan §3.1.
- **NOT NULL deferred** until setup wizard backfills (Phase 4).
- **Apply via** `mcp__2ac7599f-...__apply_migration` against project `woxtujkxatosbirikxtq`.
- **Verify via** `mcp__supabase__get_advisors` (security + performance) — zero new lints.
- **Acceptance:** Migration applied; advisors clean; `organisations` columns visible via `mcp__supabase__list_tables`.

### Task 1.2 · Write Migration 2 — create `employees` table

- **Size:** L
- **Cites:** Spec §4.2; AC-EMP-3, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-9, AC-EMP-11
- **File:** `website/supabase/migrations/{ts}_create_employees.sql`
- **Implements:** All 22 columns per spec §4.2, all CHECK constraints per impl-plan §3.1, `UNIQUE (org_id, lower(employee_external_id))`, 3 indexes (`(org_id)`, `(org_id, archived_at)`, `(retention_expires_at) WHERE retention_expires_at IS NOT NULL`), `tg_set_updated_at` trigger, RLS enabled + 4 policies (SELECT / INSERT / UPDATE / DELETE).
- **Includes** seed comment block on each column for self-documentation.
- **Acceptance:** Migration applied; advisors clean; RLS active; `mcp__supabase__list_tables` confirms.

### Task 1.3 · Write Migration 3 — create `employee_history` table

- **Size:** M
- **Cites:** Spec §4.3; AC-EMP-5
- **File:** `website/supabase/migrations/{ts}_create_employee_history.sql`
- **Implements:** All 13 columns per spec §4.3, EXCLUDE GIST constraint per impl-plan §1.4, `(employee_id, effective_from)` index, FK to `employees` with `ON DELETE CASCADE` (needed by AC-EMP-13), `org_id` denormalised for RLS perf, RLS + 4 policies.
- **Acceptance:** Migration applied; advisors clean; cascade FK verified by manual SQL probe.

### Task 1.4 · Write Migration 4 — `retention_expires_at` trigger

- **Size:** S
- **Cites:** AC-EMP-13; spec §4.2 + §7 OQ-EMP-2
- **File:** `website/supabase/migrations/{ts}_employee_retention_trigger.sql`
- **Implements:** `tg_set_retention_expires_at()` function per impl-plan §3.1, attached BEFORE INSERT OR UPDATE OF `end_date` on `employees`.
- **Acceptance:** Migration applied; advisors clean. Manual probe: insert employee with `end_date = '2030-01-01'` → `retention_expires_at` is `2037-01-01`. Clear `end_date` → `retention_expires_at` becomes NULL.

### Task 1.5 · Write Migration 5 — `purge_expired_employees` function + pg_cron schedule

- **Size:** M
- **Cites:** AC-EMP-13
- **File:** `website/supabase/migrations/{ts}_purge_expired_employees_function.sql`
- **Implements:** `purge_expired_employees()` `SECURITY DEFINER` function per impl-plan §3.1, `REVOKE EXECUTE` from public, `GRANT EXECUTE` to `postgres`. `cron.schedule(...)` daily at 16:00 UTC (≈ 02:00 Sydney).
- **Verify pg_cron is enabled** — check `mcp__supabase__list_extensions`; enable if absent.
- **Acceptance:** Migration applied; advisors clean; `cron.job` table shows the scheduled job.

### Task 1.6 · Write Migration 6 — Storage bucket + RLS for source CSV uploads

- **Size:** M
- **Cites:** Spec §5 (CSV file preservation); DEV-EMP-4
- **File:** `website/supabase/migrations/{ts}_employee_masterfile_storage_bucket.sql`
- **Implements:** Insert into `storage.buckets` (name `employee-masterfile-uploads`, private, no public access). RLS policies on `storage.objects` for that bucket per impl-plan §0 DEV-EMP-4.
- **Acceptance:** Migration applied; bucket visible via Supabase dashboard; advisors clean.

### Task 1.7 · Integration test — retention cascade end-to-end

- **Size:** M
- **Cites:** AC-EMP-13
- **File:** `website/src/lib/data/employee/__tests__/retention-cascade.integration.test.ts`
- **Test fixture:** Supabase branch created via `mcp__2ac7599f-...__create_branch`. Seed: 1 org, 1 employee with `end_date`, 1 stub `employee_history` row. Manually set `retention_expires_at` to a past timestamp. Call `public.purge_expired_employees()` directly. Assert employee + history rows gone; `import_audit_log` rows (if any) remain.
- **Acceptance:** Test passes against the Supabase branch. Branch deleted at end of suite.

### Task 1.8 · Integration test — cross-tenant RLS isolation

- **Size:** M
- **Cites:** AC-EMP-9
- **File:** `website/src/lib/data/employee/__tests__/rls-cross-tenant.integration.test.ts`
- **Test fixture:** Supabase branch with 2 orgs, 2 users (each linked to one org via `org_members`). User A inserts an employee. User B attempts SELECT / UPDATE / DELETE. All denied by RLS.
- **Acceptance:** Test passes; documented in QA checklist for E5.2 sign-off.

### Task 1.9 · Integration test — `employee_history` overlap rejection

- **Size:** S
- **Cites:** Spec §4.3 EXCLUDE constraint
- **File:** `website/src/lib/data/employee/__tests__/history-overlap.integration.test.ts`
- **Test:** Insert two history rows for same employee with overlapping date ranges. Second insert fails with Postgres `23P01`.
- **Acceptance:** Test passes; error caught and translated by service layer (Task 2.6 verifies translation).

### Task 1.10 · Phase 1 verification gate

- **Size:** S
- **Cites:** Impl-plan §3.2
- **Output:** All 6 migrations applied; advisors run after each; zero unaddressed lints. `pg_cron` job listed.
- **Acceptance:** Migrations on `feat/E5.2-employee-masterfile-impl` (the implementation branch, separate from this planning branch). PR opened for Phase 1 alone (decoupled from Phase 2 to keep PRs reviewable). Phase 2 starts when Phase 1 PR merges.

---

## Phase 2 — Service layer

Pure functions, Vitest unit tests, Zod schemas. **L (16–20 hrs)**.

### Task 2.1 [P] · Extract shared CSV parsing primitives into `core.ts`

- **Size:** S
- **Cites:** DEV-EMP-5
- **File:** `website/src/lib/lsl/parsers/csv/core.ts` (new) + refactor of `bulk.ts` to use it.
- **Verify:** Existing `bulk.test.ts` continues to pass with zero changes to assertions.
- **Acceptance:** No regression in existing tests; `core.ts` exports `parseCsvHeader`, `splitQuotedRow`, `trimNormalise`.

### Task 2.2 [P] · `types.ts` and `ServiceError` enum

- **Size:** S
- **Cites:** Impl-plan §1.6
- **File:** `website/src/lib/data/employee/types.ts`
- **Acceptance:** Discriminated-union `Result<T, ServiceError>` exported; `ServiceError` enum covers all error kinds enumerated in impl-plan §1.6.

### Task 2.3 · PII strip — `pii-strip.ts` + tests (TDD)

- **Size:** M
- **Cites:** AC-EMP-7; spec §5; impl-plan §1.5
- **Test first** (`pii-strip.test.ts`): table-driven, all header patterns, plus a per-value 9-digit TFN flag. Tests fail.
- **Implementation:** `stripPiiHeaders(headers, rows)` + `flagSuspectTfn(values)`.
- **Acceptance:** All tests green; AC-EMP-7 verified at unit level. (Integration verification via Task 3.2.)

### Task 2.4 · Masterfile CSV parser — `masterfile-csv.ts` + tests (TDD)

- **Size:** L
- **Cites:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-10; spec §5 validation rules
- **Test first** (`masterfile-csv.test.ts`): happy path + every spec §5 validation rule (8 MUSTs + 2 SHOULDs).
- **Implementation:** `parseMasterfileCsv(input: string)` returns `Result<ParsedMasterfile>` where `ParsedMasterfile` includes valid rows, row-level errors, stripped PII columns, TFN warnings, ABN warning (mod-89), and TAS/NT field warnings.
- **Reuses** Task 2.1's `core.ts`.
- **Reuses** Task 2.3's `pii-strip.ts`.
- **Acceptance:** All test cases pass; coverage on every validation rule from spec §5.

### Task 2.5 [P] · Org-setup service — `org-setup.ts` + tests

- **Size:** M
- **Cites:** AC-EMP-1
- **Test first** (`org-setup.test.ts`): valid payload writes; invalid ABN rejected; invalid jurisdiction rejected; RLS-denied error surfaced.
- **Implementation:** `updateOrgSetup(supabase, orgId, payload)`. Uses Zod schema. Mutates `organisations` columns from Task 1.1.
- **Acceptance:** Tests pass.

### Task 2.6 · Employee CRUD service — `employees.ts` + tests (TDD)

- **Size:** L
- **Cites:** AC-EMP-3, AC-EMP-4, AC-EMP-6, AC-EMP-8, AC-EMP-10, AC-EMP-11
- **Test first** (`employees.test.ts`): create / read / update (effective-dated branching) / archive / reactivate / list. `23P01` (EXCLUDE violation from Task 1.9) is caught and translated. `23505` (UNIQUE violation on `(org_id, lower(employee_external_id))`) caught and translated to `duplicate_external_id`. `scheme != 'state_lsl'` rejected at v1 validator.
- **Implementation:** Full CRUD + soft-delete + reactivate. Calls Task 2.7 (`recordEffectiveDatedChange`) when an effective-dated field changes.
- **Acceptance:** Tests pass; AC-EMP-3, AC-EMP-4, AC-EMP-6, AC-EMP-8, AC-EMP-11 verified.

### Task 2.7 · Effective-dated history service — `history.ts` + tests (TDD)

- **Size:** M
- **Cites:** AC-EMP-5
- **Test first** (`history.test.ts`): `recordEffectiveDatedChange` closes the open segment and opens a new one in a single transaction; overlap rejection; cascade on archive.
- **Implementation:** Per impl-plan §1.4, 4-step pattern wrapped in `BEGIN ... COMMIT`. Uses Supabase RPC or `pg_transaction` pattern as documented in the Supabase client library version.
- **Acceptance:** Tests pass; AC-EMP-5 verified.

### Task 2.8 · Opening-balance reconciliation — `opening-balance.ts` + tests (TDD)

- **Size:** S
- **Cites:** AC-EMP-12
- **Test first** (`opening-balance.test.ts`): paired-tests per AC-EMP-12 (CSV value + wizard value → wizard wins; CSV only → CSV wins; wizard only → wizard wins; neither → null).
- **Implementation:** `reconcileOpeningBalance(csvValue, wizardValue)`.
- **Acceptance:** Tests pass; AC-EMP-12 verified at unit level.

### Task 2.9 · Phase 2 verification gate

- **Size:** S
- **Output:** All service-layer tests green; coverage report shows ≥ 90% on the new `website/src/lib/data/employee/` directory.
- **Acceptance:** PR for Phase 2 opens, decoupled from Phase 3 for review.

---

## Phase 3 — Server actions / route handlers

Thin wrappers around Phase 2. Integration tests against a Supabase branch. **M (8–12 hrs)**.

### Task 3.1 · Route handlers under `website/src/app/(authed)/api/`

- **Size:** L
- **Cites:** Impl-plan §5
- **Files:** All 9 routes/actions per impl-plan §5 table.
- **Pattern:** Each handler ≤ 30 lines: parse → auth-check (via E5.1 `proxy.ts` provides session) → call service → respond.
- **Acceptance:** Handlers exist; basic happy-path manual probe via `curl` works against `next dev` running locally (developer-only; CI tests in Task 3.2).

### Task 3.2 · Integration test suite for routes — Supabase-branch fixture

- **Size:** L
- **Cites:** AC-EMP-1 through AC-EMP-13 end-to-end (route-level coverage)
- **File:** `website/src/app/(authed)/api/**/__tests__/*.integration.test.ts`
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

## Phase 4 — UI (ALL TASKS [GATED-E6.2])

**DO NOT START** any Phase 4 task until **E6.2 design system has merged to `main`**. Every task below carries the `[GATED-E6.2]` marker. The total Phase 4 effort is **XL (24–32 hrs)**.

### Task 4.1 [GATED-E6.2] · Customer-setup wizard at `/(authed)/setup`

- **Size:** M
- **Cites:** AC-EMP-1
- **Implements:** 5-field form (employer legal name, ABN, default work jurisdiction, default pay frequency, optional trading name). Uses Zod schema from Task 2.5. Forces completion on first login (middleware redirect when required fields are NULL on the org row).
- **Acceptance:** AC-EMP-1 verified end-to-end via Playwright.

### Task 4.2 [GATED-E6.2] · Employee list at `/(authed)/employees`

- **Size:** L
- **Cites:** Spec §3 in-scope
- **Implements:** `@tanstack/react-table` + `@tanstack/react-virtual` (already in deps). Columns per impl-plan §6. Pagination, sort, filter (archived / active / all).
- **Acceptance:** List renders 1,000+ rows without jank; filters work.

### Task 4.3 [GATED-E6.2] · Manual single-employee add at `/(authed)/employees/new`

- **Size:** M
- **Cites:** AC-EMP-3
- **Implements:** Form using the same Zod schema as `createEmployee` service. Shows helper text for the DEV-EMP-1 mapping caveats (`salaried` → engine `full_time`, `hourly` → engine `casual`).
- **Acceptance:** AC-EMP-3 verified via Playwright.

### Task 4.4 [GATED-E6.2] · Employee detail / edit + effective-dated history view at `/(authed)/employees/[id]`

- **Size:** L
- **Cites:** AC-EMP-5
- **Implements:** Field edit (history-aware — surfaces "this will create a history segment" when an effective-dated field changes). History panel listing prior segments. Archive / reactivate controls.
- **Acceptance:** AC-EMP-5, AC-EMP-6 verified via Playwright.

### Task 4.5 [GATED-E6.2] · CSV upload wizard at `/(authed)/employees/import`

- **Size:** XL
- **Cites:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-10
- **Implements:** Multi-step wizard — file pick → dry-run preview (row count, validation errors, stripped PII columns, flagged TFN values, ABN warning, TAS/NT field warnings) → confirm → commit. Shows row-level errors inline. Allows download of error-report CSV.
- **Acceptance:** AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-10 verified end-to-end via Playwright.

### Task 4.6 [GATED-E6.2] · Opening-balance setup wizard

- **Size:** M
- **Cites:** AC-EMP-12
- **Implements:** Accessible from each employee row. Captures `opening_balance_weeks`, `opening_balance_taken_weeks`, `opening_balance_as_at_date`. Surfaces existing CSV-imported values for review. Operator-entered values override CSV (per impl-plan §0).
- **Acceptance:** AC-EMP-12 verified via Playwright.

### Task 4.7 [GATED-E6.2] · Archive + reactivate controls (across list + detail)

- **Size:** S
- **Cites:** AC-EMP-6
- **Implements:** Archive button on detail page; reactivate button on archived-employee view. Confirmation modal warns about retention timer start.
- **Acceptance:** AC-EMP-6 verified via Playwright.

### Task 4.8 [GATED-E6.2] · UI accessibility + responsive sweep

- **Size:** M
- **Cites:** Project rule (AGENTS.md axe + Playwright)
- **Implements:** Axe-core checks on every Phase 4 page; responsive checks at standard breakpoints; keyboard-only flow tested for the upload wizard.
- **Acceptance:** Zero axe violations; documented in QA sign-off.

### Task 4.9 [GATED-E6.2] · Phase 4 verification gate + PR

- **Size:** S
- **Output:** All Phase 4 tests green; Playwright suite includes coverage for all AC-EMP-* not already covered by Phase 3 integration tests.
- **Acceptance:** PR for Phase 4 opens; QA handoff via `dev-qa-delegation`.

---

## Dependency graph (compact)

```
Phase 0 ──► Phase 1 (1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → [1.7, 1.8, 1.9] → 1.10)
                │
                ▼
            Phase 2 (2.1 [P] · 2.2 [P]) → 2.3 → 2.4 → 2.5 [P] → 2.6 → 2.7 → 2.8 → 2.9
                │
                ▼
            Phase 3 (3.1 → 3.2 → 3.3 → 3.4)
                │
                ▼
       ┌────────┴────────┐
       │                 │
   merge to main    wait for E6.2 merge
                         │
                         ▼
                     Phase 4 (4.1 [P] · 4.2 [P] · 4.3 [P] · 4.4 · 4.5 · 4.6 · 4.7 · 4.8 · 4.9)
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

## Effort summary

| Phase | Sizing | Hours | Gating |
|---|---|---|---|
| Phase 0 | S | 1–2 | — |
| Phase 1 | L | 12–16 | After Phase 0 |
| Phase 2 | L | 16–20 | After Phase 1 |
| Phase 3 | M | 8–12 | After Phase 2 |
| Phase 4 | XL | 24–32 | **BLOCKED-BY E6.2 + Phase 3** |
| **Total** | — | **61–82** | ≈ 8–10 working days |

Backend-only (Phases 0–3): **37–50 hrs**. Authorisable immediately.

---

*End of E5.2 tasks file — drafted 2026-05-28 on `feat/E5.2-employee-masterfile-plan`. Awaiting operator review.*
