# QA Report — E6.3 Task 3.8: Skeleton + Spinner

- **Date:** 2026-05-31
- **PR:** [#101](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/101) — `feat/E6.3-3.8-skeleton-spinner` → `main`
- **Spec:** `.specify/features/006-ui-design-system/` (tasks.md lines 410–419; spec §5.3 MUST, §5.5 SHOULD, §8.3 AC)
- **Reviewer:** QA agent
- **Verdict:** **PASS — mergeable as-is**

---

## Scope under review

Six new files; zero existing files modified; zero new dependencies.

| File | LOC | Purpose |
|---|---|---|
| `website/src/components/ui/skeleton.tsx` | 77 | Block-shaped pulsing placeholder, `aria-hidden`, class-name passthrough |
| `website/src/components/ui/skeleton.test.ts` | 48 | Source-level contract tests (4) |
| `website/src/components/ui/skeleton.stories.tsx` | 89 | 5 stories: SingleLine, Paragraph, InputField, Avatar, TableRow |
| `website/src/components/ui/spinner.tsx` | 87 | Rotating `Loader2` glyph, sm/md/lg sizes, optional `label` prop |
| `website/src/components/ui/spinner.test.ts` | 54 | Source-level contract tests (5) |
| `website/src/components/ui/spinner.stories.tsx` | 91 | 5 stories: Medium, Small, Large, WithLabel, InsideButton |

The 16 protected `ui/*` primitives listed in the worktree brief are untouched. Diff matches PR description exactly.

---

## Acceptance criteria verification

### Task 3.8 AC (tasks.md lines 410–419)

| AC | Status | Evidence |
|---|---|---|
| Both components have Storybook stories | PASS | `skeleton.stories.tsx` (5 stories) + `spinner.stories.tsx` (5 stories); both `parameters.a11y.test = 'error'` |
| `prefers-reduced-motion` honoured — Skeleton pulse stops | PASS | `motion-reduce:animate-none` modifier on the className (skeleton.tsx:70); also present on Spinner (spinner.tsx:76). Contract tests assert both. Spec §5.5 SHOULD satisfied. |
| Components consume design tokens — no hard-coded brand colours | PASS | Skeleton uses `bg-brand-light-blue/40`; Spinner uses `text-brand-navy`. Both tokens resolve via `@theme { --color-brand-* }` in `globals.css` (lines verified). Negative assertion in skeleton.test.ts rules out `bg-(gray|slate|zinc|neutral|stone)-*`. |
| Storybook axe-core: zero serious/critical violations | PASS (by config) | Both stories opt into `a11y: { test: 'error' }` — addon will fail the Storybook build on serious/critical findings per design-system convention. (Storybook visual run not executed in this review; relying on CI a11y job + dev report.) |
| Component API sensible for downstream wire-up | PASS | Skeleton: `forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>` — drop-in for any size composition (`h-4 w-32`, `h-9 w-9 rounded-full`, etc.). Spinner: explicit `size` enum + optional `label` covers both "parent owns announcement" and "self-announcing" composition patterns. Each `.stories.tsx` file demonstrates the canonical patterns for the upcoming six routes. |

### Spec §8.3 AC

| AC | Status | Notes |
|---|---|---|
| Every data-fetching `/app/*` surface renders a skeleton or spinner while loading | **DEFERRED (out of scope for this PR)** | Per PR body and brief, route wire-up lands in later PRs. Component layer is correct here. |

---

## Verification performed

| Check | Result |
|---|---|
| `npx vitest run skeleton.test.ts spinner.test.ts` (local, this worktree) | 9 passed, 0 failed, 0 skipped — duration 79 ms |
| CI: TypeScript · Vitest · Build | GREEN |
| CI: Playwright (chromium · webkit · firefox · mobile-chrome) | GREEN |
| CI: Cross-state regression (8 state suites + engine) | GREEN |
| CI: Test-sanctity guard (spec §5.3 + SC-7) | GREEN |
| CI: CSP header smoke (Task 2.10b) | GREEN |
| Vercel preview deployment | SUCCESS |
| PR mergeability | `MERGEABLE` |
| Brand Icon barrel re-exports `Loader2` + `LucideProps` | CONFIRMED (`Icon.tsx`) |
| `bg-brand-light-blue` + `text-brand-navy` defined as Tailwind v4 tokens | CONFIRMED (`globals.css`) |
| No direct `lucide-react` import in either component | CONFIRMED (grep returned no matches) |
| OQ-2 one-file-swap contract preserved (icon imports flow through barrel) | CONFIRMED |

---

## Observations (informational — not blocking)

1. **Brand-light-blue at 40% is a deliberate disabled-adjacent tint.** `globals.css` marks `--brand-light-blue` as "secondary / disabled / structural" — the `/40` opacity correctly reads as a quiet placeholder rather than an active surface. Worth flagging to designer agent if they ever want to introduce a dedicated `--brand-skeleton` token, but no action needed for v1.

2. **Skeleton is `aria-hidden` and Spinner is `aria-hidden` by default.** The component docstrings clearly state the parent must own `role="status"` + `aria-busy="true"` + an sr-only message. The `TableRow` story models this canonical wrapper; downstream consumers must follow the pattern. Recommend the empty-states task (3.7) and the route wire-up tasks include a code-review check for the wrapper.

3. **Spinner's `label` prop is a sensible escape hatch** for inline cases where there's no obvious parent to announce. The branching logic (`role="status"` + `aria-label` when labelled; `aria-hidden="true"` otherwise) is correct — no double-announcement risk.

4. **Vitest tests are source-level (regex-based), not DOM-rendered.** This matches the project's existing pattern (vitest runs in `node` env, no jsdom); a11y verification correctly lives in Storybook. Documented in the test file headers. Not a concern.

5. **No integration with the six `/app/*` data-fetching routes yet** — the PR body is explicit about this, the task description bounds it, and the per-PR scope is appropriate. Spec §8.3 AC ("every data-fetching surface renders…") remains open against later PRs in E6.3.

---

## Verdict

**PASS — PR #101 is mergeable as-is.**

All five Task 3.8 acceptance criteria are met. The §8.3 surface-wide AC is correctly deferred to later PRs. CI is fully green (13/13 checks). The component API is clean, well-documented, and composable for downstream consumers.

No defects. No required changes.

---

**Hard-rules audit:**

- No code files modified by QA. Read-only review only.
- Worktree restored to clean state (already on `feat/E6.3-3.8-skeleton-spinner`, working tree clean).
- No commits, pushes, or PRs created. Report file only, under `docs/`.
- No files touched outside this PR's diff.
