# LSL Calculator — Icon Direction (E6.1 / Task 1.3)

> ## ✅ APPROVED
>
> **Approved by:** Tracy Angwin (operator)
> **Approved on:** 2026-05-28
> **Approved as:** the entire direction document as drafted, including both design choices the designer flagged in §6.2 and §8 (gold-square-corner on app icon; white background on OG card).
> **Downstream effect:** Task 1.4 (final asset production) executes against this approved direction. No revisions required.

> **Author:** designer agent.
> **Date:** 2026-05-28.
> **Companion to:** the approved wordmark in [`./wordmark-candidates/candidate-b.svg`](./wordmark-candidates/candidate-b.svg) (approved 2026-05-28).
> **Source of truth for:** Phase 2 / E6.2 icon barrel implementation (Lucide v1) and the v1.1 custom-icon designer commission brief (replaces Lucide by E5.6 ships).

This document defines the LSL Calculator icon system at two horizons:

- **v1 (now)** — how Lucide is styled to read as "LSL Calculator family", to unblock E6.2.
- **v1.1 (post-E5.6)** — the commission brief for the future human designer who will produce a custom icon set in this direction.

Per **spec §5.1 (SHOULD)**: *"light line-weight, optionally with subtle broken-line details, standalone or encircled (circle filled in primary or secondary brand colour)"*. Per **OQ-2 (RESOLVED v0.4)**: Lucide ships as the v1 placeholder icon set with a hard deadline to replace by the time E5.6 ships.

Visual mockups referenced throughout live in [`./icon-mockups/`](./icon-mockups/):

- [`icon-grid-v1.png`](./icon-mockups/icon-grid-v1.png) — 8 styling rules in action
- [`app-icon.png`](./icon-mockups/app-icon.png) — LSL Calculator app icon @ 512×512
- [`favicon-set.png`](./icon-mockups/favicon-set.png) — favicon progression 16→32→180
- [`empty-state-direction.png`](./icon-mockups/empty-state-direction.png) — empty-state illustration anchor

---

## 1. Visual posture summary

The LSL Calculator icon system feels **quiet, geometric, and professionally restrained** — a navy line-art family that ladders directly up from Candidate B's stacked masthead wordmark. Like the wordmark, it leans on a confident navy primary with **selective gold as a deliberate signal, never decoration**. Icons are line-art at body scale, get encircled when they earn a section-header role, and live inside a rounded-square navy field at brand-surface scale (app icon, PDF cover badge, OG card). The gold mark recurs as a small accent — a "today" square, a tick stroke, a corner echo — never a fill.

This posture matches the product: a **serious payroll-compliance tool** that produces formal PDF reports for CFOs and boards. The icons should never feel chatty, decorative, or consumer-app playful.

---

## 2. Stroke / line-weight spec

| Display size | Stroke weight | Notes |
| --- | --- | --- |
| 16px (favicon, tight inline) | 1px | Use only when 1.5px breaks pixel grid — see §7 "favicon simplification" |
| 18–24px (default body, table cell, button leading icon) | **1.5px** | Lucide default — keep |
| 32–48px (page header, empty-state anchor inline) | 1.5px | Keep weight; do not thicken |
| 64–96px (encircled section-header treatment) | 2px | One step up — visible inside the circle without optical thinning |
| 180px+ (brand-surface, app-icon glyph) | 2.5–3px or solid fill | Stroke weight at large scale should never feel "wire-thin"; use filled glyphs (e.g. white-on-navy) at this scale |

**Line caps + joins:** `round` for both. No sharp corners — matches Lucide's house style and reads softer alongside the brand's rounded-corner geometry (per APA Brand Guidelines p.10 app-icon precedent).

**Subtle broken-line details** (per spec §5.1): use `stroke-dasharray="3 3"` sparingly for **secondary structural lines** — e.g. table row dividers in empty-state illustrations, hint paths inside a "drag-and-drop" upload icon. Never on the primary glyph stroke.

---

## 3. Colour rules

The icon palette is a strict subset of the brand palette:

| Colour | Hex | Used for |
| --- | --- | --- |
| Navy (primary) | `#48608a` | Default icon stroke. ~85% of icons in the product are pure navy. |
| Gold (accent) | `#d9a428` | Active / selected / "important" / "calculated" state. Used on **at most one element per icon**. |
| White | `#ffffff` | Icon stroke when inside an encircled navy fill or rounded-square navy field. |
| Pale grey-blue | `#a0aec1` | Disabled state, secondary structural lines (e.g. table dividers in empty-state art). |

