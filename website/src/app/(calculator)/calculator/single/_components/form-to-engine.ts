import type {
  Employee,
  Trigger,
  PayFrequency,
  ServiceEventType,
  WagePeriod,
  ContinuousServiceEvent,
  TerminationInitiator,
  TerminationReason,
  State,
} from '@/lib/lsl/engine/types';
import { asISODate } from '@/lib/lsl/engine/types';
import {
  EVENTS_WITH_REASONABLE_EXPECTATION_FLAG,
  EVENTS_WITH_SLACKNESS_FLAG,
  EVENTS_WITH_WC_FLAGS,
  REASONS_REQUIRING_INITIATOR,
  emptyFormState,
  type FormState,
} from './types';

export interface FormValidation {
  ok: boolean;
  fieldErrors: Record<string, string>;
  generalErrors: string[];
}

/** Validate the form. Returns field-level errors keyed by field path. */
export function validateForm(state: FormState): FormValidation {
  const fieldErrors: Record<string, string> = {};
  const generalErrors: string[] = [];

  if (!state.startDate) fieldErrors.startDate = 'Start date is required.';
  if (!state.employmentType) fieldErrors.employmentType = 'Employment type is required.';
  if (!state.currentWeeklyGross) {
    fieldErrors.currentWeeklyGross = 'Current weekly gross pay is required.';
  } else if (!/^\d+(\.\d+)?$/.test(state.currentWeeklyGross)) {
    fieldErrors.currentWeeklyGross = 'Must be a positive number.';
  }
  // DEV-CROSS-2: meals/accommodation cash value — optional, but if supplied
  // must be a non-negative number.
  if (
    state.mealsAndAccommodationCashValueWeekly &&
    !/^\d+(\.\d+)?$/.test(state.mealsAndAccommodationCashValueWeekly)
  ) {
    fieldErrors.mealsAndAccommodationCashValueWeekly = 'Must be a positive number.';
  }
  if (state.statesOfService.length === 0) {
    fieldErrors.statesOfService = 'Select at least one state of service.';
  }
  // Governing jurisdiction is required only when more than one state-of-service
  // is selected; single-state employees auto-resolve in formToEngine. This
  // preserves backwards compatibility with users whose persisted form state
  // pre-dates the explicit state selector.
  if (state.statesOfService.length > 1 && !state.governingJurisdiction) {
    fieldErrors.governingJurisdiction =
      'Nominate the governing jurisdiction when multiple states are selected.';
  }

  if (!state.triggerKind) {
    fieldErrors.triggerKind = 'Select a trigger.';
  } else if (state.triggerKind === 'taking_leave' && !state.leaveStartDate) {
    fieldErrors.leaveStartDate = 'Leave start date is required.';
  } else if (state.triggerKind === 'termination') {
    if (!state.terminationDate) fieldErrors.terminationDate = 'Termination date is required.';
    if (!state.terminationReason) {
      fieldErrors.terminationReason = 'Termination reason is required.';
    } else if (
      REASONS_REQUIRING_INITIATOR.has(state.terminationReason as TerminationReason) &&
      !state.terminationInitiator
    ) {
      // DEV-CROSS-1: illness/incapacity branches on initiator in QLD
      // (s.95(3)(b) vs (c)) so the user must nominate it.
      fieldErrors.terminationInitiator =
        'For illness / incapacity, indicate whether the employee resigned or the employer dismissed.';
    }
  } else if (state.triggerKind === 'as_at' && !state.asAtDate) {
    fieldErrors.asAtDate = 'As-at date is required.';
  }

  // Wage history rows
  state.wageHistory.forEach((row, i) => {
    if (!row.periodStart || !row.periodEnd || !row.grossPay) {
      generalErrors.push(`Wage history row ${i + 1} is incomplete.`);
    }
    if (row.frequency === 'other' && !row.periodDays) {
      generalErrors.push(
        `Wage history row ${i + 1}: period days are required when frequency = "other".`
      );
    }
    if (!row.frequency) {
      generalErrors.push(`Wage history row ${i + 1}: select a pay frequency.`);
    }
  });

  if (state.wageHistory.length === 0) {
    generalErrors.push(
      'Add at least one wage-history row, either via CSV upload or manual entry.'
    );
  }

  // Service events
  state.serviceEvents.forEach((ev, i) => {
    if (!ev.type) generalErrors.push(`Service event ${i + 1}: select an event type.`);
    if (!ev.startDate) generalErrors.push(`Service event ${i + 1}: start date is required.`);
    const endRequired =
      ev.type !== 'transfer_of_business' &&
      ev.type !== 'apprentice_to_tradesperson_transition';
    if (endRequired && !ev.endDate && ev.type !== '') {
      generalErrors.push(`Service event ${i + 1}: end date is required for this event type.`);
    }
  });

  return {
    ok: Object.keys(fieldErrors).length === 0 && generalErrors.length === 0,
    fieldErrors,
    generalErrors,
  };
}

