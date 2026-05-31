/**
 * PII strip — unit tests.
 *
 * Two-layer defence per impl-plan §1.5:
 *   (a) Column-name allowlist — any CSV header matching TFN / bank /
 *       BSB / super patterns is stripped at parse time. The column
 *       and its values never reach the DB.
 *   (b) Per-value regex defence — any *parsed value* that looks like a
 *       9-digit TFN or 6-digit BSB is FLAGGED (not auto-stripped) for
 *       operator review in the dry-run preview.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §5 (validation)
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.5
 *   - AC-EMP-7 (PII strip).
 */

import { describe, it, expect } from 'vitest';
import { stripPiiHeaders, flagSuspectTfn } from '../pii-strip';

describe('stripPiiHeaders (layer A — column-name allowlist)', () => {
  it('strips a column whose header is exactly "tfn"', () => {
    const headers = ['employee_external_id', 'full_name', 'tfn'];
    const rows = [
      ['E1', 'Alice', '123456789'],
      ['E2', 'Bob', '987654321'],
    ];
    const result = stripPiiHeaders(headers, rows);
    expect(result.headers).toEqual(['employee_external_id', 'full_name']);
    expect(result.rows).toEqual([
      ['E1', 'Alice'],
      ['E2', 'Bob'],
    ]);
    expect(result.strippedColumns).toEqual(['tfn']);
  });

  it.each([
    'tax_file_number',
    'tax_file',
    'taxfile',
    'tax file',
    'TaxFile',
    'TAX_FILE_NUMBER',
    'tax_id',
    'taxid',
    'TFN',
    'tfn_number',
    'employee_tfn',
  ])('strips a column matching TFN-family pattern "%s"', (header) => {
    const result = stripPiiHeaders(['external_id', header], [['E1', 'XXX']]);
    expect(result.headers).toEqual(['external_id']);
    expect(result.strippedColumns).toEqual([header]);
    expect(result.rows[0]).toEqual(['E1']);
  });

  it.each([
    'bank_account',
    'bank account',
    'BankAccount',
    'account_number',
    'account number',
    'bsb',
    'BSB',
    'bank_bsb',
  ])('strips a column matching bank-family pattern "%s"', (header) => {
    const result = stripPiiHeaders(['external_id', header], [['E1', '062-000']]);
    expect(result.headers).toEqual(['external_id']);
    expect(result.strippedColumns).toEqual([header]);
    expect(result.rows[0]).toEqual(['E1']);
  });

  it.each([
    'super_member',
    'super member',
    'SuperMember',
    'super_membership',
    'super_fund_member',
    'super_member_number',
  ])('strips a column matching super-family pattern "%s"', (header) => {
    const result = stripPiiHeaders(['external_id', header], [['E1', 'SF-1234']]);
    expect(result.headers).toEqual(['external_id']);
    expect(result.strippedColumns).toEqual([header]);
    expect(result.rows[0]).toEqual(['E1']);
  });

  it('strips multiple PII columns in a single pass and preserves the remaining order', () => {
    const headers = ['external_id', 'tfn', 'full_name', 'bsb', 'start_date', 'super_member'];
    const rows = [['E1', '123456789', 'Alice', '062-000', '2020-01-01', 'SF-1']];
    const result = stripPiiHeaders(headers, rows);
    expect(result.headers).toEqual(['external_id', 'full_name', 'start_date']);
    expect(result.strippedColumns).toEqual(['tfn', 'bsb', 'super_member']);
    expect(result.rows[0]).toEqual(['E1', 'Alice', '2020-01-01']);
  });

  it('is a no-op when no headers match any pattern', () => {
    const headers = ['external_id', 'full_name', 'start_date'];
    const rows = [['E1', 'Alice', '2020-01-01']];
    const result = stripPiiHeaders(headers, rows);
    expect(result.headers).toEqual(headers);
    expect(result.rows).toEqual(rows);
    expect(result.strippedColumns).toEqual([]);
  });

  it('does NOT strip the protected v1 column "tags"', () => {
    // Spec §5 explicitly notes PII-strip header patterns do not match `tags`.
    const result = stripPiiHeaders(
      ['external_id', 'tags'],
      [['E1', 'finance|sydney']],
    );
    expect(result.headers).toEqual(['external_id', 'tags']);
    expect(result.strippedColumns).toEqual([]);
  });

  it('does NOT strip benign columns that happen to contain "id" or "number"', () => {
    // employee_external_id and employee_number are the canonical identifier
    // fields — they must survive strip even though "id" / "number" appear in
    // the names. The TFN patterns are narrow: `tfn`, `tax_file*`, `tax_id`,
    // `taxid` — none of which match these benign names.
    const headers = ['employee_external_id', 'employee_number', 'phone_number'];
    const rows = [['E1', '12345', '0400000000']];
    const result = stripPiiHeaders(headers, rows);
    expect(result.headers).toEqual(headers);
    expect(result.strippedColumns).toEqual([]);
  });

  it('handles an empty input', () => {
    expect(stripPiiHeaders([], [])).toEqual({
      headers: [],
      rows: [],
      strippedColumns: [],
    });
  });

  it('handles rows of mismatched length without throwing (truncates / pads as the headers go)', () => {
    // Defensive: real CSVs sometimes have ragged rows. We rebuild rows from
    // the surviving header indices, so mismatched lengths just yield
    // undefined-padded cells which we render as empty strings.
    const headers = ['external_id', 'tfn', 'full_name'];
    const rows = [
      ['E1', '123456789'], // short — missing full_name
      ['E2', '987654321', 'Bob', 'extra'], // long — extra cell
    ];
    const result = stripPiiHeaders(headers, rows);
    expect(result.headers).toEqual(['external_id', 'full_name']);
    expect(result.rows[0]).toEqual(['E1', '']);
    expect(result.rows[1]).toEqual(['E2', 'Bob']);
  });
});

describe('flagSuspectTfn (layer B — per-value regex defence)', () => {
  it('flags a 9-digit value', () => {
    const flagged = flagSuspectTfn(['123456789', 'Alice', '2020-01-01']);
    expect(flagged).toEqual(['123456789']);
  });

  it('returns an empty array when no value looks like a TFN', () => {
    expect(flagSuspectTfn(['Alice', 'Bob', '2020-01-01', 'NSW'])).toEqual([]);
  });

  it('does NOT flag an 8-digit or 10-digit value', () => {
    expect(flagSuspectTfn(['12345678'])).toEqual([]);
    expect(flagSuspectTfn(['1234567890'])).toEqual([]);
  });

  it('does NOT flag a 9-digit value that contains non-digits', () => {
    expect(flagSuspectTfn(['123-456-789'])).toEqual([]);
    expect(flagSuspectTfn(['abc123def'])).toEqual([]);
  });

  it('does NOT flag the empty string', () => {
    expect(flagSuspectTfn([''])).toEqual([]);
  });

  it('flags every 9-digit value when several appear', () => {
    const flagged = flagSuspectTfn(['123456789', 'Alice', '987654321', '111222333']);
    expect(flagged).toEqual(['123456789', '987654321', '111222333']);
  });

  it('deduplicates flagged values — surfacing the same TFN twice is noise', () => {
    const flagged = flagSuspectTfn(['123456789', '123456789', '123456789']);
    expect(flagged).toEqual(['123456789']);
  });

  it('ignores leading / trailing whitespace when matching the regex', () => {
    // Real CSVs frequently carry stray whitespace.
    expect(flagSuspectTfn([' 123456789 '])).toEqual(['123456789']);
  });
});
