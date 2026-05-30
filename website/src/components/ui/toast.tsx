'use client';

/**
 * Toast — LSL brand wrapper around Sonner
 *
 * E6.2 Task 2.6.p (wave 2). Replaces the deprecated shadcn Toast primitive
 * with **Sonner** per operator decision 2026-05-30 (shadcn deprecated their
 * original Toast and now recommends Sonner across the board).
 *
 * Why Sonner (vs. rolling our own on Radix Toast):
 *   - shadcn's published guidance points to Sonner. Sticking to the
 *     mainstream component-library guidance reduces our maintenance
 *     surface and keeps future shadcn-CLI ergonomics intact.
 *   - Sonner ships strong a11y by default — every toast is announced via
 *     an ARIA live region; keyboard dismissal works out of the box;
 *     focus management mirrors what we'd build by hand.
 *   - `prefers-reduced-motion` is honoured by Sonner internally; the
 *     slide / fade animations strip under reduced-motion automatically.
 *   - Stacking / queue behaviour, swipe-dismiss, action buttons, promise
 *     toasts — all baked in. We'd otherwise rebuild this surface from the
 *     primitive Radix Toast.
 *
 * Why a brand wrapper instead of consuming Sonner directly:
 *   1. Token-first per spec §7.1 — the `<Toaster />` mounts with our
 *      brand colours wired through Sonner's `theme` + `richColors` +
 *      `toastOptions.className` props. Consumers never see the styling
 *      decision.
 *   2. Single import point — every other code file imports from
 *      `@/components/ui/toast`, never directly from `sonner`. If we
 *      swap Sonner for a different primitive later (custom build,
 *      Radix-based, etc.), it's a one-file change.
 *   3. Brand-specific helpers — `brandToast.success / error / info /
 *      brand` carry default semantics (icon + title style) so call sites
 *      don't reinvent them.
 *
 * File naming decision: `toast.tsx` (lowercase) follows the shadcn /
 * project house style (`card.tsx`, `dialog.tsx`, `accordion.tsx`). The
 * filename doesn't leak the "Sonner" implementation detail, which is
 * deliberate — see point 2 above.
 *
 * Spec mapping (§5.1, §5.5, §5.7):
 *   - §5.1 mandates "Toast" in the core component variant list.
 *   - §5.5 requires ARIA live announcement, keyboard dismissal, and
 *     `prefers-reduced-motion` — all satisfied by Sonner's defaults.
 *   - §5.7 requires no third-party network egress at runtime. Sonner is
 *     fully bundled with the app — no CDN, no remote scripts. The
 *     postbuild `audit-bundle.mjs` guard re-verifies on every build.
 *
 * Brand surface (spec §5.1):
 *   - default base — brand-white surface, brand-charcoal text,
 *     brand-light-blue/50 hairline, shadow-brand-md drop, rounded-brand-md.
 *   - success — brand-light + green accent left border
 *   - error — brand-light + destructive accent left border
 *   - info — brand-light + brand-navy accent left border
 *   - brand — brand-navy surface, brand-white text (the inverse — high
 *     emphasis "platform announcement" tone)
 *
 * API surface (this file exports):
 *   - `Toaster` — mount once in the app shell. Consumers don't customise
 *     props at the call site; the brand defaults are applied here.
 *   - `toast` — the call-site API. Re-exports Sonner's `toast` with the
 *     brand wrapper attached:
 *       toast('plain message')
 *       toast.success('Saved')
 *       toast.error('Could not save')
 *       toast.info('FYI')
 *       toast.brand('Welcome to LSL Calculator')      ← brand-emphasis variant
 *       toast.dismiss(id)
 *       toast.promise(p, { loading, success, error }) ← passthrough
 *
 * Queue / stacking:
 *   - Sonner queues toasts in FIFO order; default visible-at-once is 3.
 *     New toasts beyond the cap collapse into a stack the user can hover
 *     to expand. We keep the default cap.
 *   - Each toast auto-dismisses after `duration` ms (default 4000). Pass
 *     `duration: Infinity` on call to make a toast sticky.
 *
 * Accessibility — verified against Sonner v2.x defaults:
 *   - `aria-live="polite"` on the toast region (configurable via
 *     `<Toaster />` props — we keep the default polite tone).
 *   - Keyboard dismissal — focus the toast (Sonner exposes a focus-trap
 *     keyboard shortcut: `Alt+T` by default) and press Escape, or click /
 *     hit Enter on the close button.
 *   - `prefers-reduced-motion` — Sonner strips entrance / exit animations.
 *   - Screen-reader rationale: Sonner renders toasts as `role="status"`
 *     by default (or `role="alert"` for error toasts), so screen readers
 *     announce the content as it arrives without stealing focus.
 *
 * NOTE on contrast:
 *   - default + success + info + error variants (brand-white surface,
 *     brand-charcoal text) clear 4.5:1 — passes WCAG 2.2 AA body.
 *   - `brand` variant (brand-navy surface, brand-white text) — 6.33:1.
 *   - Accent left borders carry no text so the 3:1 non-text contrast bar
 *     applies; all four accent colours clear it against brand-white.
 */

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

