---
name: email-marketer-nurture
description: Nurture subscribers via Resend transactional email — welcome sequences, weekly digests, re-engagement. Convert site visitors into subscribers and subscribers into clients.
---

# Email Marketer: Subscriber Nurture

## Stack
- **Transactional**: Resend — welcome emails, sequences, one-off sends
- **Campaigns**: Brevo — for audience segmentation, campaign analytics, bulk sends (>500 subscribers or when stakeholder asks)
- **Internal notifications**: Lark (team alerts, not customer-facing) — optional; only used if `LARK_WEBHOOK_URL` is set
- **Subscriber data**: Supabase (`subscribers` table)

## Core Workflows

### 1. Welcome Sequence
Triggered immediately after subscription. Track state via `agents/email-marketer/context/email-index.md`:
- Stage 0 (immediate): Welcome + latest post — subject, HTML body with {{name}} placeholder, latest post link
- Stage 1 (day 3): Value add — best resource or introduction
- Stage 2 (day 7): Offer/CTA — booking, product, or deeper engagement

### 2. Weekly Digest
- Check for new blog posts published since last run (compare against `agents/email-marketer/context/outreach-log.md`)
- Draft digest with post title, URL, 2–3 sentence teaser drawn from `blog.md`
- Send to all active subscribers (`status = 'active'`, `opted_in = true`)
- Append post slug + send date to outreach-log.md to avoid duplicates

### 3. Re-engagement
- For subscribers inactive > 30 days
- Send "haven't seen you around" email
- If no engagement after 2 attempts, mark as `inactive`

## Rules
- Never send to anyone who has not opted in
- Never send the same post twice
- Include unsubscribe link in every email
- Respect sender reputation: warm up new domains, monitor bounce rates
- Transactional → Resend; Campaigns → Brevo (prompt stakeholder when relevant)

## File Paths
| Artifact | Path |
|----------|------|
| Email sequence index | `agents/email-marketer/context/email-index.md` |
| Outreach log | `agents/email-marketer/context/outreach-log.md` |
| Subscriber data | Supabase `subscribers` table |
