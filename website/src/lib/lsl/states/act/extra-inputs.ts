/**
 * ACT-specific extra-inputs.
 *
 * The ACT engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * Per TBD-ACT-04 / TBD-ACT-07 / etc. RESOLUTIONS (2026-05-26): every ACT-
 * specific signal is ACT-localised via `extraInputs.act_*` keys. NO new
 * cross-state schema fields were added. (Parallel to SA TBD-SA-04/-07
 * RESOLVED precedent — no DEV-CROSS-4 dev-finding.)
 *
 * See `docs/qa/test-cases-act.md` v1.0 PM-signed 2026-05-26 for fixtures that
 * exercise each key.
 */
export interface ACTExtraInputs {
  /**
   * Overtime hours per pay period (added to base hours in the s.7(2) 12-month
   * casual/PT averaging window). Drives the F9/AC11 asymmetric overtime
   * treatment per TBD-ACT-02 RESOLVED: hours INCLUDED in the average; rate
   * EXCLUDES the overtime premium. Empty array / undefined → no overtime
   * adjustment.
   */
  act_overtime_hours_by_period?: Array<{
    periodStart: string;
    periodEnd: string;
    hours: number;
  }>;
  /** Backward-compat alias for `act_overtime_hours_by_period`. */
  overtimeHoursByPeriod?: Array<{
    periodStart: string;
    periodEnd: string;
    hours: number;
  }>;

  /**
   * Date the employee transitioned from FT to PT/casual. Per TBD-ACT-04
   * RESOLVED — when supplied AND the transition is within 2 years prior to
   * the 7-yr entitlement anniversary (boundary INCLUSIVE), the engine routes
   * to s.7(3) 5-year-total-salary path. ACT-UNIQUE rule.
   */
  act_ft_to_pt_transition_date?: string;

  /**
   * Whether the employee has reached the award- or agreement-specified
   * minimum retirement age (sub-65). Per TBD-ACT-07 RESOLVED — used by the
   * s.11C qualifying-reason gate for pro-rata at 5–7 yrs.
   */
  act_award_min_retirement_age_reached?: boolean;

  /** Loaded base hourly rate (incl. casual loading; excl. overtime premium). */
  currentHourlyRate?: number | string;

  /** Total hours in the 12 mo before the 7-yr entitlement date (s.7(2)). */
  hoursLast12MonthsBeforeEntitlement?: number;

  /** Total hours in the 12 mo before cessation (s.11D). */
  hoursLast12MonthsBeforeCessation?: number;
}
