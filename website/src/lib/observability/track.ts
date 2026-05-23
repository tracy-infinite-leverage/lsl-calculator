/**
 * Custom event tracking per tasks.md §5.4.
 *
 * Thin wrapper around @vercel/analytics' `track()` with a strict event-name
 * union and a typed-payload-per-event approach. Payloads are deliberately
 * coarse — counts and enums only, never wages / names / dates. Vercel
 * Analytics also rejects payloads > 2KB so we stay small by construction.
 *
 * If you find yourself wanting to pass an employee_id or amount here, STOP
 * and reconsider. PII never leaves the browser for analytics purposes.
 */

import { track as vercelTrack } from '@vercel/analytics';

export type AnalyticsEvent =
  // Single-mode funnel
  | { event: 'single_calculate_clicked' }
  | { event: 'single_calculate_succeeded'; category: 'A' | 'B' | 'C' }
  | { event: 'single_calculate_blocked' }
  | { event: 'single_calculate_failed'; error_code: string }
  | { event: 'single_pdf_uploaded' }
  | { event: 'single_pdf_confirmed' }
  | { event: 'single_pdf_failed'; error_code: string }
  | { event: 'single_csv_uploaded' }
  | { event: 'single_pdf_exported' }
  // Bulk-mode funnel
  | { event: 'bulk_csv_uploaded'; employee_count: number }
  | { event: 'bulk_calculation_started'; employee_count: number }
  | {
      event: 'bulk_calculation_completed';
      computed: number;
      blocked: number;
      failed: number;
      elapsed_ms_bucket: '<5s' | '<30s' | '<60s' | '>=60s';
    }
  | { event: 'bulk_unblock_resolved'; state: string }
  | { event: 'bulk_csv_exported'; row_count: number }
  | { event: 'bulk_pdf_exported'; employee_count: number };

/**
 * Fire a typed analytics event. No-ops on the server.
 *
 * Vercel's runtime accepts string | number | boolean | null payload values;
 * we cast through `as Record<string, ...>` since our typed events are
 * compatible.
 */
export function track(payload: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const { event, ...rest } = payload;
  try {
    vercelTrack(event, rest as Record<string, string | number | boolean | null>);
  } catch (err) {
    // Analytics failures must never break the app. Swallow + console.warn.
    // eslint-disable-next-line no-console
    console.warn('[track] analytics call failed', err);
  }
}

/** Bucket a duration into one of the four enum strings — keeps payloads coarse. */
export function bucketElapsed(ms: number): '<5s' | '<30s' | '<60s' | '>=60s' {
  if (ms < 5_000) return '<5s';
  if (ms < 30_000) return '<30s';
  if (ms < 60_000) return '<60s';
  return '>=60s';
}
