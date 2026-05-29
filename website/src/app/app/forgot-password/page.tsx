/**
 * `/app/forgot-password` — Task 6.2 (AC-AUTH-8).
 *
 * Enumeration-resistant password-reset request. The page is a Server
 * Component that renders the form shell; the form's server action (in
 * `./actions.ts`) calls `supabase.auth.resetPasswordForEmail` and ALWAYS
 * returns the same success message regardless of whether the email exists.
 *
 * Reachable by anyone (in the proxy's PUBLIC_AUTH_ROUTES allow-list). A
 * logged-in user landing here can still request a reset — useful if they
 * suspect their password is compromised.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset your password | APA LSL Platform',
  description: 'Request a link to reset your APA LSL Platform password.',
  robots: { index: false, follow: false },
};

// Opt out of static prerender to stay consistent with the other Phase 6 auth
// pages (verify-email, reset-password) and future-proof against drift: this
// page's server action calls Supabase, and if a future edit moves a Supabase
// call into the page body the CI build would silently regress. The cost is
// negligible — it's already a tiny shell that wraps a client form.
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send you a link."
      footer={
        <>
          Remembered it?{' '}
          <Link
            href="/app/login"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Log in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
