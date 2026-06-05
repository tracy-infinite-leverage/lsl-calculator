// E5.3 Phase 2 / Task T2.1 — pay-code value-pattern detection skeleton.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5.4
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2 / step 2.5
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.5
//
// Implementation lands in T2.5.

import type {
  MappingRow,
  PayCodeAliasRow,
  ProposalRow,
} from './types';

/**
 * For each distinct raw pay code in the import, propose a bucket.
 *
 * Resolution precedence (per spec §5.4):
 *
 *   1. `(org_id, lower(raw_code))` exists in `pay_code_mappings` → silent
 *      resolution to the current mapping with `source = 'historical'`.
 *   2. Else, score against `pay_code_aliases` rows where
 *      `pattern_kind ∈ ('code_value', 'code_prefix', 'code_suffix')`.
 *      Highest-scoring proposal wins.
 *   3. Apply `VALUE_PATTERN_PROPOSE_THRESHOLD = 0.6` gate — below threshold
 *      defers to Pass 2 with `source = 'needs_review'`.
 *
 * Pure function — no I/O, no env reads, no DB calls. The caller (E5.4
 * ingestion) loads `orgMappings` filtered to the current org via RLS.
 *
 * @param distinctCodes - Unique raw pay-code values from the import.
 * @param orgMappings   - The org's existing `pay_code_mappings` rows.
 * @param aliases       - System `pay_code_aliases` rows.
 *
 * @throws Error('not_implemented') until T2.5 lands.
 */
export function detectPayCodes(
  distinctCodes: ReadonlyArray<string>,
  orgMappings: ReadonlyArray<MappingRow>,
  aliases: ReadonlyArray<PayCodeAliasRow>,
): ReadonlyArray<ProposalRow> {
  void distinctCodes;
  void orgMappings;
  void aliases;
  throw new Error(
    'detectPayCodes not_implemented — T2.1 scaffold; implementation in T2.5',
  );
}