**Restraint principle.** Per Candidate B's "selective gold accents" hint and the spec's restraint posture: **gold is a signal, not decoration**. If everything is gold, nothing is. The "today" marker in a date-range icon is gold; the "calculated" tick is gold; the "completed step" indicator is gold. The plain Calculator, FileText, User, Search, Filter, Plus icons stay navy.

A useful test: *if you removed every gold mark from the UI in a single screenshot, would it still be obvious where the user should look?* If yes, restraint is correct. If no, gold is over-applied — pare back.

**Disabled state.** Grey-blue `#a0aec1`. Do not use a low-opacity navy — that compounds badly under gradients and against off-white backgrounds.

---

## 4. Container rules

Icons appear in three container treatments. Which one depends on **where** the icon sits in the layout, not which icon it is.

### 4.1 Standalone (no container) — default

Use inline in body text, table cells, button leading icons, breadcrumb chevrons, badge prefixes. Pure line-art on a transparent background.

Examples: leading icon on a button, a `Search` icon inside an input, a `ChevronRight` in a breadcrumb.

### 4.2 Encircled — section headers, nav, status anchors

Use when the icon is the **anchor** of a section header, a top-level nav item, or a status block. The circle is **filled navy** (`#48608a`), the inner icon is white stroke. If the icon carries an "important" semantic (e.g. AlertTriangle), one gold accent inside the white glyph is permitted.

Diameter convention: **64px** for nav, **80px** for section header, **120px** for empty-state anchor (paired with a headline + CTA below).

Examples: see [`icon-grid-v1.png`](./icon-mockups/icon-grid-v1.png) Row 2 Tiles 5 and 6 — `User (encircled)` and `AlertTriangle (encircled)`.

### 4.3 Rounded-square container — brand surfaces only

Use for the **app icon**, **PDF cover badge**, **OG card badge**, **loading-state anchor on a full-page splash**. This treatment is reserved — it echoes the parent APA app-icon precedent (Brand Guidelines p.10: rounded-square + gold-square composition) and should not be used for inline UI.

Container: **navy fill `#48608a`**, corner radius = ~18.75% of the side (e.g. 96 on a 512 master, 14 on an 80 tile in the icon grid). Glyph inside: white stroke or solid white fill, plus an optional **small gold square in the bottom-right corner** for brand-surface continuity.

Examples: see [`icon-grid-v1.png`](./icon-mockups/icon-grid-v1.png) Row 2 Tile 7 (`FileText` rounded-square) and the [`app-icon.png`](./icon-mockups/app-icon.png) at 512×512.

---

## 5. Lucide v1 styling map

The following 15 icons are the most commonly used in the LSL Calculator product. For each: the Lucide identifier (lowercased import name as exported by `lucide-react`) and the brand styling rule. **In Phase 2 (E6.2), all icon usage flows through a single barrel `components/brand/Icon.tsx` so the v1.1 custom-icon swap is a one-file change** (per impl-plan §1.1 architectural decision — Lucide → custom swap mechanism).

| Semantic | Lucide id | Default style | Active / important style | Notes |
| --- | --- | --- | --- | --- |
| Calculator | `Calculator` | navy stroke | n/a (no "active" state for a brand affordance) | Used as a leading icon on the public-calc landing CTA. |
| Single employee | `User` | navy stroke | gold dot on chest-circle when selected | Use `User` (single person), not `UserCircle`. See §10 below. |
| Multiple employees | `Users` | navy stroke | gold dot on the foremost figure when "active tenant" | Use for the tenant switcher, employee roster header. |
| Date range | `CalendarRange` | navy stroke | small gold filled square as the "today" marker | See icon grid Row 1 Tile 3. |
| Calculated / done | `CheckCircle2` | navy ring + navy tick | navy ring + **gold tick** (stroke 3) | This is the signature "calculated" affordance. See icon grid Row 1 Tile 2. |
| Pay / currency | `DollarSign` | navy stroke 2.5 | n/a | Restraint demo — no gold even though it's a "money" icon. See icon grid Row 2 Tile 8. |
| Report / PDF | `FileText` | navy stroke (inline) **or** rounded-square navy field with white FileText + gold corner square (brand surface — e.g. PDF download CTA, PDF cover badge) | n/a | See icon grid Row 2 Tile 7. |
| Settings / gear | `Settings` | navy stroke | grey-blue when disabled | See icon grid Row 1 Tile 4 (disabled). |
| Search | `Search` | navy stroke | n/a | Inside an input, render at 18px navy 60% opacity to defer to the placeholder text. |
| Sort up/down | `ArrowUpDown` | navy stroke | navy + gold arrowhead on the active sort direction | When a column is the active sort, the gold arrowhead points up or down. |
| Filter | `Filter` | navy stroke | gold dot on funnel mouth when at least one filter is applied | Subtle "has-filter" signal. |
| Add / new | `Plus` | navy stroke (inline) or gold stroke inside a navy-outlined circle (empty-state CTA) | n/a | The empty-state plus is the **only place** Plus uses gold. See empty-state mockup. |
| Delete / remove | `Trash2` | navy stroke; **destructive button variant** uses `#a23a3a` red (defined in tokens), not gold | n/a | Gold is never used for destructive — that would invert the signal semantics. |
| Tenant switcher | `Building2` | navy stroke | gold dot on roofline when acting-as a non-home tenant | Pair with the persistent "Acting as: <client>" banner per spec §5.2. Do NOT use `ArrowLeftRight` — that reads "data transfer", not "switch context". |
| Help / info | `HelpCircle` | navy stroke | n/a | Use for the methodology footer link to spec sources. |
| Warning / advisory | `AlertTriangle` | navy stroke (inline) or encircled navy + white triangle + **gold "!" stem** (status anchor) | n/a | The gold "!" stem is the brand's signature advisory mark. See icon grid Row 2 Tile 6. |

