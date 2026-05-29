/**
 * `/app/verify-email` — Task 6.1 (AC-AUTH-3a).
 *
 * Default landing for an unverified session. Shows the user's email and a
 * resend button. The proxy (`src/proxy.ts`) routes:
 *   - unverified session → here (default landing for /app/*)
 *   - verified session   → /app/ (this page should still render fine, but
 *                          a verified user has no reason to be here)
 *   - no session         → /app/login (handled by proxy before we get here)
 *
 * If the user IS verified by the time the page renders (e.g. they completed
 * the flow in another tab and refreshed), we surface a friendly link to
 * `/app/` instead of the resend UI — they don't need another email.
 *
 * Page is a Server Component; the resend form is the only client leaf.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ResendVerificationForm } from './resend-form';

export const metadata: Metadata = {
  title: 'Verify your email | APA LSL Platform',
  description: 'Verify your email address to finish creating your account.',
  robots: { index: false, follow: false },
};

// Opt out of static prerender. This page calls `createSupabaseServerClient`
// at render time, which reads `NEXT_PUBLIC_SUPABASE_*` env vars. Those vars
// are absent in the CI build environment (Vercel injects them at runtime,
// not at `next build` time on GitHub Actions), so a static prerender would
// throw "Supabase environment variables are missing". Forcing dynamic
// rendering defers the Supabase client construction to request time.
export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  const supabase = await createSupabaseServerClient();
  // Canonical user state — must be `getUser()` not `getClaims()` (the JWT
  // doesn't carry `email_confirmed_at`). DEV-AUTH-1.
  const { data, error } = await supabase.auth.getUser();

  // No session: the proxy normally catches this. But /app/verify-email IS
  // in the proxy's PUBLIC_AUTH_ROUTES allow-list — an unauthenticated user
  // can land here directly. Send them to login since the page has no
  // useful action without a session.
  if (error || !data.user) {
    redirect('/app/login');
  }

  const user = data.user;
  const isVerified = user.email_confirmed_at != null;

  if (isVerified) {
    return (
      <AuthLayout
        title="You're all set"
        description="Your email is already verified."
        footer={
          <form action="/app/logout" method="post" className="inline">
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Log out
            </button>
          </form>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            You can continue to the platform.
          </p>
          <Button asChild className="w-full">
            <Link href="/app/">Continue</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      description="Almost there."
      footer={
        <form action="/app/logout" method="post" className="inline">
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Log out
          </button>
        </form>
      }
    >
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            We sent a link to{' '}
            <span className="font-medium text-foreground">{user.email}</span>.
            Click it to finish signing up. The link expires in 24 hours.
          </AlertDescription>
        </Alert>

        <ResendVerificationForm />

        <p className="text-xs text-muted-foreground text-center">
          Wrong email? Log out and start again.
        </p>
      </div>
    </AuthLayout>
  );
}
