# Dev Layer Findings — 006-ui-design-system

**Generated:** 2026-05-27
**Source:** speckit-analyze v0.3 split through pm-analyze-split
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.3

These findings are routed to the developer agent. They are NOT surfaced to the operator.

The developer agent MUST resolve all HIGH findings in Phase 0 of `dev-feature-plan` before writing the impl plan.

---

## Findings table

| ID | Issue | Section | Severity | Suggested resolution |
|----|-------|---------|----------|---------------------|
| D-A07 | **PDF generation library selection.** §5.7 says "MUST keep PDF generation server-side or fully client-side without leaking tenant/PII data." Specific lib choice not specified. Candidates: server-side Puppeteer/Playwright (Chromium-based, large memory footprint), `@react-pdf/renderer` (React tree → PDF, no Chromium, deterministic), `pdfkit` (low-level Node), `wkhtmltopdf` (deprecated upstream). | §5.7 / §8.5 | MEDIUM | **Recommend `@react-pdf/renderer`** for v1: deterministic output, no Chromium dependency, no per-PDF cold-start latency on Vercel serverless, no LLM/external dependency. Trade-off: less flexible CSS than Chromium-based renderers; must build A4 templates in `react-pdf` primitives, not arbitrary HTML/CSS. Validate by prototyping the methodology footer + page-X-of-Y under react-pdf during E6.5 Phase 1. |
| D-A15 | **Lighthouse accessibility tooling.** §8.4 names Lighthouse with target ≥ 95. Lighthouse is fine but axe-core is the stronger a11y engine and is already implied in §8.2 acceptance criteria. | §8.4 | LOW | Run BOTH: axe-core CI gate (zero "serious"/"critical") + Lighthouse ≥ 95 as a non-blocking observability metric. Add axe-core to existing Playwright E2E suite. |
| D-A16 | **Storybook or equivalent for component library.** §8.2 says "Storybook or equivalent". Decision deferred to dev. | §8.2 | LOW | **Recommend Storybook 8** for v1 — industry-standard for shadcn-based component libraries, integrates with existing Next.js + Tailwind, supports a11y add-on (chromatic + axe). Defer Chromatic visual-regression to v1.1 (paid service). Lightweight alternative: render all component variants in a `/dev/components` route gated by `NEXT_PUBLIC_DEV_COMPONENTS_ENABLED` flag — zero new dependencies, but no a11y add-on. Operator's call on cost vs simplicity; default Storybook unless told otherwise. |

---

## What dev-feature-plan should do with these

- **D-A07**: Phase 0 spike — build the methodology footer + page-X-of-Y under react-pdf and verify A4 dimensions render correctly across the four report families. If react-pdf doesn't handle the citation block layout cleanly, fall back to server-side Puppeteer with a documented cold-start mitigation strategy.
- **D-A15**: Add axe-core to the existing Playwright suite (`website/e2e/`) as part of E6.2 acceptance criteria. Lighthouse stays as a separate one-shot check.
- **D-A16**: Add Storybook to `website/` as part of E6.2 Phase 1. If operator pushes back on the dependency, switch to the `/dev/components` route fallback — no spec change needed.

## Cross-spec dependencies

- E6 ships in parallel with E5.1 (currently on `feat/E5.1-auth-slice`). E5.1 explicitly does NOT consume E6 design tokens. No merge conflict expected in the token layer, but watch for shadcn version drift between branches.
- E6.2 token layer is the hard gate to E5.2 implementation kickoff. If E6.2 slips, E5.2 must wait.
- The fallback in §3 (APA primary wordmark placeholder if E6.1 blocks > 14 days) removes the wordmark from the E5.2 critical path, but does NOT remove the token layer as a gate.

---

*End of dev findings. Consumed by `dev-feature-plan` Phase 0.*
