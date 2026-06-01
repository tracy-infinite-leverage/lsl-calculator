/**
 * ConfirmDestructiveDialog.stories.tsx — Storybook coverage for the
 * tenant-aware destructive-action confirmation wrapper.
 *
 * E6.3 Task 3.5. Stories target `ConfirmDestructiveDialogPresentation` —
 * the pure-prop sibling — because Storybook can't run the
 * `useTenantContext` hook against a real `TenantProvider` tree (Storybook
 * has no Next.js server runtime, no cookie reader). The Presentation /
 * live split exposed by `ConfirmDestructiveDialog.tsx` makes this trivial.
 *
 * Stories exercise the two behaviour branches (`isActingNonHome === true`
 * → dialog opens with tenant-aware title; `false` → click bypasses the
 * dialog) plus the long-tenant-name truncation and the ID-fallback. axe
 * flips to `'error'` per the design-system convention — zero serious /
 * critical violations on any story per spec §8.2.
 *
 * The dialog is portaled out of the component subtree on open — so the
 * `defaultOpen` parameter on the `DialogContent` is NOT used here.
 * Instead, the "OpenDialog" story documents that the operator should
 * click the trigger to render the modal surface. axe-core scans the
 * trigger button on close + the modal content when the user opens it
 * during the story session (axe addon scans on UI interaction).
 *
 * For an automated "scan-modal-open" surface, the Dialog stories in
 * `components/ui/dialog.stories.tsx` already use `defaultOpen` against
 * the same `brand-destructive` variant — that coverage doesn't need to
 * be duplicated here.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConfirmDestructiveDialogPresentation } from './ConfirmDestructiveDialog';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof ConfirmDestructiveDialogPresentation> = {
  title: 'AppShell/ConfirmDestructiveDialog',
  component: ConfirmDestructiveDialogPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Wrapper for any destructive write action (delete employee, hard-reset mapping,',
          'delete saved valuation). Reads `isActingNonHome` from `TenantContext`:',
          '',
          '- **`isActingNonHome === true`** — opens a confirm dialog whose title and body',
          '  name the active client tenant. R-5 mitigation: zero mis-tenant write incidents.',
          '- **`isActingNonHome === false`** — SKIPS the dialog entirely. The click on the',
          '  trigger fires `onConfirm` directly. Operator decision recorded inline at task',
          '  kickoff per spec §5.2 + tasks.md G-8: same confirm friction on every home-org',
          '  destructive action is hostile UX. If a pilot user reports a near-miss in',
          '  home-org context, the home-org branch flips in one line.',
          '',
          'Stories render the pure-prop `ConfirmDestructiveDialogPresentation` so Storybook',
          'does not need a live `TenantProvider` mounted above.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmDestructiveDialogPresentation>;

// ---------------------------------------------------------------------------
// Sample data — re-used across stories.
// ---------------------------------------------------------------------------

const SAMPLE_TRIGGER = (
  <Button variant="destructive">Delete employee</Button>
);

const SAMPLE_DESCRIPTION =
  'This permanently removes Sarah Connor and all associated wage history. The audit log will retain the deletion record. This action cannot be undone.';

// ---------------------------------------------------------------------------
// Non-home (dialog-opening) stories.
// ---------------------------------------------------------------------------

export const ActingOnClient: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'client-1',
    activeTenantName: 'Bondi Bookkeeping',
    trigger: SAMPLE_TRIGGER,
    title: 'Delete employee',
    description: SAMPLE_DESCRIPTION,
    confirmLabel: 'Delete employee',
    onConfirm: () => {
      /* no-op in Storybook — log the click in the actions tab */
      console.log('[ConfirmDestructiveDialog] onConfirm fired');
    },
  },
  parameters: {
    docs: {
      description: {
        story: [
          'Standard non-home case: APA consultant has switched into a client tenant. Click',
          '`Delete employee` to open the modal. The title reads',
          '`Delete employee — confirming on Bondi Bookkeeping` and the body leads with',
          '`You are acting on Bondi Bookkeeping.` Click Cancel or hit Escape to close.',
        ].join(' '),
      },
    },
  },
};

export const LongTenantName: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'client-enterprise',
    activeTenantName:
      'Compliance Services for Enterprise Payroll Australia (Holdings) Pty Ltd',
    trigger: SAMPLE_TRIGGER,
    title: 'Delete employee',
    description: SAMPLE_DESCRIPTION,
    confirmLabel: 'Delete employee',
    onConfirm: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'Enterprise tenant name flows through the title verbatim — the dialog content max-width handles wrapping. The leading sentence in the body still names the tenant unambiguously.',
      },
    },
  },
};

export const FallbackToId: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'a4b2-client-id-xyz',
    activeTenantName: '',
    trigger: SAMPLE_TRIGGER,
    title: 'Delete employee',
    description: SAMPLE_DESCRIPTION,
    confirmLabel: 'Delete employee',
    onConfirm: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: [
          "If the tenant name lookup fails (e.g. memberships fetch races the cookie), the",
          'dialog falls back to the bare tenant ID — ugly but unmissable. Matches the',
          "ActingAsBanner's fall-back-to-ID safety net. Better than an empty",
          '`confirming on ` suffix.',
        ].join(' '),
      },
    },
  },
};

export const HardResetMapping: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'client-1',
    activeTenantName: 'Bondi Bookkeeping',
    trigger: <Button variant="destructive">Hard-reset mapping</Button>,
    title: 'Hard-reset pay-code mapping',
    description:
      'Every existing pay-code-to-LSL classification on this tenant will be cleared. All future valuations on this tenant will recompute from scratch. This action cannot be undone.',
    confirmLabel: 'Reset mapping',
    onConfirm: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'A different destructive action with a long-form description. Demonstrates that the body copy is caller-controlled and the title/confirmLabel can diverge (the title is a verb phrase; the button label is a shorter imperative).',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Home-org skip branch.
// ---------------------------------------------------------------------------

export const HomeOrgSkipsDialog: Story = {
  args: {
    isActingNonHome: false,
    activeTenantId: 'home',
    activeTenantName: 'Acme Pty Ltd',
    trigger: SAMPLE_TRIGGER,
    title: 'Delete employee',
    description: SAMPLE_DESCRIPTION,
    confirmLabel: 'Delete employee',
    onConfirm: () => {
      console.log('[ConfirmDestructiveDialog] home-org bypass — onConfirm fired directly');
    },
  },
  parameters: {
    docs: {
      description: {
        story: [
          'Operator-locked behaviour for home-org context. Clicking `Delete employee`',
          'fires `onConfirm` IMMEDIATELY — no dialog renders. The transparent',
          '`<span display:contents>` wrapper intercepts the click and routes through the',
          'bypass handler. Per spec §5.2 + tasks.md G-8: only the non-home-tenant path',
          'MANDATES the confirm dialog; same confirm friction on home org is hostile UX.',
          '',
          'Click the trigger and check the browser console — `onConfirm fired directly`',
          'logs without any dialog mounting.',
        ].join(' '),
      },
    },
  },
};
