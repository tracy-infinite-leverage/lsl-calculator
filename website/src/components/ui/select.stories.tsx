/**
 * Select.stories.tsx — Storybook coverage for the LSL brand Select
 *
 * E6.2 Task 2.6.d. Renders one story per `state` (Default / Filled /
 * WithError) plus a sizes grid, disabled grid, and a long-list story to
 * exercise the popover scroll. The cva surface is on the Trigger only; the
 * Content + Item brand styling is fixed (no variants).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each Select is wrapped in a `<label>` so axe-core's "form field must have a
 * label" rule is satisfied. We use `<label htmlFor>` paired with `id` on the
 * SelectTrigger (matches the existing call-site pattern in `single-mode-form.tsx`).
 *
 * Note on a11y scanning: the popover Content renders into a Radix Portal and
 * is conditionally mounted (only when open). The default closed-state stories
 * therefore scan the trigger only. The `Open` story below forces the popover
 * open with `defaultOpen` so axe-core can scan Content + Item markup too.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

const meta: Meta<typeof SelectTrigger> = {
  title: 'UI/Select',
  component: SelectTrigger,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Select. Mirrors the Input API on the',
          'Trigger: `state` (`default` | `error`) and `size` (`sm` | `md` |',
          '`lg` | `default`). Content and Item are fixed-brand (no variants',
          'yet — add when a real consumer surfaces friction).',
          '',
          'Trigger LOOKS like an Input: same border colour, focus ring, and',
          'placeholder colour. When a form mixes Inputs and Selects (e.g.',
          'single-mode-form.tsx) the eye groups them as one field family.',
          '',
          'Re-skin note: all 9 existing `<SelectTrigger>` consumers WILL visibly',
          'change after this PR merges — border → brand-light-blue, focus →',
          'brand-navy, popover → brand-white with brand-light-blue hairline.',
          'See HANDOFF.md for the per-consumer breakdown.',
        ].join('\n'),
      },
    },
    layout: 'centered',
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

type Story = StoryObj<typeof SelectTrigger>;

// Shared option set — frequency options used in real consumers
// (wage-history-upload.tsx pattern).
const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

/**
 * Default — the brand baseline. Light-blue border, navy focus ring, brand-grey
 * placeholder, charcoal text. Matches Input's default visually.
 */
export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="default-trigger"
        className="text-sm font-medium text-brand-charcoal"
      >
        Pay frequency
      </label>
      <Select>
        <SelectTrigger id="default-trigger">
          <SelectValue placeholder="Select frequency…" />
        </SelectTrigger>
        <SelectContent>
          {frequencyOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

/**
 * Filled — Select with a `defaultValue` set, so a11y scanning covers the
 * non-placeholder rendering path. The trigger now shows the selected label
 * (`text-brand-charcoal`) rather than the placeholder (`text-brand-grey`).
 */
export const Filled: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="filled-trigger"
        className="text-sm font-medium text-brand-charcoal"
      >
        Pay frequency
      </label>
      <Select defaultValue="fortnightly">
        <SelectTrigger id="filled-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {frequencyOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

/**
 * Error — red trigger border + red focus ring, paired with `aria-invalid` and
 * a visible error message rendered by the form layer.
 *
 * WCAG SC 1.4.1: error MUST NOT be conveyed by colour alone. The combination
 * of red border + aria-invalid + visible error text satisfies the rule.
 */
export const WithError: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="error-trigger"
        className="text-sm font-medium text-brand-charcoal"
      >
        Pay frequency
      </label>
      <Select>
        <SelectTrigger
          id="error-trigger"
          state="error"
          aria-invalid="true"
          aria-describedby="frequency-error"
        >
          <SelectValue placeholder="Select frequency…" />
        </SelectTrigger>
        <SelectContent>
          {frequencyOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span id="frequency-error" className="text-sm text-destructive">
        Pay frequency is required.
      </span>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Size comparison
// ---------------------------------------------------------------------------

/**
 * Size scale. `md` is the default and an alias for legacy `default`. Heights
 * align exactly with Input so a Select trigger and an Input side-by-side share
 * the same baseline.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="size-sm"
          className="text-sm font-medium text-brand-charcoal"
        >
          Small
        </label>
        <Select>
          <SelectTrigger id="size-sm" size="sm">
            <SelectValue placeholder="Small trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">Option one</SelectItem>
            <SelectItem value="two">Option two</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="size-md"
          className="text-sm font-medium text-brand-charcoal"
        >
          Medium (default)
        </label>
        <Select>
          <SelectTrigger id="size-md" size="md">
            <SelectValue placeholder="Medium trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">Option one</SelectItem>
            <SelectItem value="two">Option two</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="size-lg"
          className="text-sm font-medium text-brand-charcoal"
        >
          Large
        </label>
        <Select>
          <SelectTrigger id="size-lg" size="lg">
            <SelectValue placeholder="Large trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">Option one</SelectItem>
            <SelectItem value="two">Option two</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="disabled-default"
          className="text-sm font-medium text-brand-charcoal"
        >
          Disabled (default state)
        </label>
        <Select disabled defaultValue="fortnightly">
          <SelectTrigger id="disabled-default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {frequencyOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="disabled-error"
          className="text-sm font-medium text-brand-charcoal"
        >
          Disabled (error state)
        </label>
        <Select disabled>
          <SelectTrigger
            id="disabled-error"
            state="error"
            aria-invalid="true"
          >
            <SelectValue placeholder="Locked invalid state" />
          </SelectTrigger>
          <SelectContent>
            {frequencyOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Open popover — forces the Content + Item markup into the DOM for a11y scan
// ---------------------------------------------------------------------------

/**
 * Open — uses Radix's `defaultOpen` to mount the Content + Item popover on
 * initial render. This exists so axe-core has a chance to scan Item rendering
 * (default closed-state stories scan the trigger only because Radix lazy-
 * mounts the Portal).
 *
 * One option is pre-selected (`defaultValue="fortnightly"`) so the indicator
 * Check is visible in the rendered markup.
 */
export const Open: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="open-trigger"
        className="text-sm font-medium text-brand-charcoal"
      >
        Pay frequency
      </label>
      <Select defaultOpen defaultValue="fortnightly">
        <SelectTrigger id="open-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {frequencyOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
  parameters: {
    // The open popover renders into a Portal; centring the trigger only would
    // leave the popover positioned awkwardly in Storybook's preview iframe.
    // Switch to padded layout so there's room above + below the trigger.
    layout: 'padded',
  },
};
