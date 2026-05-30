/**
 * Card — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.j. Adds brand-styled variants via `cva` alongside the existing
 * shadcn baseline. The root container default ("rounded-lg border bg-card …
 * shadow-sm") is preserved as the `default` variant so every existing
 * consumer on `main` continues to compile without churn (spec §7.2: extend,
 * do not fork).
 *
 * Brand variants (spec §5.1 + §7.3 "Linear polish" reference):
 *   - brand        → light surface, brand-light-blue hairline border,
 *                    brand-tinted soft shadow (shadow-brand-md). The
 *                    default brand card.
 *   - brand-flat   → light surface, brand-light-blue hairline, no shadow.
 *                    Used when cards nest (e.g. summary inside a panel)
 *                    or when a parent already supplies the shadow.
 *   - brand-elevated → light surface, brand hairline, deeper shadow
 *                    (shadow-brand-lg). Hero / "feature card" affordance.
 *   - brand-advisory → advisory teal tint, brand-advisory hairline. Mirrors
 *                    Button + Alert + Badge advisory variants for design-
 *                    system cohesion. Used in "consult an APA member"
 *                    contexts.
 *
 * Cascade decisions from Button (PR #61) → Badge + Alert (this wave)
 * honoured:
 *   1. File location stays `components/ui/card.tsx`.
 *   2. `cva` over `Readonly<Record>` — variants resolve to class strings.
 *   3. Semantic variant names decouple consumers from token names.
 *   4. Default variant stays `default` (shadcn baseline) — flipping it
 *      would silently re-skin every existing call site, out of scope here.
 *   5. Card subparts (Header / Title / Description / Content / Footer)
 *      stay un-varianted — only the root container carries the variant
 *      surface. Title typography is brand-aligned (already inherits the
 *      Montserrat/Source Sans Pro pairing from globals.css). Subparts
 *      that need a brand-specific override can do so via className at the
 *      call site.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - brand:          border-brand-light-blue/50, bg-brand-white,
 *                     shadow-brand-md
 *   - brand-flat:     border-brand-light-blue/50, bg-brand-white
 *   - brand-elevated: border-brand-light-blue/40, bg-brand-white,
 *                     shadow-brand-lg
 *   - brand-advisory: border-brand-advisory/60, bg-brand-advisory/10
 *
 * Contrast: cards don't normally carry on-surface text directly — text lives
 * in CardDescription / CardContent which use editorial colours
 * (`text-muted-foreground` and the page foreground). The brand-advisory
 * variant's pale teal surface (~10% alpha) leaves body text contrast
 * indistinguishable from a white background — well above 4.5:1 for the
 * inherited foreground.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-lg border', {
  variants: {
    variant: {
      // ----- Legacy shadcn baseline (preserved). Spec §7.2: extend, do not
      // fork. -----
      default: 'bg-card text-card-foreground shadow-sm',

      // ----- Brand variants (spec §5.1, §7.3). All token-driven. -----

      /**
       * brand — the default brand card. Brand-light-blue hairline at 50%
       * alpha provides a quiet structural edge; brand-tinted medium shadow
       * supplies the Linear-style soft polish (spec §7.3) without going
       * "heavy". `bg-brand-white` keeps the surface light-mode-only per
       * spec §5.8 (dark mode deferred).
       */
      brand: 'border-brand-light-blue/50 bg-brand-white shadow-brand-md',

      /**
       * brand-flat — same surface and hairline, no shadow. Use when a card
       * nests inside another panel or when the parent supplies the shadow.
       */
      'brand-flat': 'border-brand-light-blue/50 bg-brand-white',

      /**
       * brand-elevated — hero / feature card. Lighter hairline (40% alpha)
       * because the deeper shadow already supplies the structural edge.
       * shadow-brand-lg is the brand-tinted 10px-radius drop.
       */
      'brand-elevated': 'border-brand-light-blue/40 bg-brand-white shadow-brand-lg',

      /**
       * brand-advisory — advisory-context tint. Matches Button + Badge +
       * Alert advisory variants. Pale teal (10% alpha) so body text reads
       * against a near-white surface — contrast stays clear.
       */
      'brand-advisory': 'border-brand-advisory/60 bg-brand-advisory/10',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
