/**
 * Form-state types and initial values for `/app/verify-email`.
 *
 * Separate from `actions.ts` because `'use server'` files may only
 * export async functions. See
 * https://nextjs.org/docs/messages/invalid-use-server-value.
 */

export type ResendVerificationState = {
  /** Inline status rendered above the resend button; `null` on first render. */
  status:
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null;
};

export const RESEND_INITIAL_STATE: ResendVerificationState = {
  status: null,
};
