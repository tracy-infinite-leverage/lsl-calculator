/**
 * NT-specific extra-inputs.
 *
 * The NT engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * Per the T9.0 PM-signed test-cases-nt.md v1.0 (2026-05-27) — all NT-specific
 * signals are NT-localised via `extraInputs.nt_*` keys. NO new cross-state
 * schema fields were added at engine boundary. Parallel to TAS / SA / ACT
 * localised-extraInputs precedent. NO DEV-CROSS-3 created (TBD-NT-01 RESOLVED
 * Option (a) — state-localised `nt_hours_per_week_by_year`).
 *
 * See `docs/qa/test-cases-nt.md` v1.0 PM-signed 2026-05-27 for fixtures that
 * exercise each key.
 */

/**
 * Per-year hours-per-week entry per TBD-NT-01 RESOLVED 2026-05-27 schema
 * (the load-bearing NT engine surface).
 *
 * NT LSL Act 1981 s.11(3) computes payment as the SUM over each completed
 * year of service of `RP × HWW_y × 1.3`, where HWW_y is the average
 * hours-per-week for that specific year. The operator pre-computes per-year
 * averages and supplies them via this array.
 *
 * Operator owns the derivation. Engine consumes directly without inference.
 */
export interface NTHoursPerWeekByYearEntry {
  /** ISO YYYY-MM-DD — the start of this year-of-service window (inclusive). */
  yearStart: string;
  /** ISO YYYY-MM-DD — the end of this year-of-service window (inclusive). */
  yearEnd: string;
  /** Average hours of work per week during this year (excluding overtime). */
  hoursPerWeek: number;
}

export interface NTExtraInputs {
  /**
   * **TBD-NT-01 LOAD-BEARING — RESOLVED 2026-05-27 Option (a).**
   *
   * Per-year average hours-per-week history. Used by the s.11(3) per-year
   * formula `Σ over each completed year: RP × HWW_y × 1.3`. When `[]` or
   * undefined AND `currentWeeklyGross` is supplied, the engine falls back to
   * the single-year flat path and emits the
   * `nt_hours_per_year_history_not_supplied` advisory.
   *
   * Shape per signed test-cases-nt.md schema additions: an array of
   * `{yearStart, yearEnd, hoursPerWeek}` records, NOT a keyed map.
   */
  nt_hours_per_week_by_year?: NTHoursPerWeekByYearEntry[];

  /**
   * **TBD-NT-02 RESOLVED 2026-05-27 Option (c) override layer.**
   *
   * Operator override for the s.10(2) retirement-age gate when the operator
   * does not wish to supply `employee.dob` (privacy / data-availability).
   * When `true`, retirement qualifies regardless of dob. When `false` or
   * undefined, engine falls back to the dob → Cth Age Pension age year-of-
   * birth lookup table per Cth Social Security Act 1991 s.23.
   */
  nt_age_pension_age_at_termination_reached?: boolean;

  /**
   * **TBD-NT-03 RESOLVED 2026-05-27 Option (a).**
   *
   * Operator-supplied casual continuity flag. The NT LSL Act 1981 is silent
   * on a casual continuity test (no equivalent to TAS s.5(3) 32-hr-4-wk or
   * NSW "regular and systematic"). The engine does NOT impose a quantitative
   * test it would have to defend — operator owns the determination.
   *
   *   - `undefined` → engine treats casual service as continuous (permissive
   *                   default) + emits `nt_casual_continuity_preserved_default`.
   *   - `true`      → engine treats casual service as continuous (no advisory).
   *   - `false`     → engine requires `nt_casual_continuity_break_date`. When
   *                   supplied, that date splits service. When absent, engine
   *                   strict-zeros all service for the casual employee and
   *                   emits `nt_casual_continuity_not_preserved_no_break_date`.
   */
  nt_casual_continuity_preserved?: boolean;

  /**
   * **TBD-NT-03 RESOLVED 2026-05-27 — companion to `nt_casual_continuity_preserved`.**
   *
   * Operator-supplied date at which casual continuity was broken. Used when
   * `nt_casual_continuity_preserved === false`. Splits the service at this
   * date.
   */
  nt_casual_continuity_break_date?: string;

  /**
   * **TBD-NT-07 RESOLVED 2026-05-27 Option (a) — default exclude.**
   *
   * Operator-supplied confirmation that bonuses are "usually paid with pay"
   * for the purposes of NT s.7(2)(b) ordinary-pay inclusion (the broadest
   * bonus-inclusion rule of any Australian state).
   *
   *   - `undefined` / `false` → bonus EXCLUDED from RP (conservative default).
   *                              Emits `nt_bonus_usually_paid_with_pay_excluded`.
   *   - `true`                 → bonus INCLUDED in RP. Emits
   *                              `nt_bonus_usually_paid_with_pay_included`.
   *
   * Engine does NOT auto-detect bonus from `wageHistory.note` substring
   * matches — false-positive risk. The "usually paid with pay" determination
   * is operator-side (employer/payroll knows regular vs discretionary
   * cadence).
   */
  nt_bonus_usually_paid_with_pay?: boolean;

  /**
   * **TBD-NT-15 RESOLVED 2026-05-27.**
   *
   * Operator-supplied additional service years from related corporations
   * (per Corporations Act 2001), aggregated under NT LSL Act 1981 s.12(6)/(7).
   * Added to `years_of_continuous_service` from the `serviceEvents` walk.
   * Emits `nt_related_corporation_service_aggregated` when `> 0`.
   *
   * Default `0` — most calculations do not involve related corporations.
   */
  nt_related_corporation_service_years?: number;
}
