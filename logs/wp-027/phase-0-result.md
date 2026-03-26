# Execution Log: WP-027 Phase 0 — RECON: Safari Cursor Freeze
> Epic: Safari Cursor Freeze Bug
> Executed: 2026-03-26T18:00:00Z
> Duration: ~10 minutes (4 parallel agents)
> Status: COMPLETE

## What Was Investigated

Safari-specific bug: when hovering over an element with custom cursor size SMALLER than default, the cursor lags, freezes, then disappears entirely. Hypothesis: excessive recalculations when shrinking cursor size.

4 agents ran in parallel:
1. **render-engine** — analyzed lerp/RAF/spring logic for size transitions
2. **web-search** — searched known Safari/WebKit bugs with transform, scale, RAF
3. **css-compat** — analyzed CSS for Safari-specific pitfalls
4. **code-analysis** — traced full size transition code path with line numbers

## Key Findings

### Root Cause 1 — CSS Transitions Fighting JS RAF (CRITICAL)

**CSS** (`custom-cursor.css:167,179`): dot and ring have `transition: width .2s, height .2s, margin .2s`
**JS** (`custom-cursor.js:2838-2840`): Spring physics writes `width`, `marginLeft`, `marginTop` every frame

Safari honors BOTH animation sources simultaneously. Each JS write restarts the CSS transition. When shrinking, the CSS transition drives geometry from large→small while RAF updates transform every frame. Safari's GPU compositor must reconcile shrinking layer bounds with per-frame transform changes → layer teardown every frame → freeze → disappear.

Chrome/Firefox: JS wins, CSS transition skipped.
Safari: both fight, oscillation, compositor stall.

**Precedent in codebase:** `applyForcedType()` (JS:2273-2277) already uses `transition: none` → 1 RAF → restore pattern for exactly this reason.

### Root Cause 2 — Layout Thrashing in Render Loop (HIGH)

**JS:2943-2949** (icon cursor):
```
iconCursorInner.style.fontSize = iconSize + 'px';  // WRITE
iconCachedWidth = iconCursorEl.offsetWidth;          // READ — forced reflow
```

Write-then-read in RAF = forced synchronous layout every frame during size transition. Safari tears down and re-rasters the composited layer on each forced reflow (due to `will-change: transform`). Chrome/Firefox tolerate this.

**JS:2838-2840** (image cursor): 3 layout property writes per frame (`width`, `marginLeft`, `marginTop`) on a `will-change: transform` element.

### Root Cause 3 — Spring Physics Without Epsilon (MEDIUM)

**JS:2805-2808, 2928-2931**: Spring formula `force = (target - current) * 0.15; velocity *= 0.75` has no snap threshold. Takes ~55-70 frames to settle. During ALL those frames, DOM writes continue every frame even when changes are sub-pixel.

When shrinking, spring overshoots near zero → oscillation extends the number of affected frames.

### Root Cause 4 — mix-blend-mode Compounds Everything (HIGH when active)

**CSS:192-203**: `mix-blend-mode: exclusion/difference` creates isolated stacking context. Safari must repaint full blend composite every frame when child geometry AND transform change simultaneously. `filter: contrast(1.5)` for `blend-strong` is worst case.

### Root Cause 5 — body.style.setProperty Cascade (MEDIUM)

**JS:2324**: `applyForcedDotSize()` writes `--cmsmasters-cursor-dot-size` on `body.style` with `!important`. Invalidates every DOM element inheriting this property. Ring's `--_ring: calc(var(--cmsmasters-cursor-dot-size) + ...)` also recalculates.

### Why "Smaller Than Default" Specifically

1. Larger starting value = more spring distance downward = more frames of oscillation near zero
2. Sub-pixel sizes (< ~4px) can cause Safari to deallocate compositor tile → element disappears
3. Spring overshoot near zero crosses the 1px threshold repeatedly → more `offsetWidth` reads

## Relevant WebKit Bugs

| Bug | Status | Relevance |
|-----|--------|-----------|
| WebKit #27684 (2009!) | OPEN | Composited elements pixelated on scale — bitmap rasterization during size animation |
| WebKit #235106 | OPEN | mix-blend-mode clipping glitches |
| WebKit #215241 | Fixed | Redundant compositing updates — same symptom pattern |
| Safari 18.2 fix | Fixed | "transform animations jump back and forth" |

## Proposed Fix Strategies

| Fix | Complexity | Impact | Description |
|-----|-----------|--------|-------------|
| A: Suppress CSS transitions during forced size | Low | HIGH | Add body class → `transition: none` on dot/ring during `applyForcedDotSize()`. Existing pattern at JS:2273-2277 |
| B: Spring epsilon snap | Low | MEDIUM | `if (abs(velocity) < 0.5 && abs(target - current) < 0.5) snap to target`. Reduces 55-70 frames to ~15-20 |
| C: Round pixel values | Low | MEDIUM | `Math.round()` before DOM writes. Fewer unique values = fewer re-layouts |
| D: Skip identical writes | Low | MEDIUM | Cache last written value, skip if unchanged. Combines well with C |
| E: Transform-only sizing | High | CRITICAL | Replace `width/height/margin` with `transform: scale()`. Transform is compositor-only, no layer teardown. Most thorough fix but requires significant refactor |

## Files Involved

| File | Relevant Lines | Issue |
|------|---------------|-------|
| `custom-cursor.css` | 167, 179 | CSS transitions on width/height/margin |
| `custom-cursor.css` | 192-203 | mix-blend-mode rules |
| `custom-cursor.css` | 46, 295, 337, 365 | will-change declarations |
| `custom-cursor.js` | 2320-2328 | `applyForcedDotSize()` |
| `custom-cursor.js` | 2805-2808, 2928-2931 | Spring physics (no epsilon) |
| `custom-cursor.js` | 2838-2840 | Image cursor: 3 layout writes/frame |
| `custom-cursor.js` | 2943-2949 | Icon cursor: write-then-read layout thrash |

## Open Questions

1. Which cursor type does the reporter use? (dot, image, text, icon?) — affects which code path is hit
2. Is blend mode active when the bug occurs? — significantly amplifies the problem
3. What macOS/Safari version? — Safari 18.2 fixed some transform animation bugs
4. Does the bug occur with `transition: none` forced via DevTools? — would confirm Root Cause 1

## Discoveries

- The codebase ALREADY has the `transition: none` → 1 RAF → restore pattern in `applyForcedType()`. Fix A is just extending this existing pattern to cover size changes too.
- The spring physics is used for image and icon cursor sizing, but the DEFAULT dot/ring cursor uses CSS transitions only (no spring). This means the bug manifests differently per cursor type.
- The `will-change: transform, width` on `.cmsmasters-cursor-image` (CSS:295) actually makes Safari WORSE — it tells Safari to promote `width` changes to the compositor, but Safari can't compositor-animate `width`.
