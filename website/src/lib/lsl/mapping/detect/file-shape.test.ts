// E5.3 Phase 2 / Task T2.2 — unit tests for `detectFileShape`.
//
// Coverage targets (per tasks.md T2.2 acceptance):
//   1. csv                     — single CSV file → `{ shape: 'csv' }`.
//   2. excel-single            — one workbook, one sheet → `{ shape: 'excel-single' }`.
//   3. excel-multi             — one workbook, ≥ 2 sheets → highest-scoring sheet
//                                proposed. Virtus 3-sheet fixture: Sheet3 wins.
//   4. multi-file-relational   — 2–4 CSVs → shared `Employee ID` join key.
//                                Virtus 3-CSV fixture.
//
// The fixtures are inline TS literals — we don't need the real .xlsx / .csv
// bytes here. `detectFileShape` is a pure function over already-parsed sheets,
// so the test surface is the parsed header rows + sample rows that the upload
// pipeline (E5.4) will hand it. The Virtus fixtures below mirror the column
// signatures observed in the canonical files referenced by the spec.

import { describe, it, expect } from 'vitest';

import { detectFileShape } from './file-shape';
import type { DetectorFileInput, PayCodeAliasRow } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Test aliases — a minimal slice of the system-seed `pay_code_aliases` rows
// loaded by migration `20260602020600_create_pay_code_aliases.sql`. The
// `header_name` rows are what the sheet-signature scoring consumes; PII rows
// are intentionally included to verify they're excluded from the score.
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_ALIAS_SEEDS: ReadonlyArray<
  Pick<PayCodeAliasRow, 'pattern_kind' | 'pattern' | 'bucket' | 'confidence'>
> = [
  { pattern_kind: 'header_name', pattern: 'pay_code',         bucket: 'ordinary_time', confidence: 0.9 },
  { pattern_kind: 'header_name', pattern: 'pay code',         bucket: 'ordinary_time', confidence: 0.9 },
  { pattern_kind: 'header_name', pattern: 'paycode',          bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'earnings_code',    bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'pay_item',         bucket: 'ordinary_time', confidence: 0.8 },
  { pattern_kind: 'header_name', pattern: 'amount',           bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'gross',            bucket: 'ordinary_time', confidence: 0.75 },
  { pattern_kind: 'header_name', pattern: 'employee_id',      bucket: 'ordinary_time', confidence: 0.9 },
  { pattern_kind: 'header_name', pattern: 'employee id',      bucket: 'ordinary_time', confidence: 0.9 },
  { pattern_kind: 'header_name', pattern: 'units',            bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'hours',            bucket: 'ordinary_time', confidence: 0.8 },
  { pattern_kind: 'header_name', pattern: 'normal hours paid',bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'pay_period_end',   bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'pay period end',   bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'work_jurisdiction',bucket: 'ordinary_time', confidence: 0.85 },
  { pattern_kind: 'header_name', pattern: 'pay frequency',    bucket: 'ordinary_time', confidence: 0.85 },
  // PII surfaces — present but excluded from sheet scoring.
  { pattern_kind: 'header_name', pattern: 'TFN',              bucket: 'pii_strip',     confidence: 0.99 },
  { pattern_kind: 'header_name', pattern: 'BSB',              bucket: 'pii_strip',     confidence: 0.99 },
  // A non-header pattern — verifies the filter to `header_name` works.
  { pattern_kind: 'code_value',  pattern: 'ORD',              bucket: 'ordinary_time', confidence: 0.9 },
];

