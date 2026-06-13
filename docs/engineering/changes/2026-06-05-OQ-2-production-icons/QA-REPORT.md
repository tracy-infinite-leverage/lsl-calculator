# QA Report — PR #151 (OQ-2 production icon set, Candidate C)

> **Reviewer:** QA agent
> **Date:** 2026-06-05
> **Branch:** `design/oq-2-production-icons` vs `origin/main`
> **PR:** https://github.com/tracy-infinite-leverage/lsl-calculator/pull/151
> **Verdict:** **PASS with one minor doc-hygiene fix recommended** (broken in-repo links — see §3).
> **Files reviewed:** 159 changed (131 added, 27 deleted, 1 renamed) · all under `docs/brand/`. **Zero diff in `website/src/`.**

---

## 1. Scope correctness — PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| Total named exports in `website/src/components/brand/Icon.tsx` | 42 | 42 | PASS |
| SVGs in `docs/brand/icons/default/` | 42 | 42 | PASS |
| SVGs in `docs/brand/icons/active/` | 42 | 42 | PASS |
| SVGs in `docs/brand/icons/disabled/` | 42 | 42 | PASS |
| Total production SVGs (42 × 3) | 126 | 126 | PASS |
| Filename ↔ export-name mapping (PascalCase → kebab-case) | 1:1 | 1:1 (diff exits 0) | PASS |
| State folders have identical filename sets | yes | yes (no missing icons across states) | PASS |
| Changes under `website/src/` | 0 | 0 | PASS |
| Changes under `website/tests/`, `website/e2e/`, `website/supabase/` | 0 | 0 | PASS |
| `package.json` / `package-lock.json` changes | 0 | 0 | PASS |

**Verification method:**

```
# Diff scope
git diff --name-only origin/main..origin/design/oq-2-production-icons \
  -- 'website/src/' 'website/tests/' 'website/e2e/' 'website/supabase/' \
     package.json package-lock.json | wc -l
# → 0

# SVG counts
git ls-tree -r origin/design/oq-2-production-icons --name-only \
  | grep "^docs/brand/icons/<state>/" | wc -l
# → 42 / 42 / 42

# Filename ↔ export mapping
diff <(exports → kebab-case) <(default/*.svg filenames)
# → exit 0
```

---

## 2. SVG quality bar — PASS (all 126 SVGs audited, not just 5)

Programmatic audit of every SVG under `docs/brand/icons/{default,active,disabled}/`:

| Quality gate | Violations | Result |
|---|---|---|
| `viewBox="0 0 24 24"` present | 0 / 126 | PASS |
| `aria-hidden="true"` on root | 0 / 126 | PASS |
| No `<defs>` | 0 / 126 | PASS |
| No `<g transform>` | 0 / 126 | PASS |
| Brand palette only (`#48608a` / `#d9a428` / `#ffffff` / `#a0aec1`) | 0 / 126 | PASS |
| File size < 1 KB | 0 / 126 over limit | PASS |
| Max file size | 828 bytes (`disabled/calculator.svg`) | matches dev claim |
| Min file size | 256 bytes (`circle.svg`) | — |

**Spot-checked 5 SVGs in detail** (`default/users.svg`, `default/bell.svg`, `default/calculator.svg`, `default/scale.svg`, `default/calendar-range.svg`):

- Every one has the canonical Candidate C pattern: `<circle cx="12" cy="12" r="11" fill="#48608a"/>` + white-stroke glyph.
- Brand palette only; no CSS variables, no class attrs pointing to undefined classes.
- Glyph primitives are `<path>` / `<line>` / `<rect>` / `<polyline>` / `<circle>` only. No nesting, no transforms.
- Inline hex codes — no styling pipeline required for `<img src=…>` consumption.

---

## 3. Brand-judgement icons — PASS, but with a doc-link concern

Every dev-claimed brand decision was honoured in the actual SVGs:

