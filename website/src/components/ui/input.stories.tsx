/**
 * Input.stories.tsx — Storybook coverage for the LSL brand Input
 *
 * E6.2 Task 2.6.b (first Task 2.6 sibling after Button). Renders one story per
 * `state` x `size` combination plus a disabled story and a leading-icon
 * composition story. The composition story proves the icon-affix pattern can
 * be implemented at the call site without a render prop on Input itself
 * (Cascade Decision #5 — see input.tsx file header).
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Each form-field story is wrapped in a `<label>` so axe-core's "form field
 * must have a label" rule is satisfied. The Input itself does NOT auto-label
 * — that's the consumer's responsibility (existing 38 call sites already
 * wrap with `<Label>` + `htmlFor`, e.g. `signup-form.tsx`).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Search } from '@/components/brand/Icon';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Input. Extends the shadcn Input via `cva` with',
          'a two-axis variant API: `state` (`default` | `error`) and `size` (`sm` |',
          '`md` | `lg` | `default`). No named visual variants — form fields read best',
          'when they recede; the brand identity comes from focus + error states.',
          '',
          'Focus ring is `brand-navy` (6.33:1 against white) — matches Button for',
          'design-system consistency. Error state uses the shadcn `destructive`',
          'token family (mirrors Button destructive). Consumers MUST pair',
          '`state="error"` with `aria-invalid="true"` per WCAG SC 1.4.1.',
          '',
          'Re-skin note: all 38 existing `<Input>` call sites WILL visibly change',
          'after this PR merges — the default border, focus ring, and placeholder',
          'colour are brand-tokened. See HANDOFF.md for the per-consumer breakdown.',
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

type Story = StoryObj<typeof Input>;

// ---------------------------------------------------------------------------
// Default state (the visible baseline for the 38 existing consumers)
// ---------------------------------------------------------------------------

/**
 * Default — the brand baseline. Light-blue border, navy focus ring, brand-grey
 * placeholder, charcoal text. This is the state every existing `<Input>` call
 * site renders today (without any explicit `state=` prop).
 */
export const Default: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Employee name</span>
      <Input {...args} placeholder="e.g. Jane Smith" />
    </label>
  ),
  args: {
    state: 'default',
    size: 'md',
  },
};

/**
 * Filled — the same default state with a populated value, so a11y scanning
 * covers the non-placeholder rendering path (text contrast: brand-charcoal on
 * white is ~14.6:1, well above AA body).
 */
export const Filled: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Employee name</span>
      <Input {...args} defaultValue="Jane Smith" />
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
 * visible error message rendered by the form layer (the Input itself does NOT
 * render the error string — that's the consumer's responsibility, matching the
 * pattern in `signup-form.tsx` and `login-form.tsx`).
 *
 * WCAG SC 1.4.1: error MUST NOT be conveyed by colour alone. The combination
 * of red border + aria-invalid + visible error text satisfies the rule.
 */
export const WithError: Story = {
  render: (args) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Email</span>
      <Input
        {...args}
        type="email"
        defaultValue="not-an-email"
        aria-invalid="true"
        aria-describedby="email-error"
      />
      <span id="email-error" className="text-sm text-destructive">
        Enter a valid email address.
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
 * for legacy `default`. `sm` reads well inside dense tables (h-9 = 36px —
 * matches Button sm). `lg` reads well for hero forms (e.g. signup landing).
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Small</span>
        <Input size="sm" placeholder="Small input" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Medium (default)</span>
        <Input size="md" placeholder="Medium input" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Large</span>
        <Input size="lg" placeholder="Large input" />
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

/**
 * Disabled state. Root chain applies `opacity-50` + `cursor-not-allowed`. No
 * per-state disabled override. icon-direction.md §3's `text-brand-light-blue`
 * for disabled applies to icon glyphs, not form-field surfaces.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Disabled (default state)</span>
        <Input disabled defaultValue="Read-only field" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
        <span>Disabled (error state)</span>
        <Input disabled state="error" defaultValue="Locked invalid value" aria-invalid="true" />
      </label>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Icon composition — the call-site pattern (NO render prop on Input)
// ---------------------------------------------------------------------------

/**
 * Leading-icon composition. Per Cascade Decision #5 (input.tsx file header),
 * Input does NOT expose a `leadingIcon` / `trailingIcon` prop. When a consumer
 * needs an icon affix (e.g. the Search icon inside a search box per
 * icon-direction.md §3), they layer it at the call site with a relative
 * wrapper + absolute-positioned icon + extra left padding on the Input.
 *
 * This story documents the pattern so future consumers (and future Task 2.6
 * sibling components — Select, Textarea) don't reach for a render-prop API
 * before a real friction point surfaces.
 *
 * Icons are imported from `@/components/brand/Icon` (the v1 Lucide barrel per
 * OQ-2). Direct `lucide-react` imports outside that barrel are blocked.
 */
export const WithLeadingIcon: Story = {
  render: () => (
    <label className="flex flex-col gap-1 text-sm font-medium text-brand-charcoal">
      <span>Search employees</span>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/60"
        />
        <Input placeholder="Search by name or ID" className="pl-9" />
      </div>
    </label>
  ),
};
