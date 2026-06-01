/**
 * ConfirmDestructiveDialog — wrapper component that fronts any destructive
 * write action (delete employee, hard-reset mapping, delete saved valuation)
 * with a tenant-aware confirmation step.
 *
 * E6.3 Task 3.5. Spec `.specify/features/006-ui-design-system/spec.md` v0.5
 * §5.2 + §8.3 + R-5. Tasks lines 389–405 (G-8 inline operator-awareness note).
 *
 * # Behaviour matrix (the locked operator decision)
 *
 *   | TenantContext state           | Behaviour                              |
 *   |-------------------------------|----------------------------------------|
 *   | isActingNonHome === true      | Show confirm dialog naming the tenant. |
 *   | isActingNonHome === false     | SKIP the dialog. Fire onConfirm now.   |
 *
 * **Operator decision recorded at task kickoff (locked):** SKIP on home org.
 *
 * Per spec §5.2: only the non-home-tenant path MANDATES the confirm dialog.
 * R-5 (success criterion 4 — zero mis-tenant write incidents) is bounded by
 * the non-home case — a mis-tenant write can only happen OFF home org. Same
 * confirm friction on every destructive action under home-org context would
 * be hostile UX (caller signed in to their own org clicks "delete" → already
 * confirmed by clicking the destructive button).
 *
 * Per tasks.md line 393 (G-8 inline note): "if any pilot user reports a
 * near-miss in home-org context, flip the default." The home-org branch is
 * a single boolean below; flipping is a one-line change.
 *
 * # API shape — component wrapper
 *
 * Chose a component (not a hook) because:
 *
 *   1. **Composability with E6.2 Dialog primitives.** The shadcn / Radix
 *      Dialog is component-based (`<Dialog>` / `<DialogTrigger asChild>`);
 *      wrapping it as a component keeps the same composition pattern as
 *      existing modal consumers (`unblock-jurisdiction-modal.tsx`,
 *      `classifier-confirm-modal.tsx`).
 *   2. **Memberships prop bag.** The dialog needs the human-readable active
 *      tenant name — which lives in `memberships` (same source as the
 *      ActingAsBanner). A hook would force every call site to thread the
 *      memberships through context or props anyway; a component makes the
 *      prop explicit.
 *   3. **Presentation / live split.** The established Phase 3a pattern
 *      (TenantSwitcher, ActingAsBanner) splits a Storybook-renderable
 *      `*Presentation` from a hook-consuming live wrapper. That only works
 *      cleanly for a component.
 *   4. **Async onConfirm.** Easier to surface loading + error state via
 *      component lifecycle than via an imperative hook that has to manage
 *      its own portal.
 *
 * Usage:
 *
 * ```tsx
 * <ConfirmDestructiveDialog
 *   memberships={memberships}
 *   trigger={<Button variant="destructive">Delete employee</Button>}
 *   title="Delete employee"
 *   description="This permanently removes Sarah Connor and all pay history."
 *   confirmLabel="Delete employee"
 *   onConfirm={async () => {
 *     await deleteEmployee(id);
 *   }}
 * />
 * ```
 *
 * On non-home tenant context the title becomes:
 *   "Delete employee — confirming on Bondi Bookkeeping"
 *
 * # Tenant naming convention (R-5 alignment)
 *
 * The dialog title is amended (NOT replaced) with the active tenant name so
 * the original action verb stays visible at the top of the modal — the user
 * sees BOTH the action and the tenant in a single glance:
 *
 *   `<title> — confirming on <tenant name>`
 *
 * The description prepends a single bold sentence naming the tenant:
 *
 *   `You are acting on <tenant name>.` <user-supplied description>
 *
 * This mirrors the ActingAsBanner copy structure ("Acting as: <name>") so
 * the user gets the same visual + textual mapping in both surfaces — one
 * less thing to interpret in the moment that matters most (R-5).
 *
 * # Pure-presentation; no data fetching here
 *
 * `ConfirmDestructiveDialog` reads `useTenantContext` and resolves the
 * tenant name from the `memberships` prop. `ConfirmDestructiveDialogPresentation`
 * accepts every input as a prop so Storybook + unit tests can exercise
 * the markup without a `TenantProvider` mounted above. Same Presentation /
 * live split as TenantSwitcher.tsx + ActingAsBanner.tsx.
 *
 * # Accessibility surface
 *
 *   - Focus management → Radix UI Dialog handles focus trap on open, focus
 *     restoration on close, Escape-to-close, `aria-modal`. We only wrap.
 *   - `DialogTitle` is the accessible name → screen readers announce
 *     "Delete employee — confirming on Bondi Bookkeeping, dialog" on open.
 *   - The Cancel button gets explicit focus on open via Radix default
 *     (first focusable descendant). This is the safe default — pressing
 *     Enter immediately cancels rather than confirms a destructive action.
 *   - `aria-describedby` (via Radix DialogDescription) wires the body copy
 *     to the dialog for SR announcement.
 *
 * # Async + error semantics
 *
 * `onConfirm` is `() => void | Promise<void>`. While the promise is pending,
 * the Confirm button shows a disabled "Working…" state and the dialog is
 * non-dismissable (the user can't accidentally click Cancel mid-flight).
 * If the promise rejects, the dialog STAYS OPEN, surfaces an inline error,
 * and the caller can retry. On resolve, the dialog closes.
 *
 * This is the safest default for a destructive action: a network blip on
 * the write call should NOT close the modal silently (the user would think
 * the action succeeded). The same pattern as `unblock-jurisdiction-modal.tsx`.
 */

