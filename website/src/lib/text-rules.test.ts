/**
 * text-rules.test.ts — sentence-case helper coverage
 *
 * E6.2 Task 2.7 AC: "Heading helper enforces sentence case".
 */

import { describe, expect, it } from 'vitest';
import { capitaliseFirst, toSentenceCase } from './text-rules';

describe('toSentenceCase', () => {
  it('downcases ALL CAPS and capitalises only the first letter', () => {
    expect(toSentenceCase('PAY HISTORY')).toBe('Pay history');
  });

  it('downcases Title Case and capitalises only the first letter', () => {
    expect(toSentenceCase('Pay History')).toBe('Pay history');
  });

  it('is idempotent on already-sentence-case input', () => {
    expect(toSentenceCase('Pay history')).toBe('Pay history');
  });

  it('capitalises lowercase-only input', () => {
    expect(toSentenceCase('pay history')).toBe('Pay history');
  });

  it('trims leading and trailing whitespace', () => {
    expect(toSentenceCase('  spaced  ')).toBe('Spaced');
  });

  it('returns empty string for empty / whitespace-only input', () => {
    expect(toSentenceCase('')).toBe('');
    expect(toSentenceCase('   ')).toBe('');
  });

  it('handles single-character input', () => {
    expect(toSentenceCase('a')).toBe('A');
    expect(toSentenceCase('Z')).toBe('Z');
  });

  it('flattens acronyms (use capitaliseFirst when acronyms must survive)', () => {
    // Documenting the trade-off in test form so future readers see WHY
    // capitaliseFirst exists alongside this helper.
    expect(toSentenceCase('NSW long service leave')).toBe(
      'Nsw long service leave',
    );
  });
});

describe('capitaliseFirst', () => {
  it('capitalises a lowercase first letter and leaves the rest unchanged', () => {
    expect(capitaliseFirst('pay history')).toBe('Pay history');
  });

  it('preserves embedded acronyms', () => {
    expect(capitaliseFirst('nSW long service leave')).toBe(
      'NSW long service leave',
    );
  });

  it('is idempotent on already-capitalised input', () => {
    expect(capitaliseFirst('Pay history')).toBe('Pay history');
  });

  it('trims leading and trailing whitespace', () => {
    expect(capitaliseFirst('  spaced  ')).toBe('Spaced');
  });

  it('returns empty string for empty / whitespace-only input', () => {
    expect(capitaliseFirst('')).toBe('');
    expect(capitaliseFirst('   ')).toBe('');
  });

  it('handles single-character input', () => {
    expect(capitaliseFirst('a')).toBe('A');
    expect(capitaliseFirst('Z')).toBe('Z');
  });
});
