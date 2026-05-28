/**
 * Textarea — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.c. Closest analogue to Input (PR #63). Mirrors the cva
 * `state` × `size` surface from `input.tsx` so a consumer who already knows
 * `<Input>` can reach for `<Textarea>` without re-learning the API.
 *
 * Spec §5.1 lists Textarea in the component sweep but does NOT name specific
 * variants. The brand surface is therefore deliberately small — same logic as
 * Input: form fields read best when they recede; brand identity comes from
 * focus + error states, not loud surface colours.
 *
 * Cascade decisions from Button (PR #61) + Input (PR #63), honoured here:
 *
 *   1. **File location.** Existing shadcn path `components/ui/textarea.tsx`
 *      stays. No consumers exist on `main` today (0 hits in
 *      `website/src` for `<Textarea`) — but the in-place convention is locked
 *      across the Phase 2 component sweep, so we keep it for future imports.
 *   2. **`cva` over `Readonly<Record>`.** Textarea variants resolve to class
 *      strings. Same as Button + Input.
 *   3. **Semantic variant names.** `state="error"` decouples the API from the
 *      destructive token. A future re-tint changes the token; consumers never
 *      touch their props.
 *   4. **Default-stability + RE-SKIN ENUMERATION.** Zero existing consumers
 *      (verified by grep — see HANDOFF). No re-skin risk; the brand-styled
 *      default IS the first surface this component exposes. Documented as
 *      "shipped surface" not "preserved" per the Button POST-QA AMENDMENT
 *      framing rule.
 *   5. **No `leadingIcon` / `trailingIcon` props.** Same as Input — icon-affix
 *      is a call-site composition concern (relative wrapper + absolutely-
 *      positioned icon), not a render prop. No real consumer surfaces friction
 *      today; do not speculate.
 *   6. **Disabled colour.** Root chain `disabled:cursor-not-allowed
 *      disabled:opacity-50` (shadcn baseline) preserved. icon-direction.md §3's
 *      `brand-light-blue` for disabled is the icon-glyph rule, not the
 *      form-surface rule.
 *
 * Brand surface (mirrors Input exactly):
 *
 *   - `size`:  `sm | md (default) | lg | default`   — height baseline scales
 *   - `state`: `default | error`                    — for aria-invalid surfacing
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - default state: border-brand-light-blue, placeholder:text-brand-charcoal/70,
 *                    text-brand-charcoal, focus-visible:ring-brand-navy
 *   - error state:   border-destructive, text-destructive,
 *                    focus-visible:ring-destructive (mirrors Input + Button destructive)
 *
 * NO `resize` variant. shadcn baseline allows the browser default (vertical
 * resize). If a real consumer surfaces friction with that (e.g. a fixed-height
 * compact textarea inside a table cell), add `resize` then — don't speculate.
 *
 * Size rationale: heights are taller than Input because textareas hold
 * multi-line content. `sm` keeps the min-height shadcn baseline (80px) for
 * dense surfaces; `md` (default) bumps to 96px for forms; `lg` to 120px for
 * hero forms or long-form note fields.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  // Root — shadcn baseline structure preserved. Focus chain matches Button +
  // Input (focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2)
  // for design-system consistency. `flex` removed vs original shadcn snippet —
  // textarea is a block-level multiline control; the flex was leftover noise.
  [
    'block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      /**
       * Visual state. Defaults to `default` — brand-styled (light-blue border,
       * navy focus ring, charcoal/70 placeholder, charcoal text). `error` swaps
       * to the destructive token family (mirrors Input + Button destructive).
       *
       * Re-skin note: 0 existing `<Textarea>` consumers on main. No re-skin
       * impact. See HANDOFF §"Consumer re-skin enumeration".
       */
      state: {
        default:
          'border-brand-light-blue text-brand-charcoal placeholder:text-brand-charcoal/70 focus-visible:ring-brand-navy',

        /**
         * error — paired with `aria-invalid="true"` at the call site. Spec
         * §5.5 / WCAG SC 1.4.1: error MUST NOT be communicated by colour
         * alone. The combination of red border + aria-invalid + an
         * accompanying error message (rendered by the form layer, not
         * Textarea itself) satisfies the rule.
         */
        error:
          'border-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive',
      },

      /**
       * Size scale. `default` preserved so future consumers compile untouched.
       * `md` is an explicit alias of `default` per the Button + Input cascade —
       * brand consumers opt into sm/md/lg without thinking.
       *
       * Heights via `min-h-*` so the browser still permits user resize.
       * `sm`: 80px (shadcn baseline) — dense surfaces / table cells.
       * `md`: 96px — forms.
       * `lg`: 120px — hero forms / long-form notes.
       */
      size: {
        default: 'min-h-[96px]',
        md: 'min-h-[96px]',
        sm: 'min-h-[80px] text-sm',
        lg: 'min-h-[120px] text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'default',
    },
  },
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, state, size, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(textareaVariants({ state, size, className }))}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
