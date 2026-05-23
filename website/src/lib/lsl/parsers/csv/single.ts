import type { PayFrequency } from '@/lib/lsl/engine/types';

export interface ParsedRow {
  periodStart: string;
  periodEnd: string;
  grossPay: string;
  frequency?: PayFrequency;
  periodDays?: number;
  note?: string;
  /** Raw row number in source file (1-indexed, header excluded). */
  sourceRow: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: { row: number; message: string }[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const FREQUENCY_MAP: Record<string, PayFrequency> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  monthly: 'monthly',
  other: 'other',
  w: 'weekly',
  f: 'fortnightly',
  m: 'monthly',
};

/**
 * Parse single-mode wage-history CSV. Schema:
 *   period_start, period_end, gross_pay, [frequency], [period_days], [note]
 * Frequency / period_days may be supplied per row or set globally in the UI.
 */
export function parseSingleModeCSV(csv: string): ParseResult {
  const errors: { row: number; message: string }[] = [];
  const rows: ParsedRow[] = [];

  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows, errors: [{ row: 0, message: 'CSV is empty' }] };
  }

  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iStart = idx('period_start', 'start_date', 'start');
  const iEnd = idx('period_end', 'end_date', 'end');
  const iGross = idx('gross_pay', 'gross', 'amount');
  const iFreq = idx('frequency', 'pay_frequency', 'period_frequency');
  const iDays = idx('period_days', 'days');
  const iNote = idx('note', 'notes');

  if (iStart === -1 || iEnd === -1 || iGross === -1) {
    errors.push({
      row: 1,
      message:
        'CSV header must include period_start, period_end, and gross_pay columns. Optional columns: frequency, period_days, note.',
    });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const sourceRow = i;
    const start = cells[iStart]?.trim() ?? '';
    const end = cells[iEnd]?.trim() ?? '';
    const grossRaw = (cells[iGross]?.trim() ?? '').replace(/[$,]/g, '');
    const freqRaw = (iFreq !== -1 ? cells[iFreq]?.trim().toLowerCase() : '') ?? '';
    const daysRaw = (iDays !== -1 ? cells[iDays]?.trim() : '') ?? '';
    const note = (iNote !== -1 ? cells[iNote]?.trim() : '') ?? '';

    if (!ISO_DATE.test(start)) {
      errors.push({ row: sourceRow, message: `Invalid period_start: "${start}"` });
      continue;
    }
    if (!ISO_DATE.test(end)) {
      errors.push({ row: sourceRow, message: `Invalid period_end: "${end}"` });
      continue;
    }
    if (!/^\d+(\.\d+)?$/.test(grossRaw)) {
      errors.push({ row: sourceRow, message: `Invalid gross_pay: "${grossRaw}"` });
      continue;
    }

    const row: ParsedRow = {
      periodStart: start,
      periodEnd: end,
      grossPay: grossRaw,
      sourceRow,
    };
    if (freqRaw && FREQUENCY_MAP[freqRaw]) row.frequency = FREQUENCY_MAP[freqRaw];
    if (daysRaw && /^\d+$/.test(daysRaw)) row.periodDays = Number(daysRaw);
    if (note) row.note = note;
    rows.push(row);
  }

  return { rows, errors };
}

/** Minimal CSV line parser handling quoted fields. */
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
