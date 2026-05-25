/**
 * WA-specific extra-inputs.
 *
 * The WA engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * DEV-CROSS-2 (2026-05-25) extensions live on the state-agnostic shapes:
 *   - `slacknessOfTrade`, `paidConcurrent`, `returnToWorkProgram`,
 *     `reasonableExpectationOfReturn` are on `ContinuousServiceEvent`.
 *   - `mealsAndAccommodationCashValueWeekly` is on `Employee`.
 *
 * See `states/extra-inputs.md` for the cross-state pattern and
 * `docs/qa/test-cases-wa.md` for fixtures.
 */
export interface WAExtraInputs {
  /**
   * Loaded casual hourly rate (including casual loading) per WA LSL Act 1958
   * s.9 (as amended 2022) — "ordinary pay for long service leave purposes
   * includes their casual loading". When set together with `hoursLast52Weeks`
   * (or `hoursAccrualBlock1` / `hoursPartialBlock2`), the casual value-of-week
   * is computed by accrual-period averaging. If absent, the engine falls back
   * to `currentWeeklyGross`.
   */
  currentHourlyRate?: number | string;

  /**
   * Total ordinary hours worked in the 52 weeks ending at the prescribed date.
   * Used by the casual value-of-week fallback when accrual-block-level hours
   * data is not supplied.
   */
  hoursLast52Weeks?: number;

  /**
   * Total ordinary hours in the FIRST 10-year accrual block. Drives WA's
   * accrual-period averaging (TBD-WA-06 resolution — partial-duration averaging
   * per accrual block). Used for the first 8.6667 weeks of payable LSL.
   */
  hoursAccrualBlock1?: number;

  /**
   * Total ordinary hours in the SECOND 5-year accrual block (or partial block).
   * Used when the employee has tenure beyond 10 years. The engine averages
   * over the partial duration, not extrapolated to 5 years (TBD-WA-06).
   */
  hoursAccrualBlock2?: number;

  /**
   * Total ordinary hours in a partial second accrual block (years 10 → end of
   * tenure where tenure is < 15 yrs). Same purpose as `hoursAccrualBlock2`
   * but explicitly named for partial cases (fixture naming carries through
   * from test-cases-wa.md).
   */
  hoursPartialBlock2?: number;

  /**
   * Commission earnings in the previous 365 days, per WA LSL Act 1958 s.9 as
   * amended 2022 — for results-based pay, the average weekly rate earned in
   * the previous 365 days = total / 365 × 7.
   */
  commissionEarningsLast365Days?: number | string;

  /**
   * Pre-injury weekly rate. Diagnostic only in WA per TBD-WA-05 resolution —
   * WA has NO equivalent of VIC s.17 higher-of-rates. The engine emits an
   * advisory warning when a WC absence overlaps the trigger date but does
   * NOT auto-uplift.
   */
  preInjuryWeeklyRate?: number | string;

  /**
   * Public holidays falling within an in-progress LSL window — per WA LSL
   * Act 1958 s.9. PHs extend the leave-period; the engine does not maintain
   * a holiday calendar in v1, so the form passes them explicitly.
   */
  publicHolidaysInWindow?: string[];

  /**
   * Insufficient-data-granularity flag for the regime-split fallback (AC8).
   * When `true`, the engine applies post-2022 rules to the entire tenure as
   * a single-regime fallback and emits `wa_regime_split_data_insufficient`.
   */
  regimeSplitDataInsufficient?: boolean;
}
