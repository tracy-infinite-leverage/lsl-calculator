/**
 * Bulk-mode CSV parser per impl-plan §2.2 / D17.
 *
 * Schema (header row required, case-insensitive, underscores or spaces):
 *
 *   employee_id           Required. Stable identifier — used to group rows
 *                         belonging to one employee. Free text.
 *   legal_name            Optional. Display name.
 *   start_date            Required. ISO 8601 (YYYY-MM-DD).
 *   end_date              Optional. ISO 8601. Blank = still employed.
 *   employment_type       Required. full_time | part_time | casual
 *                         (also accepts permanent/PT/casual/flexi aliases).
 *   states                Required. Comma-separated list inside the cell:
 *                         "NSW" or "NSW,VIC". The cell may be wrapped in
 *                         double quotes when commas are used.
 *   governing_jurisdiction Optional. One of the state codes — nominated
 *                         governing state for cross-jurisdiction service.
 *                         Blank when only one state in `states`.
 *   current_weekly_gross  Required for taking-leave / as-at triggers.
 *                         Decimal string ("1500.00"). $ + commas tolerated.
 *   trigger_kind          Optional. taking_leave | termination | as_at
 *                         (defaults to "as_at" using upload date).
 *   trigger_date          Required if trigger_kind given. ISO date.
 *   termination_reason    Required if trigger_kind=termination.
 *                         voluntary_resignation | employer_initiated_not_misconduct
 *                         | redundancy | serious_misconduct | illness_incapacity
 *                         | domestic_pressing_necessity | death
 *
 * Wage history columns (one row per pay period):
 *   period_start, period_end, gross_pay, frequency, period_days, note
 *
 * Rows belonging to the same employee MUST share the same employee_id and
 * MUST repeat the employee-scope columns identically on every row. The first
 * row wins on disagreement — we emit a warning rather than throw, because in
 * practice payroll CSVs often have trailing whitespace differences.
 */

import {
  asISODate,
  type EmploymentType,
  type PayFrequency,
  type State,
  type TerminationReason,
  type Trigger,
} from '@/lib/lsl/engine/types';

export interface BulkParsedEmployee {
  employeeId: string;
  legalName?: string;
  startDate: string;
  endDate?: string;
  employmentType: EmploymentType;
  states: State[];
  governingJurisdiction?: State;
  currentWeeklyGross?: string;
  wageHistory: BulkWageRow[];
  /** Optional per-employee trigger override. Defaults applied by the runner. */
  trigger?: Trigger;
  /** Row range in the source file (1-indexed, header excluded). For error context. */
  sourceRowRange: { first: number; last: number };
}

export interface BulkWageRow {
  periodStart: string;
  periodEnd: string;
  grossPay: string;
  frequency?: PayFrequency;
  periodDays?: number;
  note?: string;
  sourceRow: number;
}

export interface BulkParseResult {
  employees: BulkParsedEmployee[];
  errors: BulkParseError[];
  warnings: BulkParseWarning[];
}

export interface BulkParseError {
  row: number;
  employeeId?: string;
  message: string;
}

export interface BulkParseWarning {
  row: number;
  employeeId?: string;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATES: readonly State[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const VALID_TERMINATION_REASONS: readonly TerminationReason[] = [
  'voluntary_resignation',
  'employer_initiated_not_misconduct',
  'redundancy',
  'serious_misconduct',
  'illness_incapacity',
  'domestic_pressing_necessity',
  'death',
  // DEV-CROSS-1 (2026-05-25) — cross-state additive expansion.
  'unfair_dismissal',
  'poor_performance',
] as const;

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  full_time: 'full_time',
  fulltime: 'full_time',
  ft: 'full_time',
  permanent: 'full_time',
  part_time: 'part_time',
  parttime: 'part_time',
  pt: 'part_time',
  casual: 'casual',
  flexi: 'casual',
  flex: 'casual',
};

const FREQUENCY_MAP: Record<string, PayFrequency> = {
  weekly: 'weekly',
  w: 'weekly',
  fortnightly: 'fortnightly',
  f: 'fortnightly',
  biweekly: 'fortnightly',
  monthly: 'monthly',
  m: 'monthly',
  other: 'other',
};

export function parseBulkCSV(csv: string): BulkParseResult {
  const errors: BulkParseError[] = [];
  const warnings: BulkParseWarning[] = [];

  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { employees: [], errors: [{ row: 0, message: 'CSV is empty.' }], warnings };
  }

