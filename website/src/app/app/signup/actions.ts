'use server';

/**
 * `/app/signup` server action — Task 5.3 (AC-AUTH-1, AC-AUTH-2).
 *
 * Contract:
 *   1. Server-side `email.trim()` per spec §7 / dev-grill B4. Supabase
 *      lowercases but does NOT trim, so a leading-space email would
 *      resolve to a different account on subsequent logins.
 *   2. Re-validate password length server-side (≥12 chars). HIBP / breach-
 *      list check is done by Supabase Auth itself (Task 9.2 enables the
 *      Pro-tier toggle; the rejection comes back as an error from
 *      signUp()).
 *   3. Call `supabase.auth.signUp`. The atomic org + admin-membership +
 *      audit-log triple is created by the `handle_new_user` trigger
 *      (Task 4.4) — this action does NOT touch those tables directly.
 *      Supabase Auth applies built-in obfuscation on duplicate-confirmed
 *      emails: a fake user object comes back, satisfying AC-AUTH-2's "no
 *      enumeration" property at the response-shape level.
 *   4. On any error or success, redirect to `/app/verify-email`. The
 *      auto-login session (locked OQ-AUTH-4) is restricted by the proxy
 *      until `email_confirmed_at` is set.
 *
 * Known spec/API gap (documented in handoff):
 *   Task 5.3 spec also asks for a custom alert email sent to an EXISTING
 *   account when someone tries to re-register their address (defence in
 *   depth on top of the response-shape obfuscation). The named API
 *   `supabase.auth.admin.sendEmail()` does NOT exist on the Supabase
 *   admin SDK — the closest primitives (`inviteUserByEmail`,
 *   `generateLink`) send the wrong template. The v1 path forward is the
 *   Resend custom-SMTP migration (OQ-AUTH-2, v1.1) — Resend can send the
 *   custom template directly, and the swap is configuration-only inside
 *   Supabase Auth per the spec. Until then, Supabase's built-in
 *   duplicate-signup obfuscation provides the AC-AUTH-2 response-shape
 *   guarantee; the additional alert email is a deferred follow-up.
 *   Flagged in the Phase 5 handoff and in the next-PM-standup brief.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildAuthRedirectUrl } from '@/lib/auth/redirect-url';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SignupActionState } from './state';

const MIN_PASSWORD_LENGTH = 12;

export async function signupAction(
  _prev: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  const rawConfirm = formData.get('confirm_password');

  if (
    typeof rawEmail !== 'string' ||
    typeof rawPassword !== 'string' ||
    typeof rawConfirm !== 'string'
  ) {
    return {
      error: 'Please complete every field.',
      email: '',
    };
  }

  const email = rawEmail.trim();
  // Do not trim the password — passphrases with leading/trailing spaces are
  // allowed per ASVS V2.1.4 + V2.1.5.
  const password = rawPassword;
  const confirm = rawConfirm;

  if (email.length === 0) {
    return { error: 'Please enter your email address.', email };
  }

  // Cheap shape check — Supabase Auth runs the authoritative email validator
  // server-side. This guard exists purely so the obvious cases ("foo", "@",
  // "no-at-sign") fail fast without a network round-trip.
  if (!email.includes('@') || email.length < 5) {
    return { error: 'Please enter a valid email address.', email };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      email,
    };
  }

  if (password !== confirm) {
    return { error: 'Passwords do not match.', email };
  }

  const supabase = await createSupabaseServerClient();
  const requestHeaders = await headers();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthRedirectUrl(requestHeaders.get('origin'), '/app/'),
    },
  });

  if (error) {
    // Surface only generic wording — never leak whether the email was rejected
    // for being a duplicate, for failing the HIBP breach list, for an SMTP
    // problem, etc. The HIBP rejection branch deserves a friendlier message
    // and will be split out when Task 9.2 lands the dashboard toggle and we
    // can match the error code precisely.
    return {
      error: 'We could not create your account. Please try again.',
      email,
    };
  }

  // On success — including the obfuscated duplicate-email branch — Supabase
  // sets an auto-login (unverified) session cookie. The next request to any
  // `/app/*` route will be intercepted by the proxy and routed to
  // `/app/verify-email` unless it's one of the three unverified-allow-listed
  // paths. We redirect there explicitly so the user lands on the resend UI
  // without a stop on `/app/` first.
  redirect('/app/verify-email');
}