'use client';

import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/lib/tenant-context';
import type { Membership } from './memberships';

export interface ConfirmDestructiveDialogProps {
  /**
   * The user's tenant memberships — same prop bag passed to TenantSwitcher
   * and ActingAsBanner from `app/app/layout.tsx`. Used to resolve the
   * active tenant's human-readable name. If the lookup misses (data race
   * or stale membership list) the dialog falls back to the bare tenant ID
   * so the user still sees an identifying handle (R-5 fallback).
   */
  memberships: Membership[];
  /**
   * The trigger element that opens the dialog (typically a destructive
   * button). Forwarded to `<DialogTrigger asChild>` — caller-controlled
   * styling. We require a `ReactElement` (not `ReactNode`) so Radix's
   * `asChild` slot can clone props onto a single element without runtime
   * errors.
   *
   * NOTE: on home-org context, the trigger STILL renders as the user's
   * normal click target — but its click is intercepted by a transparent
   * `<span display:contents>` wrapper and fires `onConfirm` directly,
   * bypassing the Dialog. See `handleHomeOrgClick` below for the
   * load-bearing wiring.
   */
  trigger: ReactElement;
  /**
   * The action verb, e.g. "Delete employee" or "Hard-reset mapping".
   * Becomes the DialogTitle on non-home tenant; amended with the tenant
   * name on non-home (` — confirming on <tenant>`).
   */
  title: string;
  /**
   * The body copy explaining the destructive consequence. Sentence-cased,
   * 1–2 sentences. Rendered as the DialogDescription.
   */
  description: ReactNode;
  /**
   * The label on the destructive confirm button. Defaults to `title` —
   * usually the same verb. Override when the title is a question
   * (e.g. title "Delete employee — are you sure?", confirmLabel "Delete").
   */
  confirmLabel?: string;
  /**
   * The label on the cancel button. Defaults to "Cancel".
   */
  cancelLabel?: string;
  /**
   * The destructive action. May be async — while pending the dialog
   * disables both buttons and shows a "Working…" state. On reject the
   * dialog stays open and surfaces the error message; on resolve it
   * closes.
   */
  onConfirm: () => void | Promise<void>;
}

export interface ConfirmDestructiveDialogPresentationProps
  extends Omit<ConfirmDestructiveDialogProps, 'memberships'> {
  /**
   * Whether the user is acting on a non-home tenant. When `false`, the
   * trigger fires `onConfirm` immediately and the dialog never opens
   * (the operator-locked skip-on-home behaviour).
   */
  isActingNonHome: boolean;
  /**
   * The active tenant ID. Used as the fallback label when
   * `activeTenantName` is empty.
   */
  activeTenantId: string;
  /**
   * The human-readable active tenant name. Empty string falls back to
   * `activeTenantId` so the dialog always shows an identifying handle
   * (matches ActingAsBanner fall-back-to-ID safety net).
   */
  activeTenantName: string;
}

