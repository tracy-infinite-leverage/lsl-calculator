# LAUNCH GUARD — read before any production cutover action

This file gates the production cutover. Any agent (or human) acting on a
"merge time", "cut over", "go live", or "ship it" signal MUST work through
this guard first. No exceptions.

---

## Hard gate — `ANTHROPIC_API_KEY` in Vercel Production env

**STATUS 2026-05-27 — GATE CLOSED BY ELIMINATION.** The PDF Removal sub-spec (`.specify/features/005-lsl-platform/sub-specs/pdf-removal.md`) has shipped on `feat/E5.0-pdf-removal`. `/api/extract-pdf`, `/api/normalize-csv`, `website/src/lib/lsl/parsers/pdf/*`, `website/src/components/lsl/pdf-upload.tsx`, `website/src/server/anthropic.ts`, and the `@anthropic-ai/sdk` dependency have all been deleted. `ANTHROPIC_API_KEY` has zero consumers in the codebase.

**Operator follow-up after merge** (one-time, dashboard-only):

1. Vercel → `lsl-calculator` → Settings → Environment Variables.
2. Delete `ANTHROPIC_API_KEY` from Production, Preview, and Development scopes.
3. (Optional) Revoke the key at https://console.anthropic.com/settings/keys.

The dev agent does not touch Vercel env vars (per `~/.claude/rules/global-engineering.md` — Vercel MCP / CLI is read-only). Removing the leftover variable is operator-owned.

**Historical context retained below.** Original gate text from before the deletion is kept for audit purposes only.

---

### Historical gate text (superseded 2026-05-27)

The Vercel production project (`lsl-calculator` on team
`infiniteleverage-2`) did NOT have an `ANTHROPIC_API_KEY` set in the
Production environment. Without it, `/api/extract-pdf` and
`/api/normalize-csv` returned 503 in production and customers could
not use the PDF / auto-normalised-CSV paths.

The originally-considered fallback was to add the key. The chosen
resolution was to delete the consuming code instead (see status note
above). This eliminates the operational burden (key rotation, ZDR
hygiene, retention disclosure) at the cost of a UX feature that the
operator confirmed was an optional convenience, not load-bearing.

---

## Production domain — `www.lslcalculator.com.au`

Domain is live as of 2026-05-25. The production site is reachable at:

- `https://www.lslcalculator.com.au` (canonical branded URL)
- `https://lsl-calculator.vercel.app` (Vercel-issued URL — still works as a fallback)

Previously the planned domain was `lsl.austpayroll.com.au` (subdomain on
Tracy's existing brand). Switched to a standalone `lslcalculator.com.au`
domain on 2026-05-25 — better SEO, cleaner brand separation now that
the product is "LSL Calculator" not "NSW LSL Calculator".

DNS + Vercel domain configuration owned by operator. No further action
required from agents.

---

## Documented risk — PDF extraction confidence thresholds uncalibrated

**CLOSED 2026-05-27 — moot after PDF Removal.** The PDF extraction
code path has been deleted (see status note in the Hard gate section
above). There is no confidence threshold to calibrate. The original
calibration plan at `docs/engineering/pdf-extraction-calibration.md`
is retained as historical context only.

---

## What changed (history note)

Earlier versions of this guard had a second hard gate requiring
Anthropic Zero Data Retention to be active before launch. That gate
was removed 2026-05-23 after the privacy notice and data-handling
policy were updated to accurately reflect Anthropic's standard
commercial terms (no training on customer data, up to 30 days
retention for service operation and abuse monitoring). When ZDR does
land, update both docs and you may strengthen the disclosure.

---

## Why this guard exists

Persistent reminder because chat sessions get compacted and prior
agreements can be lost. Treat this file as load-bearing — any agent
seeing a cutover signal reads this first.
