/**
 * Masterfile CSV parser.
 *
 * Phase 2 (Task 2.4) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Consumes a raw CSV text body produced by the authenticated upload wizard
 * (Phase 4 — `/app/employees/import`) and returns a structured
 * `ParsedMasterfile`:
 *   - validRows         — typed rows ready to insert (DB write is Task 2.6).
 *   - rowErrors         — per-row blocking errors (bad row dropped; good rows
 *                         in the same batch still succeed — AC-EMP-4).
 *   - rowWarnings       — per-row soft warnings (ABN mod-89 fail, missing
 *                         sex on TAS / dob on NT — spec §5 SHOULDs / AC-EMP-10).
 *   - strippedColumns   — column headers removed by Layer-A PII strip
 *                         (Task 2.3). The original CSV file is preserved
 *                         in Storage for audit; the DB never sees these.
 *   - suspectTfnFlags   — values that look like a 9-digit TFN, surfaced
 *                         in the dry-run preview as a soft warning
 *                         (Layer-B PII defence, spec §9 RE-3).
 *   - newTagsToCreate   — deduplicated list of `tags` values that don't
 *                         yet exist in the org's `tags` dictionary; the
 *                         commit step (Task 2.6 + 2.8b) auto-creates these
 *                         inside the same DB transaction (AC-EMP-14).
 *
 * DB writes happen in `commitMasterfile` (not this file — Task 2.6).
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §5
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.5 + §4
 *   - AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-10, AC-EMP-14
 */

import { splitCsvLines, splitQuotedRow, trimNormalise } from '@/lib/lsl/parsers/csv/core';
import { flagSuspectTfn, stripPiiHeaders } from './pii-strip';
import { err, ok, type Result } from './types';

// ─── Domain types ────────────────────────────────────────────────────────────

export type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type EmploymentType = 'full_time' | 'part_time' | 'casual' | 'salaried' | 'hourly';
export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'four_weekly';
export type Sex = 'M' | 'F' | 'unspecified';
export type Scheme =
  | 'state_lsl'
  // Forward-compat per AC-EMP-11 — parser rejects these in v1 but the enum
  // shape is reserved so the DB CHECK constraint and the engine adapter can
  // share the same type as v1.1 ships.
  | 'portable_construction'
  | 'portable_cleaning'
  | 'portable_coal';

const VALID_JURISDICTIONS: ReadonlyArray<Jurisdiction> = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
];
const VALID_EMPLOYMENT_TYPES: ReadonlyArray<EmploymentType> = [
  'full_time',
  'part_time',
  'casual',
  'salaried',
  'hourly',
];
const VALID_PAY_FREQUENCIES: ReadonlyArray<PayFrequency> = [
  'weekly',
  'fortnightly',
  'monthly',
  'four_weekly',
];
const VALID_SEX: ReadonlyArray<Sex> = ['M', 'F', 'unspecified'];

/**
 * Soft cap on `employee_external_id` length per DEV-EMP-2 spike findings.
 * The DB column has no length CHECK constraint (Postgres `text` handles
 * arbitrary lengths), so this is the service-layer-only gate.
 */
const EMPLOYEE_EXTERNAL_ID_MAX_LENGTH = 128;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TAG_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,49}$/; // 1-50 chars, lowercase, no whitespace.
// (The DB CHECK in Migration 7 is more permissive — `name = lower(name)` AND
// `name = trim(both ' ' from name)` AND length 1-50 — so this regex is the
// stricter service-layer gate. Underscore + hyphen are allowed; spaces are not.)

/**
 * Required headers on every masterfile CSV. Parsing fails fast at the header
 * layer if any are missing.
 */
const REQUIRED_HEADERS = [
  'employee_external_id',
  'full_name',
  'start_date',
  'default_work_jurisdiction',
  'employment_type',
  'pay_frequency',
] as const;