| Icon | Dev claim | Verified |
|---|---|---|
| `calculator.svg` | NO gold | PASS — no `#d9a428` present |
| `bell.svg` | gold unread dot top-right | PASS — `<circle cx="16.5" cy="7.5" r="2" fill="#d9a428"/>` |
| `calendar-range.svg` | gold "today" filled square inside range | PASS — `<rect x="10.75" y="13" width="2.5" height="2.5" rx="0.4" fill="#d9a428"/>` |
| `scale.svg` | gold dot at top hook anchor | PASS — `<circle cx="12" cy="6.5" r="1.2" fill="#d9a428"/>` |
| `git-compare-arrows.svg` | gold dot at crossing/merge join | PASS — `<circle cx="12" cy="12" r="1.1" fill="#d9a428"/>` |
| `check-circle-2.svg` | gold tick inside white ring | PASS — gold polyline tick, white-stroked ring |
| `alert-triangle.svg` | white triangle + gold "!" stem and dot | PASS — both `<line>` segments use `stroke="#d9a428"` |
| `file-warning.svg` | white file + gold "!" dot at base | PASS — gold line at (12, 16.25); inner stem stays white |
| `play.svg` | solid white triangle, NO gold | PASS — no gold; fill+stroke both white |
| `loader-2.svg` | NO gold (per direction §9) | PASS — white stroke only |
| `chevron-down.svg` | 2px stroke (heavier than 1.5px standard) | PASS — `stroke-width="2"` |
| `trash-2.svg` | NO gold (destructive uses red at consume-time) | PASS — no `#d9a428` |

**Gold accent budget audit (default state, 42 icons):**

7 icons carry a gold accent in the default variant: `alert-triangle`, `bell`, `calendar-range`, `check-circle-2`, `file-warning`, `git-compare-arrows`, `scale`. That's **7 / 42 = 16.7%** — well under the direction §3 "~30%" ceiling. **Restraint principle honoured.**

### 3a. Broken intra-repo links — MINOR FIX RECOMMENDED

This PR deletes the entire `docs/brand/icon-candidates/` directory (27 files removed). The README and inventory ship with **3 links pointing into that deleted directory**:

| File | Line | Broken link |
|---|---|---|
| `docs/brand/icons/README.md` | 4 | `../icon-candidates/candidate-c-encircled-stamp/README.md` |
| `docs/brand/icons/README.md` | 4 | `../icon-candidates/README.md` DECISION header |
| `docs/brand/icons/README.md` | 111 | `docs/brand/icon-candidates/candidate-c-encircled-stamp/` (provenance prose) |
| `docs/brand/icons/production-inventory.md` | 3 | `docs/brand/icon-candidates/README.md` DECISION header |

Also note the PR description claims "Doesn't touch `docs/brand/icon-candidates/`" — this is **inaccurate**. 27 files are deleted from that directory in this PR (Candidate A and B concepts, plus Candidate B/C orphans). The Candidate C `calculator.svg` is preserved via a git rename to `docs/brand/icons/default/calculator.svg`.

**Severity:** Minor. The links are reference-only — they don't affect any consumer code or visual rendering. Two options:
1. **Recommended:** keep `docs/brand/icon-candidates/` (revert the 27 deletions) so the historical concept-round artefacts and DECISION header remain reachable — they're load-bearing for the README links and useful for posterity.
2. Alternative: scrub the four README/inventory links and inline the DECISION rationale, then proceed with the deletion.

The dispatch dispatch dispatch (PR description) phrasing "doesn't touch `docs/brand/icon-candidates/`" should be corrected before merge regardless of which option is picked.

---

## 4. State variants — PASS

Spot-checked `users`, `bell`, `settings` for both active and disabled states.

