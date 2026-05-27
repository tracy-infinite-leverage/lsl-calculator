'use server';

/**
 * `/app/login` server action — Task 5.4 (AC-AUTH-4, AC-AUTH-5).
 *
 * Contract:
 *   1. Server-side trim the email before passing to Supabase Auth.
 *      Supabase lowercases emails but does NOT trim whitespace — without
 *      this, `" user@example.com "` and `"user@example.com"` resolve to
 *      different accounts (dev-grill amendment B4, Decisions Log
 *      2026-05-26).
 *   2. Validate inputs minimally — empty fields return a generic error.
 *      We deliberately do NOT distinguish between "missing email" and
 *      "missing password" beyond surfacing the failure; the form
 *      enforces `required` client-side.
 *   3. Call `supabase.auth.signInWithPassword`.
 *   4. On any auth error (unknown email, wrong password, locked-out, …)
 *      return the SAME generic message: "Email or password incorrect."
 *      This satisfies AC-AUTH-5 — no enumeration. The proxy handles the
 *      verified/unverified post-login redirect (AC-AUTH-4).
 *   5. On success: `redirect('/app/')`. The proxy sees the session cookie
 *      on the next request and either passes through (verified) or
 *      redirects to `/app/verify-email` (unverified).
 *
 * What this action does NOT do:
 *   - Surface a rate-limit-specific message yet. Task 9.4 + AC-AUTH-6
 *     adds the "Too many attempts. Try again in N minutes." path; for the
 *     Phase 5 vertical we collapse all auth failures into one message.
 *   - Implement the cancel-deletion-on-login flow (Task 7.5). That lands
 *     with the account-deletion grace work.
 */

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LoginActionState = {
  /** Inline error rendered above the form; `null` while in the empty/success states. */
  error: string | null;
  /** Echoed back so the email field doesn't clear on a failed submission. */
  email: string;
};

/**
 * Initial state for `useActionState` — the empty branch of the form.
 */
export const LOGIN_INITIAL_STATE: LoginActionState = {
  error: null,
  email: '',
};

/**
 * Generic error wording — identical for unknown-email and wrong-password
 * branches. AC-AUTH-5 / ASVS V2.1.6. Do NOT differentiate.
 */
const GENERIC_AUTH_ERROR = 'Email or password incorrect.';

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  // Treat missing inputs as the same auth failure. The form already enforces
  // `required`; this is the defense-in-depth server-side branch.
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
    return { error: GENERIC_AUTH_ERROR, email: '' };
  }

  // Trim the email per spec — Supabase lowercases but does NOT trim. Keep
  // the password byte-perfect: ASVS V2.1.4 + V2.1.5 allow any Unicode incl.
  // leading/trailing spaces in passphrases.
  const email = rawEmail.trim();
  const password = rawPassword;

  if (email.length === 0 || password.length === 0) {
    return { error: GENERIC_AUTH_ERROR, email };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Single error path — we don't branch on `error.code` because doing so
    // re-introduces the enumeration vector AC-AUTH-5 forbids. Logging the
    // specific error to server logs would be useful in production, but
    // wiring observability is out of scope for the Phase 5 vertical.
    return { error: GENERIC_AUTH_ERROR, email };
  }

  // Successful sign-in. Tokens are now in the cookie store via the SSR
  // server client; the proxy will route on the next request:
  //   verified   → /app/ (this redirect target) renders
  //   unverified → /app/verify-email (proxy enforces, this action no-ops on it)
  redirect('/app/');
}
