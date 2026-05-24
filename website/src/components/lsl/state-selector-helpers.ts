/**
 * Pure helpers for the state-selector. Extracted so they can be unit-tested in
 * Vitest's node environment — the component itself depends on Radix + DOM and
 * is exercised via Playwright.
 *
 * See `state-selector.tsx`.
 */

import type { State } from '@/lib/lsl/engine/types';

export const ALL_STATES_ORDERED: ReadonlyArray<State> = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'ACT',
  'TAS',
  'NT',
];

export const RECENT_STATES_STORAGE_KEY = 'lsl-calculator:state-recent:v1';
export const MAX_RECENT = 3;

/**
 * Update an LRU recent-states list with a new pick.
 *
 * - Newest first.
 * - Deduplicated.
 * - Capped at `MAX_RECENT` entries.
 */
export function pushRecent(prev: State[], state: State): State[] {
  return [state, ...prev.filter((s) => s !== state)].slice(0, MAX_RECENT);
}

/**
 * Parse a raw localStorage payload into a sanitised recent-states list.
 * Returns an empty array for any malformed input (including non-arrays,
 * unknown state values, or corrupt JSON-parsed values).
 */
export function parseRecent(raw: unknown): State[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is State => typeof s === 'string' && ALL_STATES_ORDERED.includes(s as State))
    .slice(0, MAX_RECENT);
}
