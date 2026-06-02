/**
 * Barrel export for the PDF report templates folder.
 *
 * E6.5 Task 6.1+. Re-exports the four family templates as they land:
 *
 *   - Task 6.1 (THIS PR):       `SingleEmployee` — public, single-employee LSL result.
 *   - Task 6.2 (next):          `BulkSummary`   — public, bulk-employee summary.
 *   - Task E5.5 (Phase 5b):     `Liability`     — authenticated, liability valuation.
 *   - Task E5.6 (Phase 5b):     `Reconciliation`— authenticated, EOFY reconciliation.
 *
 * Task 6.3 will import from this barrel to register the family → renderer map
 * in `/api/reports/[family]/route.ts`. Keeping the dispatcher's import surface
 * narrow (one barrel) means adding a new family is a one-line addition here +
 * one line in the dispatcher map.
 */

export {
  SingleEmployee,
  dedupCitations,
  formatCitationRule,
} from './SingleEmployee';
export type {
  SingleEmployeeIdentity,
  SingleEmployeePayload,
  SingleEmployeeProps,
} from './SingleEmployee';
