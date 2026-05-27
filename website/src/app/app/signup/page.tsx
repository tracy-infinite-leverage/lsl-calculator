/**
 * `/app/signup` — Task 5.3 (AC-AUTH-1, AC-AUTH-2).
 *
 * Server Component shell. The form module handles client-side state via
 * React 19 `useActionState`; the server action handles the Supabase Auth
 * call + redirect to `/app/verify-email`.
 *
 * Single-page signup — no separate org-naming step. The default
 * `<email-local-part>'s Organisation` is set by the `handle_new_user`
 * trigger (Task 4.4, locked OQ-AUTH-6).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Create an account | APA LSL Platform',
  description: 'Create your APA Long Service Leave Platform account.',
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      description="Email and password — we'll send a verification link."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/app/login"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
