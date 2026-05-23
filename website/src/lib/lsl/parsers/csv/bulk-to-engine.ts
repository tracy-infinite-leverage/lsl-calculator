/**
 * Adapter — turns BulkParsedEmployee (the loose, CSV-shaped output of the
 * bulk parser) into engine-ready `Employee` objects with branded ISODate
 * strings and a normalised PayFrequency. Per impl-plan §2.2.
 *
 * Pure function; no IO. Throws on any field that should have been caught
 * upstream by parseBulkCSV. In practice the parser rejects bad rows so this
 * only sees valid inputs.
 */

import { asISODate, type Employee, type PayFrequency, type State } from '@/lib/lsl/engine/types';
import type { BulkParsedEmployee } from './bulk';

export function bulkToEngineEmployees(parsed: BulkParsedEmployee[]): Employee[] {
  return parsed.map((p) => bulkToEngine(p));
}

export function bulkToEngine(p: BulkParsedEmployee): Employee {
  return {
    id: p.employeeId,
    legalName: p.legalName,
    externalEmployeeId: p.employeeId,
    startDate: asISODate(p.startDate),
    endDate: p.endDate ? asISODate(p.endDate) : undefined,
    employmentType: p.employmentType,
    statesOfService: p.states as State[],
    governingJurisdiction: p.governingJurisdiction,
    currentWeeklyGross: p.currentWeeklyGross ?? '0',
    wageHistory: p.wageHistory.map((w) => ({
      periodStart: asISODate(w.periodStart),
      periodEnd: asISODate(w.periodEnd),
      grossPay: w.grossPay,
      // Default frequency: weekly when not supplied. The engine normaliser
      // covers inference from period length too; this is just a sane default.
      frequency: (w.frequency ?? 'weekly') as PayFrequency,
      periodDays: w.periodDays,
      note: w.note,
    })),
    serviceEvents: [],
  };
}
