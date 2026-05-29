/**
 * `/app/login` — Task 5.4 (AC-AUTH-4, AC-AUTH-5).
 *
 * Server Component shell wrapping the client `<LoginForm>`. The page itself
 * does not call Supabase or read cookies — the form's server action does the
 * sign-in, and the proxy (src/proxy.ts) routes verified vs. unverified
 * sessions to `/app/` vs. `/app/verify-email` on the next request.
 *
 * No "Remember me" checkbox — locked OQ-AUTH-3 (always-on 30-day refresh).
 * Generic auth-failure wording lives in the action (AC-AUTH-5).
 *
 * Service-unavailable banner: the proxy redirects to
 * `/app/login?error=service_unavailable` when Supabase Auth throws (B3).
 * We honour the `error` query param here so the user sees a clear message
 * instead of a silent retry loop.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in | APA LSL Platform',
  description: 'Log in to the APA Long Service Leave Platform.',
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  // Next.js 16 async search params.
  searchParams: Promise<{ error?: string; reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, reset } = await searchParams;
  const showServiceUnavailable = error === 'service_unavailable';
  const showResetSuccess = reset === 'success';

  return (
    <AuthLayout
      title="Log in"
      description="Welcome back."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href="/app/signup"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Create one
          </Link>
        </>
      }
    >
      {showServiceUnavailable ? (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t reach the authentication service. Please try again
              in a moment.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {showResetSuccess ? (
        <div className="mb-4">
          <Alert>
            <AlertDescription>
              Your password has been updated. Log in with your new password to
              continue.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <LoginForm />
    </AuthLayout>
  );
}
