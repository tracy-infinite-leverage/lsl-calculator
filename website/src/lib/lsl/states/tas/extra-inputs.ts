/**
 * TAS-specific extra-inputs.
 *
 * The TAS engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * Per TBD-TAS-01 / TBD-TAS-02 / TBD-TAS-04 / TBD-TAS-09 / TBD-TAS-12 RESOLUTIONS
 * (2026-05-26): every TAS-specific signal is TAS-localised via `extraInputs.tas_*`
 * keys. NO new cross-state schema fields were added at engine boundary (the only
 * top-level cross-state addition is `Employee.sex`, gated to TAS-conditional
 * read in the orchestrator — see TBD-TAS-02 RESOLVED Option (a)). Parallel to
 * SA TBD-SA-04/-07 and ACT TBD-ACT-04/-07 RESOLVED precedents — no DEV-CROSS-N
 * dev-finding anticipated.
 *
 * See `docs/qa/test-cases-tas.md` v1.0 PM-signed 2026-05-26 for fixtures that
 * exercise each key.
 */
export interface TASExtraInputs {
  /**
   * Per-day shift penalty multipliers applicable on the days LSL is taken.
   * Keys are ISO dates (YYYY-MM-DD). Used by the TAS day-to-day rate
   * variation rule (TBD-TAS-01 RESOLVED). Locked arithmetic per operator
   * spec: per-day rate = `(base × penalty_multiplier) + allowance`. When
   * empty / undefined, engine falls back to flat `currentWeeklyGross` for
   * FT/PT and emits the `tas_shift_penalty_assumed_included_in_weekly_gross`
   * advisory.
   */
  tas_shift_penalty_by_day?: Record<string, number>;

  /**
   * Per-day all-purpose allowance amounts (AUD per day, e.g. tool allowance,
   * qualification allowance) applicable on the LSL days. Keys are ISO dates.
   * Added to base rate on those days per TBD-TAS-01 RESOLVED.
   */
  tas_all_purpose_allowance_by_day?: Record<string, number>;

  /**
   * Award-specified minimum retirement age reached. Bypasses the s.8(3)
   * literal sex-specific default reading (60 women / 65 men) and treats the
   * retirement reason as qualifying for pro-rata. Per TBD-TAS-02 RESOLVED
   * Option (a) — operator override path.
   */
  tas_award_min_retirement_age_reached?: boolean;

  /**
   * Operator-supplied confirmation that the casual employee meets the s.5(3)
   * "32 hours per consecutive 4-week period" continuity test. Per TBD-TAS-04
   * RESOLVED Option (c) hybrid hierarchy: engine attempts auto-derivation
   * from `wageHistory` 4-wk sliding windows first; falls back to this flag
   * if windows are sparse (>25% missing entries); defaults permissive plus
   * `tas_casual_32hr_4wk_test_not_verified` advisory if neither signal is
   * available.
   */
  tas_casual_32hr_4wk_periods_compliant?: boolean;

  /**
   * Operator-supplied date at which casual continuity was broken under
   * s.5(3). Used when `tas_casual_32hr_4wk_periods_compliant` is `false`
   * and the engine cannot auto-derive the break-point from `wageHistory`.
   * Per TBD-TAS-04 RESOLVED.
   */
  tas_casual_continuity_break_date?: string;

  /**
   * Whether the employee is engaged in Northern Tasmania (used by the
   * TBD-TAS-09 Sev-3 locality flag — reserved; no v1 calculation effect).
   */
  tas_employee_in_northern_tas?: boolean;

  /**
   * s.5 slackness-of-trade re-employment: 6-month tolerance applies ONLY if
   * the return-to-work offer was accepted within 14 days. Per TBD-TAS-12
   * Sev-3 RESOLVED. Default false → standard 3-month break tolerance used.
   */
  tas_slackness_return_within_14_days?: boolean;

  /** Loaded base hourly rate (incl. casual loading; excl. overtime premium). */
  currentHourlyRate?: number | string;

  /**
   * Total hours in the 12 mo immediately prior to the 10-yr entitlement date
   * (s.11(6) casual/PT averaging window — taking_leave path).
   */
  hoursLast12MonthsBeforeEntitlement?: number;

  /**
   * Total hours in the 12 mo immediately prior to cessation (s.11(6) anchored
   * at termination).
   */
  hoursLast12MonthsBeforeCessation?: number;
}