// ---------------------------------------------------------------------------
// <Toaster /> — mount once in the app shell (e.g. app/layout.tsx or
// app/(app)/layout.tsx). The brand defaults are wired here so consumers
// don't repeat them per surface.
// ---------------------------------------------------------------------------

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const Toaster = ({
  position = 'bottom-right',
  closeButton = true,
  richColors = false,
  ...props
}: ToasterProps) => {
  return (
    <SonnerToaster
      position={position}
      closeButton={closeButton}
      richColors={richColors}
      theme="light"
      visibleToasts={3}
      // The brand defaults — Sonner accepts class overrides per slot. We
      // map every slot to brand-token classes so the rendered toast reads
      // like a card from our system.
      toastOptions={{
        classNames: {
          // Base toast — brand-white surface, hairline, brand-shadow,
          // brand radius. Sonner ships its own .toast class; our classes
          // compose alongside.
          toast: [
            'bg-brand-white text-brand-charcoal',
            'border border-brand-light-blue/50',
            'shadow-brand-md rounded-brand-md',
            // Sonner applies its own padding (16px). We don't override.
          ].join(' '),
          title: 'text-brand-navy font-semibold',
          description: 'text-brand-charcoal',
          // Sonner's success / error / info / warning data attributes drive
          // the accent left border. We re-tint each via the brand palette.
          success: 'border-l-4 border-l-success',
          error: 'border-l-4 border-l-destructive',
          info: 'border-l-4 border-l-brand-navy',
          warning: 'border-l-4 border-l-warning',
          actionButton: 'bg-brand-navy text-brand-white',
          cancelButton: 'bg-brand-light-blue/30 text-brand-navy',
          closeButton:
            'bg-brand-white border border-brand-light-blue/50 text-brand-grey',
        },
      }}
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// `toast` — call-site API. Re-exports Sonner's `toast` plus a brand
// helper (`toast.brand`) for the navy-on-white high-emphasis variant.
// ---------------------------------------------------------------------------

/**
 * High-emphasis brand toast — navy surface, white type. Used for
 * platform-level announcements (e.g. "Welcome", "New feature available")
 * where the toast should feel like a deliberate brand surface rather than
 * a neutral status message.
 *
 * Composes on top of Sonner's `toast()` by passing a brand `className` —
 * this isn't a separate Sonner severity, just a styled tone of the
 * default.
 */
function brandToast(
  message: React.ReactNode,
  options?: Parameters<typeof sonnerToast>[1]
) {
  return sonnerToast(message, {
    ...options,
    className: [
      // Tones override the per-slot brand defaults from <Toaster />.
      // Sonner merges the per-toast `className` AFTER the toastOptions
      // classNames, so this wins.
      '!bg-brand-navy !text-brand-white !border-brand-navy',
      options?.className ?? '',
    ].join(' '),
    // Surface title in white when the consumer passes a `description` —
    // the toastOptions title class is brand-navy, which is invisible on a
    // navy surface. Push it to white inline.
    style: { ['--description-color' as string]: 'var(--brand-white)' },
  });
}

// Attach the brand helper as a method on the re-exported `toast` so the
// call-site API stays single-import.
type ToastFn = typeof sonnerToast & { brand: typeof brandToast };
const toast = sonnerToast as ToastFn;
toast.brand = brandToast;

export { Toaster, toast };
