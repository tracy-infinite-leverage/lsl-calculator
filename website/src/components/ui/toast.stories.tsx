'use client';

/**
 * Toast.stories.tsx — Storybook coverage for the LSL brand Toast (Sonner)
 *
 * E6.2 Task 2.6.p (wave 2). Sonner-backed brand wrapper. The
 * `<Toaster />` mounts inside each story so the rendered toast surface
 * is scannable by axe-core; consumers in production mount `<Toaster />`
 * exactly once in the app shell.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'`
 * flips the addon from preview-level `'todo'` to fail-on-violation.
 * Zero serious / critical violations on any story per spec §8.2.
 *
 * Accessibility contracts preserved by Sonner (verifiable in Storybook):
 *   - Toast region wears `aria-live="polite"` so screen readers announce
 *     the content as it arrives (or `role="alert"` for the error variant).
 *   - Close button is keyboard-reachable; Enter / Space dismisses.
 *   - `prefers-reduced-motion` strips entrance / exit animations
 *     (toggle in Storybook's a11y panel → emulate reduced motion).
 *   - Queue: visibleToasts=3; new toasts beyond the cap stack — hover the
 *     stack to expand. FIFO order.
 *
 * The `<Toaster />` is positioned `top-right` in stories so the toast
 * shows up adjacent to the trigger button instead of off-screen at the
 * default `bottom-right`. Production callers can override per-mount.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import * as React from 'react';
import { Button } from './button';
import { Toaster, toast } from './toast';

const meta: Meta = {
  title: 'UI/Toast',
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Toast — Sonner-backed wrapper.',
          '',
          'shadcn deprecated their original Toast primitive and now recommends',
          'Sonner. Operator confirmed the adoption on 2026-05-30. The wrapper',
          'at `src/components/ui/toast.tsx` carries the brand styling and a',
          'thin call-site API (`toast.success`, `toast.error`, `toast.info`,',
          '`toast.brand`).',
          '',
          '**Mount once** — `<Toaster />` lives in the app shell (e.g.',
          '`app/layout.tsx`). Per-call positioning, duration, action buttons',
          'are configured at the call site via the standard Sonner `toast()`',
          'options.',
          '',
          'Accessibility (spec §5.5):',
          '  - `aria-live="polite"` on the toast region (error variant uses',
          '    `role="alert"` for higher urgency).',
          '  - Keyboard dismissal via the close button (Tab → Enter / Space).',
          '  - `prefers-reduced-motion` strips animations — toggle in the',
          '    Storybook a11y panel to verify.',
          '',
          'Queue behaviour: visibleToasts=3, FIFO. Toasts beyond the cap stack',
          'and expand on hover.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Default — neutral brand toast
// ---------------------------------------------------------------------------

/**
 * Plain `toast()` call. Brand-white surface, brand-charcoal text, quiet
 * hairline. Used for neutral acknowledgement (e.g. "Copied to clipboard").
 */
export const Default: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-brand-grey">
        Trigger the toast — it appears top-right of the canvas.
      </p>
      <Button
        variant="primary"
        onClick={() =>
          toast('Saved to drafts', {
            description: 'You can return to this calculation later.',
          })
        }
      >
        Show default toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Success — green accent border
// ---------------------------------------------------------------------------

export const Success: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="primary"
        onClick={() =>
          toast.success('Calculation saved', {
            description:
              "NSW · 9.27 weeks · $9,900.36 saved to Adam Smith's record.",
          })
        }
      >
        Show success toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Error — destructive accent border
// ---------------------------------------------------------------------------

export const Error: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="destructive"
        onClick={() =>
          toast.error('Could not save calculation', {
            description: 'Network error. Try again, or save offline.',
          })
        }
      >
        Show error toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Info — navy accent border
// ---------------------------------------------------------------------------

export const Info: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="secondary"
        onClick={() =>
          toast.info('Methodology version 2.3', {
            description: 'State engines refreshed at 2026-05-30 09:00 AEDT.',
          })
        }
      >
        Show info toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Warning — amber accent border
// ---------------------------------------------------------------------------

export const Warning: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="secondary"
        onClick={() =>
          toast.warning('Acting as a non-home tenant', {
            description: 'Switch back to your home org before bulk actions.',
          })
        }
      >
        Show warning toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Brand — high-emphasis navy surface
// ---------------------------------------------------------------------------

/**
 * Brand-emphasis tone — navy surface, white type. Used for platform-level
 * announcements where the toast itself is the brand surface, not a neutral
 * status message.
 */
export const Brand: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="primary"
        onClick={() =>
          toast.brand('Welcome to LSL Calculator by APA', {
            description:
              'Run a single calc on the public page, or sign in for bulk + reports.',
          })
        }
      >
        Show brand toast
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Action — toast with an action button
// ---------------------------------------------------------------------------

/**
 * Toasts can carry an action button — wired through Sonner's `action`
 * option. The action button uses the brand-navy `actionButton` class from
 * the Toaster mount.
 */
export const WithAction: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="primary"
        onClick={() =>
          toast('Calculation moved to archive', {
            description: 'Adam Smith · 2026-05-30.',
            action: {
              label: 'Undo',
              onClick: () => toast.success('Restored'),
            },
          })
        }
      >
        Show toast with action
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Queue — multiple toasts demonstrate FIFO + stack behaviour
// ---------------------------------------------------------------------------

/**
 * Click rapidly — visibleToasts=3 caps the visible region; toasts beyond
 * stack and expand on hover. Demonstrates queue + dismissal contract.
 */
export const Queue: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="primary"
        onClick={() => {
          toast('First toast');
          setTimeout(() => toast.info('Second toast'), 300);
          setTimeout(() => toast.success('Third toast'), 600);
          setTimeout(() => toast.warning('Fourth toast — stacks under'), 900);
        }}
      >
        Show 4 toasts (cap is 3)
      </Button>
      <Toaster position="top-right" />
    </div>
  ),
};
