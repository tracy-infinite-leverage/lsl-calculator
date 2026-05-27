'use client';

/**
 * Client component for the `/app/login` form — handles the React 19
 * `useActionState` wiring + `useFormStatus` for the submitting state
 * (spec §7.2 row "Submitting": CTA disabled + spinner visible).
 *
 * Kept separate from the page module so the page itself can stay a
 * Server Component (per the project's "Server Components by default"
 * stack rule in CLAUDE.md) and only this leaf goes client-side for
 * the form-status hook.
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, LOGIN_INITIAL_STATE } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? 'Logging in…' : 'Log in'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, LOGIN_INITIAL_STATE);

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
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/app/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}
