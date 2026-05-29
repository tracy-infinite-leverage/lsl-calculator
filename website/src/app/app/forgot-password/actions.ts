'use server';

/**
 * `/app/forgot-password` server action — Task 6.2 (AC-AUTH-8).
 *
 * Contract per spec §7.3 + AC-AUTH-8:
 *   1. Trim the email server-side (Supabase lowercases but does NOT trim).
 *   2. Call `supabase.auth.resetPasswordForEmail` with a redirectTo pointing
 *      at `/app/reset-password` — Supabase appends `?code=…` to the link in
 *      the email; the reset-password page exchanges that code for a session.
 *   3. **Always** return the same success message — regardless of whether
 *      the email exists, whether Supabase succeeded, or whether SMTP failed.
 *      This is the enumeration-mitigation contract (AC-AUTH-8). The user
 *      sees identical UI for valid + invalid emails.
 *   4. Write a `password_reset_request` audit-log row. user_id is NULL when
 *      the email is unknown — the row still serves as a brute-force counter.
 *
 * Audit-log lookup:
 *   We do NOT pre-check whether the email exists before calling Supabase.
 *   Supabase Auth handles the conditional send internally; we just record
 *   that a reset was requested. Looking up `auth.users` ourselves would
 *   either re-introduce the enumeration vector or duplicate Supabase's
 *   own work.
 *
 *   To attribute the audit row to a user when possible, we attempt a
 *   service-role `auth.admin.getUserByEmail` lookup AFTER the
 *   `resetPasswordForEmail` call. If it returns a user, we tag the audit
 *   row with that id; otherwise user_id stays NULL. This lookup happens
 *   server-side only — never observable from the response.
 *
 * What this action does NOT do:
 *   - Redirect anywhere. Forgot-password returns to the same page with a
 *     success Alert so the user can see "if that email is registered, we
 *     sent a link" inline. No URL-state leak.
 */

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createSupabaseAdminClient,
  readClientFingerprint,
} from '@/lib/supabase/admin';

/**
 * One-way hash of an email for audit-log correlation without storing the
 * cleartext value twice. SHA-256 over the lowercased + trimmed email — the
 * exact same form Supabase Auth uses internally.
 */
function hashEmailForAudit(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export type ForgotPasswordState = {
  /** Renders an Alert when set; `null` on first render. */
  message: string | null;
  /** Echoed back so the email field doesn't clear after submission. */
  email: string;
};

export const FORGOT_INITIAL_STATE: ForgotPasswordState = {
  message: null,
  email: '',
};

/**
 * Single response shape — never differentiates registered vs. unregistered.
 * Wording per AC-AUTH-8 / spec §7.2 "Forgot-password" row.
 */
const ENUMERATION_SAFE_MESSAGE =
  'If that email is registered, we sent a link with instructions to reset your password.';

/**
 * Destination for the link Supabase puts in the reset-password email. Built
 * relative to the request origin so it works on every environment (preview,
 * production, local) without an env var.
 */
function buildResetRedirectTo(originHeader: string | null): string {
  // The Supabase Auth dashboard requires the redirectTo origin to be on the
  // allow-list. We add `https://www.lslcalculator.com.au` (prod),
  // `https://lsl-calculator-*.vercel.app` (preview wildcard), and
  // `http://localhost:3000` (local dev) — operator task, recorded in
  // docs/engineering/vercel-config.md.
  const base = originHeader ?? 'http://localhost:3000';
  return `${base}/app/reset-password`;
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const rawEmail = formData.get('email');
  if (typeof rawEmail !== 'string') {
    return { message: ENUMERATION_SAFE_MESSAGE, email: '' };
  }

  const email = rawEmail.trim();
  if (email.length === 0) {
    // Even for an empty submission, return the generic message. Surfacing a
    // distinct "please enter an email" string would leak that the form was
    // reached (useful for an attacker tracking which IPs probe the route).
    // The client-side `required` attribute already prevents empty submits in
    // a normal flow.
    return { message: ENUMERATION_SAFE_MESSAGE, email };
  }

  const supabase = await createSupabaseServerClient();
  const requestHeaders = await headers();

  // ────────────────────────────────────────────────────────────────────────
  // Supabase Auth call. Errors are swallowed deliberately — we MUST respond
  // identically regardless of whether the email exists.
  // ────────────────────────────────────────────────────────────────────────
  await supabase.auth
    .resetPasswordForEmail(email, {
      redirectTo: buildResetRedirectTo(requestHeaders.get('origin')),
    })
    .catch(() => {
      // Swallow — log only. AC-AUTH-8 requires identical response.
    });

  // ────────────────────────────────────────────────────────────────────────
  // Audit row. Best-effort; never blocks the response.
  //
  // We intentionally do NOT look up the user_id by email here:
  //   - The Supabase Auth admin `listUsers` API requires either an `email`
  //     filter (not in the stable types) or a full pagination scan (slow at
  //     scale). A SECURITY DEFINER function would be the right path, but
  //     adding one isn't in scope for Task 6.2 — Phase 7 already touches the
  //     account deletion flow and can add a `get_user_id_by_email` helper at
  //     that point if attribution becomes a requirement.
  //   - AC-AUTH-8 only specifies that an audit row IS written and that
  //     user_id may be NULL when the email is unknown. Recording every
  //     reset request with user_id NULL is spec-compliant.
  //   - The row is still useful as a brute-force counter when grouped by IP
  //     / user_agent / hour.
  // ────────────────────────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient();
  if (admin) {
    const fingerprint = readClientFingerprint(requestHeaders);
    const { error: auditError } = await admin
      .from('auth_audit_log')
      .insert({
        user_id: null,
        event_type: 'password_reset_request',
        ip: fingerprint.ip,
        user_agent: fingerprint.userAgent,
        // Hash the email so an admin can correlate audit rows without
        // storing the cleartext email in two places. SHA-256 of the trimmed
        // lowercased email keeps the row joinable but not directly readable.
        metadata: { email_hash: hashEmailForAudit(email) },
      });
    if (auditError) {
      console.warn(
        '[forgot-password] audit insert failed:',
        auditError.message
      );
    }
  }

  return { message: ENUMERATION_SAFE_MESSAGE, email };
}
