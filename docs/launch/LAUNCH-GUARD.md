# LAUNCH GUARD — read before any production cutover action

This file gates the production cutover. Any agent (or human) acting on a
"merge time", "cut over", "go live", or "ship it" signal MUST work through
this guard first. No exceptions.

## Hard gate — Anthropic Zero Data Retention

Zero Data Retention was REQUESTED with Anthropic on **2026-05-23**.
The privacy notice at `/privacy` and the data-handling policy at
`docs/engineering/data-handling-policy.md` both make claims that
only become accurate **once Anthropic has switched ZDR ON for the
production API key**.

Before any merge to `main` that would deploy to production:

1. Log into https://console.anthropic.com with the production account.
2. Navigate to: Settings → Privacy / Data controls (or Workspace settings).
3. Confirm one of the following is TRUE for the production API key:
   - "Zero Data Retention" / "No retention" is toggled ON, OR
   - An enterprise contract is in force that includes no-retention terms.
4. Take a screenshot of the active state and save to
   `docs/launch/zdr-active-screenshot-YYYY-MM-DD.png` so we have a paper
   trail.

**If ZDR is NOT yet active**, STOP. Do not merge to `main`. Options:

- Wait for Anthropic to action the request, OR
- Soft-launch with PDF extraction disabled — wire a feature flag
  (env var like `NEXT_PUBLIC_PDF_EXTRACTION_ENABLED=false`) that
  hides the PDF upload UI and serves a "Coming soon" message. CSV
  path works without Anthropic.

## Other pre-cutover items (lighter gates)

See `README.md` in this folder for the full checklist. The ZDR gate
above is the load-bearing one because everything else either
- Has no privacy/legal exposure (Vercel config, domain mapping), or
- Is already done (branch protection, CI), or
- Can be done quickly at cutover time (preview smoke).

## Why this guard exists

The user explicitly asked the dev agent to remember and remind about
ZDR at cutover time (2026-05-23 chat). This file is the persistent
memory because chat sessions get compacted and prior agreements can
be lost. Treat this file as load-bearing.
