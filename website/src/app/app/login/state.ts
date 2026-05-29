/**
 * Form-state types and initial values for `/app/login`.
 *
 * Separate from `actions.ts` because `'use server'` files may only
 * export async functions. See
 * https://nextjs.org/docs/messages/invalid-use-server-value.
 */

export type LoginActionState = {
  /** Inline error rendered above the form; `null` while in the empty/success states. */
  error: string | null;
  /** Echoed back so the email field doesn't clear on a failed submission. */
  email: string;
};

export const LOGIN_INITIAL_STATE: LoginActionState = {
  error: null,
  email: '',
};
