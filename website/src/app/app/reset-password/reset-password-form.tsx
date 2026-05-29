'use client';

/**
 * Client component for `/app/reset-password`. Mirrors the signup form's
 * password-pair layout (new + confirm) since the validation contract is
 * identical: ≥12 chars, must match.
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordAction } from './actions';
import { RESET_INITIAL_STATE } from './state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Saving…' : 'Set new password'}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    RESET_INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
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
        <Label htmlFor="confirm_password">Confirm new password</Label>
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