**Implementation note for the developer:** these 15 are the v1 minimum; the Lucide library has ~1400 icons, and engineers will pick more as features ship. The styling rules above generalise — when in doubt, default to **navy stroke + restraint with gold**.

---

## 6. App icon design

The LSL Calculator app icon is the highest-value single brand asset in the system. It appears as the iOS home-screen icon, Android launcher, PWA install card, browser tab favicon (at small sizes), PDF report cover badge, OG card badge, and any place the product self-identifies at scale.

### 6.1 Composition

| Element | Spec |
| --- | --- |
| Container | Rounded square. Side = 512px (master). Corner radius = 96px (~18.75%). Matches APA Brand Guidelines p.10 app-icon precedent. |
| Field colour | Navy `#48608a` solid. No gradient. |
| Glyph | "LSL" monogram in **Montserrat Bold**, white `#ffffff`, font-size 180, letter-spacing −2. Centred horizontally; baseline ~58% of canvas height (visually balanced once the bottom-right gold square is placed). |
| Accent | Small **gold square** in the bottom-right corner. 56×56, corner radius 8, fill `#d9a428`. Inset 44px from each edge. |

See [`app-icon.png`](./icon-mockups/app-icon.png) for the rendered master.

### 6.2 Design decisions worth flagging

Two choices were made and locked in §6.1 above. Both are flagged here so the operator can object if needed.

1. **Accent treatment: gold-square-corner (picked) vs gold-underline (rejected).** The gold square mirrors p.10 of the parent brand guidelines (rounded-square + gold-square composition) and inherits the parent grammar without copying the logomark. A gold underline beneath the LSL monogram was the other option — but the wordmark already uses a gold rule under "LSL Calculator", so a gold underline on the app icon would create visual duplication, not echo. The corner-square reads as the same family without competing.
2. **Monogram typeface: sans-LSL Montserrat Bold (picked) vs serifed-LSL (rejected).** Montserrat is the locked title typeface per spec §5.1. A serifed monogram would create a typographic family of three (Montserrat + Source Sans + a serif), breaking the two-typeface system. Montserrat Bold is heavier than the wordmark's Semibold so it earns its own presence at icon scale.

### 6.3 Sizes required (Phase 2 / E6.2 will export these)

The 512×512 master in [`./icon-mockups/app-icon.svg`](./icon-mockups/app-icon.svg) is the source. Task 1.4 will export the following raster set:

| Size | Path under `website/public/` | Use |
| --- | --- | --- |
| 16×16 | `/favicon-16x16.png` | Browser tab — **simplified glyph** (see §7) |
| 32×32 | `/favicon-32x32.png` | Browser tab retina — **simplified glyph** (see §7) |
| 48×48 | embedded in `/favicon.ico` | Legacy ICO multi-resolution |
| 180×180 | `/apple-touch-icon.png` | iOS home screen — full LSL monogram restored |
| 192×192 | `/android-chrome-192x192.png` | Android launcher |
| 512×512 | `/android-chrome-512x512.png` and `/icon-512x512.png` | PWA manifest |
| n/a | `/favicon.ico` | Multi-resolution ICO containing 16, 32, 48 |

---

## 7. Favicon set spec — simplification rule

The full LSL monogram is illegible below ~48×48. Rather than ship a mushy favicon at small sizes, the favicon set **drops the monogram and keeps the geometry** — navy rounded square + gold corner square. The brand reads as "navy square with a gold square corner" even at 16×16.

