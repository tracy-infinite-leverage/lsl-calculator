/**
 * Dialog.stories.tsx — Storybook coverage for the LSL brand Dialog
 *
 * E6.2 Task 2.6.l. Renders one story per BRAND variant (brand,
 * brand-destructive) plus a "default-open" story so the axe-core addon
 * scans the open dialog surface (modal content is portaled out of the
 * component subtree — without `defaultOpen` axe would only see the trigger
 * button).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Focus management is handled by Radix UI:
 *   - On open: focus moves to the first focusable descendant
 *     (Cancel button by default), and a focus trap is installed.
 *   - Tab / Shift+Tab cycle within the dialog only.
 *   - Escape closes the dialog and restores focus to the trigger.
 *
 * The interactive stories below exercise these contracts manually via the
 * Storybook UI; an automated focus-trap test will land alongside the
 * Playwright a11y sweep (Task 2.8).
 *
 * Legacy shadcn `default` variant is NOT story-covered here — it exists
 * solely to preserve the two existing modal consumers
 * (`unblock-jurisdiction-modal.tsx`, `classifier-confirm-modal.tsx`). If a
 * future PR adds brand styling to the default name, add a story then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './dialog';
import { Button } from './button';

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Dialog. Extends the shadcn / Radix Dialog',
          'via `cva` on the `DialogContent` shell. Two brand variants per spec',
          '§5.1 — `brand` (default brand dialog) and `brand-destructive` (for',
          'irreversible actions like delete-employee or hard-reset).',
          '',
          'Radix accessibility contracts preserved:',
          '  - Focus trap installed on open',
          '  - First focusable descendant focused automatically',
          '  - Tab / Shift+Tab cycle within the dialog',
          '  - Escape closes; focus restores to the trigger',
          '  - `aria-modal="true"` set by Radix',
          '',
          'Overlay tint stays at `bg-black/60` independent of variant — the',
          'overlay is an attention affordance, not a brand surface.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Dialog>;

// ---------------------------------------------------------------------------
// brand — interactive
// ---------------------------------------------------------------------------

/**
 * Interactive brand dialog. Click the trigger to open; Tab to traverse;
 * Escape to close. Focus returns to the trigger on close.
 */
export const Brand: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Confirm calculation</Button>
      </DialogTrigger>
      <DialogContent variant="brand">
        <DialogHeader>
          <DialogTitle>Confirm long service leave calculation</DialogTitle>
          <DialogDescription>
            Adam Smith · NSW · 9.27 weeks at $1,068 weekly = $9,900.36. This
            will be saved to the employee record and the audit log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="primary">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// ---------------------------------------------------------------------------
// brand — default-open (axe-core surface coverage)
// ---------------------------------------------------------------------------

/**
 * Renders the brand dialog open by default so the Storybook axe-core addon
 * scans the modal content. Without `defaultOpen` the addon only sees the
 * trigger button — modal content is portaled to `document.body` outside
 * the component subtree.
 *
 * This story also exercises the focus trap visually: every focusable
 * element inside the dialog (Cancel / Confirm) is reachable; Tab from the
 * Confirm button wraps back to Cancel.
 */
export const BrandDefaultOpen: Story = {
  parameters: {
    // The portaled dialog renders to `document.body`, so the story panel
    // mostly shows the overlay. Disable the `layout: 'centered'` here so
    // axe scans the full viewport (overlay + content).
    layout: 'fullscreen',
  },
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="primary">Confirm calculation</Button>
      </DialogTrigger>
      <DialogContent variant="brand">
        <DialogHeader>
          <DialogTitle>Confirm long service leave calculation</DialogTitle>
          <DialogDescription>
            Adam Smith · NSW · 9.27 weeks at $1,068 weekly = $9,900.36. This
            will be saved to the employee record and the audit log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="primary">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// ---------------------------------------------------------------------------
// brand-destructive — interactive
// ---------------------------------------------------------------------------

/**
 * Destructive dialog with red-tinted hairline. Used for irreversible
 * actions — delete employee, hard-reset mapping, drop saved valuation.
 *
 * The Confirm button uses Button's `destructive` variant to reinforce the
 * intent at the action surface; the dialog shell only adds the visual
 * cue at the surrounding container.
 */
export const BrandDestructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete employee</Button>
      </DialogTrigger>
      <DialogContent variant="brand-destructive">
        <DialogHeader>
          <DialogTitle>Delete employee — Adam Smith?</DialogTitle>
          <DialogDescription>
            This permanently removes Adam Smith and all associated wage
            history. The audit log will retain the deletion record. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Delete employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// ---------------------------------------------------------------------------
// brand-destructive — default-open (axe-core surface coverage)
// ---------------------------------------------------------------------------

export const BrandDestructiveDefaultOpen: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete employee</Button>
      </DialogTrigger>
      <DialogContent variant="brand-destructive">
        <DialogHeader>
          <DialogTitle>Delete employee — Adam Smith?</DialogTitle>
          <DialogDescription>
            This permanently removes Adam Smith and all associated wage
            history. The audit log will retain the deletion record. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Delete employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
