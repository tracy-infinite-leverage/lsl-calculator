---
name: pm-documentation
description: Scaffold and maintain docs/product/product.md with a strict 14-section format. Run once after pm-client-interview to create the file; re-run whenever product strategy changes. Does NOT write epics, epic-status, or timeline — those are owned by pm-epic-writing.
---

# PM: Product Documentation

Manages exactly **one file**: `docs/product/product.md`.

Epics, epic-status, and timeline are owned by other skills:
- `docs/product/epics.md` → **pm-epic-writing**
- `docs/product/epic-status.md` → **pm-epic-writing**

---

## File: `docs/product/product.md`

Header: `{product name} · Written by {Owner} · Draft v0.1 · {date}`

Framing sentence (first line): *"If you can read this whole document and not be able to tell a stranger why we'd be sad if this product didn't exist, I've failed at writing it."*

Sections in this exact order:

1. `## 1. The problem` — two paragraphs: first states the problem with numbers/evidence; second names the broken assumption. End with "If we're wrong about this, no amount of feature work saves us."
2. `## 2. What we deliver` — N bold verb-noun phrases (max 6), each with a one-sentence explanation
3. `## 3. Who this is for` — 3-paragraph narrative: (a) vivid portrait of the specific person, (b) what they've tried and rejected, (c) 3 anti-personas
4. `## 4. The job they're hiring us for` — two paragraphs: JTBD in behavioral terms; what they go back to if product vanishes
5. `## 5. The wedge` — one feature/mechanism in bold + 3 bullets on why it's specific/deterministic/compounds
6. `## 6. 12 months out` — 3–5 paragraphs walking through the mature product
7. `## 7. What we are explicitly not building` — 4–6 bold categories with one-sentence explanations
8. `## 8. Differentiation table` — Competitor | What they do well | Where they fall short | Our angle (≥3 rows)
9. `## 9. Market and timing` — TAM/SAM/SOM + why now
10. `## 10. Business model` — pricing, unit economics
11. `## 11. What I believe but can't yet prove` — 2–4 load-bearing assumptions, each with falsification test
12. `## 12. How we know it's working` — 2 metrics only: Leading metric + Trailing metric
13. `## 13. Next 90 days` — 3 bets in "end-state, not roadmap" format
14. `## 14. Open decisions` — bulleted: what's undecided + who decides + deadline

Close: `---` then *"What this doc deliberately does not do: feature backlog, integration list, P&L."*

---

## Output Path

| File | Path |
|------|------|
| Product strategy | `docs/product/product.md` |
