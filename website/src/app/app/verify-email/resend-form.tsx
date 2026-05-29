'use client';

/**
 * Client component for the `/app/verify-email` resend form. Mirrors the
 * login/signup form's React 19 `useActionState` + `useFormStatus` pattern
 * (spec §7.2 "Submitting" row).
 *
 * Kept separate from the page module so the page itself can remain a
 * Server Component (per the project's "Server Components by default"
 * stack rule).
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resendVerificationAction } from './actions';
import { RESEND_INITIAL_STATE } from './state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Sending…' : 'Resend verification email'}
    </Button>
  );
}

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(
    resendVerificationAction,
    RESEND_INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.status ? (
        <Alert
          variant={state.status.kind === 'error' ? 'destructive' : 'default'}
        >
          <AlertDescription>{state.status.message}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton />
    </form>
  );
}
