/**
 * `/app/reset-password` — Task 6.3 (AC-AUTH-9, AC-AUTH-10).
 *
 * Two distinct render branches:
 *
 *   (A) FRESH ARRIVAL FROM EMAIL — `?code=…` is present in the URL.
 *       We call `supabase.auth.exchangeCodeForSession(code)` server-side.
 *       Success → the SSR client writes a session cookie and we render
 *       the password form. Failure (expired / used / invalid code) → we
 *       render an error card with a link back to `/app/forgot-password`.
 *
 *   (B) NO `?code=…` — the user navigated here directly or refreshed
 *       after a successful exchange (cookies still alive). If they have
 *       a valid session, render the form. If they don't, send them to
 *       /app/forgot-password to start over.
 *
 * Why exchange happens in the page (Server Component) and NOT a route
 * handler: the page is the first thing the link points at, and a Server
 * Component can write cookies via `createSupabaseServerClient` exactly
 * the same way a server action can. Splitting into a separate route just
 * to do the exchange would add an extra hop and a redirect.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Set a new password | APA LSL Platform',
  description: 'Choose a new password for your APA LSL Platform account.',
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  // Next.js 16 async search params.
  searchParams: Promise<{ code?: string; error?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { code, error: queryError } = await searchParams;
  const supabase = await createSupabaseServerClient();

  // ────────────────────────────────────────────────────────────────────────
  // Branch (A): code present — exchange it for a session.
  //
  // We exchange even if the user already has a session (the new code wins).
  // If the exchange fails — expired, already used, or invalid — we render
  // the error card. AC-AUTH-10 requires "a clear error and a link to start
  // the flow again" for both expired and reused tokens.
  // ────────────────────────────────────────────────────────────────────────
  let exchangeError: string | null = queryError ?? null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Supabase typically returns `otp_expired` / `invalid_request` here.
      // We collapse both into a single user-facing message per AC-AUTH-10.
      exchangeError = error.message ?? 'expired_or_invalid';
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // After (a possible) exchange, check the session state. If there's no
  // session AND no code, the user reached this page by mistake — send
  // them back to forgot-password.
  // ────────────────────────────────────────────────────────────────────────
  const { data: userData } = await supabase.auth.getUser();
  const hasSession = !!userData.user;

  if (exchangeError || (!hasSession && !code)) {
    return (
      <AuthLayout
        title="Reset link expired"
        description="This password-reset link can no longer be used."
      >
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              The link has expired or has already been used. Request a new
              one to continue.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/app/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password you don't use anywhere else."
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
