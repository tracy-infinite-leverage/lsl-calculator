'use server';

/**
 * `/app/reset-password` server action — Task 6.3 (AC-AUTH-9, AC-AUTH-10).
 *
 * Flow:
 *   1. User clicks the link in the reset-password email. Supabase Auth's
 *      hosted handler validates the token and bounces them to the
 *      `redirectTo` URL we set in `/app/forgot-password/actions.ts`
 *      (= `${origin}/app/reset-password?code=…`).
 *   2. The PAGE (`./page.tsx`) calls `supabase.auth.exchangeCodeForSession`
 *      using the `code` param — this sets an authenticated session cookie
 *      for the user. If the code is expired (>60min) or already used,
 *      `exchangeCodeForSession` errors and the page surfaces a clear "link
 *      expired / already used" message with a CTA back to /app/forgot-password.
 *   3. THIS ACTION runs after the page has a session. It:
 *        a. Re-validates the new password (≥12 chars, matches confirm).
 *        b. Calls `supabase.auth.updateUser({ password })`. Supabase
 *           applies the HIBP breach-list check internally (Task 9.2 toggle).
 *        c. Calls `supabase.auth.signOut({ scope: 'others' })` to invalidate
 *           every OTHER session for the user (the current session stays valid
 *           but the spec says we redirect to /app/login anyway — AC-AUTH-9).
 *        d. Calls `supabase.auth.signOut()` (default scope `'local'`) to clear
 *           the current session too, then `redirect('/app/login')`.
 *        e. Writes a `password_reset_complete` audit row.
 *
 * The single-use property of the reset token is enforced by Supabase Auth —
 * `exchangeCodeForSession` invalidates the token on first successful use.
 * The expiry (60 min) is configured in the Supabase dashboard's Auth →
 * Templates section (Task 6.4) and is the default Supabase value.
 *
 * Why two `signOut` calls and not just `{ scope: 'global' }`:
 *   - `{ scope: 'global' }` would invalidate the current session too BEFORE
 *     the redirect response writes its cookie-clearing headers — sometimes
 *     the user ends up holding a stale cookie that fails the next refresh
 *     loudly. Splitting into "others" (invalidate everywhere else) + a
 *     standard local sign-out gives deterministic cookie state.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createSupabaseAdminClient,
  readClientFingerprint,
} from '@/lib/supabase/admin';

export type ResetPasswordState = {
  /** Inline error rendered above the form; `null` on first render. */
  error: string | null;
};

export const RESET_INITIAL_STATE: ResetPasswordState = {
  error: null,
};

const MIN_PASSWORD_LENGTH = 12;
const GENERIC_ERROR =
  'We could not reset your password. The link may have expired — please request a new one.';

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const rawPassword = formData.get('password');
  const rawConfirm = formData.get('confirm_password');

  if (typeof rawPassword !== 'string' || typeof rawConfirm !== 'string') {
    return { error: 'Please complete every field.' };
  }

  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (rawPassword !== rawConfirm) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createSupabaseServerClient();

  // The page has already exchanged the code for a session; the user must be
  // authenticated by the time we reach this action. If not, the link was
  // expired/used/invalid before we got here — surface the generic error.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: GENERIC_ERROR };
  }
  const userId = userData.user.id;

  // Update the password. Supabase Auth runs HIBP + length validation
  // server-side and returns a typed error on rejection.
  const { error: updateError } = await supabase.auth.updateUser({
    password: rawPassword,
  });
  if (updateError) {
    // The most common rejections are:
    //   - 'weak_password' / breach-list match (Pro-tier HIBP toggle)
    //   - 'same_password' (Supabase refuses to set the same password)
    //   - generic auth errors
    // Per spec §7.2, surface a specific user-friendly message where we
    // confidently can; otherwise the generic error.
    const code = (updateError as { code?: string }).code ?? '';
    if (code === 'weak_password' || /breached|compromised|weak/i.test(updateError.message)) {
      return {
        error:
          'This password is on a known breach list. Please pick a different one.',
      };
    }
    if (code === 'same_password' || /same password/i.test(updateError.message)) {
      return { error: 'Please pick a password different from your previous one.' };
    }
    return { error: GENERIC_ERROR };
  }

  // Invalidate all OTHER sessions (AC-AUTH-9). On success the current
  // session is still valid; we clear it explicitly below before redirecting
  // to login so the user re-authenticates with the new password.
  try {
    await supabase.auth.signOut({ scope: 'others' });
  } catch {
    // Non-fatal — worst case, an old session lingers another hour until its
    // access token expires.
  }

  // Audit the completion. Fire-and-forget per the same pattern as logout.
  const admin = createSupabaseAdminClient();
  if (admin) {
    const fingerprint = readClientFingerprint(await headers());
    const { error: auditError } = await admin
      .from('auth_audit_log')
      .insert({
        user_id: userId,
        event_type: 'password_reset_complete',
        ip: fingerprint.ip,
        user_agent: fingerprint.userAgent,
        metadata: null,
      });
    if (auditError) {
      console.warn(
        '[reset-password] audit insert failed:',
        auditError.message
      );
    }
  }

  // Sign out the current session too — spec wants the user to re-log-in
  // with the new password (AC-AUTH-9).
  try {
    await supabase.auth.signOut();
  } catch {
    // intentional no-op
  }

  redirect('/app/login?reset=success');
}
