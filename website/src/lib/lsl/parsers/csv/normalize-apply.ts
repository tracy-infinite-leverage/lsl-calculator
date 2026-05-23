/**
 * Apply a Claude-issued NormalizationSpec to a raw CSV, producing a CSV
 * string in our canonical bulk schema that the existing parseBulkCSV()
 * can consume.
 *
 * This is pure deterministic code — no Claude calls happen here.
 * The smart "which-column-is-which" decision happened upstream; here
 * we just execute the recipe.
 *
 * Why a separate step from parseBulkCSV: parseBulkCSV validates types
 * and groups rows by employee. applyNormalizationSpec rewrites the
 * source CSV into a shape parseBulkCSV understands. Keeping them
 * separate means parseBulkCSV stays unaware of the normalisation
 * flow — useful for tests + for users who upload a canonical CSV
 * directly.
 */

import type {
  ColumnMapping,
  DateFormat,
  NormalizationSpec,
} from './normalize-schema';

export interface ApplyInput {
  /** The raw CSV text the user uploaded. */
  csv: string;
  spec: NormalizationSpec;
  /** Pay frequency selected at upload time — written into every wage row. */
  payFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'other';
  /**
   * When mode === 'single_employee', the user supplies these via the
   * identity form. Required fields are at minimum: employee_id,
   * start_date, employment_type, states. Optional: legal_name, end_date,
   * governing_jurisdiction, current_weekly_gross.
   */
  identity?: SingleEmployeeIdentity;
}

export interface SingleEmployeeIdentity {
  employee_id: string;
  legal_name?: string;
  start_date: string; // ISO YYYY-MM-DD
  end_date?: string;
  employment_type: 'full_time' | 'part_time' | 'casual';
  states: string; // comma-separated state codes
  governing_jurisdiction?: string;
  current_weekly_gross?: string;
}

export interface ApplyResult {
  /** The normalized CSV ready for parseBulkCSV(). */
  canonicalCSV: string;
  /** Conversion warnings worth surfacing in UI. */
  warnings: string[];
  /** Per-row failures (e.g. a row had an unparseable date). */
  errors: { sourceRow: number; message: string }[];
}

const CANONICAL_HEADER = [
  'employee_id',
  'legal_name',
  'start_date',
  'end_date',
  'employment_type',
  'states',
  'governing_jurisdiction',
  'current_weekly_gross',
  'period_start',
  'period_end',
  'gross_pay',
  'frequency',
  'period_days',
  'note',
] as const;

export function applyNormalizationSpec(input: ApplyInput): ApplyResult {
  const warnings: string[] = [];
  const errors: { sourceRow: number; message: string }[] = [];

  const lines = input.csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { canonicalCSV: '', warnings, errors: [{ sourceRow: 0, message: 'CSV is empty.' }] };
  }

  const headerCells = parseCSVLine(lines[0]);
  void headerCells; // We don't need the parsed header here — the spec already has source_index per column.

  // Index the column mappings by canonical name for quick lookup.
  const byCanonical = new Map<string, ColumnMapping>();
  for (const m of input.spec.columns) byCanonical.set(m.canonical, m);

  // Sanity: required wage-row columns
  for (const required of ['period_start', 'period_end', 'gross_pay'] as const) {
    if (!byCanonical.has(required)) {
      return {
        canonicalCSV: '',
        warnings,
        errors: [
          {
            sourceRow: 0,
            message: `Spec is missing required wage column: ${required}. Try the upload again.`,
          },
        ],
      };
    }
  }

  // Single-employee mode requires identity input
  if (input.spec.mode === 'single_employee' && !input.identity) {
    return {
      canonicalCSV: '',
      warnings,
      errors: [
        {
          sourceRow: 0,
          message:
            'This CSV looks like wage history for one employee — please fill in the identity form before continuing.',
        },
      ],
    };
  }

  const outRows: string[] = [CANONICAL_HEADER.join(',')];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const out = makeBlankRow();

    let rowFailed = false;
    const failHere = (msg: string) => {
      errors.push({ sourceRow: i, message: msg });
      rowFailed = true;
    };

    // Map every column from the spec
    for (const m of input.spec.columns) {
      if (rowFailed) break;
      const raw = (cells[m.source_index] ?? '').trim();
      if (raw === '' && (m.canonical === 'period_start' || m.canonical === 'period_end' || m.canonical === 'gross_pay')) {
        failHere(`Empty ${m.canonical}.`);
        break;
      }
      const value = transformCell(raw, m, input.spec.date_format);
      if (value.ok) {
        setField(out, m.canonical, value.value);
      } else {
        failHere(value.error);
      }
    }
    if (rowFailed) continue;

    // For single-employee mode, splice in the identity from the form
    if (input.spec.mode === 'single_employee' && input.identity) {
      setField(out, 'employee_id', input.identity.employee_id);
      setField(out, 'legal_name', input.identity.legal_name ?? '');
      setField(out, 'start_date', input.identity.start_date);
      setField(out, 'end_date', input.identity.end_date ?? '');
      setField(out, 'employment_type', input.identity.employment_type);
      setField(out, 'states', input.identity.states);
      setField(out, 'governing_jurisdiction', input.identity.governing_jurisdiction ?? '');
      setField(out, 'current_weekly_gross', input.identity.current_weekly_gross ?? '');
    }

    setField(out, 'frequency', input.payFrequency);

    outRows.push(CANONICAL_HEADER.map((h) => csvEscape(out[h])).join(','));
  }

  if (input.spec.notes) warnings.push(input.spec.notes);

  return {
    canonicalCSV: outRows.join('\n'),
    warnings,
    errors,
  };
}