/**
 * Optional headers we recognise. Anything else in the CSV that isn't a PII
 * column is silently ignored (per spec §5 — we keep the original CSV in
 * Storage so nothing is truly lost).
 */
const OPTIONAL_HEADERS = [
  'end_date',
  'sex',
  'dob',
  'classification',
  'hours_per_week',
  'scheme',
  'opening_balance_weeks',
  'opening_balance_taken_weeks',
  'opening_balance_as_at_date',
  'tags',
  'abn',
] as const;

export interface ParsedMasterfileRow {
  /** 1-indexed row number in the source CSV (the header is row 1). */
  sourceRow: number;
  employee_external_id: string;
  full_name: string;
  start_date: string;
  end_date: string | null;
  default_work_jurisdiction: Jurisdiction;
  employment_type: EmploymentType;
  pay_frequency: PayFrequency;
  sex: Sex | null;
  dob: string | null;
  classification: string | null;
  hours_per_week: number | null;
  scheme: Scheme;
  opening_balance_weeks: number | null;
  opening_balance_taken_weeks: number | null;
  opening_balance_as_at_date: string | null;
  tags: string[];
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface RowWarning {
  row: number;
  field: string;
  message: string;
}

export interface ParsedMasterfile {
  validRows: ParsedMasterfileRow[];
  rowErrors: RowError[];
  rowWarnings: RowWarning[];
  strippedColumns: string[];
  suspectTfnFlags: string[];
  /** Deduplicated lowercased list of tag names referenced by `tags` columns. */
  newTagsToCreate: string[];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseMasterfileCsv(input: string): Result<ParsedMasterfile> {
  if (!input || input.trim().length === 0) {
    return err('parse_failed', 'CSV input is empty.');
  }

  const lines = splitCsvLines(input);
  if (lines.length === 0) {
    return err('parse_failed', 'CSV input contains no non-empty lines.');
  }

  // ── Header layer ──────────────────────────────────────────────────────────

  const rawHeaders = splitQuotedRow(lines[0]).map(trimNormalise);
  const dataLines = lines.slice(1);
  const dataRows = dataLines.map((line) => splitQuotedRow(line));

  // PII strip — Layer A. Remove any column whose header matches a PII pattern.
  // Rows downstream are rebuilt from the surviving column indices.
  const stripped = stripPiiHeaders(rawHeaders, dataRows);
  const headers = stripped.headers;
  const rows = stripped.rows;
  const strippedColumns = stripped.strippedColumns;

  // Validate required headers are present after the PII strip.
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return err(
      'parse_failed',
      `CSV header missing required columns: ${missing.join(', ')}. See documented schema.`,
      { detail: { missing } },
    );
  }

  // Map header name → column index for cheap per-row lookup.
  const idx: Record<string, number> = {};
  for (const name of [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]) {
    idx[name] = headers.indexOf(name);
  }

  // ── Row layer ─────────────────────────────────────────────────────────────

  const validRows: ParsedMasterfileRow[] = [];
  const rowErrors: RowError[] = [];
  const rowWarnings: RowWarning[] = [];
  const seenExternalIdLower = new Set<string>();
  const tagsSeen = new Set<string>();
  const allSurvivingValues: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const sourceRow = i + 2; // Header is row 1; first data row is row 2.
    const cells = rows[i];
    // Collect every non-empty surviving cell value for Layer-B TFN scan.
    for (const c of cells) {
      if (c) allSurvivingValues.push(c);
    }

    // Per-row validation. The first error short-circuits the row — we report
    // one field per row to keep dry-run preview output digestible.
    const rowResult = validateRow(cells, idx, sourceRow, seenExternalIdLower);
    if (rowResult.error) {
      rowErrors.push(rowResult.error);
      continue;
    }
    const row = rowResult.row!;
    seenExternalIdLower.add(row.employee_external_id.toLowerCase());

    // Per-row warnings (SHOULDs — non-blocking).
    for (const warning of buildRowWarnings(cells, idx, sourceRow, row)) {
      rowWarnings.push(warning);
    }