See [`favicon-set.png`](./icon-mockups/favicon-set.png).

| Size | Glyph treatment |
| --- | --- |
| 16×16 | No monogram. Navy rounded square + 4×4 gold corner square. |
| 32×32 | Single "L" in Montserrat Bold + 6×6 gold corner square. "LSL" does not fit legibly. |
| 48×48 | Single "L" (same as 32×32, scaled). |
| 180×180+ | Full "LSL" monogram + 20×20+ gold corner square. |

**File format note for Task 1.4 / E6.2:**

- `favicon.ico` is a **multi-resolution ICO** containing 16/32/48 PNG layers — not three separate `.ico` files.
- Apple touch icon ships as a flat `.png` (no transparency) at 180×180.
- `safari-pinned-tab.svg` is the monochrome navy SVG of the full app icon (no gold) — Safari uses it as a monochrome mask.
- PWA manifest references the 192 and 512 PNGs.

---

## 8. OG card icon usage

The Open Graph card (e.g. when a `lslcalculator.com.au` link is pasted into LinkedIn or Slack) uses the **wordmark, not the app icon**. Rationale: OG cards have horizontal real estate, and the wordmark is the strongest brand signal at horizontal aspect ratios. The app icon is reserved for square / tight contexts.

Composition guidance for the OG card (Task 1.4 / E6.2):

- Navy background (`#48608a`) or white background — **pick one and lock it project-wide** so social-feed thumbnails are recognisably consistent.
- **Recommendation: white background.** A white-background OG card with the navy wordmark reads cleaner in dense social feeds where every other card is already coloured.
- Wordmark centred horizontally, ~60% of the card width.
- 1200×630 standard OG size; 1200×1200 square fallback.

**Optional:** the small app-icon glyph (the rounded-square LSL badge) sits in the upper-right corner at ~96×96 as a brand-surface continuity cue. Optional, not required.

---

## 9. Loading state direction

**Spinner.** A simple navy circular spinner (Lucide `Loader2` rotated) at 18–24px inline, 48px for page-level loading. No gold flair. No pulse, no breathing — just rotation. Honour `prefers-reduced-motion` per spec §5.5 (SHOULD): if reduced-motion is on, render a static dashed navy circle, no rotation.

**Skeleton screens.** Pale grey-blue `#a0aec1` at 30% opacity rectangular blocks matching the layout's content rhythm. No shimmer animation in v1 — the spec doesn't require it and shimmer reads as "consumer app", which conflicts with the serious-payroll-tool posture.

**Full-page splash.** Centred app-icon glyph (the rounded-square LSL badge) at 80×80, with a 32px circular spinner orbiting just outside the bottom-right gold square. This is the only place where "spinner + brand glyph" combines.

---

## 10. Empty state illustration direction

Per spec §5.2, the platform must ship opinionated empty states for **six** primary surfaces: Employees-empty, Pay Codes-empty, Pay History-empty, Valuations-empty, Liability-empty, Reconciliation-empty.

This document defines the direction; **the six illustrations are NOT produced in this run** (Task 1.3 stops at direction). The future custom-icon designer (v1.1 commission, §11) produces all six in the same posture.

The anchor example [`empty-state-direction.png`](./icon-mockups/empty-state-direction.png) renders the "Employees-empty" illustration.

### Direction rules

1. **Light line-art only.** Stroke 1.5px navy `#48608a`. No fills, no shading, no gradient.
2. **Subtle broken-line details permitted** for secondary structural lines (per spec §5.1) — e.g. dashed row dividers in a table illustration, dashed "drop zone" perimeter for an upload illustration. Use `stroke-dasharray="3 3"`. Never on the primary glyph.
3. **Pale grey-blue** `#a0aec1` for tertiary structural elements (column rules, secondary frames) — pushes them back visually.
4. **One gold accent per illustration max.** Usually the "add" plus, the "imported" check, or the "ready" mark. The accent earns the user's eye.
5. **Generous whitespace inside the frame.** The illustration should feel *open* and invite the action; no busy detail.
6. **Aspect ratio.** Roughly 4:3 (wider than tall) so the illustration sits comfortably above a single-line headline + CTA.
7. **Subject matter** for each empty state — guidance for the v1.1 designer:

   | Empty state | Suggested visual subject |
   | --- | --- |
   | Employees-empty | Empty roster table with a single gold plus circle (the anchor mockup) |
   | Pay Codes-empty | Empty filing-folder grid with one gold tag |
   | Pay History-empty | Empty timeline with a single gold dot at "today" |
   | Valuations-empty | Empty document stack with one gold calculator badge on top |
   | Liability-empty | Empty stacked-bar chart with one gold bar segment |
   | Reconciliation-empty | Empty balance/scales line drawing with a single gold marker on one pan |

