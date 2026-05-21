---
name: designer-design-system
description: Maintain a 5-preset design system at docs/brand/style-guide.md with color palettes, typography, spacing, and shadow tokens. Each preset maps to a content type.
---

# Designer: Design System

Maintain `docs/brand/style-guide.md` with 5 presets:

| Preset | Best For | Palette |
|--------|----------|---------|
| Editorial / thought-leadership | Long-form content, analysis | Clean serif + muted palette |
| Technical / product | Docs, product pages | Monospace accents + functional palette |
| Lifestyle / personal | Blogs, personal stories | Warm tones + expressive typography |
| Minimal / clean | Landing pages, portfolios | Generous whitespace, single accent color |
| Bold / creative | Campaigns, creative work | High contrast, experimental layouts |

Each preset defines: color palette (primary, secondary, accent, background, text), typography (headings, body, mono), spacing scale (4px base), border radius tokens, shadow tokens.

## Usage
Before generating any image: read this file, match the blog's tone to the best-fit preset, record the selection as an HTML comment in the image prompt file.
