/**
 * Helpers for spawning + cleaning up test users in Playwright E2E suites.
 *
 * Strategy (per the DevOps scope for Task 5.8):
 *   - Each E2E run generates a unique, namespaced email so concurrent runs
 *     (and re-runs of the same suite on the same Supabase project) never
 *     collide.
 *   - The domain is intentionally a `.test.lslcalculator.com.au` namespace
 *     so a scheduled cleanup job can purge stale rows by domain match
 *     without risking real users.
 *   - A `cleanupUser` helper deletes the auth.users row at end-of-test via
 *     the admin SDK. Failure to clean up is logged but not fatal — the
 *     periodic purge job is the real safety net.
 */

import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Domain namespace for E2E test users. Any user with this suffix should be
 * considered ephemeral and safe to delete.
 */
export const E2E_EMAIL_DOMAIN = 'playwright.test.lslcalculator.com.au';

/**
 * Generate a unique email for a single test run. Format:
 *   `e2e-<unix-ms>-<8-hex>@<E2E_EMAIL_DOMAIN>`
 *
 * Time-prefix + random suffix gives:
 *   - Lexicographic sort by creation time (useful in audit-log scans)
 *   - Practical collision resistance even under parallel workers
 */
export function uniqueE2eEmail(): string {
  const ts = Date.now();
  const hex = randomBytes(4).toString('hex');
  return `e2e-${ts}-${hex}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * Build a service-role admin client for cleanup. Returns `null` if env vars
 * aren't present — caller should skip cleanup gracefully.
 */
function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Delete an auth.users row by email. Best-effort — logs and continues on any
 * failure. Cascade deletes the `org_members` row; `organisations` row is left
 * for the scheduled purge job to handle (its `delete_scheduled_at` policy
 * lives in Phase 7 land).
 */
export async function cleanupUserByEmail(email: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      `[e2e cleanup] no Supabase admin env — skipping cleanup of ${email}`
    );
    return;
  }

  try {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) {
      console.warn(`[e2e cleanup] listUsers failed: ${error.message}`);
      return;
    }
    const lowered = email.toLowerCase();
    const user = data.users.find(
      (u) => (u.email ?? '').toLowerCase() === lowered
    );
    if (!user) {
      // Already gone — fine.
      return;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.warn(
        `[e2e cleanup] deleteUser failed for ${email}: ${deleteError.message}`
      );
    }
  } catch (err) {
    console.warn(
      `[e2e cleanup] threw cleaning up ${email}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Convenience: a strong-enough password that satisfies the ≥12-char rule and
 * is unlikely to appear in HIBP's breach list (random hex suffix).
 */
export function e2eTestPassword(): string {
  return `Apa-E2e-${randomBytes(6).toString('hex')}!`;
}