    // Tags — collect new names for the commit step's bulk-create-from-import.
    for (const tag of row.tags) tagsSeen.add(tag);

    validRows.push(row);
  }

  // Layer-B PII defence — scan every surviving value.
  const suspectTfnFlags = flagSuspectTfn(allSurvivingValues);

  // Deterministic ordering: insertion order of unique tag names.
  const newTagsToCreate = Array.from(tagsSeen);

  return ok({
    validRows,
    rowErrors,
    rowWarnings,
    strippedColumns,
    suspectTfnFlags,
    newTagsToCreate,
  });
}

// ─── Row validation ──────────────────────────────────────────────────────────

interface RowValidationOutcome {
  row?: ParsedMasterfileRow;
  error?: RowError;
}

function validateRow(
  cells: ReadonlyArray<string>,
  idx: Record<string, number>,
  sourceRow: number,
  seenExternalIdLower: ReadonlySet<string>,
): RowValidationOutcome {
  const cell = (name: string): string => {
    const i = idx[name];
    if (i === -1) return '';
    return (cells[i] ?? '').trim();
  };

  // MUST 1 — employee_external_id non-empty.
  const employeeExternalId = cell('employee_external_id');
  if (employeeExternalId.length === 0) {
    return {
      error: {
        row: sourceRow,
        field: 'employee_external_id',
        message: 'employee_external_id is required.',
      },
    };
  }

  // DEV-EMP-2 service-layer soft cap.
  if (employeeExternalId.length > EMPLOYEE_EXTERNAL_ID_MAX_LENGTH) {
    return {
      error: {
        row: sourceRow,
        field: 'employee_external_id',
        message: `employee_external_id exceeds the ${EMPLOYEE_EXTERNAL_ID_MAX_LENGTH}-char service-layer soft cap.`,
      },
    };
  }

  // MUST 6 — duplicate (case-insensitive, matching the DB UNIQUE constraint).
  if (seenExternalIdLower.has(employeeExternalId.toLowerCase())) {
    return {
      error: {
        row: sourceRow,
        field: 'employee_external_id',
        message: `Duplicate employee_external_id "${employeeExternalId}" within import batch.`,
      },
    };
  }

  // MUST 2 — start_date present and ISO-parseable.
  const startDate = cell('start_date');
  if (!ISO_DATE.test(startDate) || !isValidIsoDate(startDate)) {
    return {
      error: {
        row: sourceRow,
        field: 'start_date',
        message: `start_date must be YYYY-MM-DD; got "${startDate}".`,
      },
    };
  }

  // MUST 3 — default_work_jurisdiction valid.
  const jurisdictionRaw = cell('default_work_jurisdiction').toUpperCase();
  if (!(VALID_JURISDICTIONS as ReadonlyArray<string>).includes(jurisdictionRaw)) {
    return {
      error: {
        row: sourceRow,
        field: 'default_work_jurisdiction',
        message: `default_work_jurisdiction must be one of ${VALID_JURISDICTIONS.join(', ')}; got "${jurisdictionRaw}".`,
      },
    };
  }

  // MUST 4 — employment_type valid.
  const employmentTypeRaw = cell('employment_type').toLowerCase();
  if (!(VALID_EMPLOYMENT_TYPES as ReadonlyArray<string>).includes(employmentTypeRaw)) {
    return {
      error: {
        row: sourceRow,
        field: 'employment_type',
        message: `employment_type must be one of ${VALID_EMPLOYMENT_TYPES.join(', ')}; got "${employmentTypeRaw}".`,
      },
    };
  }

  // MUST 5 — pay_frequency valid.
  const payFrequencyRaw = cell('pay_frequency').toLowerCase();
  if (!(VALID_PAY_FREQUENCIES as ReadonlyArray<string>).includes(payFrequencyRaw)) {
    return {
      error: {
        row: sourceRow,
        field: 'pay_frequency',
        message: `pay_frequency must be one of ${VALID_PAY_FREQUENCIES.join(', ')}; got "${payFrequencyRaw}".`,
      },
    };
  }

  // MUST 8 — scheme is state_lsl in v1 (default if absent).
  const schemeRaw = cell('scheme');
  let scheme: Scheme;
  if (schemeRaw.length === 0) {
    scheme = 'state_lsl';
  } else if (schemeRaw === 'state_lsl') {
    scheme = 'state_lsl';
  } else {
    return {
      error: {
        row: sourceRow,
        field: 'scheme',
        message: `scheme must be "state_lsl" in v1; got "${schemeRaw}". Portable-LSL schemes are reserved for v1.1.`,
      },
    };
  }

  // Optional fields — present but parseable, or absent → null.
  const endDate = cell('end_date');
  if (endDate.length > 0 && (!ISO_DATE.test(endDate) || !isValidIsoDate(endDate))) {
    return {
      error: {
        row: sourceRow,
        field: 'end_date',
        message: `end_date must be YYYY-MM-DD; got "${endDate}".`,
      },
    };
  }

  const sexRaw = cell('sex');
  let sex: Sex | null = null;
  if (sexRaw.length > 0) {
    if (!(VALID_SEX as ReadonlyArray<string>).includes(sexRaw)) {
      return {
        error: {
          row: sourceRow,
          field: 'sex',
          message: `sex must be one of ${VALID_SEX.join(', ')}; got "${sexRaw}".`,
        },
      };
    }
    sex = sexRaw as Sex;
  }

  const dob = cell('dob');
  if (dob.length > 0 && (!ISO_DATE.test(dob) || !isValidIsoDate(dob))) {
    return {
      error: {
        row: sourceRow,
        field: 'dob',
        message: `dob must be YYYY-MM-DD; got "${dob}".`,
      },
    };
  }

  const hoursPerWeekRaw = cell('hours_per_week');
  let hoursPerWeek: number | null = null;
  if (hoursPerWeekRaw.length > 0) {
    const n = Number(hoursPerWeekRaw);
    if (!Number.isFinite(n) || n < 0) {
      return {
        error: {
          row: sourceRow,
          field: 'hours_per_week',
          message: `hours_per_week must be a non-negative number; got "${hoursPerWeekRaw}".`,
        },
      };
    }
    hoursPerWeek = n;
  }

  const openingBalanceWeeks = cell('opening_balance_weeks');
  let openingBalanceWeeksNum: number | null = null;
  if (openingBalanceWeeks.length > 0) {
    const n = Number(openingBalanceWeeks);
    if (!Number.isFinite(n) || n < 0) {
      return {
        error: {
          row: sourceRow,
          field: 'opening_balance_weeks',
          message: `opening_balance_weeks must be a non-negative number; got "${openingBalanceWeeks}".`,
        },
      };
    }
    openingBalanceWeeksNum = n;
  }

  const openingBalanceTakenWeeks = cell('opening_balance_taken_weeks');
  let openingBalanceTakenWeeksNum: number | null = null;
  if (openingBalanceTakenWeeks.length > 0) {
    const n = Number(openingBalanceTakenWeeks);
    if (!Number.isFinite(n) || n < 0) {
      return {
        error: {
          row: sourceRow,
          field: 'opening_balance_taken_weeks',
          message: `opening_balance_taken_weeks must be a non-negative number; got "${openingBalanceTakenWeeks}".`,
        },
      };
    }
    openingBalanceTakenWeeksNum = n;
  }

  const openingBalanceAsAt = cell('opening_balance_as_at_date');
  if (
    openingBalanceAsAt.length > 0 &&
    (!ISO_DATE.test(openingBalanceAsAt) || !isValidIsoDate(openingBalanceAsAt))
  ) {
    return {
      error: {
        row: sourceRow,
        field: 'opening_balance_as_at_date',
        message: `opening_balance_as_at_date must be YYYY-MM-DD; got "${openingBalanceAsAt}".`,
      },
    };
  }

  // MUST 9 — tags pipe-delimited list, each 1-50 chars, lowercased, trimmed.
  const tagsRaw = cell('tags');
  let tags: string[] = [];
  if (tagsRaw.length > 0) {
    const parts = tagsRaw
      .split('|')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    for (const tag of parts) {
      if (!TAG_NAME_REGEX.test(tag)) {
        return {
          error: {
            row: sourceRow,
            field: 'tags',
            message: `Invalid tag "${tag}". Tags must be 1-50 chars, lowercase, alphanumeric / underscore / hyphen only.`,
          },
        };
      }
    }
    // Dedup within the same row (operator may accidentally repeat a tag).
    tags = Array.from(new Set(parts));
  }

  return {
    row: {
      sourceRow,
      employee_external_id: employeeExternalId,
      full_name: cell('full_name'),
      start_date: startDate,
      end_date: endDate.length === 0 ? null : endDate,
      default_work_jurisdiction: jurisdictionRaw as Jurisdiction,
      employment_type: employmentTypeRaw as EmploymentType,
      pay_frequency: payFrequencyRaw as PayFrequency,
      sex,
      dob: dob.length === 0 ? null : dob,
      classification: cell('classification') || null,
      hours_per_week: hoursPerWeek,
      scheme,
      opening_balance_weeks: openingBalanceWeeksNum,
      opening_balance_taken_weeks: openingBalanceTakenWeeksNum,
      opening_balance_as_at_date: openingBalanceAsAt.length === 0 ? null : openingBalanceAsAt,
      tags,
    },
  };
}

