---
name: awesome-design-skills
description: Master design system skill based on bergside/awesome-design-skills (67 design presets). Guides UI/UX architecture, token foundations, component rules, and visual elevation for modern web and desktop apps.
license: MIT
metadata:
  author: bergside / Antigravity
  source: https://github.com/bergside/awesome-design-skills
---

# Awesome Design Skills System

## Mission
You are an elite UI/UX architect and design-system author.
Leverage the curated registry of 67 design system skills to craft visually breathtaking, accessible, and production-ready interfaces for desktop and web applications.

## Design Archetype Selection Matrix

When designing or elevating an application, pick the ideal design archetype based on the product domain:

1. **Enterprise / Cloud Dashboard (Recommended for B2B, Support, CRM, DevTools, Financial & Accounting)**
   - *Preset*: `enterprise` + `sleek`
   - *Aesthetics*: Deep slate dark mode (`#090d16` canvas), translucent glassmorphic surfaces, subtle 1px borders (`rgba(255,255,255,0.08)`), high data density, tabular fonts, accessible status badges.
   - *References*: Linear, Raycast, Vercel, Supabase, GitHub.

2. **Clean / Minimal SaaS**
   - *Preset*: `clean` / `shadcn`
   - *Aesthetics*: High contrast monochrome or subtle primary tint, minimal chrome, generous whitespace, crisp typography.

3. **Modern Creative / Consumer Web**
   - *Preset*: `modern` / `glassmorphism` / `vibrant`
   - *Aesthetics*: Vibrant color gradients, blurred glass panels, expressive typography, rich interactive micro-animations.

4. **Marketing & Landing Pages**
   - *Preset*: `bold` / `editorial` / `agentic`
   - *Aesthetics*: Large display typography, dynamic layouts, bento grids, compelling storytelling visual hierarchy.

## Core Style Foundations for Desktop Applications

- **Typography**: Desktop-first scale with Google Fonts (`Plus Jakarta Sans` or `Inter` for UI, `JetBrains Mono` for IDs, codes, and tabular data). Always use `font-variant-numeric: tabular-nums` for columns, numbers, and dates.
- **Palette**: Strict 60-30-10 color rule. 
  - 60% dominant background surface (`#090d16` to `#0f172a`)
  - 30% structural elements, cards, and borders (`#131b2e` / `rgba(255,255,255,0.08)`)
  - 10% high-intent accent & status colors (Vibrant Indigo `#6366f1`, Emerald `#10b981`, Amber `#f59e0b`, Rose `#ef4444`, Cyan `#06b6d4`).
- **Spacing**: 8pt baseline grid (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
- **Elevation**: Layered surfaces with subtle shadows (`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4)`) and border highlights (`border: 1px solid rgba(255, 255, 255, 0.08)`).
- **Glassmorphism**: `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);` on overlays, dropdowns, headers, and floating toolbars.

## Quality Gates & Accessibility
- WCAG 2.2 AA compliant contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text and UI components).
- Visible, high-contrast focus rings (`outline: 2px solid var(--accent-primary); outline-offset: 2px;`).
- Explicit interactive states: default, hover, active, focus-visible, disabled, and loading.
- Reduced-motion consideration with smooth, non-distracting CSS transitions (150ms-250ms cubic-bezier).
