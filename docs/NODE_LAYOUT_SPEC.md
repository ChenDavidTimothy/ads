# Node Layout Addendum & Test Plan

## Overview
The node chrome now performs content-aware layout so every node resizes around the real text content without changing any wiring behaviour. Handles, port ordering, and React Flow integration remain untouched—only the visual presentation adapts to the copy length, locale, and zoom level.

## Layout & Measurement Model
- Each node card exposes a layout context that tracks every port on both sides.
- Port badges report their rendered height through a `ResizeObserver` so the layout engine knows how much vertical space each label consumes (including multi-line wraps).
- The card computes safe anchor positions using `computePortLayout`, a deterministic algorithm that:
  - Normalises requested percentages to the nearest feasible pixel coordinate.
  - Enforces minimum spacing based on the measured height of adjacent ports plus a 12px gutter.
  - Clamps handles within a 20px top/bottom padding band.
  - Emits the minimum required card height so the node grows when labels require more headroom.
- Position updates are cached per port to avoid unnecessary React state churn.

## Node Sizing Rules
- Base shell uses an adaptive width window (`min 18rem` → `max 28rem`). Nodes expand to accommodate titles and multi-line body copy until that ceiling, then rely on truncation.
- Calculated minimum height from port content is merged with any inline overrides so geometry nodes can still provide explicit dimensions.
- Height recalculations are throttled via resize observation and requestAnimationFrame to prevent layout thrash while dragging or zooming.

## Text Handling Rules
- **Titles**: single-line `truncate` with tooltip; node width grows before truncation kicks in.
- **Port labels**: uppercase pills support two visual lines via `-webkit-line-clamp`, fallback wrapping, and automatically expose tooltips for long copy.
- **Port descriptions**: limited to three lines with consistent 11px typography and WCAG AA colour contrast.
- **Internationalisation**: badges use `whitespace-normal`, `flex-wrap`, and safe system font stacks to support RTL scripts, CJK glyphs, and emoji.

## Port Alignment & Readability
- Handles remain locked to their side; only `top` offsets change.
- Badges reserve up to `16rem` of readable width and sit flush against the interior padding, preventing overlap with the card body.
- Vertical rhythm guarantees at least 12px between adjacent port centres after accounting for the rendered heights.

## Accessibility & Zoom Support
- Typography line-height tightened for dense copy while staying above WCAG recommendations.
- Tooltips are provided via native `title` attributes for truncated labels/descriptions.
- Layout algorithm uses pixel coordinates so zooming from 75%–200% keeps spacing intact.

## Test Plan & Results
- **Automated**: `vitest` coverage verifies the layout solver prevents overlap, honours padding, and reports minimum node height for tall content.
- **Manual QA (spot-checked on updated build)**:
  - Stress ports with 200+ character labels (LTR & RTL) and emoji clusters.
  - Validate maximum port counts per node type at zoom levels 75%, 100%, 150%, 200% in Chrome, Firefox, Safari.
  - Confirm connector wiring remains stable after resizing nodes and dragging edges.
- Observed outcome: no text overlap or handle drift during automated checks and manual spot-verification.
