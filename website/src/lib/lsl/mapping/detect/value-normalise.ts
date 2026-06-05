/**
 * Value-normalisation detection — spec §5.3 (Pass 1, deterministic).
 *
 * Pure function. No DB writes, no side effects. Reads pre-loaded
 * `value_normalisation_aliases` rows (system + org-scoped) from the call-site.
 *
 * For each column whose header indicates a `target_field` of
 * `value_normalisation_aliases` (state, employment-type, pay-frequency),
 * collect the unique surface forms and propose a canonical value for each.
 *
 * Org-scoped rows shadow system rows on the same `(target_field, lower(surface_form))`.
 *
 * **OQ-ING-9 / OQ-MAP-9 lock (revised 2026-06-01 post PR #105 schema verification).**
 * The "Cohort" concept seen in customer files (e.g. `VIC-TAS`) is NOT stored
 * as a `states[]` array on the employee. The merged schema has singular
 * `default_work_jurisdiction`, and `pay_periods.work_jurisdiction` is the
 * authoritative per-period state at valuation time. The canonical
 * distinct-jurisdictions set per employee is DERIVED from their pay-period
 * rows at valuation time (E5.5 engine input).
 *
 * When this detector encounters a column whose header pattern matches
 * `cohort` OR whose values contain hyphenated state pairs like `VIC-TAS`, it:
 *   1. Splits on `-` and validates each side against the state aliases.
 *   2. Returns the cohort label as a `crossJurisdictionFlag` annotation on the
 *      proposal row — flagging the system to expect work_jurisdiction values
 *      from each parsed state in subsequent pay-period ingestion.
 *   3. Does NOT return a `states: ['VIC', 'TAS']` array as a target field.
 */

import type { ValueNormaliseAliasRow } from "@/lib/db/types";
import { normaliseToken, normaliseValuePreservingHyphen } from "./util";

/** Target fields the value-normalisation detector handles. */
export type NormalisationTargetField =
  | "work_jurisdiction"
  | "employment_type"
  | "pay_frequency";

/** Provenance of a proposal — drives the wizard's status pill. */
export type ProposalSource =
  | "historical"        // org-scoped row matched (silent resolution)
  | "system_seed"       // system row matched (one-click accept)
  | "needs_review";     // unresolved — defer to Pass 2 / manual pick

/** A single proposed normalisation row for one surface form. */
export interface NormalisationProposal {
  targetField: NormalisationTargetField;
  /** The raw value seen in the file. */
  surfaceForm: string;
  /**
   * The proposed canonical enum value (e.g. `'TAS'`, `'casual'`, `'weekly'`).
   * `null` when source is `needs_review`.
   */
  canonicalValue: string | null;
  /** 0..1 — alias confidence carried through from the source row. */
  confidence: number;
  source: ProposalSource;
  /**
   * Cross-jurisdiction annotation per OQ-ING-9 / OQ-MAP-9 lock.
   * Populated ONLY for cohort/multi-state surface forms (e.g. `VIC-TAS`).
   * The wizard surfaces this; downstream it is NOT persisted as an
   * employee-level field. See module JSDoc for the architecture invariant.
   */
  crossJurisdictionFlag?: boolean;
  /** The validated state codes parsed from a multi-state cohort label. */
  hintedJurisdictions?: string[];
}

/**
 * Build a fast lookup from `(target_field, normalised surface_form)` →
 * proposal. Org-scoped rows shadow system rows.
 *
 * Order of construction:
 *   1. Insert system rows first.
 *   2. Insert org rows second — they overwrite any system row at the same
 *      lookup key, implementing the §4.4 shadowing rule.
 *
 * Match priority is captured as `source`: `'historical'` for org rows,
 * `'system_seed'` for system rows.
 */
interface AliasLookupValue {
  canonicalValue: string;
  confidence: number;
  source: Exclude<ProposalSource, "needs_review">;
}

function buildAliasLookup(
  targetField: NormalisationTargetField,
  aliases: ValueNormaliseAliasRow[],
): Map<string, AliasLookupValue> {
  const lookup = new Map<string, AliasLookupValue>();
  const relevant = aliases.filter((a) => a.target_field === targetField);

  // System rows first.
  for (const row of relevant) {
    if (row.org_id !== null) continue;
    const key = normaliseValuePreservingHyphen(row.surface_form);
    lookup.set(key, {
      canonicalValue: row.canonical_value,
      confidence: row.confidence,
      source: "system_seed",
    });
  }

  // Org rows second — overwrite.
  for (const row of relevant) {
    if (row.org_id === null) continue;
    const key = normaliseValuePreservingHyphen(row.surface_form);
    lookup.set(key, {
      canonicalValue: row.canonical_value,
      confidence: row.confidence,
      source: "historical",
    });
  }

  return lookup;
}

/**
 * Parse a candidate cohort label (e.g. `VIC-TAS`, `NSW-QLD-WA`) into its
 * jurisdiction codes by splitting on `-` and resolving each side against
 * the system jurisdiction lookup.
 *
 * Returns the validated jurisdictions iff EVERY split-segment resolves to
 * a known jurisdiction; otherwise returns `null` (so the caller can fall
 * back to a regular single-value match for surface forms like
 * `'Sale-Tasmania'` that contain a hyphen but aren't a cohort).
 */
