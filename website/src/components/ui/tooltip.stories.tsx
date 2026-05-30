/**
 * Tooltip.stories.tsx — Storybook coverage for the LSL brand Tooltip
 *
 * E6.2 Task 2.6.o (wave 2). Renders one story per BRAND variant (brand,
 * brand-light) plus a "keyboard focus" story documenting the focus-show
 * contract and a side-placement matrix.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Accessibility contracts preserved by Radix:
 *   - **Focus shows the tooltip** (not hover-only). Tab to the trigger and
 *     the tooltip appears — verifiable in any of the stories below.
 *   - **Escape dismisses without moving focus**. Focus stays on the
 *     trigger so keyboard users don't lose their place.
 *   - **`aria-describedby`** is wired automatically — screen readers
 *     announce the tooltip when focus arrives at the trigger.
 *   - **`prefers-reduced-motion`** strips the fade + slide animation; the
 *     tooltip still appears, just instantly.
 *
 * Legacy `default` variant is NOT story-covered here — it exists for future
 * non-brand consumers.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { Button } from './button';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Tooltip. Wraps Radix UI Tooltip 1.2 —',
          'all keyboard + ARIA semantics are inherited; cva adds two brand',
          'content shells per spec §5.1.',
          '',
          '`brand` — navy field, white type. The high-contrast default.',
          '`brand-light` — white field, navy type, brand hairline. For dark',
          'panels or contextual rather than instructional tooltips.',
          '',
          'Keyboard access: Tab to the trigger and the tooltip appears',
          '(focus-show, not hover-only) per WCAG 2.2 SC 1.4.13. Escape',
          'dismisses without moving focus.',
          '',
          '`prefers-reduced-motion` is honoured (spec §5.5): fade and slide',
          'animations are stripped; the tooltip still appears.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

// ---------------------------------------------------------------------------
// brand — default brand tooltip (focus + hover)
// ---------------------------------------------------------------------------

/**
 * Hover OR Tab onto the trigger to show the tooltip. Escape dismisses it
 * without moving focus.
 */
export const Brand: Story = {
  render: () => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="primary">Calculate</Button>
        </TooltipTrigger>
        <TooltipContent variant="brand">
          Runs the LSL engine against the current inputs.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

// ---------------------------------------------------------------------------
// brand-light — for dark panels / contextual tooltips
// ---------------------------------------------------------------------------

export const BrandLight: Story = {
  render: () => (
    <TooltipProvider delayDuration={150}>
      <div className="bg-brand-navy p-12 rounded-brand-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Methodology</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand-light">
            State engine v2.3 · data as at 2026-05-30.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};

// ---------------------------------------------------------------------------
// brand — keyboard-focus contract
// ---------------------------------------------------------------------------

/**
 * Demonstrates WCAG 2.2 SC 1.4.13 compliance: the tooltip is reachable by
 * keyboard (Tab) — not hover-only. Tab onto the button below and the
 * tooltip appears. Press Escape to dismiss without moving focus.
 *
 * The Radix-supplied `aria-describedby` link means a screen reader at the
 * focused trigger announces the tooltip text automatically.
 */
export const BrandKeyboardFocus: Story = {
  render: () => (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-brand-grey">
          Tab onto the button below — the tooltip appears via keyboard focus.
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="primary">Download PDF</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand">
            Generates an A4 PDF of this result. Esc to dismiss.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};

// ---------------------------------------------------------------------------
// brand — side placement matrix
// ---------------------------------------------------------------------------

/**
 * The same brand tooltip placed on each of the four sides. Useful for
 * design review of the slide-in direction + arrow alignment.
 */
export const BrandSides: Story = {
  render: () => (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 gap-12 p-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="primary">Top</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand" side="top">
            Tooltip on top.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="primary">Right</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand" side="right">
            Tooltip on right.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="primary">Bottom</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand" side="bottom">
            Tooltip on bottom.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="primary">Left</Button>
          </TooltipTrigger>
          <TooltipContent variant="brand" side="left">
            Tooltip on left.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};
