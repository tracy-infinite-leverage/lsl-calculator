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

/** Lower-case a string for case-insensitive matching. */
function lc(s: string): string {
  return s.toLowerCase();
}

/**
 * Score one raw code against one alias row. Returns the alias's stored
 * confidence on a match, or 0 on no-match.
 *
 * Match semantics per spec §4.3 + §5.4:
 *   - `code_value`  → equality on case-folded full string.
 *   - `code_prefix` → case-folded raw code starts-with the pattern.
 *   - `code_suffix` → case-folded raw code ends-with the pattern.
 */
function scoreAlias(rawCode: string, alias: PayCodeAliasRow): number {
  const rc = lc(rawCode);
  const p = lc(alias.pattern);
  switch (alias.pattern_kind) {
    case "code_value":
      return rc === p ? alias.confidence : 0;
    case "code_prefix":
      return rc.startsWith(p) ? alias.confidence : 0;
    case "code_suffix":
      return rc.endsWith(p) ? alias.confidence : 0;
    default:
      // header_name aliases never apply to value detection.
      return 0;
  }
}

/**
 * Detect bucket proposals for a set of distinct raw pay codes.
 *
 * @param distinctCodes Distinct raw code values seen in the import.
 * @param orgMappings The org's existing live `pay_code_mappings` rows.
 *   Used for silent resolution of already-mapped codes (highest priority).
 *   Pass `[]` for first-import flow.
 * @param aliases System-level `pay_code_aliases` rows with
 *   `pattern_kind ∈ (code_value, code_prefix, code_suffix)`. The caller
 *   pre-filters and passes them in. `header_name` rows are ignored if
 *   passed, so callers can safely pass the full alias set.
 */
export function detectPayCodes(
  distinctCodes: string[],
  orgMappings: MappingRow[],
  aliases: PayCodeAliasRow[],
): PayCodeProposal[] {
  // Build the historical lookup: lower(raw_code) → bucket. Ignores
  // archived rows (spec §4.1 — archived codes don't shadow new ones).
  const historical = new Map<string, MappingRow>();
  for (const m of orgMappings) {
    if (m.archived_at !== null) continue;
    historical.set(lc(m.raw_code), m);
  }

  // Pre-filter aliases once.
  const valueAliases = aliases.filter(
    (a) =>
      a.pattern_kind === "code_value" ||
      a.pattern_kind === "code_prefix" ||
      a.pattern_kind === "code_suffix",
  );

  const proposals: PayCodeProposal[] = [];
  const emitted = new Set<string>();

  for (const raw of distinctCodes) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    const dedupKey = lc(trimmed);
    if (emitted.has(dedupKey)) continue;
    emitted.add(dedupKey);

    // ─── 1. Historical match (silent). Spec §5.4 step 7a. ────────────
    const hist = historical.get(dedupKey);
    if (hist) {
      proposals.push({
        rawCode: trimmed,
        bucket: hist.bucket,
        confidence: 1.0,
        source: "historical",
      });
      continue;
    }

    // ─── 2. Score against value/prefix/suffix aliases. ───────────────
    let best: { score: number; alias: PayCodeAliasRow } | null = null;
    for (const a of valueAliases) {
      const s = scoreAlias(trimmed, a);
      if (s > 0 && (!best || s > best.score)) {
        best = { score: s, alias: a };
      } else if (s > 0 && best && s === best.score) {
        // Tie-break: prefer the more-specific kind. code_value > code_prefix > code_suffix.
        const order = (k: string) =>
          k === "code_value" ? 3 : k === "code_prefix" ? 2 : 1;
        if (order(a.pattern_kind) > order(best.alias.pattern_kind)) {
          best = { score: s, alias: a };
        } else if (
          order(a.pattern_kind) === order(best.alias.pattern_kind) &&
          a.pattern.length > best.alias.pattern.length
        ) {
          // Same kind, same score — prefer the LONGER pattern (more specific).
          best = { score: s, alias: a };
        }
      }
    }

    // ─── 3. Threshold-gate. Spec §5.4 step 7c. ───────────────────────
    if (best && best.score >= PAY_CODE_VALUE_PROPOSE_THRESHOLD) {
      proposals.push({
        rawCode: trimmed,
        bucket: best.alias.bucket,
        confidence: best.score,
        source: "auto_mapped",
        matchedAliasPattern: best.alias.pattern,
        matchedAliasKind: best.alias.pattern_kind,
      });
      continue;
    }

    proposals.push({
      rawCode: trimmed,
      bucket: null,
      confidence: 0,
      source: "needs_review",
    });
  }

  return proposals;
}
