# Designer — Task 6.4 — Supabase Auth Email Templates (APA Branding)

**Date:** 2026-05-29
**For:** PR #67 / `feat/E5.1-auth-slice-phase-6` / Task 6.4
**Owner:** Operator clicks the Supabase dashboard; this doc is the spec they paste from.
**Status:** Draft for sign-off — no operator decision required to ship as-is (see §5).

---

## 1. Visual approach

> **One-line summary:** Minimal, dark-on-white. APA navy headings + Source Sans 3 body, **gold accent rule** echoing the wordmark, large primary CTA in `--brand-navy`, generous whitespace.

### Why this approach

Transactional auth email is read in 8 seconds on a phone in bright daylight. The brief is the opposite of marketing email — clarity beats branding density. I'm therefore using only **three** brand tokens (navy, gold, charcoal) on a white background, with the wordmark doing the brand work and the rest of the visual budget spent on the CTA.

### Tokens extracted from `website/src/app/globals.css` (read-only)

| Role | Token | Hex | Where used in the template |
|---|---|---|---|
| Primary surface | `--brand-white` | `#ffffff` | Body background, card background |
| Headings + primary text | `--brand-navy` | `#48608a` | "Confirm your email" headline, links |
| Headings (high-contrast) | `--brand-dark-blue` | `#324d61` | Card heading (chosen over `--brand-navy` for AA contrast on white at body sizes) |
| Body copy | `--brand-charcoal` | `#333232` | Paragraph text, fallback URL |
| Metadata / footer | `--brand-grey` | `#808897` | Footer line, "If you didn't request this…" disclaimer |
| Accent rule | `--brand-gold` | `#d9a428` | 3px horizontal rule under wordmark, echoes the wordmark master's gold rule |
| CTA button | `--brand-navy` on white text | `#48608a` / `#ffffff` | Primary CTA. Navy chosen over gold because gold-on-white fails WCAG AA at button sizes (gold is a *signal*, never a structural surface, per `globals.css` lines 60-77 token-rules comment). |
| Card border | derived `--brand-light-blue` @ 30% | `rgba(160, 174, 193, 0.3)` | Subtle 1px card border |

### Typography choices

Inline web fonts in HTML email are unreliable (Outlook strips them; mobile clients vary). I use a **system stack** with a Google Fonts `<link>` **opt-in** as a progressive enhancement — clients that respect it render closer to the product UI; clients that don't fall back gracefully.

| Token (from `globals.css`) | Email substitution | Notes |
|---|---|---|
| `--font-heading` (Montserrat) | `'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Headline only — short, low render cost |
| `--font-sans` (Source Sans 3) | `'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif` | Body, button, footer |

