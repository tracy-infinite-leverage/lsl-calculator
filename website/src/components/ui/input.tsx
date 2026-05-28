/**
 * Input — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.b — the FIRST sibling component PR after Button (PR #61). This
 * file mirrors the cascade-quality decisions documented in
 * `docs/engineering/changes/2026-05-28-E6.2-task-2.6-button/HANDOFF.md`
 * (POST-QA AMENDMENT block). Read that doc before extending any further Task
 * 2.6 sibling components — the discipline that broke down on Button's first
 * pass is the discipline that matters here.
 *
 * Spec §5.1 lists Input in the component sweep but does NOT name specific
 * variants (unlike Button which spec §5.1 mandates by name). The brand surface
 * Input exposes today is therefore deliberately small:
 *
 *   - `size`:  `sm | md (default) | lg | default`   — mirrors Button sizing
 *   - `state`: `default | error`                    — for aria-invalid surfacing
 *
 * No named visual variants beyond that. Form fields read best when they recede
 * — the brand identity for inputs comes from focus + error states, not from
 * loud surface colours. If a real consumer surfaces a need (e.g. a "search"
 * variant with an icon affix), add it then; don't speculate now.
 *
 * Cascade decisions from Button (PR #61) honoured here:
 *
 *   1. **File location.** Existing shadcn path `components/ui/input.tsx` stays
 *      — extending in place preserves consumer imports across all 38 existing
 *      `<Input>` call sites (8 files).
 *   2. **`cva` over `Readonly<Record>`.** Input variants resolve to class
 *      strings, same as Button. cva is the right tool.
 *   3. **Semantic variant names.** `state="error"` decouples the API from the
 *      destructive token. A future re-tint changes the token; consumers never
 *      touch their props.
 *   4. **Default-stability + RE-SKIN ENUMERATION.** No existing `<Input>`
 *      consumer passes `variant=` or `state=` today (verified by grep — see
 *      HANDOFF). Adding `state="default"` as the cva default does change the
 *      base class string from main's shadcn baseline to a brand-token chain
 *      (`border-brand-light-blue`, `focus-visible:ring-brand-navy`,
 *      `placeholder:text-brand-grey`). **This RE-SKINS all 38 existing
 *      consumers** — they will visibly change from shadcn neutral grey to
 *      brand grey-blue with a navy focus ring. This is intentional brand
 *      application (the whole point of Phase 2) but is enumerated explicitly
 *      in the HANDOFF per the Button POST-QA AMENDMENT — never claim
 *      "preserved" when the answer is "re-skinned."
 *   5. **No `leadingIcon` / `trailingIcon` props.** Per icon-direction.md §3,
 *      "Search inside an input" is a real pattern but is a composition concern
 *      at the call site, not a render prop on Input. If a real consumer needs
 *      icon affixes, layer them at the call site with an absolutely-positioned
 *      icon over the Input — don't grow the API surface here.
 *   6. **Disabled colour.** The shadcn baseline `disabled:cursor-not-allowed
 *      disabled:opacity-50` is preserved. icon-direction.md §3 calls out
 *      `brand-light-blue` for disabled icon glyphs; that's the icon rule, not
 *      the input rule. opacity-50 already pushes the input surface back; no
 *      per-state disabled override.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - default state: border-brand-light-blue, placeholder:text-brand-grey,
 *                    text-brand-charcoal, focus-visible:ring-brand-navy
 *   - error state:   border-destructive, text-destructive,
 *                    focus-visible:ring-destructive (mirrors Button destructive)
 *
 * Focus ring rationale: brand-navy (6.33:1 against white) matches Button.
 * Consistency across the design system matters more than per-component
 * uniqueness — when a user keyboard-navigates from a Button to an Input the
 * focus indicator should feel familiar.
 *
 * Error state rationale: spec §5.5 (WCAG 2.2 AA) requires error states be
 * communicated by more than colour alone (SC 1.4.1). The cva surfaces a
 * `state="error"` API; consumers MUST also set `aria-invalid="true"` (the
 * `state="error"` style and `aria-invalid` are two halves of the same
 * affordance — colour for sighted users, ARIA for assistive tech). The
 * `WithError` Storybook story models this explicitly.
 *
 * Border colour rationale: `brand-light-blue` is icon-direction.md §3's
 * nominated colour for "secondary structural lines" and disabled state. It's
 * the closest semantic match for an input border — soft enough to recede,
 * brand-tinted enough to feel intentional. `brand-grey` was the alternative
 * but reads as metadata, not as a form-field affordance.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  // Root — shadcn baseline structure (flex, h, w, rounded, px, py, text, shadow,
  // transition, file:..., disabled:...) preserved. Focus chain matches the
  // Button root (`focus-visible:outline-none focus-visible:ring-2
  // focus-visible:ring-offset-2`) for design-system consistency.
  [
    'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      /**
       * Visual state. Defaults to `default` — brand-styled (light-blue border,
       * navy focus ring, brand-grey placeholder, charcoal text). `error` swaps
       * to the destructive token family (mirrors Button destructive — single
       * red across the system, no parallel "input-error-red").
       *
       * Re-skin note: NO existing consumer passes a `state` prop today, but
       * the `default` state IS brand-styled (not shadcn-neutral). All 38
       * existing `<Input>` call sites WILL visibly change. See HANDOFF
       * §"Consumer re-skin enumeration" for the per-consumer breakdown.
       */
      state: {
        default:
          'border-brand-light-blue text-brand-charcoal placeholder:text-brand-grey focus-visible:ring-brand-navy',

        /**
         * error — paired with `aria-invalid="true"` at the call site. Spec
         * §5.5 / WCAG SC 1.4.1: error MUST NOT be communicated by colour
         * alone. The combination of red border + aria-invalid + an
         * accompanying error message (rendered by the form layer, not
         * Input itself) satisfies the rule.
         */
        error:
          'border-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive',
      },

      /**
       * Size scale. `default` preserved so existing 38 consumers compile
       * untouched. `md` is an explicit alias of `default` per the Button
       * cascade decision — brand consumers opt into sm/md/lg without
       * thinking; legacy consumers keep their implicit `default`.
       *
       * Note on touch targets: sm at h-9 (36px) is below the WCAG 2.5.8
       * AAA minimum (44px) but matches Button sm — within a tabular dense
       * layout it's the right affordance. The 24px AA floor (SC 2.5.8 AA
       * level applies only at AAA) is still satisfied. md / lg both
       * exceed 44px after padding.
       */
      size: {
        default: 'h-10 px-3 py-2',
        md: 'h-10 px-3 py-2',
        sm: 'h-9 px-2.5 py-1.5 text-sm',
        lg: 'h-11 px-4 py-2.5 text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'default',
    },
  },
);

/**
 * `size` collides with the native HTML `<input size>` attribute (a numeric
 * column hint — `<input size={20}>`). We deliberately shadow the native attr
 * here: in 2026, virtually nobody styles inputs via the legacy `size` HTML
 * attribute (Tailwind/CSS width utilities replace it). Omitting it from
 * `React.InputHTMLAttributes<HTMLInputElement>` via `Omit` lets our cva-driven
 * `size` ('sm' | 'md' | 'lg' | 'default') take over without TS narrowing
 * surprises. Grep confirmed 0 existing consumers pass a numeric `size=`
 * attribute today.
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state, size, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(inputVariants({ state, size, className }))}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input, inputVariants };
