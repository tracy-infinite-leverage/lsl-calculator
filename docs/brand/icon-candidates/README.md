# LSL Calculator — Custom Icon Set Candidates (OQ-2 / E6.1+)

> **Status:** awaiting operator selection.
> **Author:** designer agent.
> **Date:** 2026-06-05.
> **Direction document:** [`../icon-direction.md`](../icon-direction.md) (approved 2026-05-28).
> **Wordmark precedent:** [`../wordmark-candidates/README.md`](../wordmark-candidates/README.md) — Candidate B (approved 2026-05-28). This selection round mirrors that one's format.
> **Hard deadline:** custom icon set replaces Lucide **by the time E5.6 ships** (per OQ-2 in `.specify/features/006-ui-design-system/spec.md` §5.1).

This folder presents three concept candidates for the OQ-2 custom icon set. Each candidate is rendered against a representative subset of 6 icons drawn from the actual active icon surface in the codebase (see the [Icon surface inventory](#icon-surface-inventory) section below).

This is the **discovery + concept round**. The operator picks one candidate (or requests iteration), then a production round delivers the full ~30 icon set against the approved direction. The barrel swap in `website/src/components/brand/Icon.tsx` happens as a single follow-up PR before E5.6 ships.

The concepts here are **not the final assets**. They are deliberately scoped to a representative subset of 6 icons (Users, Calculator, Bell, CalendarRange, Scale, ChevronDown) — chosen because they are visually diverse (people, object, alert, time, balance, motion) and stress-test the candidate's direction at the three sizes that matter (24/32/48).

---

## Candidate A — Pure Monoline

[`./candidate-a-monoline/`](./candidate-a-monoline/) · [README](./candidate-a-monoline/README.md) · [preview](./candidate-a-monoline/preview.png)

**Visual description.** Pure 1.5px navy stroke on a 24×24 viewBox. Round caps, round joins. No fills, no broken-line details, no gold accents in the default state — gold variants ship as a separate active-state set during the production round.

**Why it works.** Strict interpretation of `icon-direction.md` §3 restraint. The closest 1-to-1 visual replacement for Lucide — a returning user may not notice the swap happened, which is sometimes exactly the right brief. Lowest production risk and cheapest delivery against the E5.6 deadline.

**Trade-off.** Lowest visual distinctiveness. A returning user may not notice the swap happened. Misses the direction doc's §5.1 "broken-line detail" permission.

---

## Candidate B — Broken-Line Detail

[`./candidate-b-broken-line/`](./candidate-b-broken-line/) · [README](./candidate-b-broken-line/README.md) · [preview](./candidate-b-broken-line/preview.png)

**Visual description.** Same 1.5px navy monoline primary as Candidate A, plus a single dashed grey-blue secondary structure on each icon. The dashed elements add semantic richness — roster row under Users, receipt-tape under Calculator display, ringing waves flanking Bell, range connector inside CalendarRange, pan shadows under Scale. ChevronDown stays pure monoline (no natural place for a dashed accent).

**Why it works.** Honours the direction doc's most distinctive permission (§2 + §5.1 *"subtle broken-line details"*). The icons and the planned empty-state illustrations (per §10) form one visual family — same broken-line grammar across both surfaces. Strongest "this was designed for us" voice without abandoning monoline restraint.

**Trade-off.** Some icons (ChevronDown, X, Plus, micro-directional icons) have no natural place for a broken-line accent and degrade gracefully to monoline — a documented exception, not a failure, but a thing to explain. At 16×16 the dashed secondary disappears.

---

## Candidate C — Encircled Stamp

[`./candidate-c-encircled-stamp/`](./candidate-c-encircled-stamp/) · [README](./candidate-c-encircled-stamp/README.md) · [preview](./candidate-c-encircled-stamp/preview.png)

**Visual description.** Every icon is a filled navy disc with a white-stroke glyph inside it. Selective gold accents on the icons that semantically earn them — Bell (unread dot), CalendarRange (today square), Scale (hook anchor) — per direction §3 restraint rule (at-most-3-of-10 icons carry gold). Calculator and Users are gold-free by spec. ChevronDown also encircled but with a documented production-round carve-out for micro-directional icons.

**Why it works.** Elevates the direction doc's §4.2 encircled variant to the default. Pairs natively with the wordmark's masthead posture and gold accent rule. Strongest brand-system identity — a single icon at 24px is instantly recognisable as the family. The §4.2 64/80/120 anchor-tier (section headers, nav, empty-state) is simply this candidate's icons resized — zero extra work for those surfaces.

**Trade-off.** Most expensive production round (~2× the SVGs because every icon needs a standalone variant for inline body use). Visually heaviest of the three at icon-dense surfaces (bulk-results table, multi-column grids). Largest tonal shift from the current Lucide surface — returning users will definitely notice the swap.

---

## How to pick

Decision criteria, in priority order — same lens the wordmark-candidates README used:

1. **Brand voice posture.** Candidate A says "the icons defer to the content". Candidate B says "the icons are quietly bespoke, in step with the empty-state illustrations". Candidate C says "the icons are a load-bearing brand asset, like the wordmark and the app icon". Match the candidate to where the operator wants the icons to sit in the brand hierarchy.

2. **Pairing with the approved wordmark (Candidate B).** All three icon candidates work with the approved stacked-masthead wordmark, but they pair differently:
   - **Candidate A** pairs *neutrally* — the icons stay out of the wordmark's way.
   - **Candidate B** pairs *in step* — the broken-line grammar in the icons echoes the same restraint posture as the wordmark's selective-gold rule.
   - **Candidate C** pairs *in harmony* — the encircled stamps visually echo the wordmark's gold accent rule, and the navy disc is a direct sibling to the app icon's rounded-square navy field per direction §4.3.

3. **Production budget.** A and B are each ~35 base SVGs. C is ~70 (encircled + standalone variants per icon). If the production budget is tight and the E5.6 deadline is the binding constraint, A or B wins.

4. **Surface density compatibility.** The bulk-results table (`bulk-results-table.tsx`) and the data-table-heavy Liability/Reconciliation surfaces (E5.5/E5.6) have high icon counts per row. Candidate C's discs stack visually at that density — needs an explicit "standalone only in data tables" rule. A and B have no such constraint.

5. **Direction-doc fidelity score.** All three are spec-compliant. A is the most conservative reading of §3 restraint. B is the most explicit honouring of §5.1 broken-line permission. C is the most explicit honouring of §4.2 encircled treatment.

**Recommended default if undecided:** **Candidate B.** It is the strongest brand-voice pick without the production cost or surface-density risk of Candidate C. The dashed secondary structure is the direction doc's most distinctive design move — the broken-line grammar threads through the icons, the empty-state illustrations, and (potentially) the PDF report decorations as one family. It pairs in-step with the approved wordmark's restraint posture, and it leaves Candidate C's stamp grammar available as a separate brand-surface treatment (PDF cover badge, OG card) rather than as a default everywhere.

If the operator's instinct is "I want this to be unmistakably *our* icons", pick **Candidate C** and accept the higher production cost.

If the operator's instinct is "I want the icons to be invisible, the content does the talking", pick **Candidate A**.

---

## Icon surface inventory

The custom set must replace these Lucide icons currently used in `website/src/`. Audit run 2026-06-05 via `grep -rE "from ['\"]lucide-react['\"]" website/src/` plus the brand barrel exports in [`website/src/components/brand/Icon.tsx`](/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/brand/Icon.tsx).

**Single import path:** every icon consumer goes through `website/src/components/brand/Icon.tsx`. The two exceptions are shadcn primitive components (`components/ui/{accordion,radio-group,dialog,select,checkbox,dropdown-menu}.tsx`) which import Lucide directly per shadcn's vendored shape — those are gated by an ESLint allow-list and will swap to the custom set at the same time as the barrel.

### Active consumer-side icons (38 unique)

| Surface | Icons |
| --- | --- |
| Sidebar (`sidebar-routes.ts`) | `Users`, `Tag`, `CalendarRange`, `Calculator`, `Scale`, `GitCompareArrows`, `Settings` |
| TopNav (`TopNav.tsx`) | `Bell` |
| UserMenu (`UserMenu.tsx`) | `ChevronDown`, `LogOut`, `User` |
| TenantSwitcher (`TenantSwitcher.tsx`) | `Building2`, `Check`, `ChevronDown` |
| ActingAsBanner (`ActingAsBanner.tsx`) | `AlertTriangle` |
| Breadcrumbs (`Breadcrumbs.tsx`) | `ChevronRight` |
| Empty states (`empty-states/*.tsx`) | `Users`, `Tag`, `CalendarRange`, `Calculator`, `Scale`, `GitCompareArrows` (one per empty-state surface) |
| Calculator single mode (`single-mode-form.tsx`) | `Calculator`, `RotateCcw`, `AlertTriangle`, `Plus`, `X` |
| Calculator bulk mode (`bulk-mode-form.tsx`, `bulk-results-table.tsx`, `bulk-preview-table.tsx`, `unblock-jurisdiction-modal.tsx`) | `AlertCircle`, `Download`, `FileUp`, `Loader2`, `Play`, `Trash2`, `ArrowUpDown`, `ChevronDown`, `ChevronRight`, `Lock`, `Unlock` |
| Result panel (`result-panel.tsx`) | `AlertTriangle`, `Download`, `FileWarning`, `Info`, `TrendingDown`, `TrendingUp` |
| Wage history upload (`wage-history-upload.tsx`) | `Upload`, `FileText`, `X` |
| Continuous service list (`continuous-service-list.tsx`) | `Plus`, `X` |
| Calculator error route (`error.tsx`) | `AlertTriangle` |
| Public-calc landing (`app/page.tsx`) | `ArrowRight`, `FileText`, `Users` |
| PDF citation block (`citation-block.tsx`) | `BookOpen` |
| Spinner (`spinner.tsx`) | `Loader2` |
| Storybook stories (`*.stories.tsx`) | `Calculator`, `ArrowRight`, `Download`, `Trash2`, `Search`, `FileWarning`, `Info`, `AlertTriangle`, `HelpCircle` |

### Shadcn primitives (gated, swap together)

| Primitive | Icons |
| --- | --- |
| `accordion.tsx` | `ChevronDown` |
| `select.tsx` | `Check`, `ChevronDown` |
| `checkbox.tsx` | `Check`, `Minus` |
| `dropdown-menu.tsx` | `Check`, `ChevronRight`, `Circle` |
| `radio-group.tsx` | `Circle` |
| `dialog.tsx` | `X` |

### Brand-barrel-only (no consumer on `main` yet, present for OQ-2 surface parity)

Per the §5 v1 minimum in `icon-direction.md`: `CalendarRange`, `DollarSign`, `Settings`, `Search`, `Filter`, `CheckCircle2`, `AlertCircle`, `Info`, `HelpCircle`, `FileWarning`, `Lock`, `Unlock`, `Bell` — all already in the barrel; some now consumed (this list is shrinking).

### Total production surface

~38 unique semantic icons + the §5 brand-v1 minimums = **~30 icons to produce in the production round** (some shadcn primitives share with the brand list; `Circle` is a single mark; `Minus` is a single mark — these are trivial to redraw and consolidate during the production round audit).

---

## Drift flagged

While inventorying the active icon surface, the designer agent noticed two drift points between the dispatch description and the actual codebase. Recording here for the operator's awareness, not blocking the selection:

1. **The dispatch listed the sidebar as `Users / FileText / Receipt / Calculator / Scale / CheckSquare / Settings`**, but the actually-shipped E6.3 sidebar uses `Users / Tag / CalendarRange / Calculator / Scale / GitCompareArrows / Settings` (per `website/src/components/app-shell/sidebar-routes.ts`). `FileText`, `Receipt`, and `CheckSquare` are *not* the icons used. The candidates here are drawn against the actually-shipped sidebar.

2. **The dispatch listed the TopNav user menu as `CircleUser`**, but the shipped UserMenu uses `User` (the single-figure mark, not the circle-wrapped variant). Matches direction §5 *"Use `User` (single person), not `UserCircle`"*. The candidates here treat `User` as the canonical TopNav glyph.

Neither drift is load-bearing for this selection round — the candidate direction will apply uniformly to whichever icon name ends up in the barrel. But the production-round audit should re-grep the active surface at commission time to catch any further drift between now and E5.6.

---

## What's not in this run

Per the dispatch, this round stops at three SVG candidates × six representative icons, one preview board per candidate, and the READMEs. The following are deferred until the operator picks a candidate (or requests iteration):

- The full ~30 icon production set against the approved direction.
- The encircled / rounded-square container *variants* per direction §4 (Candidate C ships encircled by default; A and B need explicit encircled variants for §4.2 surfaces).
- The six empty-state illustrations per direction §10 (these come from the same production round, in the same visual language).
- The `Icon.tsx` barrel swap — the swap is a one-file change per impl-plan §1.1; it ships as a final follow-up PR before E5.6.
- The ESLint allow-list update for the shadcn primitives — same follow-up PR.

---

## Operator action required

1. Open this folder and view the three PNG previews side-by-side.
2. Read the per-candidate READMEs for trade-offs and "when to pick / reject" guidance.
3. Pick one candidate (A, B, or C) **or** request iteration on a specific candidate with concrete feedback (e.g. "B but without the dashed shadows on Scale", "C but with the discs at 80% navy fill so they sit lighter in tables", "A but show me what one gold-tick variant looks like").
4. Once decided, dispatch the designer agent for the **production round** — full ~30 icon SVGs in the approved direction, plus the empty-state illustrations.

Do not commit production-round deliverables yet — those wait for the selection.