Type scale (mobile-first — large enough to read at arm's length on a 5.5" screen):

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Headline | 24px | 600 | 1.25 |
| Body | 16px | 400 | 1.5 |
| CTA button | 16px | 600 | 1 |
| Footer / fine print | 13px | 400 | 1.5 |

### Layout

```
┌─────────────────────────────────────────┐
│  (transparent space — Gmail collapses)  │
├─────────────────────────────────────────┤
│                                         │
│         [LSL Calculator wordmark]       │  ← 200px wide, 1× PNG
│         ───  gold rule  ───             │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │  Headline (navy)                │   │
│   │                                 │   │
│   │  Body paragraph 1.              │   │
│   │  Body paragraph 2 (optional).   │   │
│   │                                 │   │
│   │  [ Primary CTA button (navy) ]  │   │
│   │                                 │   │
│   │  Plain-text fallback line.      │   │
│   │  (paste-this URL line)          │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Footer (grey, 13px):                  │
│   – If you didn't request this, ignore. │
│   – APA Long Service Leave Calculator   │
│   – Australian Payroll Association      │
│                                         │
└─────────────────────────────────────────┘
```

Card max-width **560px**; padded **40px** desktop / **24px** mobile via media query.

### Hosted-image strategy

The wordmark must come from a public CDN URL (Supabase doesn't host email assets). Two options:

| Option | Cost | Risk |
|---|---|---|
| **A: Serve from production website** — `https://www.lslcalculator.com.au/brand/wordmark-1x.png` | Free, already deployed | If domain ever changes or `/brand/` route is broken, every past email shows a broken image. The asset is gitignored from `website/public/brand/` (per `docs/brand/final/README.md` line 80) — derived at build via `scripts/sync-brand-assets`. **Confirmed present in `website/public/brand/wordmark-1x.png`** (verified 2026-05-29). |
| B: Inline base64 `<img src="data:...">` | No external request | Gmail strips data URIs in HTML email. Outlook may flag as spam. **Do not use.** |

**Decision:** Option A. Use `https://www.lslcalculator.com.au/brand/wordmark-1x.png` (480×173 PNG, transparent). Fallback to `width="200"` and `alt="LSL Calculator"` so blocked-image clients still show text identity.

---

## 2. The three templates

For all three: the markup is the same shell — only headline, body copy, CTA label, and Supabase bound variable change. Each section below is **ready to paste verbatim** into the Supabase dashboard.

### 2.1 Confirm signup

**Bound variables used:** `{{ .ConfirmationURL }}`

#### Subject line — A/B options

| Option | Length | Tone |
|---|---|---|
| **A (recommended):** `Confirm your APA Long Service Leave Calculator account` | 56 chars | Formal, descriptive |
| B: `Almost there — confirm your email to start calculating LSL` | 58 chars | Warmer, slightly conversational |

I recommend **A** — auth email should read like a system notification, not a marketing nudge. The user just signed up; they're expecting a confirmation, not engagement-bait.

#### Pre-header text

`One click to verify your email and unlock the calculator. Link expires in 24 hours.`

#### HTML body

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirm your email</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
  <style>
    /* Inlined defensively for clients that strip <style>. Media query for mobile padding. */
    @media only screen and (max-width: 600px) {
      .container { padding: 24px 16px !important; }
      .card { padding: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#333232;">
  <!-- Pre-header (hidden) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    One click to verify your email and unlock the calculator. Link expires in 24 hours.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" class="container" style="padding:40px 24px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <img src="https://www.lslcalculator.com.au/brand/wordmark-1x.png"
                   alt="LSL Calculator — by Australian Payroll Association"
                   width="200"
                   style="display:block; width:200px; max-width:200px; height:auto; border:0; outline:none;">
            </td>
          </tr>

          <!-- Gold rule -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:96px; height:3px; background-color:#d9a428; line-height:3px; font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background-color:#ffffff; border:1px solid rgba(160, 174, 193, 0.3); border-radius:12px; padding:40px;">

              <h1 style="margin:0 0 16px 0; font-family:'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:24px; font-weight:600; line-height:1.25; color:#324d61;">
                Confirm your email
              </h1>

              <p style="margin:0 0 16px 0; font-size:16px; line-height:1.5; color:#333232;">
                Welcome to the APA Long Service Leave Calculator. Confirm your email address to activate your account and start calculating LSL entitlements.
              </p>

              <p style="margin:0 0 32px 0; font-size:16px; line-height:1.5; color:#333232;">
                This link expires in 24 hours.
              </p>

              <!-- Primary CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
                <tr>
                  <td align="center" style="background-color:#48608a; border-radius:8px;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block; padding:14px 32px; font-family:'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:16px; font-weight:600; line-height:1; color:#ffffff; text-decoration:none; border-radius:8px;">
                      Confirm email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Plain-text fallback -->
              <p style="margin:0 0 8px 0; font-size:14px; line-height:1.5; color:#808897;">
                If the button doesn't work, paste this link into your browser:
              </p>
              <p style="margin:0; font-size:13px; line-height:1.5; word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#48608a; text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 8px 0 8px; font-size:13px; line-height:1.5; color:#808897; text-align:center;">
              <p style="margin:0 0 8px 0;">
                If you didn't create this account, you can safely ignore this email.
              </p>
              <p style="margin:0;">
                APA Long Service Leave Calculator &middot; Australian Payroll Association
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
```

#### Plain-text fallback

(Supabase doesn't have a separate plain-text field — clients render the HTML stripped. The "paste this link" block inside the HTML serves as the in-body fallback. The hidden pre-header and `alt` text cover screen readers and image-blocked clients.)

---

### 2.2 Reset password

**Bound variables used:** `{{ .ConfirmationURL }}`

#### Subject line — A/B options

| Option | Length | Tone |
|---|---|---|
| **A (recommended):** `Reset your APA Long Service Leave Calculator password` | 53 chars | Formal, descriptive |
| B: `Your password reset link is ready` | 33 chars | Concise, action-oriented |

Recommend **A** — sender clarity matters more than brevity in a security email; the recipient should know exactly which service is asking.

#### Pre-header text

`Click to set a new password. Link expires in 1 hour. If you didn't request this, ignore.`

#### HTML body

Same shell as 2.1 — only the **headline**, **two paragraphs**, **CTA label**, and **link variable** change. Paste the entire 2.1 markup, then make these substitutions:

| Find | Replace with |
|---|---|
| `<title>Confirm your email</title>` | `<title>Reset your password</title>` |
| The pre-header `<div>` text | `Click to set a new password. Link expires in 1 hour. If you didn't request this, ignore.` |
| `<h1>...Confirm your email</h1>` | `<h1 style="...">Reset your password</h1>` |
| First `<p>` (welcome) | `<p style="...">We received a request to reset the password for your APA Long Service Leave Calculator account. Click the button below to set a new password.</p>` |
| Second `<p>` (expiry) | `<p style="...">This link expires in <strong>1 hour</strong>. If you didn't request this reset, you can safely ignore this email — your password will not change.</p>` |
| CTA `<a>` label `Confirm email` | `Reset password` |
| Footer first `<p>` | `<p style="...">If you didn't request this reset, your account is still safe — no action needed.</p>` |

**Important:** the `1-hour expiry` is the Supabase default for recovery tokens; if Phase 6 / Task 6.5 reset-token-lifecycle test is reading anything different, update the copy to match the configured value.

#### Plain-text fallback

Same in-body block as 2.1.

---

### 2.3 Magic link

**Bound variables used:** `{{ .ConfirmationURL }}`

#### Subject line — A/B options

| Option | Length | Tone |
|---|---|---|
| **A (recommended):** `Your sign-in link for the APA LSL Calculator` | 45 chars | Direct, descriptive |
| B: `Click to sign in to LSL Calculator` | 34 chars | Concise |

Recommend **A**.

#### Pre-header text

`One click to sign in. Link expires in 1 hour and works once.`

#### HTML body

Same shell as 2.1. Substitutions:

| Find | Replace with |
|---|---|
| `<title>Confirm your email</title>` | `<title>Sign in to LSL Calculator</title>` |
| Pre-header text | `One click to sign in. Link expires in 1 hour and works once.` |
| `<h1>...Confirm your email</h1>` | `<h1 style="...">Sign in to LSL Calculator</h1>` |
| First `<p>` | `<p style="...">Click the button below to sign in to the APA Long Service Leave Calculator. No password needed.</p>` |
| Second `<p>` | `<p style="...">This link expires in <strong>1 hour</strong> and can only be used once.</p>` |
| CTA label `Confirm email` | `Sign in` |
| Footer first `<p>` | `<p style="...">If you didn't request this sign-in link, you can safely ignore this email.</p>` |

**Note:** Per the brief, magic link may or may not be enabled. Customise the template now so it's ready regardless. Supabase will only send it if the operator enables it under **Authentication → Providers → Email → "Enable Email OTP"** (which controls magic-link sends).

#### Plain-text fallback

Same in-body block as 2.1.

---

## 3. Operator instructions — dashboard click-through

> **Target:** Supabase dashboard for project `woxtujkxatosbirikxtq` (lsl-platform).
> **URL:** https://supabase.com/dashboard/project/woxtujkxatosbirikxtq
> **Estimated time:** 25 minutes (10 min paste, 10 min test sends, 5 min screenshots).

### 3.1 Pre-flight check (do this first)

Verify the wordmark is live on the production site before doing anything else. Open these in a browser:

- [ ] https://www.lslcalculator.com.au/brand/wordmark-1x.png — should display the navy wordmark on transparent background (480×173).
- [ ] If it 404s, ask Developer/DevOps to run `scripts/sync-brand-assets` and redeploy *before* you touch templates — every past email will reference this URL.

### 3.2 Customise the three templates

Path: **Dashboard → Authentication → Email Templates** (left sidebar).

For each of the three templates (**Confirm signup**, **Reset password**, **Magic link**):

1. Click the template name in the left list.
2. **Subject heading** field → paste subject line **A** from §2.x above.
3. **Message body** field → click the **HTML** toggle (the rich-text editor will mangle our markup; HTML mode is required).
4. **Select all** existing markup, delete, paste the full HTML from §2.x.
   - For **Reset password** and **Magic link**, paste the §2.1 HTML, then make the §2.2 / §2.3 substitutions inline.
5. Click **Save changes** at the bottom right.
6. **Important:** do NOT touch the `{{ .ConfirmationURL }}` placeholder — Supabase rewrites it server-side; the template just needs to contain the literal Liquid tag.

### 3.3 Where each field goes (Supabase dashboard mapping)

| Our spec field | Supabase dashboard field |
|---|---|
| Subject line (§2.x) | **"Subject heading"** input at top of the template editor |
| HTML body (§2.x) | **"Message body"** textarea — **HTML mode** must be on |
| Pre-header text (§2.x) | Embedded in the HTML body — Supabase does not have a separate field |
| Plain-text fallback (§2.x) | Embedded in the HTML body — Supabase does not have a separate field |

### 3.4 Send a test email — verify rendering

Supabase doesn't ship a one-click "send test" button, so we trigger each template via a real auth flow against a disposable account:

**Confirm signup test:**
1. Open the production site in an incognito tab → `/app/signup`.
2. Sign up with a throwaway email you control (e.g. `tracy+test-confirm-signup@austpayroll.com.au`).
3. Open the inbox — verify the email arrives within 30s.
4. Check rendering against the §4 checklist.
5. **Clean up:** dashboard → **Authentication → Users** → find the test user → **Delete user**. Otherwise the application-side 5-per-24h resend cap (Task 6.6) will count against this address.

**Reset password test:**
1. Same incognito tab → `/app/forgot-password`.
2. Enter the same throwaway email (must have an existing account; create one first if you deleted the signup test user). Submit.
3. Inbox → verify the reset email arrives.
4. Check rendering against the §4 checklist.

**Magic link test:**
1. Only run this test if magic link is enabled (Dashboard → **Authentication → Providers → Email** → "Enable Email OTP" toggle = ON).
2. Same incognito tab → trigger a magic-link sign-in (route TBD — this flow is not yet built in the app per the brief).
3. If the flow isn't built, **send a manual test** instead: Dashboard → **Authentication → Users** → click a test user → **"Send magic link"** menu action.
4. Inbox → verify the email arrives.
5. Check rendering against the §4 checklist.

### 3.5 Screenshots checklist (for QA / sign-off folder)

Save each screenshot under `docs/engineering/changes/2026-05-29-e51-auth-phase-6/email-template-screenshots/`. **Nine screenshots total — three templates × three clients.**

- [ ] `confirm-signup-gmail-desktop.png`
- [ ] `confirm-signup-ios-mail.png`
- [ ] `confirm-signup-outlook-web.png`
- [ ] `reset-password-gmail-desktop.png`
- [ ] `reset-password-ios-mail.png`
- [ ] `reset-password-outlook-web.png`
- [ ] `magic-link-gmail-desktop.png` (skip if magic link disabled — document the skip in the QA folder README)
- [ ] `magic-link-ios-mail.png`
- [ ] `magic-link-outlook-web.png`

---

## 4. QA / sign-off checklist

Verify each template in each client before flipping Task 6.4 to ✅ DONE in `auth-tasks.md`.

### Per-template render checks

For each of the three templates, in each of **Gmail web, iOS Mail, Outlook web, Apple Mail (macOS)**:

- [ ] Email arrives within 30 seconds of trigger.
- [ ] Subject line matches §2.x exactly — no Supabase default text leaking through.
- [ ] Pre-header preview text shows in the inbox list (Gmail/iOS Mail show this in the inbox; Outlook shows it in the preview pane).
- [ ] Wordmark image loads — if blocked, the `alt` text "LSL Calculator — by Australian Payroll Association" displays in its place.
- [ ] Gold rule renders as a 3px gold horizontal bar under the wordmark (Outlook on Windows 10+ may render thicker — acceptable).
- [ ] Headline is navy (`#324d61`), 24px, bold-ish (Outlook may fall back to system bold — acceptable).
- [ ] Body copy is dark grey (`#333232`), 16px, comfortable to read on mobile without zooming.
- [ ] CTA button is a solid navy rectangle with white text, ~48px tall, rounded corners.
- [ ] CTA button is tappable on mobile (full-width-ish, no need for fine motor control).
- [ ] CTA link goes to a working URL — clicking it lands on the right page (signup → `/app/verify-email`; reset → `/app/reset-password?code=...`; magic → app landing).
- [ ] Plain-text fallback URL is present below the CTA, in a smaller font, and is clickable.
- [ ] Footer is grey, 13px, centered.
- [ ] Total email width does not exceed 560px on desktop; full-bleed with 16-24px padding on mobile.
- [ ] No horizontal scrolling on mobile (iPhone SE width = 375px is the tightest case).
- [ ] No Supabase default footer ("powered by Supabase") leaking in.

### Cross-client gotchas to specifically check

- [ ] **Outlook web** — does the `border-radius` on the CTA render, or do you get sharp corners? (Sharp is acceptable; just confirm.)
- [ ] **Outlook web** — does the gold rule render as a line or a chunky bar? (Both acceptable.)
- [ ] **iOS Mail (dark mode)** — does the white card become a near-black card with white text, or does the inline-CSS lock it to white background with `#333232` text? **Verify text remains readable in dark mode**; if the card stays white but iOS inverts the surrounding chrome, that's fine.
- [ ] **Gmail web** — does the Google Fonts `<link>` actually load Montserrat / Source Sans 3, or do they fall back to system? Either is acceptable; just note which.
- [ ] **Apple Mail (macOS)** — Markdown link auto-detection may render the plain-text fallback URL twice. Confirm the URL is only linked once.

### Sign-off

Once every box above is checked across nine matrix cells:

- [ ] Designer (this doc author): visual fidelity acceptable.
- [ ] PM: copy reviewed for tone and accuracy.
- [ ] QA: rendering verified on the four target clients per the matrix above.
- [ ] Operator: dashboard config saved on all three templates; screenshots committed.

Then flip Task 6.4 to ✅ DONE in `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` with a status note pointing to this doc + screenshot folder.

---

## 5. Open questions / operator decisions before shipping

These do **not** block Task 6.4 — defaults are fine — but flagging for transparency:

1. **Subject line A vs B for each template.** I've recommended A across the board (formal, descriptive). If PM/operator prefer B for the warmth angle, the substitution is mechanical.
2. **Reset-password expiry copy.** I've written "1 hour" matching Supabase's default recovery-link expiry. If Task 6.5's integration test or Auth project settings configure a different value, update the copy to match.
3. **Magic-link enablement.** Currently uncertain whether magic-link is enabled (see brief). The template ships ready regardless. Operator decides whether to flip the toggle under **Authentication → Providers → Email → "Enable Email OTP"**.
4. **Wordmark choice.** I'm using the approved Candidate B wordmark (`wordmark-1x.png` — 480×173 PNG, navy with gold rule). The mono and white-on-navy variants exist (`wordmark-mono.png`, `wordmark-white-on-navy.png`) but the white-background template doesn't need them. If a future dark-mode-native email variant is requested, use `wordmark-white-on-navy.png` against a `#324d61` card surface.
5. **Hosted wordmark URL.** I've used `https://www.lslcalculator.com.au/brand/wordmark-1x.png`. Confirm this 200s when the operator checks pre-flight (§3.1). If the operator hosts these somewhere more durable (e.g. a Supabase Storage bucket with a stable URL, or an S3 CDN), that's strictly better — past emails reference the URL forever, so domain rot is a real cost. **Default to the production website URL for now.**

---

## 6. References

- Brand source of truth: `docs/brand/final/README.md`
- Wordmark master: `docs/brand/final/wordmark/wordmark-master.svg`
- Design tokens: `website/src/app/globals.css` lines 60-77 (palette), 199-210 (type scale)
- Phase 6 brief: `docs/engineering/changes/2026-05-29-e51-auth-phase-6/HANDOFF.md` §"Task 6.4"
- Supabase dashboard: https://supabase.com/dashboard/project/woxtujkxatosbirikxtq/auth/templates
- Bound variables reference: https://supabase.com/docs/guides/auth/auth-email-templates#template-variables
