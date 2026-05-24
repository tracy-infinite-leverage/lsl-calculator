import { describe, it, expect } from 'vitest';
import {
  ALL_STATES_ORDERED,
  MAX_RECENT,
  parseRecent,
  pushRecent,
  RECENT_STATES_STORAGE_KEY,
} from './state-selector-helpers';
import type { State } from '@/lib/lsl/engine/types';

describe('state-selector-helpers · ALL_STATES_ORDERED', () => {
  it('lists exactly 8 states', () => {
    expect(ALL_STATES_ORDERED).toHaveLength(8);
  });

  it('places NSW first (currently-shipped state)', () => {
    expect(ALL_STATES_ORDERED[0]).toBe('NSW');
  });

  it('includes every Australian state and territory', () => {
    const expected: ReadonlyArray<State> = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'ACT', 'TAS', 'NT'];
    for (const s of expected) {
      expect(ALL_STATES_ORDERED).toContain(s);
    }
  });
});

describe('state-selector-helpers · pushRecent', () => {
  it('inserts a new state at the front', () => {
    expect(pushRecent([], 'NSW')).toEqual(['NSW']);
    expect(pushRecent(['VIC'], 'NSW')).toEqual(['NSW', 'VIC']);
  });

  it('moves an existing state to the front (LRU)', () => {
    expect(pushRecent(['VIC', 'NSW', 'QLD'], 'NSW')).toEqual(['NSW', 'VIC', 'QLD']);
  });

  it('caps the list at MAX_RECENT', () => {
    expect(MAX_RECENT).toBe(3);
    const result = pushRecent(['NSW', 'VIC', 'QLD'], 'WA');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('WA');
  });

  it('dedupes correctly when capping (no duplicates after eviction)', () => {
    const result = pushRecent(['VIC', 'QLD', 'NSW'], 'VIC');
    expect(result).toEqual(['VIC', 'QLD', 'NSW']);
    expect(new Set(result).size).toBe(result.length);
  });
});

describe('state-selector-helpers · parseRecent', () => {
  it('parses a valid array', () => {
    expect(parseRecent(['NSW', 'VIC'])).toEqual(['NSW', 'VIC']);
  });

  it('returns empty for non-array input', () => {
    expect(parseRecent('NSW')).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent({ NSW: true })).toEqual([]);
    expect(parseRecent(undefined)).toEqual([]);
  });

  it('filters unknown states', () => {
    expect(parseRecent(['NSW', 'INVALID', 'VIC'])).toEqual(['NSW', 'VIC']);
  });

  it('caps at MAX_RECENT', () => {
    expect(parseRecent(['NSW', 'VIC', 'QLD', 'WA', 'SA'])).toHaveLength(MAX_RECENT);
  });

  it('drops non-string entries', () => {
    expect(parseRecent(['NSW', 42, 'VIC', null, 'QLD'])).toEqual(['NSW', 'VIC', 'QLD']);
  });
});

describe('state-selector-helpers · constants', () => {
  it('storage key follows the LSL Calculator namespace', () => {
    expect(RECENT_STATES_STORAGE_KEY).toBe('lsl-calculator:state-recent:v1');
  });
});
