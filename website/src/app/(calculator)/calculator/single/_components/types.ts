import type {
  EmploymentType,
  ISODate,
  PayFrequency,
  ServiceEventType,
  State,
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

  // Wage history
  wageHistory: WagePeriodDraft[];

  // Service events
  serviceEvents: ServiceEventDraft[];

  // Trigger
  triggerKind: TriggerKind | '';
  leaveStartDate: string;
  terminationDate: string;
  terminationReason: TerminationReason | '';
  asAtDate: string;
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
    wageHistory: [],
    serviceEvents: [],
    triggerKind: '',
    leaveStartDate: '',
    terminationDate: '',
    terminationReason: '',
    asAtDate: '',
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
];

export type ISODateInput = ISODate | '';
