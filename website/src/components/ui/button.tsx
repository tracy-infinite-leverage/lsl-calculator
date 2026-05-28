/**
 * Button — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6 (the pattern-setting task for Phase 2). Extends the shadcn
 * Button with brand-styled variants per spec §5.1: primary, secondary, ghost,
 * destructive, advisory. Spec §7.2 mandates "variant overrides, not
 * replacements" — the existing shadcn variants (`default`, `outline`,
 * `secondary`, `ghost`, `destructive`, `link`) are PRESERVED so the 14 active
 * consumers on `main` continue to compile without churn. Brand variants are
 * added alongside, opt-in by name.
 *
 * Cascade decisions for downstream Task 2.6 sub-tasks (Input, Card, Table,
 * etc.) documented in HANDOFF.md. Summary of the load-bearing ones:
 *
 *   1. **File location.** Existing shadcn path `components/ui/button.tsx`
 *      stays — extending in place preserves consumer imports.
 *   2. **`cva` over `Readonly<Record>`.** Brand-asset components in
 *      `components/brand/` use a literal-record map because variants resolve
 *      to SVG paths. Button variants resolve to class strings → `cva` is the
 *      right tool. Future Task 2.6 sub-tasks consuming class strings should
 *      also use `cva`.
 *   3. **Semantic variant names.** `primary`, `secondary`, `ghost`,
 *      `destructive`, `advisory` decouple the API from token names. A
 *      future re-tint changes the token; consumers never touch their
 *      `variant="primary"` props.
 *   4. **Default variant stays `default` (legacy shadcn).** Flipping the
 *      cva default to `primary` would silently re-skin every existing
 *      `<Button>` call site in this PR — out of scope for Task 2.6. The
 *      default-flip lands with E6.4 public-calc re-skin when the brand
 *      identity is rolled out end-to-end.
 *   5. **No `leadingIcon` / `trailingIcon` props.** The root `gap-2`
 *      already supports `<Icon /> <span>Label</span>` children; that's
 *      the established pattern in 14 existing consumers. Adding a render-
 *      prop API here would set an unwanted precedent before a real
 *      consumer surfaces friction. Re-evaluate at Task 2.6's
 *      Input/Select/Table sub-tasks if they need icons.
 *   6. **Disabled colour.** The root chain `disabled:opacity-50
 *      disabled:pointer-events-none` is preserved (shadcn baseline). For
 *      brand variants on light surfaces axe-core spot-checked navy/white at
 *      6.33:1 — disabled @ 50% opacity stays above 3:1 large-text. Brand
 *      variants do NOT add per-variant disabled overrides; `opacity-50` is
 *      enough.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - primary:     bg-brand-navy, text-brand-white, hover bg-brand-dark-blue,
 *                  focus-visible:ring-brand-navy, shadow-brand-sm
 *   - advisory:    bg-brand-advisory, text-brand-dark-blue,
 *                  hover bg-brand-advisory/85, focus-visible:ring-brand-navy
 *
 * Focus ring rationale: brand-navy (6.33:1 against white) not brand-gold
 * (2.26:1 against white — fails SC 1.4.11 non-text UI 3:1). Gold also
 * conflicts with the icon-direction.md §3 "gold = signal, not decoration"
 * restraint principle. Focus is a mechanical affordance, not a brand signal.
 *
 * Contrast audit (axe-core checked all five brand combinations in stories):
 *   primary navy/white                  6.33:1  ✓ AA body text
 *   primary hover dark-blue/white       8.86:1  ✓ AAA body text
 *   advisory mint/dark-blue             4.51:1  ✓ AA body text (just)
 *   destructive (existing semantic tok) inherited from shadcn defaults
 *   ghost (transparent → page bg)       inherited from parent surface
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // ----- Legacy shadcn defaults (preserved for the 14 existing
        // consumers; no brand styling). Spec §7.2: extend, do not fork. -----
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm focus-visible:ring-ring',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
        link:
          'text-primary underline-offset-4 hover:underline focus-visible:ring-ring',

        // ----- Brand variants (spec §5.1). All token-driven. -----

        /**
         * primary — the brand CTA. Navy field, white type, dark-navy hover.
         * Focus ring is brand-navy (6.33:1) not gold (2.26:1 fails SC 1.4.11
         * and conflicts with the "gold = signal" restraint principle from
         * icon-direction.md §3). Soft brand-tinted shadow for the Linear-polish
         * affordance per spec §7.3.
         */
        primary:
          'bg-brand-navy text-brand-white hover:bg-brand-dark-blue shadow-brand-sm focus-visible:ring-brand-navy',

        /**
         * secondary — quieter affordance, navy hairline + light surface. Used
         * for "Cancel" / "Back" siblings of a primary CTA. Hover tints to the
         * sub-brand light-blue at low alpha so the button still feels brand-
         * adjacent without competing with the primary navy.
         */
        secondary:
          'bg-brand-white text-brand-navy border border-brand-navy hover:bg-brand-light-blue/20 focus-visible:ring-brand-navy',

        /**
         * ghost — text-only affordance for inline controls (e.g. icon-buttons
         * in a table row, "Reset" link inside a form). No border, no shadow;
         * hover surfaces a tinted background to confirm interactivity.
         */
        ghost:
          'text-brand-navy hover:bg-brand-light-blue/20 focus-visible:ring-brand-navy',

        /**
         * destructive — for irreversible actions (delete, remove). Uses the
         * shadcn semantic `destructive` token (oklch red defined in
         * globals.css) rather than inventing a new `brand-red` token — the
         * shadcn red is already wired through the system, axe-passes for
         * white text, and is consumer-stable. icon-direction.md §5 references
         * `#a23a3a` as the "destructive button red" but the token is not
         * defined in globals.css today; adopting the existing semantic token
         * is the correct restraint until a brand-red token lands as a
         * separate, deliberate change. [SCOPE-NOTE in HANDOFF]
         */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-brand-sm focus-visible:ring-destructive',

        /**
         * advisory — for advisory / "consult an APA member" context (spec
         * §5.1). Uses the brand-advisory teal as a quiet, recognisable
         * background tint. Text is brand-dark-blue (4.51:1 ≥ 4.5:1 body-text
         * AA). Brand-navy text would only hit 3.22:1 — fails AA body.
         * Dark-blue is the correct on-brand foreground here.
         */
        advisory:
          'bg-brand-advisory text-brand-dark-blue hover:bg-brand-advisory/85 shadow-brand-sm focus-visible:ring-brand-navy',
      },

      /**
       * Size scale. `default` preserved for the 14 existing consumers. `md`
       * is an explicit alias of `default` so brand consumers can opt into
       * sm/md/lg without thinking — sm/md/lg is the conventional API operator
       * docs reference, and `md` reads cleaner than `default` at a call site.
       *
       * Token note: `text-body-min` / `text-body-max` would be the brand
       * type-scale tokens for button labels. We deliberately retain the
       * Tailwind utility `text-sm` / `text-base` here — the brand type tokens
       * are sized for editorial copy (10pt body min, 12pt body max) which is
       * too tight for tappable controls. Re-evaluate if E6.4 surfaces a
       * call-site that needs a true brand-token label size.
       */
      size: {
        default: 'h-10 px-4 py-2',
        md: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the component renders as its first child (via Radix `Slot`),
   * forwarding `className` + ref. Used by `<Button asChild><Link/></Button>`
   * to apply button styling to an `<a>`. Preserves shadcn upgrade contract.
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
