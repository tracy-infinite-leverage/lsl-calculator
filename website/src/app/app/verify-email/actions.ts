'use server';

/**
 * `/app/verify-email` server action — Task 6.1 (AC-AUTH-3a resend behaviour).
 *
 * Contract per spec §7.5:
 *   1. Caller must have a session (the proxy already restricts this route
 *      to authenticated users — unauthenticated requests redirect to
 *      /app/login). If the action is somehow hit without a session, return
 *      a generic error and no-op.
 *   2. If the user is already verified, no-op with a success-style
 *      message — they don't need another email.
 *   3. Check the 5-per-24h application-side cap via auth_audit_log.
 *   4. Call `supabase.auth.resend({ type: 'signup', email })`. Supabase
 *      enforces its own 1-per-60s cooldown. We translate its rate-limit
 *      error into the same UI message shape.
 *   5. On success, record a `verification_resend` audit row so the next
 *      check sees the right count.
 *
 * What this action does NOT do:
 *   - Surface email enumeration (the caller already owns the session, so
 *     no leak risk — but we still wrap any unexpected error in a generic
 *     message just in case).
 *   - Pre-compute the precise 1-per-60s remainder. If Supabase rejects
 *     for cooldown we surface "in 60 seconds" — close enough for UX.
 */

import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createSupabaseAdminClient,
  readClientFingerprint,
} from '@/lib/supabase/admin';
import {
  checkVerificationResendQuota,
  formatRetryAfter,
  recordVerificationResend,
} from '@/lib/auth/rate-limit';
import type { ResendVerificationState } from './state';

const GENERIC_ERROR =
  'We could not send the email right now. Please try again in a moment.';

const SUCCESS_MESSAGE =
  'We sent another verification email. Check your inbox (and spam folder).';

const ALREADY_VERIFIED_MESSAGE =
  'Your email is already verified. You can continue using the platform.';

export async function resendVerificationAction(
  _prev: ResendVerificationState,
  _formData: FormData
): Promise<ResendVerificationState> {
  const supabase = await createSupabaseServerClient();

  // Source of truth for the unverified gate — must be `getUser()` not
  // `getClaims()` (the JWT does not carry `email_confirmed_at`).
  // See DEV-AUTH-1 in auth-impl-plan.md.
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { status: { kind: 'error', message: GENERIC_ERROR } };
  }

  const user = userData.user;
  if (user.email_confirmed_at != null) {
    return { status: { kind: 'success', message: ALREADY_VERIFIED_MESSAGE } };
  }

  if (!user.email) {
    // Defensive — should never happen for a password-auth account.
    return { status: { kind: 'error', message: GENERIC_ERROR } };
  }

  const admin = createSupabaseAdminClient();

  // 1. Application-side 5-per-24h cap. If the service-role key is missing
  //    we skip this check (the helper returns null) and fall through to the
  //    Supabase 1-per-60s cap, which is still in force.
  if (admin) {
    const quota = await checkVerificationResendQuota(admin, user.id);
    if (!quota.allowed) {
      const retry = quota.retryAfterSeconds
        ? formatRetryAfter(quota.retryAfterSeconds)
        : 'later';
      return {
        status: {
          kind: 'error',
          message: `You've reached the daily limit. You can request another verification email ${retry}.`,
        },
      };
    }
  }

  // 2. Hand off to Supabase Auth's resend endpoint.
  const { error: resendError } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
  });

  if (resendError) {
    // Supabase returns code 'over_email_send_rate_limit' (HTTP 429) for the
    // built-in cooldown. Map that to the same UI shape so the user sees a
    // friendly wait message instead of a generic failure.
    // Property names follow `@supabase/supabase-js` AuthError contract.
    const code = (resendError as { code?: string }).code ?? '';
    const status = (resendError as { status?: number }).status;
    if (status === 429 || code === 'over_email_send_rate_limit') {
      return {
        status: {
          kind: 'error',
          message: `You can request another verification email ${formatRetryAfter(60)}.`,
        },
      };
    }
    return { status: { kind: 'error', message: GENERIC_ERROR } };
  }

  // 3. Record the resend so the next check sees the bumped count. Fire-and-
  //    forget — failure here doesn't roll back the user-visible success.
  if (admin) {
    const fingerprint = readClientFingerprint(await headers());
    await recordVerificationResend(admin, user.id, fingerprint);
  }

  return { status: { kind: 'success', message: SUCCESS_MESSAGE } };
}