8. **Headline + CTA layout** sits below the illustration (not inside it). The illustration owns its own vertical space; the headline + body + CTA stack beneath.

---

## 11. v1.1 custom icon commission brief

**Trigger:** commission a human icon designer **no later than 2 weeks before E5.6 ships** to honour the OQ-2 hard deadline ("custom icon set replaces Lucide by the time E5.6 ships").

**Deliverable:**

1. **~35 custom SVG icons** in the visual posture defined in this document. Includes the 15 from §5 (Lucide map) plus the ~20 most-used Lucide imports detected in the codebase at the point of commission (e.g. `Mail`, `ExternalLink`, `Copy`, `Download`, `Upload`, `Eye`, `EyeOff`, `Lock`, `Unlock`, `Bell`, `Menu`, `X`, `MoreHorizontal`, `ChevronRight`, `ChevronDown`, `ArrowRight`, `RefreshCw`, `Loader2`, `Info`, `XCircle`). The exact list is finalised in a pre-commission audit by the developer agent: `grep -r "from 'lucide-react'" website/` to enumerate actual imports.
2. **Sprite-sheet deliverable format:** a single `icons.svg` sprite with `<symbol>` elements indexed by id, plus a TypeScript barrel re-exporting each as a React component matching the Lucide component-name convention. This keeps the swap to a single-file change in `components/brand/Icon.tsx` (per impl-plan §1.1).
3. **Six empty-state illustrations** in the §10 direction, one per primary surface.

**Constraints to communicate to the designer:**

- **Stroke weight:** 1.5px on a 24×24 viewBox (Lucide-compatible scale) so the swap is a one-line component change, not a re-layout.
- **Container rules:** match this document's §4 — standalone is default; encircled and rounded-square variants ship as separate components.
- **Colour rules:** match this document's §3. The designer ships **monochrome SVG paths** (no embedded fills); colour is applied via `currentColor` and Tailwind classes at consumption time. This is critical — it lets the engineering team re-tint via tokens without re-exporting SVGs.
- **No off-palette colours.** Navy, gold, grey-blue, white only.
- **Naming convention:** PascalCase matching Lucide names where a Lucide equivalent exists (drop-in swap). For LSL-specific icons with no Lucide equivalent (e.g. a custom "LSL accrued weeks" glyph) use a `Lsl` prefix.
- **Licence:** custom commission, work-for-hire. APA owns the IP.

**Acceptance criteria for the v1.1 commission:**

- All 35 SVGs render correctly at 16, 24, 32, 64, 128px.
- Sprite-sheet barrel passes type-check against the existing `components/brand/Icon.tsx` Lucide barrel signature.
- Each icon's encircled and rounded-square container variants are produced.
- The six empty-state illustrations are committed to `docs/brand/empty-states/`.
- Operator approval recorded before the icon barrel swap PR is merged.

---

## Open questions for operator review

None blocking — all decisions are made and flagged inline. Two items invite optional operator pushback:

1. **§6.2 design choice 1 (gold-square-corner vs gold-underline)** — the corner mirror was picked to avoid duplication with the wordmark's gold rule. If the operator prefers a *unifying* visual hook (same gold rule under "LSL" on both wordmark and app icon), revert this and ship the gold-underline instead.
2. **§8 OG-card background colour** — recommendation is white; operator may prefer navy if the brand-presence-in-feed signal is more important than feed legibility.

---

## What is NOT in this document

- Final raster export of the favicon set (Task 1.4)
- Final SVG/PNG export of the app icon (Task 1.4)
- Tokenisation of icon colours into Tailwind theme (Phase 2 / E6.2 — `tailwind.config.ts`)
- Wiring Lucide into the codebase (Phase 2 / E6.2 — `components/brand/Icon.tsx` barrel)
- The 6 empty-state illustrations themselves (v1.1 commission)
- The 35 custom SVG icons themselves (v1.1 commission)

---

## Operator action required

1. Open this doc alongside the four PNG previews in [`./icon-mockups/`](./icon-mockups/).
2. Approve the direction as-is, or push back on §6.2 / §8 / any other section with concrete feedback.
3. Once approved, dispatch the designer agent for **Task 1.4 (final wordmark + app icon + favicon asset production)** — exports the Candidate B SVG + 1×/2×/3× PNGs, the full favicon set per §7, the app icon master per §6, and the safari-pinned-tab SVG.

Do NOT commit Phase 1 deliverables yet — leave them unstaged until the icon direction is approved, so revisions can be made cleanly.
