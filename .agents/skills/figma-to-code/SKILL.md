---
name: figma-to-code
description: Use when implementing or reviewing any UI (web or mobile) for PI-CORE from the Figma prototype, extracting design tokens, or checking visual fidelity. Load before building or changing a screen or shared component.
---

# Figma-to-code skill

Figma file: https://www.figma.com/design/18T2e8GH2l2zTzn7vkP1ax/PMK-CORE?node-id=0-1 (key `18T2e8GH2l2zTzn7vkP1ax`). Read `docs/DESIGN.md` first.

## Procedure
1. Verify the Figma MCP is configured and authenticated (list its tools; fetch the file). If unavailable, STOP and report; do not guess designs from memory.
2. Enumerate pages/frames; map each frame to the screen inventory in `docs/DESIGN.md`. Note frames that are empty or missing.
3. Per screen: fetch node metadata, screenshot, and variables/styles (colors, type, spacing, radii, shadows). Record exact values; update the token section of DESIGN.md (replace *(approx.)* values).
4. Tokens first: implement/extend the token layer, then shared components (TopBar, BottomNav, Drawer, Card, ListRow, StatCard, Button, Input, Tabs, Dialog, Toast, EmptyState), then screens. Reuse existing components; no duplicates.
5. Implement all states: loading, empty, error, forbidden, offline (mobile). Make it responsive (web) and accessible (labels, contrast, focus, 44px targets).
6. Apply **approved deviations** (DESIGN.md D1–D5) deliberately; do not invent other deviations.
7. Fidelity check: screenshot the implementation and compare with the Figma frame; list differences.

## Distinguish in your report
- **Verified from Figma**: values/layout you read via MCP.
- **Assumption**: anything inferred (e.g., behavior not shown in a static frame).
- **Proposal**: improvements or missing screens (Create/Edit Member, desktop layouts) offered for owner review.

Never treat a visual prototype as a business-logic spec. Do not redesign.
