/**
 * keyboard-shortcuts.stories.tsx — Storybook coverage for the global
 * shortcut overlay.
 *
 * E6.3 Task 3.9. Stories target `KeyboardShortcutsOverlayPresentation` —
 * the pure-prop sibling — because the live `KeyboardShortcuts` wrapper
 * attaches a `window` keydown listener via `useEffect` and reads
 * `useRouter()` from Next.js. Storybook has no Next router runtime, and
 * a global keydown listener would interfere with the addon panels.
 *
 * Coverage strategy:
 *
 *   - `Closed`         — overlay closed; verifies the markup doesn't
 *                        render outside the portal when `open={false}`.
 *   - `Open`           — overlay open via `defaultOpen` (controlled via
 *                        `args.open`); axe scans the modal content.
 *   - `OpenForA11yScan`— same as Open but with axe configured to flag
 *                        violations as errors per spec §8.2.
 *
 * axe flips to `'error'` per design-system convention; zero serious /
 * critical violations on any story.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { KeyboardShortcutsOverlayPresentation } from './keyboard-shortcuts';

const meta: Meta<typeof KeyboardShortcutsOverlayPresentation> = {
  title: 'Lib/KeyboardShortcuts',
  component: KeyboardShortcutsOverlayPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'The `?` overlay for `/app/*` keyboard shortcuts.',
          '',
          'Spec §5.2 + §8.3 + OQ-8: shortcuts are always-on in v1.',
          'The overlay lists every navigation sequence (`g e`, `g v`, etc.)',
          'plus the `?` self-reference. Mounted by the live wrapper at the',
          'workspace layout level — see `app/app/layout.tsx`.',
          '',
          'Stories render the pure-prop presentation so Storybook does not',
          'need a Next router runtime. The live wrapper composes this with',
          'a global `keydown` listener + `useState` for the open state; see',
          '`keyboard-shortcuts.tsx` for the wiring.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the overlay is open. Drives the Dialog open prop.',
    },
    onOpenChange: {
      action: 'onOpenChange',
      description:
        'Fired when Radix wants to change the open state (Escape, overlay click, X).',
    },
  },
};

export default meta;

type Story = StoryObj<typeof KeyboardShortcutsOverlayPresentation>;

// ---------------------------------------------------------------------------
// Closed (default) — the overlay is mounted but not visible.
// ---------------------------------------------------------------------------

export const Closed: Story = {
  args: {
    open: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default state — overlay is closed. Radix renders nothing in the portal until `open={true}`.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Open — the overlay is visible with the full shortcut list.
// ---------------------------------------------------------------------------

export const Open: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story: [
          'Overlay open with the full shortcut list:',
          '',
          '- `g e` → Employees',
          '- `g h` → Pay history',
          '- `g l` → Liability',
          '- `g p` → Pay codes',
          '- `g r` → Reconciliation',
          '- `g s` → Settings',
          '- `g v` → Valuations',
          '- `?` → Show this overlay (self-reference)',
        ].join('\n'),
      },
    },
  },
};

// ---------------------------------------------------------------------------
// OpenForA11yScan — explicit a11y story with axe set to error level.
// Spec §8.2: zero serious / critical violations on any story.
// ---------------------------------------------------------------------------

export const OpenForA11yScan: Story = {
  args: {
    open: true,
  },
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: {
        story:
          'Same as Open but explicitly tagged for axe-core scanning. The overlay must register zero serious or critical violations per spec §8.2.',
      },
    },
  },
};
