/**
 * Application-level rate-limit helper for the verification-email resend flow
 * (Task 6.1, AC-AUTH-3a) and a small set of other auth-side actions.
 *
 * Why this exists:
 *   Supabase Auth enforces a short per-user resend cooldown (configurable,
 *   default 60s). That covers the 1-per-60s requirement from spec §7.5
 *   well — but Supabase does NOT expose a 5-per-24h cap on the same channel.
 *   The 5-per-24h cap is a deliberate spec property (prevents using the
 *   platform as an email-bomb relay) so we layer an application-level
 *   counter on top.
 *
 * Storage:
 *   We reuse `public.auth_audit_log` (Task 4.3) — every successful resend
 *   writes one `event_type='verification_resend'` row, and the rate-limit
 *   check is a `count(*) WHERE user_id = $1 AND event_type = 'verification_resend'
 *   AND created_at > now() - interval '24 hours'` lookup.
 *
 *   No new table, no new migration. The audit-log table already has the
 *   right indexes (`user_id_idx`, `created_at_idx`) for this query shape.
 *
 * Service-role required:
 *   Reads + writes to `auth_audit_log` need `service_role` because the
 *   table has zero authenticated/anon policies (spec §9.4). Callers MUST
 *   supply a service-role client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Maximum number of verification-resend events per user per 24h rolling
 * window — spec §7.5 ("5 sends per 24 hours per user").
 *
 * The 1-per-60s window is enforced by Supabase Auth itself; we do not
 * duplicate it here.
 */
export const VERIFICATION_RESEND_DAILY_CAP = 5;

/** Audit-log event type recorded on every successful resend attempt. */
export const VERIFICATION_RESEND_EVENT = 'verification_resend';

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | {
      allowed: false;
      /** Why the limit was hit — surface a clear message. */
      reason: 'daily_cap_exceeded' | 'cooldown_active';
      /**
       * Approximate seconds the caller should wait before retrying. NULL when
       * we don't know (e.g. Supabase didn't tell us the cooldown remainder).
       */
      retryAfterSeconds: number | null;
    };

/**
 * Check whether a verification-resend is allowed for the given user. Looks
 * back 24 hours and counts the `verification_resend` audit rows.
 *
 * @param admin  Service-role Supabase client (RLS bypassed).
 * @param userId The authenticated user requesting a resend.
 * @returns      A decision the caller can branch on; never throws — on a
 *               read failure we fail OPEN (allow the resend) and log to
 *               stderr. Failing closed here would let a transient DB error
 *               soft-lock a user out of finishing signup.
 */
export async function checkVerificationResendQuota(
  admin: SupabaseClient,
  userId: string
): Promise<RateLimitDecision> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from('auth_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', VERIFICATION_RESEND_EVENT)
    .gte('created_at', twentyFourHoursAgo);

  if (error) {
    // Fail OPEN (allow). A read failure should not strand a user mid-signup.
    // The Supabase 1-per-60s cap is still in force, so the worst case is
    // the user gets ONE extra email beyond what the daily cap would allow.
    console.warn(
      '[rate-limit] verification-resend quota check failed:',
      error.message
    );
    return { allowed: true, remaining: VERIFICATION_RESEND_DAILY_CAP };
  }

  const used = count ?? 0;
  if (used >= VERIFICATION_RESEND_DAILY_CAP) {
    return {
      allowed: false,
      reason: 'daily_cap_exceeded',
      // 24h is the worst-case wait. We could compute the earliest expiry
      // by finding the oldest row in the window, but the UI message
      // ("You can request another verification email in N hours") only
      // needs hour-granularity which 24h covers.
      retryAfterSeconds: 24 * 60 * 60,
    };
  }

  return { allowed: true, remaining: VERIFICATION_RESEND_DAILY_CAP - used };
}

/**
 * Record a successful verification-resend in the audit log. Fire-and-forget
 * semantics — if the insert fails we log to stderr and the caller continues.
 * The audit row is the counter for `checkVerificationResendQuota`, so an
 * insert failure here effectively "refunds" the user one resend. That's a
 * deliberate trade-off vs. failing the user-visible resend.
 */
export async function recordVerificationResend(
  admin: SupabaseClient,
  userId: string,
  request: { ip: string | null; userAgent: string | null }
): Promise<void> {
  const { error } = await admin
    .from('auth_audit_log')
    .insert({
      user_id: userId,
      event_type: VERIFICATION_RESEND_EVENT,
      ip: request.ip,
      user_agent: request.userAgent,
      metadata: null,
    });

  if (error) {
    console.warn(
      '[rate-limit] verification-resend audit insert failed:',
      error.message
    );
  }
}

/**
 * Pretty-print a "retry in N units" string for a UI Alert. Keeps the wording
 * consistent across resend, login lockout, etc.
 *
 * @example
 *   formatRetryAfter(45)     === 'in 45 seconds'
 *   formatRetryAfter(120)    === 'in 2 minutes'
 *   formatRetryAfter(3600)   === 'in 1 hour'
 *   formatRetryAfter(86400)  === 'in 24 hours'
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `in ${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  if (seconds < 60 * 60) {
    const minutes = Math.ceil(seconds / 60);
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.ceil(seconds / 3600);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}
