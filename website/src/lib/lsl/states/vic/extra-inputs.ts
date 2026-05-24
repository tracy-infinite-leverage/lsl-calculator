import type { ISODate } from '@/lib/lsl/engine/types';

/**
 * VIC-specific extra-inputs.
 *
 * Surface only as needed; the engine layer treats this loosely-typed. The form
 * and fixture loaders are expected to populate the correct shape; runtime
 * validation lives wherever the input arrives.
 *
 * See `states/extra-inputs.md` for the cross-state pattern.
 */
export interface VICExtraInputs {
  /**
   * Written agreement (employer + employee, made BEFORE the leave was taken)
   * allowing a single unpaid-leave period of more than 52 weeks to count as
   * service — per VIC LSL Act 2018 s.13(1)(d)(ii). When true, the per-period
   * 52-week cap is waived for `leave_without_pay` events.
   */
  unpaidLeaveWrittenAgreement?: boolean;

  /**
   * For workers-comp employees on reduced pay, the pre-injury weekly rate per
   * VIC LSL Act 2018 s.17(2). Engine emits the higher of pre-injury vs current
   * as value-of-week.
   */
  preInjuryWeeklyRate?: number | string;

  /**
   * Pre-injury weekly hours — diagnostic only in v1 (engine uses the rate
   * directly).
   */
  preInjuryWeeklyHours?: number;

  /**
   * Public holidays falling within an in-progress LSL window — per VIC LSL
   * Act 2018 s.7. PHs extend the leave-period; the engine does not maintain a
   * holiday calendar in v1, so the form passes them explicitly when the user
   * confirms.
   */
  publicHolidaysInWindow?: ISODate[];
}