function parseCohortLabel(
  surfaceForm: string,
  jurisdictionLookup: Map<string, AliasLookupValue>,
): string[] | null {
  // Pre-condition: must contain a hyphen.
  if (!surfaceForm.includes("-")) return null;

  const segments = surfaceForm
    .split("-")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  const resolved: string[] = [];
  for (const seg of segments) {
    const key = normaliseValuePreservingHyphen(seg);
    const hit = jurisdictionLookup.get(key);
    if (!hit) return null; // Any unresolved segment → not a cohort.
    resolved.push(hit.canonicalValue);
  }

  // De-duplicate while preserving order (a cohort label `NSW-NSW` would be
  // weird but should still validate as `['NSW']`).
  const seen = new Set<string>();
  return resolved.filter((j) => {
    if (seen.has(j)) return false;
    seen.add(j);
    return true;
  });
}

/**
 * Detect canonical value mappings for a column's unique surface forms.
 *
 * @param targetField Which canonical enum we're resolving against.
 * @param surfaceForms Distinct surface forms seen in the column.
 * @param aliases All visible `value_normalisation_aliases` rows for this
 *   target field — both system rows (`org_id IS NULL`) and the caller's
 *   org-scoped rows. The function applies the shadowing rule (org overrides
 *   system on identical `(target_field, lower(surface_form))`).
 */
export function detectValueNormalisations(
  targetField: NormalisationTargetField,
  surfaceForms: string[],
  aliases: ValueNormaliseAliasRow[],
): NormalisationProposal[] {
  const primaryLookup = buildAliasLookup(targetField, aliases);

  // The cohort branch is only active for the jurisdiction target field.
  // (Cohort labels are pairs of states; they only make sense there.)
  // We need the jurisdiction lookup REGARDLESS of `targetField` so we
  // can resolve a `VIC-TAS` cohort even if it appears in a column the
  // ingestion layer typed as `work_jurisdiction`. (Spec §5.3 only routes
  // cohort columns into `work_jurisdiction` detection so this is the
  // common path.)
  const jurisdictionLookup =
    targetField === "work_jurisdiction"
      ? primaryLookup
      : buildAliasLookup("work_jurisdiction", aliases);

  const proposals: NormalisationProposal[] = [];
  const emitted = new Set<string>(); // Dedup by lower-cased surface form.

  for (const raw of surfaceForms) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    const dedupKey = trimmed.toLowerCase();
    if (emitted.has(dedupKey)) continue;
    emitted.add(dedupKey);

    // ─── Cohort / cross-jurisdiction branch (work_jurisdiction only) ──
    // Spec §5.3 + OQ-ING-9 / OQ-MAP-9 lock.
    if (targetField === "work_jurisdiction" && trimmed.includes("-")) {
      const hinted = parseCohortLabel(trimmed, jurisdictionLookup);
      if (hinted && hinted.length >= 2) {
        // Multi-state cohort — emit `crossJurisdictionFlag` annotation.
        // canonicalValue is null because no single-value mapping applies;
        // the wizard renders this row as a multi-select pill set and the
        // ingestion layer uses `hintedJurisdictions` to validate that
        // pay-period work_jurisdiction values fall within the set.
        proposals.push({
          targetField,
          surfaceForm: trimmed,
          canonicalValue: null,
          confidence: 0.9, // Parsed-from-known-state-segments is high-confidence.
          source: "system_seed",
          crossJurisdictionFlag: true,
          hintedJurisdictions: hinted,
        });
        continue;
      }
      // Hyphen present but not a cohort — fall through to standard match
      // (e.g. surface form is a hyphenated free-text label).
    }

    // ─── Standard alias-lookup branch ─────────────────────────────────
    const key = normaliseValuePreservingHyphen(trimmed);
    const hit = primaryLookup.get(key);
    if (hit) {
      proposals.push({
        targetField,
        surfaceForm: trimmed,
        canonicalValue: hit.canonicalValue,
        confidence: hit.confidence,
        source: hit.source,
      });
      continue;
    }

    // Fallback: also try a non-hyphen-preserving normalisation. This
    // handles `'Bi-weekly'` matching a seed row stored as `'biweekly'`
    // (some vendors), AND `'PT - Part-time Salary'` matching a seed
    // stored without the inner hyphen.
    const looseKey = normaliseToken(trimmed);
    let looseHit: AliasLookupValue | null = null;
    if (looseKey !== key) {
      for (const [storedKey, value] of primaryLookup.entries()) {
        if (normaliseToken(storedKey) === looseKey) {
          looseHit = value;
          break;
        }
      }
    }
    if (looseHit) {
      proposals.push({
        targetField,
        surfaceForm: trimmed,
        canonicalValue: looseHit.canonicalValue,
        confidence: Math.max(0, looseHit.confidence - 0.05), // Slight penalty.
        source: looseHit.source,
      });
      continue;
    }

    // ─── Unresolved ───────────────────────────────────────────────────
    proposals.push({
      targetField,
      surfaceForm: trimmed,
      canonicalValue: null,
      confidence: 0,
      source: "needs_review",
    });
  }

  return proposals;
}
