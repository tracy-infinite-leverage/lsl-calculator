/**
 * Icon.stories.tsx — Storybook coverage for the OQ-2 brand icon barrel.
 *
 * E6.2+ barrel swap. The icons themselves are the in-house "Encircled
 * Stamp" set rendered from `/icons/sprite.svg`. Stories demonstrate:
 *
 *   1. The full 42-icon production set in default variant — the canonical
 *      family view (replaces the v1 brand-v1-minimum story).
 *   2. The three variant states (default / active / disabled) side-by-side
 *      for a representative icon — the user-visible contract for the
 *      `variant` prop.
 *   3. Size scale via `className` — `h-4 w-4` / `h-6 w-6` / `h-8 w-8` /
 *      `h-12 w-12`. The sprite's intrinsic 24×24 viewBox scales cleanly
 *      to any class-driven size; Tailwind's height/width utilities are
 *      the documented size mechanism (per Icon.tsx JSDoc).
 *   4. Surface composition — icons inside brand-tinted containers
 *      (rounded-square, encircled) per `icon-direction.md` §4.
 *
 * Notably absent from this v2 file: `size={N}`, `text-brand-*` colour
 * tints, and `strokeWidth` overrides. The OQ-2 set is intentionally
 * non-recolourable (per direction §3) — gold accents and navy stroke
 * are baked into the source SVGs. Consumers control SIZE (via `className`)
 * and STATE (via `variant`), not colour.
 *
 * axe-core fails the story on serious / critical violations.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  // Calculator / measurement
  Calculator,
  // People / tenancy
  User,
  Users,
  Building2,
  LogOut,
  // Status / signals
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  FileWarning,
  Lock,
  Unlock,
  Bell,
  // Navigation / motion
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Menu,
  // Editing / IO
  Plus,
  X,
  Trash2,
  Check,
  Circle,
  // Files / reports
  FileText,
  FileUp,
  Download,
  Upload,
  BookOpen,
  // Process
  Play,
  Loader2,
  Scale,
  TrendingDown,
  TrendingUp,
  GitCompareArrows,
  // Taxonomy
  Tag,
  // Brand-v1 §5 surface parity
  CalendarRange,
  DollarSign,
  Settings,
  Search,
  Filter,
} from './Icon';

const meta: Meta = {
  title: 'Brand/Icon',
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: {
        component: [
          'The OQ-2 brand icon barrel — single import point for every icon in the app.',
          '',
          'Renders the in-house "Encircled Stamp" set (Candidate C, selected 2026-06-05) from a',
          'sprite at `/icons/sprite.svg`. Each export accepts `variant?: "default" | "active" |',
          '"disabled"` (default = `"default"`) plus a standard SVG attribute surface — most',
          'importantly `className` (used for sizing via Tailwind `h-{n} w-{n}` utilities) and',
          '`aria-label` (used when an icon is the sole content of an interactive element).',
          '',
          'Brand styling (`docs/brand/icon-direction.md` §3):',
          '',
          '- **Default** — navy disc, white glyph, selective gold accents.',
          '- **Active** — gold disc, navy glyph (selected / pressed state).',
          '- **Disabled** — grey-blue disc, white glyph at 60% opacity.',
          '',
          'The wrapper does NOT recolour at the consumer level. `text-brand-*` Tailwind classes',
          'have no effect on the sprite — the brand stamp is intentionally non-overridable.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj;

/**
 * The full 42-icon production set — the canonical family view. Order
 * mirrors `production-inventory.md`. Use this story to confirm the sprite
 * shipped all 42 icons and the family stays visually consistent.
 */
