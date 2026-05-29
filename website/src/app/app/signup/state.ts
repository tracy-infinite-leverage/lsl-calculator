/**
 * Form-state types and initial values for `/app/signup`.
 *
 * Lives in a separate module from `actions.ts` because Next.js's
 * `'use server'` files may only export async functions — exporting a
 * plain `const` initial-state from a `'use server'` file fails at
 * runtime with "A 'use server' file can only export async functions,
 * found object" (https://nextjs.org/docs/messages/invalid-use-server-value).
 *
 * Imported by both `signup-form.tsx` (initial state for `useActionState`)
 * and `actions.ts` (type-only).
 */

export type SignupActionState = {
  /** Inline error rendered above the form; `null` while in the empty/success states. */
  error: string | null;
  /** Echoed back so the email field survives a server-side validation rejection. */
  email: string;
};

export const SIGNUP_INITIAL_STATE: SignupActionState = {
  error: null,
  email: '',
};
