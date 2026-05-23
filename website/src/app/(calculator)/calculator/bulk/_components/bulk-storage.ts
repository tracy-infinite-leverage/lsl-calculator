/**
 * Bulk-mode browser-local persistence per tasks.md §4.10 / D13.
 *
 * Behaviour:
 *   - Persist the most recent run (results + summary) to localStorage so
 *     a refresh / accidental tab close doesn't blow away minutes of work.
 *   - Cap at 4 MB. Beyond that the data either truncates (too many employees)
 *     or fails the quota check; we silently fall back to in-memory only and
 *     log a console warning. The runner still works — only persistence is
 *     lost.
 *   - Schema versioned via STORAGE_KEY suffix so a future shape change
 *     auto-invalidates old entries.
 */

import type { Result } from '@/lib/lsl/engine/types';
import type { BulkParsedEmployee } from '@/lib/lsl/parsers/csv/bulk';

// v2 — added `parsed` for name lookup + unblock re-runs (Wave 2).
const STORAGE_KEY = 'lsl-calculator:bulk-mode:v2';
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB hard cap (D13)

export interface PersistedBulkState {
  results: Result[];
  /** Optional — present in v2, absent in legacy v1 entries (already invalidated by key bump). */
  parsed?: BulkParsedEmployee[];
  summary: {
    computed: number;
    blocked: number;
    failed: number;
    elapsedMs: number;
  };
  /** Persistence timestamp, ms since epoch. */
  savedAt: number;
}

/** Save bulk results. Returns false (and warns) when over the cap. */
export function saveBulkState(state: Omit<PersistedBulkState, 'savedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload: PersistedBulkState = { ...state, savedAt: Date.now() };
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_BYTES) {
      console.warn(
        `[bulk-storage] payload ${(serialized.length / 1_048_576).toFixed(1)} MB exceeds 4 MB cap; results kept in memory only.`
      );
      return false;
    }
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    // Quota exceeded, privacy-mode storage refused, etc. Non-fatal.
    console.warn('[bulk-storage] save failed:', err);
    return false;
  }
}

/** Load the most-recent saved bulk run, or null when nothing is persisted. */
export function loadBulkState(): PersistedBulkState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedBulkState;
  } catch (err) {
    console.warn('[bulk-storage] load failed:', err);
    return null;
  }
}

/** Wipe persisted state. Used when the user clicks "Start over". */
export function clearBulkState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
