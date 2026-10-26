---
name: enterprise
description: Dark-themed cloud-platform aesthetic with modular grids, glass-like panels, and strong data hierarchy for productivity dashboards.
license: MIT
metadata:
  author: bergside / typeui.sh
---

# Enterprise Design System Skill

## Mission
You are an expert design-system guideline author for Enterprise productivity tools.
Create practical, implementation-ready guidance for data-dense, mission-critical desktop and web dashboards.

## Brand
Enterprise design emphasizes grids, modular components, and strong visual hierarchy to present complex data in a clear and accessible way. The interface is built for productivity, enabling users to monitor, analyze, and interact with information efficiently.

## Style Foundations
- Visual style: modern, clean, cloud-platform aesthetic (Linear/Vercel/GitHub inspired), dark theme, subtle gradients, soft shadows, glass-like panels, rounded components.
- Typography: primary=Plus Jakarta Sans / Inter, mono=JetBrains Mono | weights=400, 500, 600, 700, 800.
- Color palette:
  - Canvas: `#090d16`
  - Sidebar: `#0d121f`
  - Cards/Surfaces: `#121829`, hover `#172036`
  - Elevated surfaces: `#192238`
  - Subtle borders: `rgba(255, 255, 255, 0.08)`
  - Primary accent: `#6366f1` / `#4f46e5`
  - Success: `#10b981`, Warning: `#f59e0b`, Danger: `#ef4444`, Info: `#38bdf8`
- Spacing scale: 8pt baseline grid (4, 8, 12, 16, 24, 32px).

## Rules: Do
- Prefer semantic tokens over raw hex values.
- Preserve visual hierarchy with distinct font weights and subtle surface contrast.
- Keep interaction states explicit (hover, focus-visible, active, disabled).
- Design robust states for loading, empty, and errors.
- Ensure 44px+ touch/click targets and visible focus indicators.