/**
 * Pure-presentation variant. Accepts every input as a prop so Storybook +
 * vitest can render the dialog markup without a `TenantProvider` mounted
 * above. The default `ConfirmDestructiveDialog` export below wraps this
 * with the live `useTenantContext` consumer.
 */
export function ConfirmDestructiveDialogPresentation({
  isActingNonHome,
  activeTenantId,
  activeTenantName,
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmDestructiveDialogPresentationProps) {
  // Tenant label resolution — fall back to the bare ID if the name lookup
  // missed. Matches ActingAsBanner's safety net: an empty handle in the
  // dialog title (" — confirming on ") would defeat R-5 (the whole point
  // is the user sees the tenant they're operating on).
  const tenantLabel = activeTenantName.trim() || activeTenantId;

  // Open/closed + async state. We control the Dialog's `open` prop
  // explicitly so we can:
  //   1. Prevent close-while-pending (the user can't dismiss mid-flight).
  //   2. Keep the dialog open on rejection so the user can read the
  //      error and retry.
  //   3. Close on a successful confirm.
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedConfirmLabel = confirmLabel ?? title;
  const resolvedCancelLabel = cancelLabel ?? 'Cancel';

  // ---------------------------------------------------------------------
  // Home-org skip branch (operator decision — locked).
  //
  // When `isActingNonHome === false` we BYPASS the Dialog entirely and
  // fire `onConfirm` directly when the trigger is clicked. The Dialog
  // never opens; there's no portal, no overlay, no focus trap to wire.
  //
  // We DO still run `onConfirm` through the same async wrapper so the
  // call site gets a consistent shape across both branches (e.g. a
  // network error on home-org delete still propagates upward). The
  // difference is purely whether we render the modal in between.
  //
  // Wiring: wrap the trigger in a transparent `<span display:contents>`
  // whose `onClick` handler captures the bubbled click. This avoids the
  // React 19 `cloneElement` + `unknown`-typed `props` cast and works for
  // any `ReactElement` trigger without forcing the caller to supply a
  // specific button type.
  // ---------------------------------------------------------------------
  const handleHomeOrgClick = useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      // The caller's trigger element may carry its own onClick (e.g. an
      // analytics ping or a dirty-state check). We don't try to extract
      // and chain it here because that requires casting `trigger.props`
      // through React 19's `unknown`-typed `props` field and the
      // ergonomics aren't worth it for a v1. Callers who need pre-click
      // analytics should wrap the trigger themselves; the dialog's job
      // is the post-click confirmation step.
      //
      // Short-circuit if a previous in-flight confirm is still pending —
      // protects against accidental double-clicks on home-org.
      if (pending) return;
      // Stop propagation so the parent's listeners don't double-fire
      // (e.g. a row click handler if the trigger is nested in a list row).
      event.preventDefault();
      event.stopPropagation();

      setPending(true);
      setError(null);
      try {
        await onConfirm();
      } catch (e) {
        // Home-org skip path: no dialog to surface the error in. We
        // RE-THROW so the caller's error boundary can handle it. The
        // operator decision (skip dialog) does NOT mean "swallow errors".
        setPending(false);
        throw e;
      }
      setPending(false);
    },
    [onConfirm, pending],
  );

  // ---------------------------------------------------------------------
  // Non-home dialog confirm branch.
  // ---------------------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      // Success — close the dialog. The next mount (open === false → true)
      // will re-initialise `pending` and `error` to false / null.
      setOpen(false);
      setPending(false);
    } catch (e) {
      // Surface the error inline; KEEP THE DIALOG OPEN. The user can
      // read the message, decide to retry or cancel. Closing on error
      // would silently swallow the failure — exactly the wrong outcome
      // for a destructive action.
      const message =
        e instanceof Error && e.message ? e.message : 'The action failed. Please try again.';
      setError(message);
      setPending(false);
    }
  }, [onConfirm, pending]);

  // Block close-while-pending. Radix invokes `onOpenChange(false)` when
  // the user clicks the overlay, presses Escape, or hits the X button.
  // Returning early swallows the close attempt without ceremony.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (pending) return;
      setOpen(next);
      // Reset error state when the dialog closes naturally — next open
      // starts fresh.
      if (!next) {
        setError(null);
      }
    },
    [pending],
  );

  // ---------------------------------------------------------------------
  // Home-org branch: render ONLY the trigger, with the click bypass wired.
  // No Dialog, no portal, no overlay.
  // ---------------------------------------------------------------------
  if (!isActingNonHome) {
    // Render the trigger as-is, wrapped in a `<span>` whose `onClick`
    // captures the click in the bubble phase and routes it through our
    // bypass handler. The span is `display: contents` so it adds zero
    // layout — the trigger renders exactly where it would without the
    // wrapper. This is simpler and more robust than `React.cloneElement`
    // (which would force us to cast through React 19's `unknown`-typed
    // `props` field).
    //
    // The trigger element itself keeps its own focus + keyboard
    // semantics — we only intercept the click event. Enter / Space on
    // the underlying button still reach the trigger (the button's
    // native click handler bubbles up to our span listener).
    return (
      <span
        onClick={handleHomeOrgClick}
        data-testid="app-confirm-destructive-trigger-home"
        // `display: contents` removes the span from layout while
        // preserving event delegation. The underlying trigger renders
        // exactly as if there were no wrapper.
        style={{ display: 'contents' }}
        // Block keyboard activation during pending so the user can't
        // accidentally retrigger an in-flight confirm by pressing Enter.
        // `aria-busy` signals the busy state to assistive tech.
        aria-busy={pending || undefined}
      >
        {trigger}
      </span>
    );
  }

  // ---------------------------------------------------------------------
  // Non-home dialog branch.
  // ---------------------------------------------------------------------
  // Compose the tenant-aware title. The literal phrase "confirming on" is
  // load-bearing — the test suite greps for it as the R-5 alignment
  // marker.
  const tenantTitle = `${title} — confirming on ${tenantLabel}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        variant="brand-destructive"
        data-testid="app-confirm-destructive-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="app-confirm-destructive-title">{tenantTitle}</DialogTitle>
          <DialogDescription data-testid="app-confirm-destructive-description">
            {/* Lead with the tenant identification — mirrors the
              * ActingAsBanner "Acting as: <name>" structure so the user
              * gets the same visual + textual mapping in both surfaces. */}
            <span className="block font-semibold text-brand-charcoal">
              You are acting on {tenantLabel}.
            </span>
            <span className="mt-2 block">{description}</span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          // Inline error surface. Lives inside the dialog body so it
          // appears between description + footer — directly above the
          // retry button. `role="alert"` + `aria-live="assertive"` so
          // screen readers announce the failure immediately.
          <div
            role="alert"
            aria-live="assertive"
            data-testid="app-confirm-destructive-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
            data-testid="app-confirm-destructive-cancel"
          >
            {resolvedCancelLabel}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={handleConfirm}
            data-testid="app-confirm-destructive-confirm"
          >
            {pending ? 'Working…' : resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Live `ConfirmDestructiveDialog` — consumes `useTenantContext`, resolves
 * the active tenant name from the memberships prop, and forwards to
 * `ConfirmDestructiveDialogPresentation`.
 *
 * Mount under any `/app/*` subtree wrapped by `<TenantProvider>` (which
 * `app/app/layout.tsx` already provides). The same `memberships` prop bag
 * is forwarded as for `TenantSwitcher` + `ActingAsBanner`.
 */
export function ConfirmDestructiveDialog({
  memberships,
  ...rest
}: ConfirmDestructiveDialogProps) {
  const { isActingNonHome, activeTenantId } = useTenantContext();

  // Resolve the active tenant name. Memoised so the lookup doesn't run on
  // every parent re-render — the membership list is stable from the
  // layout's server fetch.
  const activeTenantName = useMemo(() => {
    const active = memberships.find((m) => m.id === activeTenantId);
    return active?.name ?? '';
  }, [memberships, activeTenantId]);

  return (
    <ConfirmDestructiveDialogPresentation
      isActingNonHome={isActingNonHome}
      activeTenantId={activeTenantId}
      activeTenantName={activeTenantName}
      {...rest}
    />
  );
}
