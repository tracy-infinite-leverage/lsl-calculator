/**
 * NT-specific extra-inputs.
 *
 * The NT engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation, although the per-year
 * `RP × HWW × 1.3` formula (NT LSL Act 1981 s.11(3)) is load-bearing and
 * relies on `nt_hours_per_week_by_year` when hours have varied across the
 * employee's service.
 *
 * Per TBD-NT-01 RESOLVED 2026-05-27 (Option (a)): every NT-specific signal is
 * NT-localised via `extraInputs.nt_*` keys. NO new cross-state schema fields
 * were added — `Employee.dob` already exists from ACT Phase 7 and is consumed
 * for the s.10(2) retirement-age qualifying-reason gate (Age Pension age per
 * Cth Social Security Act 1991 s.23, currently 67 sex-neutral). Parallel to
 * SA TBD-SA-04/-07, ACT TBD-ACT-04/-07, and TAS TBD-TAS-01 RESOLVED precedents
 * — no DEV-CROSS-3 dev-finding required.
 *
 * See `docs/qa/test-cases-nt.md` v1.0 PM-signed 2026-05-27 for fixtures that
 * exercise each key.
 */

/** Per-year hours-per-week entry per TBD-NT-01 RESOLVED schema. */
export interface NTHoursPerWeekByYear {
  yearStart: string;
  yearEnd: string;
  hoursPerWeek: number;
}

export interface NTExtraInputs {
  /**
   * Per-year hours-per-week history for the NT s.11(3) per-year formula:
   *   value_of_LSL = Σ over each completed year of service: RP × HWW × 1.3
   * where RP = rate at cessation/LSL-start and HWW = hours per week during
   * that year (excluding overtime).
   *
   * Per TBD-NT-01 RESOLVED 2026-05-27 (Option (a)) — TAS-style state-localised
   * encoding (NOT a top-level Employee.hoursPerWeekByYear; YAGNI parallel to
   * SA TBD-SA-07 ruling). When EMPTY and `currentWeeklyGross` is supplied,
   * engine falls back to single-year flat path and emits
   * `nt_per_year_hours_history_missing`. When supplied but incomplete (some
   * years missing), engine fills the missing years from `currentWeeklyGross`
   * and emits `nt_per_year_hours_history_partial`.
   *
   * Shape per signed test-cases-nt.md schema additions (line 183): an array
   * of `{yearStart, yearEnd, hoursPerWeek}` records, NOT a keyed map.
   */
  nt_hours_per_week_by_year?: NTHoursPerWeekByYear[];

  /**
   * Operator override for the s.10(2) retirement-reason qualifying gate when
   * `employee.dob` is unavailable, uncertain, or privacy-restricted. When
   * `true`, retirement qualifies regardless of dob. Per TBD-NT-02 RESOLVED
   * Option (b)+(c) — dob lookup table per Cth SS Act 1991 s.23 layered with
   * operator override path.
   */
  nt_age_pension_age_at_termination_reached?: boolean;

  /**
   * Operator-supplied confirmation that a casual employee meets continuity
   * under NT s.12. The NT Act contains NO specific quantitative casual-
   * continuity test (unlike TAS s.5(3) 32hr/4wk or NSW "regular and
   * systematic"). Per TBD-NT-03 RESOLVED Option (a) — permissive default
   * absent statutory authority, aligning with benefits-conferring construction.
   *
   * `undefined` → engine defaults permissive (continuity preserved) and emits
   * `nt_casual_continuity_preserved_default`. `true` → continuity preserved,
   * no advisory. `false` → continuity broken, pre-break service forfeited,
   * emit `nt_casual_continuity_broken`.
   */
  nt_casual_continuity_preserved?: boolean;

  /**
   * Operator-supplied confirmation that a detected bonus in `wageHistory.note`
   * meets the s.7(2)(b) "usually paid with pay" inclusion test. NT has the
   * BROADEST bonus-inclusion rule of any Australian state — when bonuses are
   * "usually paid with pay" they are part of ordinary pay. Per TBD-NT-07
   * RESOLVED Option (a) — operator flag (default `false` = exclude). Engine
   * does NOT auto-detect from `wageHistory.note`; advisory either way.
   */
  nt_bonus_usually_paid_with_pay?: boolean;

  /**
   * Operator-supplied weekly cash value of board and lodging provided to the
   * employee in lieu of wages. NT s.7(2)(c) includes board/lodging in ordinary
   * pay with NT-unique statutory dollar fallbacks ($15/wk board + $5/wk
   * lodging). Per TBD-NT-11 RESOLVED Option (c) — v1 defers cash-value
   * computation to the operator (consistent with other 7 states); operator
   * pre-strips board+lodging into `currentWeeklyGross` and supplies this field
   * only to emit the advisory. Re-evaluated at RES-3.
   */
  nt_board_lodging_cash_value_weekly?: number;

  /**
   * Operator-supplied total additional service years with related corporations
   * per NT s.12(6)/(7) ("related corporation" per Corporations Act 2001).
   * Added to `years_of_continuous_service`. Per TBD-NT-15 RESOLVED — parallel
   * to WA/SA related-corp aggregation. Default 0.
   */
  nt_related_corporation_service_years?: number;

  /**
   * Operator-supplied flag clarifying whether s.10(2)'s
   * "employer-not-misconduct" qualifying reason applies. Per TBD-NT-04
   * RESOLVED Option (a) — strict closed-list reading: voluntary resignation
   * 7–10 yrs pays $0 (binary 10-yr cliff). When `true` AND the termination
   * reason does not indicate misconduct, the s.10(2) gate is satisfied via
   * the employer-not-misconduct path and the retirement-age gate is bypassed.
   */
  nt_employer_initiated_dismissal?: boolean;
}
