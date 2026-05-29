'use client';

/**
 * Client component for `/app/forgot-password`. Mirrors the login/signup
 * form pattern (React 19 `useActionState` + `useFormStatus`).
 *
 * Note: this form NEVER differentiates between registered and unregistered
 * emails in the UI. The server action returns the same string for both
 * branches (AC-AUTH-8 / spec §7.3 enumeration mitigation), and the message
 * surface uses a neutral (non-destructive) Alert variant so the colour
 * doesn't betray which branch fired.
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordAction, FORGOT_INITIAL_STATE } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    FORGOT_INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          placeholder="you@example.com"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
