/**
 * Pay-code value-pattern detection — spec §5.4 (Pass 1, deterministic).
 *
 * Pure function. No DB writes, no side effects. Reads pre-loaded
 * `pay_code_aliases` rows (value-kind) and the org's historical
 * `pay_code_mappings` from the call-site.
 *
 * For each distinct raw code in the import:
 *   1. If `(org_id, lower(raw_code))` matches an existing mapping → resolve
 *      silently to the current mapping (status `historical`).
 *   2. Else, score the raw code against `pay_code_aliases` rows where
 *      `pattern_kind ∈ (code_value, code_prefix, code_suffix)`; the
 *      highest-scoring proposal becomes the wizard's default.
 *   3. If no pattern scores ≥ PAY_CODE_VALUE_PROPOSE_THRESHOLD → defer to Pass 2.
 */

import type { MappingRow, PayCodeAliasRow } from "@/lib/db/types";
import { PAY_CODE_VALUE_PROPOSE_THRESHOLD } from "./thresholds";

/** Provenance of a proposal — drives the wizard's status pill (per §6.1). */
export type PayCodeProposalSource =
  | "historical"   // matched the org's existing mapping (silent)
  | "auto_mapped"  // matched a system alias above threshold
  | "needs_review"; // no match above threshold — defer to Pass 2

export interface PayCodeProposal {
  /** The raw code value as it appears in the file. */
  rawCode: string;
  /**
   * The proposed bucket. `null` when source is `needs_review`.
   * Bucket values come from the umbrella spec §6 enum.
   */
  bucket: string | null;
  /** 0..1 — alias confidence (carried from `pay_code_aliases.confidence`). */
  confidence: number;
  source: PayCodeProposalSource;
  /**
   * Which alias `pattern` matched (for traceability). Null when the proposal
   * came from a historical mapping or is `needs_review`.
   */
  matchedAliasPattern?: string;
  /**
   * Which alias `pattern_kind` matched (`code_value`, `code_prefix`,
   * `code_suffix`). Null when historical or needs_review.
   */
  matchedAliasKind?: string;
}

/**
 * Detect bucket proposals for a set of distinct raw pay codes.
 * Implementation lands in T2.5.
 *
 * @param distinctCodes Distinct raw code values seen in the import.
 * @param orgMappings The org's existing live `pay_code_mappings` rows.
 *   Used for silent resolution of already-mapped codes (highest priority).
 * @param aliases System-level `pay_code_aliases` rows with
 *   `pattern_kind ∈ (code_value, code_prefix, code_suffix)`. The caller
 *   pre-filters and passes them in.
 */
export function detectPayCodes(
  distinctCodes: string[],
  orgMappings: MappingRow[],
  aliases: PayCodeAliasRow[],
): PayCodeProposal[] {
  void distinctCodes;
  void orgMappings;
  void aliases;
  void PAY_CODE_VALUE_PROPOSE_THRESHOLD;
  throw new Error("detectPayCodes not implemented — lands in T2.5");
}