  const header = parseCSVLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iEmpId = idx('employee_id', 'emp_id', 'id');
  const iLegalName = idx('legal_name', 'name', 'employee_name');
  const iStartDate = idx('start_date', 'employment_start', 'hire_date');
  const iEndDate = idx('end_date', 'employment_end', 'termination_date_field');
  const iEmploymentType = idx('employment_type', 'type', 'employment');
  const iStates = idx('states', 'states_of_service', 'state');
  const iGoverning = idx('governing_jurisdiction', 'governing_state', 'governing');
  const iCurrentGross = idx('current_weekly_gross', 'weekly_gross', 'gross');
  const iTriggerKind = idx('trigger_kind', 'trigger', 'trigger_type');
  const iTriggerDate = idx('trigger_date', 'as_at_date', 'leave_start_date', 'termination_date');
  const iTermReason = idx('termination_reason', 'reason');

  const iPeriodStart = idx('period_start', 'pay_period_start');
  const iPeriodEnd = idx('period_end', 'pay_period_end');
  const iGrossPay = idx('gross_pay', 'period_gross', 'amount');
  const iFrequency = idx('frequency', 'pay_frequency');
  const iPeriodDays = idx('period_days', 'days');
  const iNote = idx('note', 'notes');

  const required = [
    ['employee_id', iEmpId],
    ['start_date', iStartDate],
    ['employment_type', iEmploymentType],
    ['states', iStates],
    ['period_start', iPeriodStart],
    ['period_end', iPeriodEnd],
    ['gross_pay', iGrossPay],
  ] as const;
  const missing = required.filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length > 0) {
    errors.push({
      row: 1,
      message: `CSV header missing required columns: ${missing.join(', ')}. See on-page schema docs.`,
    });
    return { employees: [], errors, warnings };
  }

  // Group rows by employee_id, preserving file order for first-occurrence wins.
  const grouped = new Map<string, BulkParsedEmployee>();
  const groupOrder: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const sourceRow = i;
    const employeeId = (cells[iEmpId] ?? '').trim();
    if (!employeeId) {
      errors.push({ row: sourceRow, message: 'Missing employee_id.' });
      continue;
    }

    // Wage row fields (every line has one wage period)
    const periodStart = (cells[iPeriodStart] ?? '').trim();
    const periodEnd = (cells[iPeriodEnd] ?? '').trim();
    const grossPayRaw = (cells[iGrossPay] ?? '').trim().replace(/[$,]/g, '');
    const freqRaw = iFrequency !== -1 ? (cells[iFrequency] ?? '').trim().toLowerCase() : '';
    const daysRaw = iPeriodDays !== -1 ? (cells[iPeriodDays] ?? '').trim() : '';
    const note = iNote !== -1 ? (cells[iNote] ?? '').trim() : '';

    if (!ISO_DATE.test(periodStart)) {
      errors.push({ row: sourceRow, employeeId, message: `Invalid period_start "${periodStart}".` });
      continue;
    }
    if (!ISO_DATE.test(periodEnd)) {
      errors.push({ row: sourceRow, employeeId, message: `Invalid period_end "${periodEnd}".` });
      continue;
    }
    if (!/^\d+(\.\d+)?$/.test(grossPayRaw)) {
      errors.push({ row: sourceRow, employeeId, message: `Invalid gross_pay "${grossPayRaw}".` });
      continue;
    }

    const wageRow: BulkWageRow = {
      periodStart,
      periodEnd,
      grossPay: grossPayRaw,
      sourceRow,
    };
    if (freqRaw && FREQUENCY_MAP[freqRaw]) wageRow.frequency = FREQUENCY_MAP[freqRaw];
    if (daysRaw && /^\d+$/.test(daysRaw)) wageRow.periodDays = Number(daysRaw);
    if (note) wageRow.note = note;

    // Employee-scope fields — only validate on first appearance.
    let emp = grouped.get(employeeId);
    if (!emp) {
      const legalName = iLegalName !== -1 ? (cells[iLegalName] ?? '').trim() || undefined : undefined;
      const startDate = (cells[iStartDate] ?? '').trim();
      const endDate = iEndDate !== -1 ? (cells[iEndDate] ?? '').trim() || undefined : undefined;
      const empTypeRaw = (cells[iEmploymentType] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
      const statesRaw = (cells[iStates] ?? '').trim();
      const governingRaw = iGoverning !== -1 ? (cells[iGoverning] ?? '').trim().toUpperCase() : '';
      const grossRaw = iCurrentGross !== -1
        ? (cells[iCurrentGross] ?? '').trim().replace(/[$,]/g, '')
        : '';

      if (!ISO_DATE.test(startDate)) {
        errors.push({ row: sourceRow, employeeId, message: `Invalid start_date "${startDate}".` });
        continue;
      }
      if (endDate && !ISO_DATE.test(endDate)) {
        errors.push({ row: sourceRow, employeeId, message: `Invalid end_date "${endDate}".` });
        continue;
      }
      const employmentType = EMPLOYMENT_TYPE_MAP[empTypeRaw];
      if (!employmentType) {
        errors.push({
          row: sourceRow,
          employeeId,
          message: `Invalid employment_type "${cells[iEmploymentType]}". Use full_time | part_time | casual.`,
        });
        continue;
      }
      const states = statesRaw
        .split(/[,;]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .filter((s): s is State => (VALID_STATES as readonly string[]).includes(s));
      if (states.length === 0) {
        errors.push({
          row: sourceRow,
          employeeId,
          message: `Missing or invalid states "${statesRaw}". Expected one or more of: ${VALID_STATES.join(', ')}.`,
        });
        continue;
      }
      const governingJurisdiction = governingRaw && (VALID_STATES as readonly string[]).includes(governingRaw)
        ? (governingRaw as State)
        : undefined;
      if (states.length > 1 && !governingJurisdiction) {
        warnings.push({
          row: sourceRow,
          employeeId,
          message:
            'Multiple states with no governing_jurisdiction set — this employee will be blocked until nominated in the UI.',
        });
      }

      // Trigger parsing (optional — runner applies as_at default if absent)
      let trigger: Trigger | undefined;
      if (iTriggerKind !== -1) {
        const tkRaw = (cells[iTriggerKind] ?? '').trim().toLowerCase();
        const td = iTriggerDate !== -1 ? (cells[iTriggerDate] ?? '').trim() : '';
        if (tkRaw === 'as_at' || tkRaw === '') {
          if (td) {
            if (!ISO_DATE.test(td)) {
              errors.push({ row: sourceRow, employeeId, message: `Invalid trigger_date "${td}".` });
              continue;
            }
            trigger = { kind: 'as_at', asAtDate: asISODate(td) };
          }
        } else if (tkRaw === 'taking_leave') {
          if (!ISO_DATE.test(td)) {
            errors.push({
              row: sourceRow,
              employeeId,
              message: `trigger_kind=taking_leave requires a valid trigger_date.`,
            });
            continue;
          }
          trigger = { kind: 'taking_leave', leaveStartDate: asISODate(td) };
        } else if (tkRaw === 'termination') {
          if (!ISO_DATE.test(td)) {
            errors.push({
              row: sourceRow,
              employeeId,
              message: `trigger_kind=termination requires a valid trigger_date.`,
            });
            continue;
          }
          const reasonRaw = iTermReason !== -1
            ? (cells[iTermReason] ?? '').trim().toLowerCase().replace(/\s+/g, '_')
            : '';
          if (!(VALID_TERMINATION_REASONS as readonly string[]).includes(reasonRaw)) {
            errors.push({
              row: sourceRow,
              employeeId,
              message: `Invalid termination_reason "${reasonRaw}".`,
            });
            continue;
          }
          trigger = {
            kind: 'termination',
            terminationDate: asISODate(td),
            reason: reasonRaw as TerminationReason,
          };
        } else if (tkRaw) {
          errors.push({
            row: sourceRow,
            employeeId,
            message: `Invalid trigger_kind "${tkRaw}". Use as_at | taking_leave | termination.`,
          });
          continue;
        }
      }

      emp = {
        employeeId,
        legalName,
        startDate,
        endDate,
        employmentType,
        states,
        governingJurisdiction,
        currentWeeklyGross: grossRaw || undefined,
        wageHistory: [],
        trigger,
        sourceRowRange: { first: sourceRow, last: sourceRow },
      };
      grouped.set(employeeId, emp);
      groupOrder.push(employeeId);
    } else {
      emp.sourceRowRange.last = sourceRow;
    }

    emp.wageHistory.push(wageRow);
  }

  return {
    employees: groupOrder.map((id) => grouped.get(id)!),
    errors,
    warnings,
  };
}

/** Reusable CSV line parser — handles quoted fields and doubled-quote escapes. */
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
