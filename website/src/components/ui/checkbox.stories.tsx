/**
 * Checkbox.stories.tsx — Storybook coverage for the LSL brand Checkbox
 *
 * E6.2 Task 2.6.e. Renders default / checked / indeterminate states + size
 * grid + disabled grid + a labelled-row composition story showing the
 * label-extends-hit-area pattern (the existing call-site convention in
 * `single-mode-form.tsx` and `continuous-service-list.tsx`).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each Checkbox in a labelled context is wrapped in a `<label>` (or has an
 * `id` + matching `<label htmlFor>`) so axe-core's "form field must have a
 * label" rule is satisfied.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from './checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Checkbox. Single-axis `size` variant',
          '(`sm` | `md` | `lg` | `default`) — no `state` variant today',
          '(checkbox errors are rare; defer until a real consumer surfaces',
          'friction).',
          '',
          'Brand-navy border + brand-navy fill when checked or indeterminate.',
          'Focus ring is brand-navy (6.33:1 against white) — matches Button +',
          'Input + Select for design-system consistency.',
          '',
          'Re-skin note: all 12 existing `<Checkbox>` consumers WILL visibly',
          'change after this PR merges — border + checked fill move from shadcn',
          'primary (deeper oklch) to brand-navy. See HANDOFF.md for the per-',
          'consumer breakdown.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'default'],
    },
    disabled: { control: 'boolean' },
    checked: {
      control: 'select',
      options: [false, true, 'indeterminate'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

// ---------------------------------------------------------------------------
// Default state (unchecked)
// ---------------------------------------------------------------------------

/**
 * Default — unchecked, brand-navy border, transparent fill. The unchecked
 * state is the visible baseline for the 12 existing consumers.
 */
export const Default: Story = {
  render: (args) => (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
      <Checkbox {...args} />
      <span>I accept the terms of service</span>
    </label>
  ),
  args: {
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// Checked state
// ---------------------------------------------------------------------------

/**
 * Checked — brand-navy fill, brand-white check glyph. Triggered via the
 * `defaultChecked` Radix prop so it's controllable in Storybook.
 */
export const Checked: Story = {
  render: (args) => (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
      <Checkbox {...args} defaultChecked />
      <span>Include casual employees in calculation</span>
    </label>
  ),
  args: {
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// Indeterminate state
// ---------------------------------------------------------------------------

/**
 * Indeterminate — brand-navy fill, brand-white horizontal stroke (Minus
 * glyph). Used for "some-but-not-all" parent selections (e.g. an
 * "all employees" header checkbox over a table with mixed row selection).
 *
 * Radix expects the `checked` prop to be `"indeterminate"` (the literal
 * string). The Indicator slot picks the right glyph automatically via
 * `data-state="indeterminate"`.
 */
export const Indeterminate: Story = {
  render: (args) => (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
      <Checkbox {...args} checked="indeterminate" />
      <span>Select all rows (partial)</span>
    </label>
  ),
  args: {
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// Size comparison
// ---------------------------------------------------------------------------

/**
 * Size scale. `md` is the default and an alias for legacy `default`. `sm` for
 * dense tables, `lg` for hero forms or accessibility-priority surfaces.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox size="sm" defaultChecked />
        <span>Small (16×16) — dense tables</span>
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox size="md" defaultChecked />
        <span>Medium (20×20) — default, form rows</span>
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox size="lg" defaultChecked />
        <span>Large (24×24) — hero forms</span>
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`. The
 * box is still readable in all three positions (unchecked / checked /
 * indeterminate) — axe-core spot-checked navy/white at 6.33:1; 50% opacity
 * stays above 3:1 (large-text WCAG SC 1.4.3 floor).
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox disabled />
        <span>Disabled (unchecked)</span>
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox disabled defaultChecked />
        <span>Disabled (checked)</span>
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <Checkbox disabled checked="indeterminate" />
        <span>Disabled (indeterminate)</span>
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Labelled-row composition — extends the hit area beyond the box
// ---------------------------------------------------------------------------

/**
 * Labelled row. Per the existing call-site convention in `single-mode-form.tsx`
 * and `continuous-service-list.tsx`, the Checkbox is paired with a `<Label>`
 * (or wrapping `<label>`) whose text extends the clickable area. This is the
 * practical answer to WCAG SC 2.5.8 — the box itself is 16–24px but the row
 * is row-height tall, comfortably above any reasonable target-size threshold.
 *
 * Also demonstrates the htmlFor pattern (Checkbox carries an `id`, the Label
 * references it). This is the form-layer pattern existing consumers already
 * use; the Checkbox does NOT auto-pair with a Label internally.
 */
export const LabelledRow: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-72">
      <div className="flex items-start gap-2 rounded-md border border-brand-light-blue/40 p-3">
        <Checkbox id="row-paid-leave" defaultChecked />
        <label
          htmlFor="row-paid-leave"
          className="flex-1 cursor-pointer text-sm font-medium text-brand-charcoal"
        >
          Paid leave reduces continuous service
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Tick to deduct paid leave periods from the service total.
          </span>
        </label>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-brand-light-blue/40 p-3">
        <Checkbox id="row-unpaid-leave" />
        <label
          htmlFor="row-unpaid-leave"
          className="flex-1 cursor-pointer text-sm font-medium text-brand-charcoal"
        >
          Unpaid leave breaks continuous service
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Tick if an unpaid LWOP period resets continuity per state rules.
          </span>
        </label>
      </div>
    </div>
  ),
};
