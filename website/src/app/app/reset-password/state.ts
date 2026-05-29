/**
 * Form-state types and initial values for `/app/reset-password`.
 *
 * Separate from `actions.ts` because `'use server'` files may only
 * export async functions. See
 * https://nextjs.org/docs/messages/invalid-use-server-value.
 */

export type ResetPasswordState = {
  /** Inline error rendered above the form; `null` on first render. */
  error: string | null;
};

export const RESET_INITIAL_STATE: ResetPasswordState = {
  error: null,
};
