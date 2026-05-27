import type {
  EmploymentType,
  ISODate,
  PayFrequency,
  ServiceEventType,
  State,
  TerminationInitiator,
  TerminationReason,
} from '@/lib/lsl/engine/types';

/**
 * Wire-shape: what the form holds. Strings throughout for input control.
 * Coerced to engine types before calling dispatch.calculate().
 */
export interface ServiceEventDraft {
  id: string;
  type: ServiceEventType | '';
  startDate: string;
  endDate: string;
  note: string;
  /**
   * DEV-CROSS-2 (2026-05-25) — per-event optional flags. Each flag applies to
   * a specific event type; the conditional UI only surfaces each flag when
   * relevant. Defaults to `false`. The form-to-engine layer omits the field
   * from the emitted `ContinuousServiceEvent` when `false`, mirroring the
   * "omit when not needed" pattern established by DEV-CROSS-1.
   */
  slacknessOfTrade?: boolean;
  paidConcurrent?: boolean;
  returnToWorkProgram?: boolean;
  reasonableExpectationOfReturn?: boolean;
}

export interface WagePeriodDraft {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossPay: string;
  frequency: PayFrequency | '';
  periodDays: string;
  note: string;
}

export type TriggerKind = 'taking_leave' | 'termination' | 'as_at';

export interface FormState {
  // Identity
  legalName: string;
  externalEmployeeId: string;

  // Employment
  startDate: string;
  employmentType: EmploymentType | '';
  categoryOverride: 'A' | 'B' | 'C' | '';
  categoryOverrideConfirmed: boolean;

  // Jurisdiction
  statesOfService: State[];
  governingJurisdiction: State | '';

  // Pay
  currentWeeklyGross: string;
  priorLeaveTakenWeeks: string;
  /**
   * DEV-CROSS-2 (2026-05-25) — weekly cash value of meals/accommodation
   * normally provided to the employee, in AUD. Always-visible form field
   * (applies cross-state where the cash value is positive). Empty string =
   * unset → engine treats as undefined → 0. NSW/VIC/QLD currently ignore this
   * field; available to future state engines that encode the WA s.9 inclusion.
   */
  mealsAndAccommodationCashValueWeekly: string;

  // Wage history
  wageHistory: WagePeriodDraft[];

  // Service events
  serviceEvents: ServiceEventDraft[];

  // Trigger
  triggerKind: TriggerKind | '';
  leaveStartDate: string;
  terminationDate: string;
  terminationReason: TerminationReason | '';
  /**
   * DEV-CROSS-1: surfaced when the termination reason requires
   * employee-vs-employer disambiguation (currently only `illness_incapacity`).
   * Empty for all other reasons — engine defaults to `'employee'` when omitted.
   */
  terminationInitiator: TerminationInitiator | '';
  asAtDate: string;

  /**
   * TAS-specific extra-inputs (E3 Phase 8 / T8.5). Surfaced in the single-mode
   * form ONLY when `statesOfService` includes / `governingJurisdiction` equals
   * `'TAS'`. Empty strings / false defaults map to omitted engine fields. Other
   * state engines ignore every key here entirely.
   *
   * See `website/src/lib/lsl/states/tas/extra-inputs.ts` for engine-side docs
   * on each key.
   */
  tas_currentHourlyRate: string;
  tas_hoursLast12MonthsBeforeEntitlement: string;
  tas_hoursLast12MonthsBeforeCessation: string;
  tas_award_min_retirement_age_reached: boolean;
  tas_casual_32hr_4wk_periods_compliant: '' | 'true' | 'false';
  tas_casual_continuity_break_date: string;
  tas_employee_in_northern_tas: boolean;
  tas_slackness_return_within_14_days: boolean;

  /**
   * NT-specific extra-inputs (E2 Phase 9 / T9.5). Surfaced in the single-mode
   * form ONLY when `statesOfService` includes / `governingJurisdiction` equals
   * `'NT'`. Empty strings / false / `''` tri-state defaults map to omitted
   * engine fields. Other state engines ignore every key here entirely.
   *
   * See `website/src/lib/lsl/states/nt/extra-inputs.ts` for engine-side docs
   * on each key.
   */
  nt_hours_per_week_by_year: NTHoursPerWeekByYearDraft[];
  nt_age_pension_age_at_termination_reached: boolean;
  nt_casual_continuity_preserved: '' | 'true' | 'false';
  nt_bonus_usually_paid_with_pay: boolean;
  nt_board_lodging_cash_value_weekly: string;
  nt_related_corporation_service_years: string;
  nt_employer_initiated_dismissal: boolean;
}

/**
 * Per-year hours-per-week row used by the NT `nt_hours_per_week_by_year` form
 * field (E2 Phase 9). Strings throughout for input control; coerced before
 * the engine sees them. Mirrors `NTHoursPerWeekByYear` in
 * `website/src/lib/lsl/states/nt/extra-inputs.ts`.
 */
export interface NTHoursPerWeekByYearDraft {
  id: string;
  yearStart: string;
  yearEnd: string;
  hoursPerWeek: string;
}

