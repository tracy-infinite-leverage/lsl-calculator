/**
 * Icon — single barrel for every Lucide icon used in the app
 *
 * E6.2 Task 2.5 (OQ-2 mechanism). Lucide ships as the v1 placeholder icon
 * set per spec §5.1 / OQ-2; the custom set replaces Lucide "by the time E5.6
 * ships." The swap is a one-file change because nothing else in the codebase
 * imports from `lucide-react` directly — every icon use goes through this
 * barrel.
 *
 * Implementation rules (impl-plan §1.1, icon-direction.md §5):
 *
 *   1. Re-export only the icons the app actually uses. The 21 icons listed
 *      below cover every existing `lucide-react` import on `main` (audited
 *      2026-05-28) plus a small set named in icon-direction.md §5 that future
 *      tasks will reach for. New icons get added one at a time; the v1.1
 *      replacement audit then has a known, finite surface.
 *
 *   2. Re-export under the same names as Lucide. This keeps the v1→v1.1
 *      swap a true one-file change — the custom set provides identical named
 *      exports (`Calculator`, `User`, etc.) with the same `LucideProps`
 *      contract. Callers don't notice the swap.
 *
 *   3. Also export the shared icon prop type. Future custom icons MUST
 *      satisfy `LucideProps` for the swap to be transparent.
 *
 *   4. Lint rule (enforced in `eslint.config.mjs` via the
 *      `no-restricted-imports` pattern added in this task): direct
 *      `lucide-react` imports anywhere outside this file fail the build.
 *
 * Brand styling rules (icon-direction.md §5):
 *   Default style is "navy stroke, restraint with gold." Components consuming
 *   icons apply colour via Tailwind utilities (`text-brand-navy`,
 *   `text-brand-gold`) and stroke-width as needed — the barrel does NOT
 *   pre-style icons. That decision keeps the consumer in control and matches
 *   the existing Lucide ergonomics.
 *
 * Usage:
 *   ```tsx
 *   import { Calculator, CheckCircle2 } from '@/components/brand/Icon';
 *
 *   <Calculator className="text-brand-navy" strokeWidth={2.5} />
 *   <CheckCircle2 className="text-brand-gold" />
 *   ```
 */

// Re-export the `LucideProps` type so consumers (and the future custom-icon
// shim) share a single icon contract. This is the only `lucide-react` import
// permitted in the codebase — every other file goes through the named-icon
// re-exports below. ESLint exempts this file via `eslint.config.mjs`.
export type { LucideProps } from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon re-exports — the v1 surface.
//
// Each named import below corresponds to a Lucide identifier currently used
// somewhere in `src/` OR explicitly named in icon-direction.md §5 as part of
// the brand v1 minimum. Anything not in this list is intentionally absent —
// add to the list when a feature lands, not preemptively.
//
// Audit source: `grep -rEn "from ['\"]lucide-react['\"]" website/src/` on
// 2026-05-28 — 17 files, 21 unique identifiers below + the brand-v1 minimum.
//
// Brand-v1 minimum (`docs/brand/icon-direction.md` §5): the 15 mandated icons
// MUST all appear in this barrel even if no consumer imports them yet — that
// is the OQ-2 one-file-swap contract. The 5 spec-mandated icons that have no
// consumer on `main` today (`CalendarRange`, `DollarSign`, `Settings`,
// `Search`, `Filter`) are exported below alongside the actively-used set so
// the swap surface matches the documented v1 surface.
// ---------------------------------------------------------------------------

export {
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

  // Taxonomy / categorisation
  Tag,

  // Brand-v1 §5 — no consumer on main yet, present for OQ-2 surface parity
  CalendarRange,
  DollarSign,
  Settings,
  Search,
  Filter,
} from 'lucide-react';
