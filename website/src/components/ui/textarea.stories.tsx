/**
 * Textarea.stories.tsx — Storybook coverage for the LSL brand Textarea
 *
 * E6.2 Task 2.6.c. Renders one story per `state` plus a sizes grid, disabled
 * grid, and a leading-icon composition story. The composition story proves
 * the icon-affix pattern can be implemented at the call site without a render
 * prop on Textarea itself (Cascade Decision #5 — see textarea.tsx file header).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each form-field story is wrapped in a `<label>` so axe-core's "form field
 * must have a label" rule is satisfied.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from './textarea';
import { FileWarning } from '@/components/brand/Icon';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Textarea. Mirrors the Input API exactly:',
          'a two-axis variant API of `state` (`default` | `error`) and `size`',
          '(`sm` | `md` | `lg` | `default`). No named visual variants — form',
          'fields read best when they recede; brand identity comes from focus +',
          'error states.',
          '',
          'Focus ring is `brand-navy` (6.33:1 against white) — matches Button +',
          'Input for design-system consistency. Error state uses the shadcn',
          '`destructive` token family (single red across the system). Consumers',
          'MUST pair `state="error"` with `aria-invalid="true"` per WCAG SC 1.4.1.',
          '',
          'No existing `<Textarea>` consumers on main — this is a new surface.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'error'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'default'],
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Textarea>;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

/**
 * Default — the brand baseline. Light-blue border, navy focus ring, brand-grey
 * placeholder, charcoal text. Matches Input's default visually so the eye
 * groups form fields together.
 */
export const Default: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Calculation notes</span>
      <Textarea {...args} placeholder="Add any context for this calculation…" />
    </label>
  ),
  args: {
    state: 'default',
    size: 'md',
  },
};

/**
 * Filled — same default state with populated content, so a11y scanning
 * covers the non-placeholder rendering path. Text contrast: brand-charcoal on
 * white is ~14.6:1, well above AA body.
 */
export const Filled: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Calculation notes</span>
      <Textarea
        {...args}
        defaultValue={
          'Employee returned from parental leave on 2024-03-12. Continuous service preserved per Fair Work s 67 — confirmed with payroll.'
        }
      />
    </label>
  ),
  args: {
    state: 'default',
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

/**
 * Error — red border, red focus ring, paired with `aria-invalid="true"` and a
 * visible error message rendered by the form layer (Textarea itself does NOT
 * render the error string — same separation-of-concerns as Input).
 *
 * WCAG SC 1.4.1: error MUST NOT be conveyed by colour alone. The combination
 * of red border + aria-invalid + visible error text satisfies the rule.
 */
export const WithError: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Calculation notes</span>
      <Textarea
        {...args}
        defaultValue=""
        aria-invalid="true"
        aria-describedby="notes-error"
      />
      <span id="notes-error" className="text-sm text-destructive">
        Notes are required when claiming a leave-without-pay deduction.
      </span>
    </label>
  ),
  args: {
    state: 'error',
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// Size comparison
// ---------------------------------------------------------------------------

/**
 * Size scale across the three brand sizes. `md` is the default and an alias
 * for legacy `default`. `sm` keeps the shadcn baseline 80px min-height —
 * dense surfaces / table cells. `lg` 120px for hero forms or long-form notes.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Small</span>
        <Textarea size="sm" placeholder="Small textarea (80px min-height)" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Medium (default)</span>
        <Textarea size="md" placeholder="Medium textarea (96px min-height)" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Large</span>
        <Textarea size="lg" placeholder="Large textarea (120px min-height)" />
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`. No
 * per-state disabled override — same restraint as Input.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Disabled (default state)</span>
        <Textarea disabled defaultValue="Read-only notes from a prior session." />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Disabled (error state)</span>
        <Textarea
          disabled
          state="error"
          defaultValue="Locked invalid value."
          aria-invalid="true"
        />
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Icon composition — the call-site pattern (NO render prop on Textarea)
// ---------------------------------------------------------------------------

/**
 * Leading-icon composition. Per Cascade Decision #5, Textarea does NOT expose
 * a `leadingIcon` / `trailingIcon` prop. When a consumer needs an icon affix
 * (e.g. a warning icon inside a textarea per icon-direction.md §3), they
 * layer it at the call site with a relative wrapper + absolutely-positioned
 * icon + extra padding on the Textarea.
 *
 * For a textarea the icon sits at the top-left (not vertically centred) — a
 * multi-line control means "centre" reads ambiguously.
 *
 * Icons are imported from `@/components/brand/Icon` (the v1 Lucide barrel per
 * OQ-2). Direct `lucide-react` imports outside that barrel are blocked.
 */
export const WithLeadingIcon: Story = {
  render: () => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Reason for adjustment</span>
      <div className="relative">
        <FileWarning
          aria-hidden
          className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-brand-navy/60"
        />
        <Textarea
          placeholder="Explain the manual override applied to this row…"
          className="pl-9"
        />
      </div>
    </label>
  ),
};