export const ProductionSet: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-4 p-4">
      {[
        { Icon: Calculator, name: 'Calculator' },
        { Icon: User, name: 'User' },
        { Icon: Users, name: 'Users' },
        { Icon: Building2, name: 'Building2' },
        { Icon: LogOut, name: 'LogOut' },
        { Icon: CheckCircle2, name: 'CheckCircle2' },
        { Icon: AlertCircle, name: 'AlertCircle' },
        { Icon: AlertTriangle, name: 'AlertTriangle' },
        { Icon: Info, name: 'Info' },
        { Icon: HelpCircle, name: 'HelpCircle' },
        { Icon: FileWarning, name: 'FileWarning' },
        { Icon: Lock, name: 'Lock' },
        { Icon: Unlock, name: 'Unlock' },
        { Icon: Bell, name: 'Bell' },
        { Icon: ArrowRight, name: 'ArrowRight' },
        { Icon: ArrowUpDown, name: 'ArrowUpDown' },
        { Icon: ChevronDown, name: 'ChevronDown' },
        { Icon: ChevronRight, name: 'ChevronRight' },
        { Icon: RotateCcw, name: 'RotateCcw' },
        { Icon: Menu, name: 'Menu' },
        { Icon: Plus, name: 'Plus' },
        { Icon: X, name: 'X' },
        { Icon: Trash2, name: 'Trash2' },
        { Icon: Check, name: 'Check' },
        { Icon: Circle, name: 'Circle' },
        { Icon: FileText, name: 'FileText' },
        { Icon: FileUp, name: 'FileUp' },
        { Icon: Download, name: 'Download' },
        { Icon: Upload, name: 'Upload' },
        { Icon: BookOpen, name: 'BookOpen' },
        { Icon: Play, name: 'Play' },
        { Icon: Loader2, name: 'Loader2' },
        { Icon: Scale, name: 'Scale' },
        { Icon: TrendingDown, name: 'TrendingDown' },
        { Icon: TrendingUp, name: 'TrendingUp' },
        { Icon: GitCompareArrows, name: 'GitCompareArrows' },
        { Icon: Tag, name: 'Tag' },
        { Icon: CalendarRange, name: 'CalendarRange' },
        { Icon: DollarSign, name: 'DollarSign' },
        { Icon: Settings, name: 'Settings' },
        { Icon: Search, name: 'Search' },
        { Icon: Filter, name: 'Filter' },
      ].map(({ Icon, name }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon className="h-8 w-8" />
          <span className="font-sans text-caption text-brand-charcoal">{name}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * The three variant states for a representative icon. `default` is navy +
 * white + selective gold accent (the Bell carries a gold unread dot).
 * `active` flips the disc to gold and the glyph to navy. `disabled` drops
 * to a muted grey-blue with 60% opacity.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-10 p-4">
      <div className="flex flex-col items-center gap-2">
        <Bell className="h-12 w-12" />
        <span className="font-sans text-caption text-brand-charcoal">default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Bell variant="active" className="h-12 w-12" />
        <span className="font-sans text-caption text-brand-charcoal">active</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Bell variant="disabled" className="h-12 w-12" />
        <span className="font-sans text-caption text-brand-charcoal">disabled</span>
      </div>
    </div>
  ),
};

/**
 * Size scale via `className`. The sprite's 24×24 viewBox scales cleanly
 * via Tailwind `h-{n} w-{n}` utilities — `h-4 w-4` (16px) is favicon-grade
 * / inline-cell, `h-12 w-12` (48px) is hero-grade.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-8 p-4">
      {[
        { cls: 'h-4 w-4', label: '16px (h-4)' },
        { cls: 'h-5 w-5', label: '20px (h-5)' },
        { cls: 'h-6 w-6', label: '24px (h-6)' },
        { cls: 'h-8 w-8', label: '32px (h-8)' },
        { cls: 'h-12 w-12', label: '48px (h-12)' },
      ].map(({ cls, label }) => (
        <div key={cls} className="flex flex-col items-center gap-2">
          <CheckCircle2 className={cls} />
          <span className="font-sans text-caption text-brand-charcoal">{label}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Gold-accent vs no-accent — the restraint-with-gold rule (direction §3).
 * Each icon in the row is a "warmth" carrier (Bell unread, Calendar today,
 * Scale anchor, CheckCircle2 tick, AlertTriangle stem, FileWarning dot,
 * GitCompareArrows merge). Side-by-side with three icons that intentionally
 * stay pure navy + white to demonstrate the "no gold even though it's a
 * money / settings / similar" restraint.
 */
export const GoldAccentRestraint: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <div className="font-sans text-caption text-brand-charcoal mb-2">
          With gold accent — semantic earns a signal
        </div>
        <div className="flex items-center gap-6">
          <Bell className="h-8 w-8" />
          <CalendarRange className="h-8 w-8" />
          <Scale className="h-8 w-8" />
          <CheckCircle2 className="h-8 w-8" />
          <AlertTriangle className="h-8 w-8" />
          <FileWarning className="h-8 w-8" />
          <GitCompareArrows className="h-8 w-8" />
        </div>
      </div>
      <div>
        <div className="font-sans text-caption text-brand-charcoal mb-2">
          Pure navy — restraint (no gold even though it&apos;s a &quot;money&quot; / &quot;config&quot; icon)
        </div>
        <div className="flex items-center gap-6">
          <DollarSign className="h-8 w-8" />
          <Settings className="h-8 w-8" />
          <Trash2 className="h-8 w-8" />
          <Calculator className="h-8 w-8" />
        </div>
      </div>
    </div>
  ),
};

/**
 * Rounded-square surface (icon-direction §4.3) — the "brand surface"
 * pattern. PDF download CTA, PDF cover badge. The wrapping container
 * carries `bg-brand-navy` / `bg-brand-advisory`; the icon glyph is the
 * white stroke on top.
 *
 * Note: the encircled stamp is already "the disc" — the rounded-square
 * surface adds a second container around it for grouped affordances.
 * This is a deliberate stack-up (two enclosures) on PDF surfaces only;
 * inline use shows just the encircled stamp on its own.
 */
export const RoundedSquareSurface: Story = {
  render: () => (
    <div className="flex items-center gap-8 p-4">
      <div className="bg-brand-navy rounded-brand-lg p-3 inline-flex">
        <FileText className="h-7 w-7" aria-label="PDF report" />
      </div>
      <div className="bg-brand-navy rounded-brand-lg p-3 inline-flex">
        <Download className="h-7 w-7" aria-label="Download" />
      </div>
      <div className="bg-brand-advisory rounded-brand-lg p-3 inline-flex">
        <Info className="h-7 w-7" aria-label="Advisory" />
      </div>
    </div>
  ),
};
