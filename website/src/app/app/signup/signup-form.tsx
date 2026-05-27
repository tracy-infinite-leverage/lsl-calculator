'use client';

/**
 * Client component for the `/app/signup` form — mirrors the login form's
 * `useActionState` + `useFormStatus` pattern (spec §7.2 row "Submitting":
 * CTA disabled + spinner visible).
 *
 * `minLength={12}` on the password field gives a client-side hint; the
 * server action re-validates (defence in depth — never trust the client).
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupAction, SIGNUP_INITIAL_STATE } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, SIGNUP_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 12 characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}
