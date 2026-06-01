/**
 * families.ts — report-family registry for the PDF pipeline.
 *
 * E6.5 Task 5.5 (spec §5.3, impl-plan §1.3 — resolves G-1). Single source of
 * truth for:
 *
 *   1. The four `ReportFamily` identifiers accepted by `POST /api/reports/:family`.
 *   2. The auth posture of each family (`'public'` vs `'authenticated'`) —
 *      the load-bearing OQ-6 contract that public-calc PDFs ship without
 *      coupling to E5.1 session middleware.
 *   3. The `isKnownFamily` type-guard used by the route handler to narrow the
 *      raw `string` URL segment into a typed `ReportFamily`.
 *
 * ----------------------------------------------------------------------------
 * Why a separate module from the route handler
 * ----------------------------------------------------------------------------
 *
 * The route handler (`app/api/reports/[family]/route.ts`) is a Next.js entry
 * point — it picks up runtime context (cookies, params) and wires the dispatch.
 * The family registry is a pure data + typeguard module that other layers can
 * import without dragging the runtime in:
 *
 *   - Phase 5a templates (Tasks 6.1 + 6.2) will add a `FAMILY_TEMPLATE` map
 *     here that points each family at its `(context, payload) => ReactElement`
 *     renderer.
 *   - Tests can assert posture-contract invariants without bootstrapping the
 *     route handler.
 *   - The Task 5.5-bis e2e contract test (separate PR) only needs to import
 *     this module to enumerate the families it must hit.
 *
 * The posture map is `Record<ReportFamily, 'public' | 'authenticated'>` rather
 * than two `readonly string[]` constants because that shape makes it
 * impossible to add a new family without giving it a posture — TypeScript's
 * exhaustiveness check at the `Record` site is the guard.
 */

/**
 * The four report families served by `POST /api/reports/:family`.
 *
 * Order is intentional — public families first (Phase 5a) then authenticated
 * families (Phase 5b). The order has no runtime semantics; this is a stable
 * type-level union.
 */
export type ReportFamily =
  | 'single-employee'
  | 'bulk-summary'
  | 'liability'
  | 'reconciliation';

/**
 * Posture per family (impl-plan §1.3 table — load-bearing, resolves G-1).
 *
 * `'public'` families MUST NOT touch Supabase or read session cookies in
 * the route handler. `'authenticated'` families MUST return 401 without a
 * valid Supabase session.
 *
 * The route handler branches on this map BEFORE invoking any auth check
 * so the public path is independent of E5.1's merge to `main`.
 */
export const FAMILY_POSTURE: Record<ReportFamily, 'public' | 'authenticated'> = {
  'single-employee': 'public',
  'bulk-summary': 'public',
  liability: 'authenticated',
  reconciliation: 'authenticated',
};

/**
 * Stable enumerated list of every known family. Derived from `FAMILY_POSTURE`
 * keys so the two stay in lockstep — any new family added to the posture map
 * automatically appears in this list at type-level.
 *
 * Exposed as `ReadonlyArray<ReportFamily>` so callers cannot mutate.
 */
export const KNOWN_FAMILIES: ReadonlyArray<ReportFamily> = Object.keys(
  FAMILY_POSTURE,
) as ReadonlyArray<ReportFamily>;

/**
 * Narrowing type-guard for the `family` URL segment.
 *
 * The Next.js route handler receives `family` as a raw `string`. This guard
 * narrows it into the `ReportFamily` union so the rest of the handler is
 * type-safe.
 */
export function isKnownFamily(value: string): value is ReportFamily {
  return Object.prototype.hasOwnProperty.call(FAMILY_POSTURE, value);
}
