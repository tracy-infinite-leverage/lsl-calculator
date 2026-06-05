// E5.3 Phase 2 / Task T2.1 — value-normalisation detection skeleton.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5.3, §4.4
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2 / step 2.4
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.4
//
// Implementation lands in T2.4. The OQ-MAP-9 / OQ-ING-9 lock — cohort labels
// like `'VIC-TAS'` are split on `-` and returned as a
// `{ crossJurisdictionFlag, hintedJurisdictions }` annotation on the
// proposal row, NOT persisted as an employee-level `states[]` field — is
// realised here.

import type {
  ProposalRow,
  ValueNormaliseAliasRow,
  ValueNormaliseTargetField,
} from './types';

/**
 * Resolve the unique surface forms found in a normalisation-target column
 * (state / employment-type / pay-frequency) against the
 * `value_normalisation_aliases` knowledge base.
 *
 * Resolution precedence (per spec §5.3):
 *
 *   1. `(org_id, target_field, lower(surface_form))` org row → silent
 *      resolution with `source = 'auto_mapped'`.
 *   2. `(NULL,  target_field, lower(surface_form))` system row → proposed
 *      with `source = 'system_seed'` (one-click accept in the wizard).
 *   3. Else → defer to Pass 2 with `source = 'needs_review'`.
 *
 * Cohort handling (OQ-MAP-9 lock — see T2.4 acceptance):
 *
 *   When a `work_jurisdiction` surface form contains a `-`, split on `-` and
 *   validate each side against the state alias rows. If both sides resolve,
 *   return a single `ProposalRow` with:
 *     - `crossJurisdictionFlag: true`
 *     - `hintedJurisdictions: ['VIC', 'TAS']`
 *     - `suggestion: null` (the row is a hint, not a persisted target field)
 *   This signals to downstream ingestion (E5.4) to expect per-pay-period
 *   work_jurisdiction values from each parsed state. The hint is NEVER
 *   stored as an employee-level `states[]` field.
 *
 * Pure function — no I/O, no env reads, no DB calls.
 *
 * @param targetField - Which canonical enum we're normalising against.
 * @param surfaceForms - Unique raw values seen in the column.
 * @param aliases - All value_normalisation_aliases rows (system + org-scoped).
 *                  Caller is responsible for RLS — service-role calls pass
 *                  everything; user-role calls only see their own org's rows
 *                  plus system rows.
 *
 * @throws Error('not_implemented') until T2.4 lands.
 */
export function detectValueNormalisations(
  targetField: ValueNormaliseTargetField,
  surfaceForms: ReadonlyArray<string>,
  aliases: ReadonlyArray<ValueNormaliseAliasRow>,
): ReadonlyArray<ProposalRow> {
  void targetField;
  void surfaceForms;
  void aliases;
  throw new Error(
    'detectValueNormalisations not_implemented — T2.1 scaffold; implementation in T2.4',
  );
}
