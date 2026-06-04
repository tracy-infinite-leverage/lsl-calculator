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

---

## Reinstatement flagged — `ANTHROPIC_API_KEY` REQUIRED before E5.3 Phase 3 ships

**STATUS 2026-06-01 — SOFT-REQUIRED dependency for upcoming E5.3 Phase 3.** E5.3 (Pay-Code Mapping) Phase 3 introduces LLM-assist pass for unresolved pay codes per operator decision OQ-MAP-5 (LLM default-on with per-org opt-out; $0.05 cap; 10s budget; fail-soft when `ANTHROPIC_API_KEY` unset). The `organisations.llm_assist_enabled BOOLEAN NOT NULL DEFAULT true` column shipped in E5.3 Phase 1 (PR #144 commit `59a0692`). The LLM call site itself ships in E5.3 Phase 3.

**Not a hard gate today.** Phase 1 (data layer + RLS) shipped without the key. The fail-soft contract means the LLM-assist pass becomes a no-op if the key is absent — pay-code mapping still runs via the deterministic Phase 2 auto-detect Pass 1. Customers get the deterministic mapping experience; LLM upside is gated behind the key.

**Operator follow-up before E5.3 Phase 3 dispatch** (one-time, dashboard-only):

1. Vercel → `lsl-calculator` → Settings → Environment Variables.
2. Re-add `ANTHROPIC_API_KEY` to Production, Preview, and Development scopes.
3. Confirm Anthropic ZDR posture for the project (privacy notice already covers standard commercial terms — no further docs change required unless ZDR is enabled).

The PDF Removal closure above (2026-05-27) reflected the state when no consumer existed. E5.3 Phase 3 brings a consumer back. Dev agent does not touch Vercel env vars; this is operator-owned.

**When the key is reinstated**, also flip a corresponding note in `.specify/features/008-bulk-import-data-schema/pay-code-mapping.md` §3.8 (LAUNCH-GUARD update task) to record the reinstatement date + scope coverage.

---

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
