/**
 * Form-state types and initial values for `/app/forgot-password`.
 *
 * Separate from `actions.ts` because `'use server'` files may only
 * export async functions. See
 * https://nextjs.org/docs/messages/invalid-use-server-value.
 */

export type ForgotPasswordState = {
  /** Renders an Alert when set; `null` on first render. */
  message: string | null;
  /** Echoed back so the email field doesn't clear after submission. */
  email: string;
};

export const FORGOT_INITIAL_STATE: ForgotPasswordState = {
  message: null,
  email: '',
};