/** Convert form draft → engine Employee + Trigger. Assumes validated input. */
export function formToEngine(state: FormState): { employee: Employee; trigger: Trigger } {
  const wageHistory: WagePeriod[] = state.wageHistory.map((r) => {
    const wp: WagePeriod = {
      periodStart: asISODate(r.periodStart),
      periodEnd: asISODate(r.periodEnd),
      grossPay: r.grossPay,
      frequency: r.frequency as PayFrequency,
    };
    if (r.periodDays) wp.periodDays = Number(r.periodDays);
    if (r.note) wp.note = r.note;
    return wp;
  });

  const serviceEvents: ContinuousServiceEvent[] = state.serviceEvents.map((ev) => {
    const type = ev.type as ServiceEventType;
    const e: ContinuousServiceEvent = {
      type,
      startDate: asISODate(ev.startDate),
    };
    if (ev.endDate) e.endDate = asISODate(ev.endDate);
    if (ev.note) e.note = ev.note;
    // DEV-CROSS-2: per-event optional flags. Each flag is omitted when (a) it
    // does not apply to this event type OR (b) the user did not tick it. The
    // engine treats omitted = false → preserves byte-identity for NSW/VIC/QLD.
    if (EVENTS_WITH_SLACKNESS_FLAG.has(type) && ev.slacknessOfTrade) {
      e.slacknessOfTrade = true;
    }
    if (EVENTS_WITH_WC_FLAGS.has(type)) {
      if (ev.paidConcurrent) e.paidConcurrent = true;
      if (ev.returnToWorkProgram) e.returnToWorkProgram = true;
    }
    if (
      EVENTS_WITH_REASONABLE_EXPECTATION_FLAG.has(type) &&
      state.employmentType === 'casual' &&
      ev.reasonableExpectationOfReturn
    ) {
      // Reasonable-expectation flag only meaningful for casuals on UPL.
      e.reasonableExpectationOfReturn = true;
    }
    return e;
  });

  const employee: Employee = {
    id: state.externalEmployeeId || 'single-mode',
    startDate: asISODate(state.startDate),
    employmentType: state.employmentType as Employee['employmentType'],
    statesOfService: state.statesOfService as State[],
    currentWeeklyGross: state.currentWeeklyGross,
    wageHistory,
    serviceEvents,
  };
  if (state.legalName) employee.legalName = state.legalName;
  if (state.externalEmployeeId) employee.externalEmployeeId = state.externalEmployeeId;
  if (state.governingJurisdiction) {
    employee.governingJurisdiction = state.governingJurisdiction as State;
  } else if (state.statesOfService.length === 1) {
    // Single-state employee — populate governingJurisdiction so the dispatcher
    // (E2 Phase 1) can route without needing the form to special-case it.
    // Pre-E2 the engine fell back to NSW for any unset value; this is a
    // strictly-additive change with no behavioural difference for NSW users.
    employee.governingJurisdiction = state.statesOfService[0] as State;
  }
  if (state.priorLeaveTakenWeeks) {
    employee.priorLeaveTakenWeeks = state.priorLeaveTakenWeeks;
  }
  // DEV-CROSS-2: meals/accommodation cash value. Only attach when the user
  // supplied a positive number — empty string OR 0 leaves the field absent so
  // engines see undefined (treated as 0). NSW/VIC/QLD ignore it.
  if (state.mealsAndAccommodationCashValueWeekly) {
    const parsed = Number(state.mealsAndAccommodationCashValueWeekly);
    if (Number.isFinite(parsed) && parsed > 0) {
      employee.mealsAndAccommodationCashValueWeekly = parsed;
    }
  }
  if (state.categoryOverride && state.categoryOverrideConfirmed) {
    employee.categoryOverride = state.categoryOverride;
    employee.categoryOverrideConfirmed = true;
  }

  let trigger: Trigger;
  if (state.triggerKind === 'taking_leave') {
    trigger = { kind: 'taking_leave', leaveStartDate: asISODate(state.leaveStartDate) };
  } else if (state.triggerKind === 'termination') {
    const reason = state.terminationReason as TerminationReason;
    const terminationTrigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate(state.terminationDate),
      reason,
    };
    // DEV-CROSS-1: pass `terminationInitiator` only when (a) the reason
    // requires the disambiguation AND (b) the user supplied a value. The
    // engine defaults to `'employee'` when the field is omitted — so for all
    // other reasons we leave it off entirely to avoid leaking unused state.
    if (
      REASONS_REQUIRING_INITIATOR.has(reason) &&
      state.terminationInitiator
    ) {
      terminationTrigger.terminationInitiator =
        state.terminationInitiator as TerminationInitiator;
    }
    trigger = terminationTrigger;
    employee.endDate = asISODate(state.terminationDate);
  } else {
    trigger = { kind: 'as_at', asAtDate: asISODate(state.asAtDate) };
  }

  return { employee, trigger };
}

/** localStorage key for browser-local persistence (D13). */
export const LOCAL_STORAGE_KEY = 'lsl-calculator:single-mode:v1';

export function loadFromStorage(): FormState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; state: FormState };
    // 7-day auto-clear per impl-plan §5.5
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.savedAt > SEVEN_DAYS_MS) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
    // Forward-migrate: merge the persisted state on top of the current empty
    // defaults so any newly-added FormState fields (e.g. DEV-CROSS-2's
    // `mealsAndAccommodationCashValueWeekly`) get their default value rather
    // than `undefined`. Prevents React's controlled→uncontrolled warning when
    // the persisted state pre-dates the new field.
    return { ...emptyFormState(), ...parsed.state };
  } catch {
    return null;
  }
}

export function saveToStorage(state: FormState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), state })
    );
  } catch {
    /* ignore quota or serialization errors */
  }
}

export function clearStorage(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}
