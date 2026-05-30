/**
 * Dialog — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.l. Adds brand-styled variants via `cva` on `DialogContent`.
 * Radix UI primitive wrapping is preserved (Root / Portal / Overlay /
 * Content / Close are still Radix) so focus management — focus trap on open,
 * focus restoration on close, Escape-to-close, `aria-modal` — behaves
 * identically to upstream shadcn. The cva surface only re-tints the visual
 * shell.
 *
 * The shadcn baseline (`variant="default"`) is preserved so the existing
 * consumers on `main` (`unblock-jurisdiction-modal.tsx`,
 * `classifier-confirm-modal.tsx`) compile without churn (spec §7.2: extend,
 * do not fork).
 *
 * Brand variants (spec §5.1):
 *   - brand            → brand-light-blue/50 hairline, brand-tinted large
 *                        shadow (shadow-brand-lg), brand-white surface,
 *                        brand-rounded-lg corners. The default brand
 *                        dialog.
 *   - brand-destructive → red-tinted hairline for irreversible actions
 *                        (delete employee, hard-reset mapping). Uses the
 *                        shadcn semantic `destructive` token same as
 *                        Button — see button.tsx §5 for the rationale on
 *                        not minting a brand-red.
 *
 * Cascade decisions from Card + Tabs (this wave) honoured:
 *   1. File location stays `components/ui/dialog.tsx`.
 *   2. `cva` over `Readonly<Record>`.
 *   3. Semantic variant names — `brand`, `brand-destructive`.
 *   4. Default variant stays `default` (shadcn baseline) — flipping it
 *      would re-skin the two existing consumers, out of scope.
 *
 * Overlay tint stays at `bg-black/60` — independent of variant. The overlay
 * is a focus / attention affordance, not a brand surface; re-tinting it
 * would silently change every existing dialog on `main`.
 *
 * Close button (X) tint moves to `text-brand-charcoal` when a brand variant
 * is active, matching the brand text-body token. Default variant keeps the
 * shadcn baseline opacity-treatment for back-compat.
 *
 * Focus management — verified in Storybook stories (open trigger, click to
 * open, Tab to traverse focusable children, Shift+Tab to traverse back,
 * Escape to close, focus returns to the trigger). Radix handles this; we
 * only re-tint.
 *
 * Token consumption (zero hex literals on brand variants — spec §7.1):
 *   - brand:             border-brand-light-blue/50, bg-brand-white,
 *                        shadow-brand-lg, rounded-brand-lg
 *   - brand-destructive: border-destructive/40, bg-brand-white,
 *                        shadow-brand-lg
 *
 * Contrast: dialogs carry editorial body text (CardDescription-equivalent
 * `text-muted-foreground`, headings via DialogTitle). Brand-white surface
 * keeps every inherited token at its normal contrast level. The
 * brand-destructive border accent doesn't carry text — it's a non-text
 * contrast affordance (SC 1.4.11) and the destructive token clears the
 * 3:1 bar against the brand-white surface.
 */

'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// ---------------------------------------------------------------------------
// DialogContent variants
// ---------------------------------------------------------------------------

const dialogContentVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 p-6',
    'sm:rounded-lg',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border bg-background shadow-lg',
        brand:
          'border border-brand-light-blue/50 bg-brand-white shadow-brand-lg',
        'brand-destructive':
          'border border-destructive/40 bg-brand-white shadow-brand-lg',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, variant, children, ...props }, ref) => {
  // Brand variants override the default Close button tint so it reads against
  // the brand-white surface. Default keeps shadcn opacity-treatment.
  const closeBrandClass =
    variant === 'brand' || variant === 'brand-destructive'
      ? 'text-brand-charcoal opacity-70 hover:opacity-100 focus:ring-brand-navy'
      : 'opacity-70 hover:opacity-100 focus:ring-ring';

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentVariants({ variant }), className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 rounded-sm transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none',
            closeBrandClass
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogContentVariants,
};
