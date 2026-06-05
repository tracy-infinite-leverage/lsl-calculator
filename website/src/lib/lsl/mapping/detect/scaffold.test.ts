// E5.3 Phase 2 / Task T2.1 — scaffold smoke test.
//
// Verifies the barrel exports and that every detector module is reachable
// via the barrel. Each detector throws `not_implemented` until its specific
// task (T2.2–T2.5) lands; this test pins the contract so subsequent tasks
// cannot accidentally rename or remove a symbol without updating callers.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.1

import { describe, it, expect } from 'vitest';

import {
  detectFileShape,
  detectColumns,
  detectValueNormalisations,
  detectPayCodes,
  COLUMN_HEADER_PROPOSE_THRESHOLD,
  VALUE_PATTERN_PROPOSE_THRESHOLD,
} from './index';

describe('E5.3 T2.1 — Pass 1 detector scaffold', () => {
  it('barrel exposes all four detector functions', () => {
    expect(typeof detectFileShape).toBe('function');
    expect(typeof detectColumns).toBe('function');
    expect(typeof detectValueNormalisations).toBe('function');
    expect(typeof detectPayCodes).toBe('function');
  });

  it('confidence-threshold constants match spec §5', () => {
    // Column-header detection threshold (spec §5.2).
    expect(COLUMN_HEADER_PROPOSE_THRESHOLD).toBe(0.7);
    // Value-pattern detection threshold (spec §5.4).
    expect(VALUE_PATTERN_PROPOSE_THRESHOLD).toBe(0.6);
  });

  it('detectFileShape implementation landed in T2.2 — empty input now throws a validation error', () => {
    // T2.2 supersedes the original `not_implemented` stub. Empty input is now
    // a caller-bug guard; see `file-shape.test.ts` for full behaviour coverage.
    expect(() => detectFileShape([], [])).toThrow(/at least one input file/);
  });

  it('detectColumns stub throws not_implemented (lands in T2.3)', () => {
    expect(() => detectColumns([], [], [])).toThrow(/not_implemented/);
  });

  it('detectValueNormalisations stub throws not_implemented (lands in T2.4)', () => {
    expect(() =>
      detectValueNormalisations('work_jurisdiction', [], []),
    ).toThrow(/not_implemented/);
  });

  it('detectPayCodes stub throws not_implemented (lands in T2.5)', () => {
    expect(() => detectPayCodes([], [], [])).toThrow(/not_implemented/);
  });
});