/** Hydrate the alias rows to full `PayCodeAliasRow` shape. */
function aliases(
  rows: ReadonlyArray<
    Pick<PayCodeAliasRow, 'pattern_kind' | 'pattern' | 'bucket' | 'confidence'>
  > = HEADER_ALIAS_SEEDS,
): PayCodeAliasRow[] {
  return rows.map((r, i) => ({
    id: `alias-${i}`,
    created_at: '2026-06-02T00:00:00Z',
    source: 'system_seed',
    ...r,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape 1 — CSV
// ─────────────────────────────────────────────────────────────────────────────

describe('detectFileShape — shape: csv', () => {
  it('classifies a single CSV as `csv`', () => {
    const input: DetectorFileInput = {
      filename: 'payroll-2026-04.csv',
      kind: 'csv',
      sheets: [
        {
          name: 'payroll-2026-04.csv',
          headers: ['Employee ID', 'Pay Code', 'Amount', 'Units', 'Pay Period End'],
          sampleRows: [['E001', 'ORD', '1500.00', '38', '2026-04-15']],
        },
      ],
    };

    const result = detectFileShape([input], aliases());

    expect(result.shape).toBe('csv');
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets?.[0].score).toBeGreaterThan(0.5);
    expect(result.proposedSheet).toBeUndefined();
    expect(result.fileRelationship).toBeUndefined();
  });

  it('handles an empty-headers CSV with score 0 (degenerate but not a throw)', () => {
    const input: DetectorFileInput = {
      filename: 'empty.csv',
      kind: 'csv',
      sheets: [{ name: 'empty.csv', headers: [], sampleRows: [] }],
    };
    const result = detectFileShape([input], aliases());
    expect(result.shape).toBe('csv');
    expect(result.sheets?.[0].score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shape 2 — excel-single
// ─────────────────────────────────────────────────────────────────────────────

describe('detectFileShape — shape: excel-single', () => {
  it('classifies a one-sheet .xlsx as `excel-single`', () => {
    const input: DetectorFileInput = {
      filename: 'monthly.xlsx',
      kind: 'xlsx',
      sheets: [
        {
          name: 'Payroll',
          headers: ['Employee ID', 'Pay Code', 'Amount', 'Units'],
          sampleRows: [['E001', 'ORD', '1500.00', '38']],
        },
      ],
    };

    const result = detectFileShape([input], aliases());

    expect(result.shape).toBe('excel-single');
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets?.[0].name).toBe('Payroll');
    expect(result.proposedSheet).toBeUndefined();
  });

  it('also classifies single-sheet .xlsm as `excel-single`', () => {
    const input: DetectorFileInput = {
      filename: 'monthly.xlsm',
      kind: 'xlsm',
      sheets: [
        {
          name: 'Sheet1',
          headers: ['Employee ID', 'Pay Code', 'Amount'],
          sampleRows: [['E001', 'ORD', '1500.00']],
        },
      ],
    };
    expect(detectFileShape([input], aliases()).shape).toBe('excel-single');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shape 3 — excel-multi (Virtus 3-sheet workbook)
// ─────────────────────────────────────────────────────────────────────────────

describe('detectFileShape — shape: excel-multi (Virtus 3-sheet)', () => {
  // Mirrors `Virtus Health LSL - Sample run.xlsx` per spec §10 — Sheet1 +
  // Sheet2 are reconciliation summaries; Sheet3 carries the payroll-export
  // columns (long-form states + prefixed employment types).
  const virtus3Sheet: DetectorFileInput = {
    filename: 'Virtus Health LSL - Sample run.xlsx',
    kind: 'xlsx',
    sheets: [
      {
        name: 'Sheet1',
        headers: ['Summary Label', 'Total', 'Notes'],
        sampleRows: [['Gross', '$1.2M', '']],
      },
      {
        name: 'Sheet2',
        headers: ['ABN', 'Entity Name', 'Headcount', 'Period'],
        sampleRows: [['12345', 'Virtus IVF Pty Ltd', '120', '2026-04']],
      },
      {
        name: 'Sheet3',
        headers: [
          'Employee ID',
          'Pay Code',
          'Amount',
          'Units',
          'Pay Period End',
          'Work Jurisdiction',
          'Pay Frequency',
        ],
        sampleRows: [
          ['E001', 'ORD', '1500.00', '38', '2026-04-15', 'Tasmania', 'Weekly'],
          ['E002', 'OT15', '220.00', '4', '2026-04-15', 'Victoria', 'Weekly'],
        ],
      },
    ],
  };

  it('classifies the Virtus 3-sheet workbook as `excel-multi`', () => {
    const result = detectFileShape([virtus3Sheet], aliases());
    expect(result.shape).toBe('excel-multi');
  });

  it('proposes Sheet3 as the payroll-export sheet (AC-MAP-13)', () => {
    const result = detectFileShape([virtus3Sheet], aliases());
    expect(result.proposedSheet).toBe('Sheet3');
  });

  it('surfaces a score for every sheet with Sheet3 ranked highest', () => {
    const result = detectFileShape([virtus3Sheet], aliases());
    expect(result.sheets).toHaveLength(3);
    const byName = Object.fromEntries((result.sheets ?? []).map((s) => [s.name, s.score]));
    expect(byName['Sheet3']).toBeGreaterThan(byName['Sheet1'] ?? 0);
    expect(byName['Sheet3']).toBeGreaterThan(byName['Sheet2'] ?? 0);
    // Sheet3 has 5+ matching headers — should clear the 0.7 propose threshold.
    expect(byName['Sheet3']).toBeGreaterThanOrEqual(0.7);
  });

  it('uses stable input order to break ties between identically-scored sheets', () => {
    // Two payroll-shaped sheets with identical headers — first should win.
    const tied: DetectorFileInput = {
      filename: 'tied.xlsx',
      kind: 'xlsx',
      sheets: [
        { name: 'Alpha', headers: ['Employee ID', 'Pay Code', 'Amount'], sampleRows: [] },
        { name: 'Beta',  headers: ['Employee ID', 'Pay Code', 'Amount'], sampleRows: [] },
      ],
    };
    expect(detectFileShape([tied], aliases()).proposedSheet).toBe('Alpha');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shape 4 — multi-file-relational (Virtus 3-CSV drop)
// ─────────────────────────────────────────────────────────────────────────────

describe('detectFileShape — shape: multi-file-relational (Virtus 3-CSV)', () => {
  // Mirrors the Virtus PayHistory + PayRateHistory + PositionHistory drop per
  // spec §10. `Employee ID` is the shared join key across all three.
  const payHistory: DetectorFileInput = {
    filename: 'Virtus SAMPLE PayHistorySampleFile(in).csv',
    kind: 'csv',
    sheets: [
      {
        name: 'pay-history',
        headers: ['Employee ID', 'Pay Code', 'Units', 'Amount', 'Pay Run'],
        sampleRows: [['E001', 'ORD', '38', '1500.00', '2026-04-15']],
      },
    ],
  };
  const rateHistory: DetectorFileInput = {
    filename: 'Virtus SAMPLE PayRateHistorySampleFile(in).csv',
    kind: 'csv',
    sheets: [
      {
        name: 'rate-history',
        headers: ['Employee ID', 'Effective From', 'Rate'],
        sampleRows: [['E001', '2025-07-01', '38.45']],
      },
    ],
  };
  const positionHistory: DetectorFileInput = {
    filename: 'Virtus SAMPLE PositionHistorySampleFile(in).csv',
    kind: 'csv',
    sheets: [
      {
        name: 'position-history',
        headers: ['Employee ID', 'Effective From', 'Position Title'],
        sampleRows: [['E001', '2025-07-01', 'Embryologist']],
      },
    ],
  };

  it('classifies the Virtus 3-CSV drop as `multi-file-relational`', () => {
    const result = detectFileShape(
      [payHistory, rateHistory, positionHistory],
      aliases(),
    );
    expect(result.shape).toBe('multi-file-relational');
  });

  it('identifies `Employee ID` as the join key (AC-MAP-14)', () => {
    const result = detectFileShape(
      [payHistory, rateHistory, positionHistory],
      aliases(),
    );
    expect(result.fileRelationship?.joinKey).toBe('Employee ID');
    expect(result.fileRelationship?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('proposes PayHistory as the primary file (most payroll-like signature)', () => {
    const result = detectFileShape(
      [rateHistory, payHistory, positionHistory], // shuffled — order shouldn't matter
      aliases(),
    );
    expect(result.fileRelationship?.primaryFile).toBe(
      'Virtus SAMPLE PayHistorySampleFile(in).csv',
    );
    expect(result.fileRelationship?.companionFiles).toHaveLength(2);
    expect(result.fileRelationship?.companionFiles).toContain(
      'Virtus SAMPLE PayRateHistorySampleFile(in).csv',
    );
    expect(result.fileRelationship?.companionFiles).toContain(
      'Virtus SAMPLE PositionHistorySampleFile(in).csv',
    );
  });

  it('tolerates header-spelling drift across files (Employee_ID vs Employee ID)', () => {
    const drifted: DetectorFileInput = {
      ...rateHistory,
      sheets: [
        {
          ...rateHistory.sheets[0],
          headers: ['Employee_ID', 'Effective From', 'Rate'],
        },
      ],
    };
    const result = detectFileShape(
      [payHistory, drifted, positionHistory],
      aliases(),
    );
    expect(result.fileRelationship?.joinKey).toMatch(/Employee[\s_]?ID/i);
  });

  it('surfaces all uploaded files in `sheets` with their individual scores', () => {
    const result = detectFileShape(
      [payHistory, rateHistory, positionHistory],
      aliases(),
    );
    expect(result.sheets).toHaveLength(3);
    const payHistoryScore = result.sheets?.find((s) => s.name === 'pay-history')?.score ?? 0;
    const rateHistoryScore = result.sheets?.find((s) => s.name === 'rate-history')?.score ?? 0;
    expect(payHistoryScore).toBeGreaterThan(rateHistoryScore);
  });

  it('omits fileRelationship when no shared header surfaces', () => {
    const disjointA: DetectorFileInput = {
      filename: 'a.csv',
      kind: 'csv',
      sheets: [{ name: 'a', headers: ['ColA', 'ColB'], sampleRows: [] }],
    };
    const disjointB: DetectorFileInput = {
      filename: 'b.csv',
      kind: 'csv',
      sheets: [{ name: 'b', headers: ['ColC', 'ColD'], sampleRows: [] }],
    };
    const result = detectFileShape([disjointA, disjointB], aliases());
    expect(result.shape).toBe('multi-file-relational');
    expect(result.fileRelationship).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-cutting — invariants the contract demands of every shape.
// ─────────────────────────────────────────────────────────────────────────────

describe('detectFileShape — cross-cutting invariants', () => {
  it('throws on empty input (caller bug)', () => {
    expect(() => detectFileShape([], aliases())).toThrow(/at least one input file/);
  });

  it('is a pure function — same inputs produce same outputs', () => {
    const input: DetectorFileInput = {
      filename: 'p.csv',
      kind: 'csv',
      sheets: [
        {
          name: 'p',
          headers: ['Employee ID', 'Pay Code', 'Amount'],
          sampleRows: [['E001', 'ORD', '1500']],
        },
      ],
    };
    const a = detectFileShape([input], aliases());
    const b = detectFileShape([input], aliases());
    expect(a).toEqual(b);
  });

  it('PII-strip aliases do not inflate sheet scores', () => {
    // A sheet whose ONLY matches are PII columns (TFN, BSB) should score 0 —
    // the spec says PII presence is orthogonal to "is this payroll".
    const piiOnly: DetectorFileInput = {
      filename: 'pii-only.csv',
      kind: 'csv',
      sheets: [
        { name: 'pii-only', headers: ['TFN', 'BSB'], sampleRows: [['12345', '06-2999']] },
      ],
    };
    const result = detectFileShape([piiOnly], aliases());
    expect(result.sheets?.[0].score).toBe(0);
  });

  it('ignores non-header_name alias rows in sheet scoring', () => {
    // Pass ONLY a `code_value` alias — sheet scoring should not match it.
    const codeValueOnly = aliases([
      { pattern_kind: 'code_value', pattern: 'pay code', bucket: 'ordinary_time', confidence: 0.9 },
    ]);
    const input: DetectorFileInput = {
      filename: 'p.csv',
      kind: 'csv',
      sheets: [{ name: 'p', headers: ['Pay Code', 'Amount'], sampleRows: [] }],
    };
    expect(detectFileShape([input], codeValueOnly).sheets?.[0].score).toBe(0);
  });

  it('returns no shape change with zero aliases (graceful degradation)', () => {
    const input: DetectorFileInput = {
      filename: 'p.csv',
      kind: 'csv',
      sheets: [{ name: 'p', headers: ['Pay Code', 'Amount'], sampleRows: [] }],
    };
    const result = detectFileShape([input], []);
    expect(result.shape).toBe('csv');
    expect(result.sheets?.[0].score).toBe(0);
  });
});
