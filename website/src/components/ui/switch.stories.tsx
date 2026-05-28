/**
 * Switch.stories.tsx — Storybook coverage for the LSL brand Switch
 *
 * E6.2 Task 2.6.g. Renders default / on / size grid / disabled grid + a
 * labelled-row composition story.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each `<Switch>` in a labelled context carries an `id` paired with a
 * `<label htmlFor>` so axe-core's "form field must have a label" rule is
 * satisfied.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Switch. Single-axis `size` variant',
          '(`sm` | `md` | `lg` | `default`) — no `state` variant (binary by',
          'definition; errors are surfaced by surrounding form text).',
          '',
          'Off-state track: brand-light-blue + brand-charcoal/40 border (the',
          'border supplies the 3:1 non-text contrast bounding edge per WCAG',
          'SC 1.4.11). On-state track: brand-navy. Thumb: brand-white. Focus',
          'ring: brand-navy (6.33:1 against white) — matches Button + Input',
          '+ Select + Checkbox + Radio.',
          '',
          'First-shipped surface — zero existing consumers on `main`. No',
          're-skin enumeration needed.',
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
    checked: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof Switch>;

// ---------------------------------------------------------------------------
// Default (off)
// ---------------------------------------------------------------------------

/**
 * Default — off. Brand-light-blue track, brand-white thumb, bounding border.
 */
export const Default: Story = {
  render: (args) => (
    <label className="inline-flex items-center gap-3 text-sm font-medium text-brand-charcoal">
      <Switch {...args} id="story-default" />
      <span>Notify me about new state engines</span>
    </label>
  ),
  args: {
    size: 'md',
  },
};

// ---------------------------------------------------------------------------
// On
// ---------------------------------------------------------------------------

/**
 * On — brand-navy track, thumb translated to the right. Triggered via Radix's
 * `defaultChecked` prop so the visual is stable across renders.
 */
export const On: Story = {
  render: (args) => (
    <label className="inline-flex items-center gap-3 text-sm font-medium text-brand-charcoal">
      <Switch {...args} id="story-on" defaultChecked />
      <span>Show advanced override controls</span>
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
 * Size scale. `md` is the default and an alias for `default`. `sm` for dense
 * settings / table cells, `lg` for hero forms or accessibility-priority
 * surfaces. Each size shown in both off and on states.
 */
export const Sizes: Story = {
  render: () => (
    <div className="grid grid-cols-[max-content_max-content_max-content] items-center gap-x-6 gap-y-3 text-sm text-brand-charcoal">
      <span className="font-medium">Small (16×32)</span>
      <Switch size="sm" id="size-sm-off" />
      <Switch size="sm" id="size-sm-on" defaultChecked />

      <span className="font-medium">Medium (24×44)</span>
      <Switch size="md" id="size-md-off" />
      <Switch size="md" id="size-md-on" defaultChecked />

      <span className="font-medium">Large (28×56)</span>
      <Switch size="lg" id="size-lg-off" />
      <Switch size="lg" id="size-lg-on" defaultChecked />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`.
 * Both off and on positions stay legible.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="inline-flex items-center gap-3 text-sm font-medium text-brand-charcoal">
        <Switch disabled id="disabled-off" />
        <span>Disabled (off)</span>
      </label>
      <label className="inline-flex items-center gap-3 text-sm font-medium text-brand-charcoal">
        <Switch disabled defaultChecked id="disabled-on" />
        <span>Disabled (on)</span>
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Labelled row composition
// ---------------------------------------------------------------------------

/**
 * Labelled row — settings-style row with title + description on the left and
 * the Switch flush-right. The full row is the click target via
 * `<label htmlFor>`.
 */
export const LabelledRow: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-96">
      <label
        htmlFor="row-notify"
        className="flex items-center justify-between gap-4 cursor-pointer rounded-md border border-brand-light-blue/40 p-4"
      >
        <span className="flex-1">
          <span className="block text-sm font-medium text-brand-charcoal">
            Email notifications
          </span>
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Receive a digest when a new state engine ships.
          </span>
        </span>
        <Switch id="row-notify" defaultChecked />
      </label>
      <label
        htmlFor="row-advanced"
        className="flex items-center justify-between gap-4 cursor-pointer rounded-md border border-brand-light-blue/40 p-4"
      >
        <span className="flex-1">
          <span className="block text-sm font-medium text-brand-charcoal">
            Show advanced overrides
          </span>
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Surfaces operator-only NT engine flags on the single-mode form.
          </span>
        </span>
        <Switch id="row-advanced" />
      </label>
    </div>
  ),
};