function makeBlankRow(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of CANONICAL_HEADER) out[h] = '';
  return out;
}

function setField(row: Record<string, string>, key: string, value: string): void {
  row[key] = value;
}

type TransformResult = { ok: true; value: string } | { ok: false; error: string };

function transformCell(
  raw: string,
  mapping: ColumnMapping,
  defaultDateFormat: DateFormat
): TransformResult {
  // Currency
  if (
    mapping.transform === 'strip_currency' ||
    mapping.canonical === 'gross_pay' ||
    mapping.canonical === 'current_weekly_gross'
  ) {
    const cleaned = raw.replace(/[$,]/g, '').trim();
    if (cleaned === '') return { ok: true, value: '' };
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return { ok: false, error: `Invalid number "${raw}" for ${mapping.canonical}.` };
    }
    return { ok: true, value: cleaned };
  }

  // Dates
  if (
    mapping.transform === 'parse_date' ||
    mapping.canonical === 'period_start' ||
    mapping.canonical === 'period_end' ||
    mapping.canonical === 'start_date' ||
    mapping.canonical === 'end_date'
  ) {
    if (raw === '') return { ok: true, value: '' };
    const iso = toISODate(raw, defaultDateFormat);
    if (!iso) return { ok: false, error: `Invalid date "${raw}" for ${mapping.canonical}.` };
    return { ok: true, value: iso };
  }

  // States (split multi-state values into comma-separated for our schema)
  if (mapping.transform === 'split_states' || mapping.canonical === 'states') {
    const parts = raw
      .split(/[,;|/]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return { ok: true, value: parts.join(',') };
  }

  return { ok: true, value: raw };
}

const MONTH_BY_NAME: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function toISODate(raw: string, fmt: DateFormat): string | null {
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // dd_mmm_yyyy like "01-Jul-2016" or "1 Jul 2016"
  let m = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const mo = MONTH_BY_NAME[m[2].toLowerCase()];
    if (mo && day >= 1 && day <= 31) {
      return `${m[3]}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Slash- or dash-separated numeric
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    let dd: number;
    let mo: number;
    if (fmt === 'mm_dd_yyyy') {
      mo = a; dd = b;
    } else {
      // Default to dd_mm_yyyy (Australian) for ambiguous values
      dd = a; mo = b;
    }
    if (dd < 1 || dd > 31 || mo < 1 || mo > 12) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  // 2016/07/01
  m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const dd = Number(m[3]);
    if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return null;
}

function csvEscape(v: string): string {
  if (v === '') return '';
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Same CSV-line parser pattern as bulk.ts — handles quoted fields. */
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
