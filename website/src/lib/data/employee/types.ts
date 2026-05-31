/**
 * Shared types + ServiceError taxonomy for the Employee Masterfile service layer.
 *
 * Phase 2 (Task 2.2) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.2
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.6
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2
 *
 * Design notes
 * ────────────
 * Every service-layer entry point returns the `Result<T>` discriminated union
 * below. Route handlers (Phase 3) translate `error.kind` → HTTP status code;
 * tests assert on `error.kind` not on free-form messages. Adding a new error
 * kind is a deliberate API change — every consumer's switch is exhaustive.
 *
 * Operator ratification proposal (PR body):
 *   - 11 ServiceError kinds enumerated below, organised in four families:
 *       1. Validation         — `validation_failed`, `invalid_jurisdiction`, `invalid_employment_type`,
 *                                `invalid_pay_frequency`, `invalid_scheme`, `pii_header_rejected`
 *       2. Duplicates         — `duplicate_external_id`, `duplicate_tag_name`
 *       3. History conflicts  — `history_overlap`
 *       4. Auth / not-found   — `rls_denied`, `not_found`
 *       5. Unexpected         — `parse_failed`, `db_error`
 *
 *   - Each error carries an optional `field` (for validation) plus an
 *     optional `detail` payload for debugging. `field` is the *masterfile*
 *     field name (e.g. `employee_external_id`), not the engine field name,
 *     so the dev-EMP-1 mapping table is preserved at the boundary.
 *
 * The route-handler HTTP mapping (Phase 3) is documented but NOT exported
 * from this file — keeping it close to the route handlers makes the boundary
 * explicit. Suggested mapping (for the PR-body summary):
 *
 *   validation_failed / invalid_*    → 400
 *   duplicate_external_id            → 409
 *   duplicate_tag_name               → 409
 *   history_overlap                  → 409
 *   pii_header_rejected              → 400 (warning surfaced in body)
 *   rls_denied                       → 403
 *   not_found                        → 404
 *   parse_failed                     → 400
 *   db_error                         → 500
 */

/**
 * Canonical taxonomy of error kinds the service layer can return.
 *
 * Add new variants here when a new failure mode is genuinely distinct from
 * the existing ones. Prefer reusing an existing kind with a narrower `field`
 * / `detail` over inventing a near-duplicate kind.
 */
export type ServiceErrorKind =
  // Validation family — input shape / value problems caught before DB.
  | 'validation_failed'
  | 'invalid_jurisdiction'
  | 'invalid_employment_type'
  | 'invalid_pay_frequency'
  | 'invalid_scheme'
  | 'pii_header_rejected'
  // Duplicate family — UNIQUE / dedup violations surfaced to the caller.
  | 'duplicate_external_id'
  | 'duplicate_tag_name'
  // History family — effective-dated EXCLUDE constraint conflicts (23P01).
  | 'history_overlap'
  // Auth / lookup family.
  | 'rls_denied'
  | 'not_found'
  // Catch-alls — these signal a bug or a transient DB problem, not user error.
  | 'parse_failed'
  | 'db_error';

/**
 * Structured service error. Free-form `message` is for logging / UI display;
 * structured `kind` + `field` + `detail` are for programmatic handling.
 *
 * `field` is the *masterfile* field name (e.g. `employee_external_id`), NOT
 * the engine field name. The DEV-EMP-1 mapping happens at the engine adapter
 * (E5.5), not here.
 *
 * `detail` is an opaque debug payload. Route handlers MUST NOT echo `detail`
 * to clients — it may carry PII-adjacent breadcrumbs (raw row indices, etc.).
 * Logging it server-side is fine.
 */
export interface ServiceError {
  kind: ServiceErrorKind;
  message: string;
  field?: string;
  detail?: unknown;
}

/**
 * Discriminated-union return type for every service-layer function.
 *
 * Callers exhaustively switch on `result.ok`:
 *
 *   const result = await createEmployee(supabase, orgId, payload);
 *   if (!result.ok) {
 *     switch (result.error.kind) {
 *       case 'duplicate_external_id': ...
 *       case 'validation_failed': ...
 *       ...
 *     }
 *     return;
 *   }
 *   // result.data is fully typed
 */
export type Result<T, E = ServiceError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Convenience constructors. Use these in service-layer code rather than
 * inlining `{ ok: true, data }` / `{ ok: false, error }` so the call sites
 * stay readable and a future refactor of the union shape is mechanical.
 */
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(
  kind: ServiceErrorKind,
  message: string,
  options?: { field?: string; detail?: unknown },
): Result<never> {
  const error: ServiceError = { kind, message };
  if (options?.field !== undefined) error.field = options.field;
  if (options?.detail !== undefined) error.detail = options.detail;
  return { ok: false, error };
}
