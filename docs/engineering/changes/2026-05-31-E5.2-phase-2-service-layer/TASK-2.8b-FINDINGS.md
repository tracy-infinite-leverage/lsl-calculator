# Task 2.8b — tags dictionary service: findings

**Branch:** `feat/e5-2-task-2-8b-tags-service`
**Spec:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md` §4.4
**Plan:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md` §3.1 Migration 7
**AC:** AC-EMP-14

## Files

- **New:** `website/src/lib/data/employee/tags.ts` (401 lines)
- **New:** `website/src/lib/data/employee/__tests__/tags.test.ts` (604 lines, 40 tests)
- **Touched:** none (read-only consumers: `types.ts`)

## Operations exposed

| Function | DB op | RLS gate (Migration 7) |
|---|---|---|
| `createTag(supabase, orgId, name)` | INSERT into `public.tags` | `org_admin` + `org_payroll` |
| `getTag(supabase, tagId)` | SELECT | members (all roles) |
| `listTags(supabase, orgId, filters?)` | SELECT (`ilike` prefix; range pagination) | members |
| `renameTag(supabase, tagId, newName)` | UPDATE | `org_admin` + `org_payroll` |
| `deleteTag(supabase, tagId)` | DELETE | `org_admin` only |
| `getTagUsageCount(supabase, orgId, name)` | `SELECT count(*) FROM employees WHERE org_id=? AND tags @> array[name]` (HEAD + `count: 'exact'`) | members |
| `normaliseTagName(input)` | pure helper | n/a |

## Validation rules

1. `org_id` and `tag_id` must match RFC-4122 UUID shape — rejected pre-DB as `validation_failed{field}`.
2. `name`: trim → lowercase → collapse internal whitespace runs to a single space.
3. Empty after normalisation ⇒ `validation_failed{field:'name'}`.
4. > 50 chars after normalisation ⇒ `validation_failed{field:'name'}`.
5. `listTags` prefix is normalised + LIKE wildcards (`%`, `_`, `\`) escaped so a user typing `"100%"` matches `100%` literally, not every row.

## ServiceError mapping

| SQLSTATE / PostgREST code | ServiceError kind |
|---|---|
| `23505` unique_violation | `duplicate_tag_name` |
| `23514` check_violation | `validation_failed` (defence-in-depth; service-layer should catch first) |
| `42501` insufficient_privilege | `rls_denied` |
| `PGRST116` no rows | `not_found` |
| anything else | `db_error` (with original error on `detail`) |

## Cascade behaviour verification

The load-bearing assertion the dispatch flagged. **Executed against Supabase test branch `pjjalownnwnikjqtjhgu` via account-scoped MCP.**

Test fixture sequence:
1. `INSERT` org + `INSERT` tag `'finance'` + two employees in the same org with `tags = '{finance, payroll}'`.
2. `UPDATE tags SET name = 'accounting' WHERE id = v_tag`.
3. `DELETE FROM tags WHERE id = v_tag` (now `'accounting'`).

Three assertions on `employees.tags`:

| Stage | Expected | Observed | Outcome |
|---|---|---|---|
| Pre-rename | both rows `@> {finance, payroll}` | match | OK |
| Post-rename | both rows `@> {accounting, payroll}`, no `finance` | match | OK |
| Post-delete | neither row contains `accounting`; both still contain `payroll` | match | OK |

DO-block completed without any `RAISE EXCEPTION`. The final `RAISE NOTICE 'CASCADE INTEGRATION TEST: ALL 3 ASSERTIONS PASSED'` fired and a cleanup query confirmed `orgs_left=0, tags_left=0, emps_left=0`.

Conclusion: `tg_cascade_tag_rename_on_tags` (`array_replace`) and `tg_cascade_tag_delete_on_tags` (`array_remove`) work as designed. The service layer correctly relies on them and does NOT touch `employees.tags` from `renameTag` / `deleteTag`.

## `getTagUsageCount` query pattern

Per Q5 (resolved 2026-05-31) there is no `usage_count_cached` column. The service issues a HEAD-only PostgREST request:

```ts
supabase
  .from('employees')
  .select('id', { count: 'exact', head: true })
  .eq('org_id', orgId)
  .contains('tags', [normalisedName])
```

`.contains('tags', [name])` translates to PostgreSQL `@>` which uses the GIN index on `employees.tags` from Migration 6 — query stays index-supported.

## ServiceError enum gaps

**None.** `duplicate_tag_name` was already in the `ServiceErrorKind` union in `types.ts` (Task 2.2). All five error families in scope (validation, duplicate, RLS, not-found, db_error) are covered by existing variants. No new kinds proposed.

## Test outcomes

| Suite | Result |
|---|---|
| `tags.test.ts` | 40 passed, 0 failed |
| Full vitest run | 2860 passed, 32 skipped, 0 failed |
| `tsc --noEmit` | clean |
| Cascade integration (test branch SQL) | 3/3 assertions passed |

Production main UNTOUCHED. Test fixtures cleaned up.