### Active state (gold disc + navy glyph)
- Disc fill: `#d9a428` ✓
- Glyph stroke: `#48608a` ✓
- **Inner gold accents flip to navy** to remain legible on gold (e.g. Bell's unread dot becomes navy) ✓
- AlertTriangle: both "!" stem and dot flip to navy ✓

### Disabled state (grey-blue disc + white glyph at 60% opacity)
- Disc fill: `#a0aec1` (full opacity — preserves silhouette on busy backgrounds) ✓
- Glyph: `#ffffff`, wrapped in `<g opacity="0.6">` ✓
- **Gold accents become white** (then muted with the rest of the glyph by the wrapping group) ✓
- AlertTriangle: both `<line>` elements switch from `stroke="#d9a428"` → `stroke="#ffffff"` inside the opacity group ✓

**Mechanical recolour discipline is consistent across the set.** A tiny indentation inconsistency exists in the disabled SVGs (`<g opacity="0.6">` is not indented relative to its child `<g>`), but it has no rendering impact.

---

## 5. Inventory completeness + barrel-swap actionability — PASS

**`production-inventory.md`:**

- All 42 `Icon.tsx` exports have a row ✓
- Cross-checked 3 consumer claims:
  - `Bell` → `TopNav.tsx`: confirmed (`import { Bell } from '@/components/brand/Icon'`)
  - Sidebar icons (`sidebar-routes.ts`): confirmed (Users, Tag, CalendarRange, Calculator, Scale, GitCompareArrows, Settings all imported)
  - `BookOpen` → `citation-block.tsx`: confirmed
- Surface-by-surface roll-up table covers every UI surface (sidebar, TopNav, UserMenu, TenantSwitcher, Breadcrumbs, calculator forms, result panel, citation block, empty states, Storybook, etc.)
- State-variants transformation table is complete and matches what the SVGs actually do
- Minor: `EmptyState.tsx` is listed as an `Icon` importer but only imports the `LucideProps` type, not an icon name — fair omission from the per-icon consumer column

**`README.md` — Barrel swap strategy section is actionable:**

- Sprite-sheet approach at `website/public/icons/sprite.svg` with `<symbol>` per icon name ✓
- React component-per-export pattern ✓
- `variant?: 'default' | 'active' | 'disabled'` prop on the wrapper ✓
- `LucideProps` → `LslIconProps` migration plus 35-file codemod call-out ✓
- `eslint.config.mjs` allow-list removal step ✓
- `lucide-react` removal after burn-in (with savings: ~120 KB unminified) ✓
- Test surface notes: `brand.test.ts` re-export test stays valid; add visual-regression snapshots ✓
- Roll-back posture: keep `lucide-react` in `package.json` for one release after swap ✓

The follow-up PR has a clear, finite surface. No actionability concerns.

---

## 6. Preview images — PASS

- `docs/brand/icons/preview-grid.png` (2440 × 7600, 1.05 MB): renders the full 42-icon set × 3 states × 3 sizes in a single sheet. Title bar reads "LSL Calculator — OQ-2 Production Icon Set (Candidate C / Encircled Stamp)". Visually consistent family — no glyph "pops out as alien."
- `docs/brand/icons/scale-check.png` (1816 × 1848, 244 KB): sample of 11 icons × 4 sizes (16 / 24 / 32 / 48 px) × 2 backgrounds (white + navy). Confirms readability at 16 px — disc + glyph silhouette remains legible at the smallest target size.
- Source SVGs (`preview-grid.svg`, `scale-check.svg`) are committed alongside the rasters so previews can be re-rendered when the set changes.

---

## 7. Carve-outs / scope guard — PASS (with one caveat)

| Path | Diff | Expected | Result |
|---|---|---|---|
| `website/src/` | 0 files | 0 | PASS |
| `website/tests/` | 0 | 0 | PASS |
| `website/e2e/` | 0 | 0 | PASS |
| `website/src/__tests__/` | 0 | 0 | PASS |
| `website/src/lib/lsl/` | 0 | 0 | PASS |
| `website/supabase/` | 0 | 0 | PASS |
| `package.json` / `package-lock.json` | 0 | 0 | PASS |
| `docs/brand/icon-candidates/` | **27 deletions + 1 rename** | "0 — doesn't touch" per PR description | **MISMATCH (see §3a)** |

The PR description's claim "Doesn't touch `docs/brand/icon-candidates/`" is inaccurate — the directory is fully removed. Either restore those files or update the PR description and scrub the in-repo links in the new README/inventory before merge.

---

## 8. Overall verdict

**PASS** — production-quality work. The icon set is consistent, restrained, well-documented, and entirely scoped to the design surface (zero consumer-code diff). The barrel-swap follow-up has a finite, actionable surface.

**One minor pre-merge fix recommended (doc hygiene, not blocking):**

- Either restore `docs/brand/icon-candidates/` (preferred — preserves the historical concept-round and DECISION header that the new docs link to), **or** scrub the four `../icon-candidates/...` references from `README.md` and `production-inventory.md`.
- Correct the PR description's "Doesn't touch `docs/brand/icon-candidates/`" line — 27 files are deleted from it.

Everything else (file counts, viewBox, aria-hidden, palette purity, sub-1 KB size, gold restraint at ~17%, state-variant correctness, README + inventory completeness, preview-grid readability) is clean and matches the dev's stated decisions.
