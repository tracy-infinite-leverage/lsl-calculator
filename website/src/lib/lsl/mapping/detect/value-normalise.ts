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
 * Detect canonical value mappings for a column's unique surface forms.
 * Implementation lands in T2.4.
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
  void targetField;
  void surfaceForms;
  void aliases;
  throw new Error("detectValueNormalisations not implemented — lands in T2.4");
}