export function emptyFormState(): FormState {
  return {
    legalName: '',
    externalEmployeeId: '',
    startDate: '',
    employmentType: '',
    categoryOverride: '',
    categoryOverrideConfirmed: false,
    // Default to NSW for safety — preserves the v1 NSW-only flow for any user
    // who doesn't touch the state selector. Selector + the per-state list
    // both drive this single field.
    statesOfService: ['NSW'],
    governingJurisdiction: 'NSW',
    currentWeeklyGross: '',
    priorLeaveTakenWeeks: '',
    mealsAndAccommodationCashValueWeekly: '',
    wageHistory: [],
    serviceEvents: [],
    triggerKind: '',
    leaveStartDate: '',
    terminationDate: '',
    terminationReason: '',
    terminationInitiator: '',
    asAtDate: '',
    // TAS extra-inputs — defaults map to omitted engine fields.
    tas_currentHourlyRate: '',
    tas_hoursLast12MonthsBeforeEntitlement: '',
    tas_hoursLast12MonthsBeforeCessation: '',
    tas_award_min_retirement_age_reached: false,
    tas_casual_32hr_4wk_periods_compliant: '',
    tas_casual_continuity_break_date: '',
    tas_employee_in_northern_tas: false,
    tas_slackness_return_within_14_days: false,
    // NT extra-inputs — defaults map to omitted engine fields. Tri-state casual
    // continuity defaults to '' (engine treats as undefined → permissive).
    nt_hours_per_week_by_year: [],
    nt_age_pension_age_at_termination_reached: false,
    nt_casual_continuity_preserved: '',
    nt_bonus_usually_paid_with_pay: false,
    nt_board_lodging_cash_value_weekly: '',
    nt_related_corporation_service_years: '',
    nt_employer_initiated_dismissal: false,
  };
}

export const STATE_OPTIONS: { value: State; label: string }[] = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'Northern Territory' },
];

export const SERVICE_EVENT_OPTIONS: { value: ServiceEventType; label: string }[] = [
  { value: 'paid_leave', label: 'Paid leave (annual / LSL / parental / sick)' },
  { value: 'workers_comp_absence', label: "Workers' Compensation absence" },
  { value: 'unpaid_parental_leave', label: 'Unpaid parental leave' },
  { value: 'leave_without_pay', label: 'Leave without pay' },
  { value: 'industrial_action', label: 'Industrial action / strike' },
  { value: 'employer_stand_down', label: 'Employer stand-down (slackness)' },
  { value: 'transfer_of_business', label: 'Transfer of business (s.4(6))' },
  {
    value: 'employer_initiated_termination_and_rehire',
    label: 'Employer-initiated termination + rehire',
  },
  {
    value: 'apprentice_to_tradesperson_transition',
    label: 'Apprentice → tradesperson transition',
  },
  { value: 'jobkeeper_or_covid_standdown', label: 'JobKeeper / COVID stand-down' },
];

export const TERMINATION_REASON_OPTIONS: { value: TerminationReason; label: string }[] = [
  { value: 'voluntary_resignation', label: 'Voluntary resignation' },
  { value: 'employer_initiated_not_misconduct', label: 'Employer-initiated (not misconduct)' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'serious_misconduct', label: 'Serious misconduct' },
  { value: 'illness_incapacity', label: 'Illness / incapacity' },
  {
    value: 'domestic_pressing_necessity',
    label: 'Domestic or other pressing necessity',
  },
  { value: 'death', label: 'Death' },
  // DEV-CROSS-1 (2026-05-25).
  { value: 'unfair_dismissal', label: 'Unfair dismissal' },
  { value: 'poor_performance', label: 'Dismissal for poor performance' },
  // E2 Phase 7 (ACT) — retirement qualifies under s.11C for pro-rata 5-7yr.
  { value: 'retirement', label: 'Retirement' },
];

/**
 * Set of termination reasons whose sub-paragraph outcome depends on who
 * initiated the termination. When the user selects one of these reasons,
 * the single-mode form surfaces a `terminationInitiator` radio group.
 *
 * v1: only `illness_incapacity` (QLD s.95(3)(b) vs (c)). Future per-state PRs
 * may add more entries (WA/SA/TAS analogues).
 */
export const REASONS_REQUIRING_INITIATOR: ReadonlySet<TerminationReason> = new Set([
  'illness_incapacity',
]);

export const TERMINATION_INITIATOR_OPTIONS: { value: TerminationInitiator; label: string }[] = [
  { value: 'employee', label: 'Employee-initiated (the employee resigned)' },
  { value: 'employer', label: 'Employer-initiated (the employer dismissed)' },
];

/**
 * DEV-CROSS-2 (2026-05-25) — service-event types that surface a
 * `slacknessOfTrade` checkbox in the continuous-service list. Currently:
 * employer-initiated termination + rehire (WA s.6 — 6-month tolerance vs
 * standard 2-month). NSW/VIC/QLD ignore the field; the checkbox is harmless
 * for them but only meaningful when the user later switches to WA.
 */
export const EVENTS_WITH_SLACKNESS_FLAG: ReadonlySet<ServiceEventType> = new Set([
  'employer_initiated_termination_and_rehire',
]);

/**
 * DEV-CROSS-2 — service-event types that surface `paidConcurrent` and
 * `returnToWorkProgram` checkboxes. Currently: workers_comp_absence (WA
 * DEMIRS exception for pre-2024-07-01 absences).
 */
export const EVENTS_WITH_WC_FLAGS: ReadonlySet<ServiceEventType> = new Set([
  'workers_comp_absence',
]);

/**
 * DEV-CROSS-2 — service-event types that surface a
 * `reasonableExpectationOfReturn` checkbox. Currently: unpaid_parental_leave,
 * AND only when the employee's employment type is `casual` (WA s.6 post-2022
 * casual-continuity rule). The continuous-service list receives the
 * employment type so it can apply this secondary gate.
 */
export const EVENTS_WITH_REASONABLE_EXPECTATION_FLAG: ReadonlySet<ServiceEventType> = new Set([
  'unpaid_parental_leave',
]);

export type ISODateInput = ISODate | '';
