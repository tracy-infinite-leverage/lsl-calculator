/**
 * Button.stories.tsx — Storybook coverage for the LSL brand Button
 *
 * E6.2 Task 2.6 (pattern-setting). Renders one story per BRAND variant
 * (primary, secondary, ghost, destructive, advisory) at the default size,
 * one size-comparison story, one disabled-state story, and one icon-in-
 * children story (consuming the `components/brand/Icon` barrel — proves the
 * leading-icon affordance works with the established gap-2 pattern, no new
 * prop required).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn variants (`default`, `outline`, `link`) are NOT story-covered
 * here — they exist solely to preserve the 14 active consumers on `main` and
 * are not part of the brand surface E6.2 ships. If a future PR adds brand
 * styling to those legacy names, add stories then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Calculator, ArrowRight, Download, Trash2 } from '@/components/brand/Icon';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Button. Extends the shadcn shadcn Button via `cva`',
          'with five brand variants per spec §5.1 — `primary`, `secondary`, `ghost`,',
          '`destructive`, `advisory`.',
          '',
          'Legacy shadcn variants (`default`, `outline`, `link`) are preserved for the',
          '14 active consumers on `main`; they are deliberately not story-covered here.',
          '',
          'Focus ring is `brand-navy` (6.33:1 against white) — meets WCAG 2.2 SC 1.4.11',
          'non-text UI contrast. Gold is reserved for "signal" per icon-direction.md §3',
          'and is NOT used as a focus indicator (gold against white is 2.26:1 — fails).',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive', 'advisory'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

// ---------------------------------------------------------------------------
// One story per brand variant (5)
// ---------------------------------------------------------------------------

/**
 * Primary — the brand CTA. Navy field, white type, dark-navy hover. Used for
 * the dominant action on any surface (e.g. "Calculate", "Generate PDF",
 * "Save changes").
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Calculate LSL',
  },
};

/**
 * Secondary — quieter affordance, navy hairline + white surface. Used as the
 * sibling of a primary CTA (e.g. "Cancel" next to "Save changes", "Back" next
 * to "Continue").
 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
    children: 'Cancel',
  },
};

/**
 * Ghost — text-only affordance for inline controls (icon-buttons in tables,
 * "Reset" inside a form, "Dismiss" inside a card). Hover surfaces a tinted
 * background to confirm interactivity.
 */
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    size: 'md',
    children: 'Reset',
  },
};

/**
 * Destructive — for irreversible actions (delete, remove, drop). Uses the
 * shadcn semantic `destructive` token rather than a new brand-red token (see
 * Button.tsx file header for rationale).
 */
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    size: 'md',
    children: 'Delete employee',
  },
};

/**
 * Advisory — for advisory / "consult an APA member" context per spec §5.1.
 * Mint background + dark-blue type. Text contrast is 4.51:1 — just clears AA
 * body-text. Use sparingly; advisory surfaces are meant to feel calm, not
 * loud.
 */
export const Advisory: Story = {
  args: {
    variant: 'advisory',
    size: 'md',
    children: 'Consult APA member',
  },
};

// ---------------------------------------------------------------------------
// Size comparison
// ---------------------------------------------------------------------------

/**
 * Size scale across the three brand sizes. `md` is the default and the alias
 * for legacy `default`. `sm` reads well inside dense tables; `lg` reads well
 * for the dominant CTA on a hero or empty-state.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button variant="primary" size="sm">
        Small
      </Button>
      <Button variant="primary" size="md">
        Medium
      </Button>
      <Button variant="primary" size="lg">
        Large
      </Button>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state across each brand variant. The root cva chain applies
 * `opacity-50` + `pointer-events-none`; brand variants do not add per-variant
 * disabled overrides. Spot-checked against icon-direction.md §3 — disabled
 * uses `text-brand-light-blue` for icons, but the root opacity-50 is the
 * established button affordance.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="primary" disabled>
        Primary
      </Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
      <Button variant="advisory" disabled>
        Advisory
      </Button>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Icon usage — the established gap-2 children pattern
// ---------------------------------------------------------------------------

/**
 * Buttons with icons. The cva root carries `gap-2` so consumers pass an
 * icon as a child alongside the label — no `leadingIcon` / `trailingIcon`
 * prop is needed. This matches the pattern used in all 14 existing
 * consumers on `main` and keeps the API surface small.
 *
 * Icons are imported from `@/components/brand/Icon` (the v1 Lucide barrel
 * per OQ-2). Direct `lucide-react` imports anywhere outside that barrel
 * are blocked by ESLint.
 */
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      <Button variant="primary" size="md">
        <Calculator className="h-4 w-4" aria-hidden />
        Calculate LSL
      </Button>
      <Button variant="primary" size="md">
        Generate PDF
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
      <Button variant="secondary" size="md">
        <Download className="h-4 w-4" aria-hidden />
        Download CSV
      </Button>
      <Button variant="destructive" size="md">
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete
      </Button>
    </div>
  ),
};
