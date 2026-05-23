# LAUNCH GUARD — read before any production cutover action

This file gates the production cutover. Any agent (or human) acting on a
"merge time", "cut over", "go live", or "ship it" signal MUST work through
this guard first. No exceptions.

## Hard gate #1 — `ANTHROPIC_API_KEY` in Vercel Production env

The Vercel production project (`lsl-calculator` on team
`infiniteleverage-2`) exists but does NOT yet have an
`ANTHROPIC_API_KEY` set in the Production environment. Without it,
`/api/extract-pdf` and `/api/normalize-csv` will return 503 in
production.

Before any merge to `main` that would deploy:

1. Confirm ZDR has been switched on by Anthropic (see hard gate #2).
2. Get the ZDR-enabled production key from console.anthropic.com.
3. Set it in Vercel via either:
   - **Recommended**: ask the dev agent to run
     `vercel env add ANTHROPIC_API_KEY production` and paste the key
     into the prompt. The key disappears from the terminal after
     submission. It DOES briefly appear in chat scrollback — rotate
     either token (Anthropic, or Vercel CLI if exposed) as
     standard hygiene.
   - Or: paste it via the Vercel dashboard → Settings → Environment
     Variables → Production only.
4. Run a manual preview deploy of the current branch + curl
   `/api/normalize-csv` to confirm the key works:
   `vercel deploy --prebuilt` then test the resulting URL.

**Do NOT use the local-dev key** (the one in `website/.env.local`)
for Production. The local key is on Anthropic's standard tier; the
production key needs to be on the ZDR-enabled tier.

## Hard gate #2 — Anthropic Zero Data Retention

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
