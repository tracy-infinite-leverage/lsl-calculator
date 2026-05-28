/**
 * RadioGroup.stories.tsx — Storybook coverage for the LSL brand RadioGroup
 *
 * E6.2 Task 2.6.f. Renders default / checked-by-default states + size grid +
 * disabled grid + a labelled-row composition story showing the
 * label-extends-hit-area pattern (matches the existing call-site convention
 * in `single-mode-form.tsx`).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each `<RadioGroupItem>` in a labelled context is paired with a `<label>` or
 * `<Label htmlFor>` so axe-core's "form field must have a label" rule is
 * satisfied.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RadioGroup, RadioGroupItem } from './radio-group';

const meta: Meta<typeof RadioGroup> = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand RadioGroup. Single-axis `size` variant on',
          'the **Item** (`sm` | `md` | `lg` | `default`) — no `state` variant',
          'today (radio errors are rare; defer until a real consumer surfaces',
          'friction).',
          '',
          'Brand-navy border + brand-navy filled circle indicator when',
          'checked. Focus ring is brand-navy (6.33:1 against white) — matches',
          'Button + Input + Select + Checkbox for design-system consistency.',
          '',
          'Re-skin note: all 11 existing `<RadioGroupItem>` consumers in',
          '`single-mode-form.tsx` (NT engine override controls) WILL visibly',
          'change after this PR merges — border + checked indicator move from',
          'shadcn primary (deeper oklch) to brand-navy. See HANDOFF.md for',
          'the per-consumer breakdown.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

// ---------------------------------------------------------------------------
// Default state (3-option group, no default selection)
// ---------------------------------------------------------------------------

/**
 * Default — three options, no preselection. Brand-navy border, transparent
 * fill. Mirrors the NT engine override pattern in `single-mode-form.tsx`
 * (auto / true / false).
 */
export const Default: Story = {
  render: () => (
    <RadioGroup className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="auto" id="story-default-auto" />
        Auto (permissive default)
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="true" id="story-default-true" />
        Yes (operator override)
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="false" id="story-default-false" />
        No (operator override)
      </label>
    </RadioGroup>
  ),
};

// ---------------------------------------------------------------------------
// Pre-selected state
// ---------------------------------------------------------------------------

/**
 * Pre-selected — `defaultValue="auto"` lights the Auto row with a brand-navy
 * filled indicator. Demonstrates the checked visual.
 */
export const PreSelected: Story = {
  render: () => (
    <RadioGroup defaultValue="auto" className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="auto" id="story-pre-auto" />
        Auto (selected)
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="true" id="story-pre-true" />
        Yes
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem value="false" id="story-pre-false" />
        No
      </label>
    </RadioGroup>
  ),
};

// ---------------------------------------------------------------------------
// Size comparison
// ---------------------------------------------------------------------------

/**
 * Size scale. `md` is the default and an alias for `default`. `sm` for dense
 * tables, `lg` for hero forms or accessibility-priority surfaces. Each size
 * is shown with its `defaultValue` pre-set so the inner circle is visible.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <RadioGroup defaultValue="a" className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
          <RadioGroupItem size="sm" value="a" id="size-sm-a" />
          Small (16×16) — dense tables
        </label>
      </RadioGroup>
      <RadioGroup defaultValue="b" className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
          <RadioGroupItem size="md" value="b" id="size-md-b" />
          Medium (20×20) — default, form rows
        </label>
      </RadioGroup>
      <RadioGroup defaultValue="c" className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
          <RadioGroupItem size="lg" value="c" id="size-lg-c" />
          Large (24×24) — hero forms
        </label>
      </RadioGroup>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`.
 * Both unchecked and checked rows stay readable; navy/white at 6.33:1 stays
 * above the WCAG 1.4.3 large-text floor even at 50% opacity.
 */
export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="b" className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem disabled value="a" id="disabled-a" />
        Disabled (unchecked)
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal">
        <RadioGroupItem disabled value="b" id="disabled-b" />
        Disabled (checked)
      </label>
    </RadioGroup>
  ),
};

// ---------------------------------------------------------------------------
// Labelled-row composition — extends hit area beyond the circle
// ---------------------------------------------------------------------------

/**
 * Labelled row. Mirrors the call-site convention in `single-mode-form.tsx`:
 * the RadioGroupItem is paired with a `<label htmlFor>` (or wrapping
 * `<label>`) whose text extends the clickable area row-wide. The component
 * does NOT auto-pair with a Label internally — that's a form-layer concern.
 */
export const LabelledRow: Story = {
  render: () => (
    <RadioGroup defaultValue="auto" className="flex flex-col gap-3 w-80">
      <div className="flex items-start gap-2 rounded-md border border-brand-light-blue/40 p-3">
        <RadioGroupItem value="auto" id="row-auto" className="mt-1" />
        <label
          htmlFor="row-auto"
          className="flex-1 cursor-pointer text-sm font-medium text-brand-charcoal"
        >
          Auto
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Permissive default — continuity preserved.
          </span>
        </label>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-brand-light-blue/40 p-3">
        <RadioGroupItem value="true" id="row-true" className="mt-1" />
        <label
          htmlFor="row-true"
          className="flex-1 cursor-pointer text-sm font-medium text-brand-charcoal"
        >
          Continuity preserved
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Operator confirmed — service period continues across the break.
          </span>
        </label>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-brand-light-blue/40 p-3">
        <RadioGroupItem value="false" id="row-false" className="mt-1" />
        <label
          htmlFor="row-false"
          className="flex-1 cursor-pointer text-sm font-medium text-brand-charcoal"
        >
          Continuity broken
          <span className="mt-1 block text-xs font-normal text-brand-grey">
            Pre-break service forfeited.
          </span>
        </label>
      </div>
    </RadioGroup>
  ),
};
