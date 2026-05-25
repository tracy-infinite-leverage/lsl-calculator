/**
 * QLD-specific extra-inputs.
 *
 * The QLD engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * See `states/extra-inputs.md` for the cross-state pattern and
 * `docs/qa/test-cases-qld.md` for fixtures that exercise each key.
 */
export interface QLDExtraInputs {
  /**
   * Loaded casual hourly rate (including 25% casual loading) per QLD IR Act
   * 2016 s.105. When set together with `hoursLast52Weeks`, the casual value-of-week
   * is computed as `(hoursLast52Weeks / 52) × currentHourlyRate`. If absent for a
   * casual employee, the engine falls back to `currentWeeklyGross`.
   */
  currentHourlyRate?: number | string;

  /**
   * Total ordinary hours worked in the 52 weeks ending at the prescribed date.
   * Drives the casual single-52-wk lookback per TBD-QLD-03 resolution.
   */
  hoursLast52Weeks?: number;

  /**
   * Pre-injury weekly rate. Diagnostic only in QLD: the engine deliberately
   * does NOT auto-uplift WC-reduced rates per TBD-QLD-05 resolution. QLD has
   * no equivalent of VIC s.17 higher-of-rates. The engine emits an advisory
   * warning when a WC absence overlaps the trigger date.
   */
  preInjuryWeeklyRate?: number | string;

  /**
   * Public holidays falling within an in-progress LSL window — per QLD IR
   * Act 2016 s.97. PHs extend the leave-period; the engine does not maintain
   * a holiday calendar in v1, so the form passes them explicitly when the
   * user confirms.
   */
  publicHolidaysInWindow?: string[];

  /**
   * Initiator of a termination (employee vs. employer). Reserved for the
   * DEV-CROSS-1 cross-state termination-reason enum refactor; not consulted
   * by QLD v1 (the existing `Trigger.reason` enum is the sole router).
   */
  terminationInitiator?: 'employee' | 'employer';
}