function buildRowWarnings(
  cells: ReadonlyArray<string>,
  idx: Record<string, number>,
  sourceRow: number,
  row: ParsedMasterfileRow,
): RowWarning[] {
  const warnings: RowWarning[] = [];

  // SHOULD 1 — ABN mod-89 check. Only present if the CSV carries an `abn`
  // column (rare — ABN lives on `organisations`, not on employees — but the
  // operator may include it for their own reconciliation). Warn on mismatch.
  if (idx.abn !== -1) {
    const raw = (cells[idx.abn] ?? '').trim();
    if (raw.length > 0 && !validateAbnChecksum(raw)) {
      warnings.push({
        row: sourceRow,
        field: 'abn',
        message: `ABN "${raw}" failed mod-89 check-digit validation. Verify with the customer.`,
      });
    }
  }

  // SHOULD 2 — TAS without sex / NT without dob.
  if (row.default_work_jurisdiction === 'TAS' && row.sex === null) {
    warnings.push({
      row: sourceRow,
      field: 'sex',
      message:
        'TAS employees require `sex` for s.8(3) retirement-gate engine logic. Valuations will block until populated.',
    });
  }
  if (row.default_work_jurisdiction === 'NT' && row.dob === null) {
    warnings.push({
      row: sourceRow,
      field: 'dob',
      message:
        'NT employees require `dob` for s.10(2) federal Age Pension age lookup. Valuations will block until populated.',
    });
  }

  return warnings;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate an ISO-shaped date string actually represents a real calendar date
 * (catches things like 2020-02-30). Assumes the input already matched
 * `ISO_DATE` regex.
 */
function isValidIsoDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Australian Business Number mod-89 check-digit validation.
 *
 * Algorithm (ATO published):
 *   1. Subtract 1 from the first digit.
 *   2. Multiply each digit by the corresponding weight:
 *      [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19].
 *   3. Sum the products.
 *   4. Divisible by 89 → valid.
 *
 * Service-layer SOFT validation only (spec §5 SHOULD 1). The DB constraint
 * enforces the `^\d{11}$` format; this function adds the check-digit gate
 * on top.
 */
function validateAbnChecksum(raw: string): boolean {
  const digits = raw.replace(/\s+/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split('').map(Number);
  nums[0] -= 1;
  const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
  return sum % 89 === 0;
}
