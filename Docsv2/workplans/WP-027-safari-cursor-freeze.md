# WP-027: Safari Cursor Freeze on Per-Element Size Override

> Fix Safari-specific bug where cursor lags, freezes, then disappears when hovering over elements with custom cursor size smaller than default.

**Status:** PLANNING
**Priority:** P1 — Important (Safari-only, but affects all Mac users)
**Prerequisites:** None
**Estimated effort:** 3-5 hours across 4 phases
**Created:** 2026-03-26
**Completed:** —

---

## Problem Statement

On Mac Safari, when a user hovers over an element that sets a custom cursor size smaller than the global default, the cursor starts lagging, then freezes, then disappears entirely. The bug does not reproduce on Chrome or Firefox.

The root cause is a Safari-specific interaction where CSS transitions on geometry properties (`width`, `height`, `margin`) fight with JS RAF-driven animation on the same composited elements. Safari honors both animation sources simultaneously, causing per-frame compositor layer teardown and re-rasterization. Additional contributing factors: layout thrashing in the render loop (write-then-read pattern), spring physics without convergence epsilon (55-70 frames of unnecessary DOM writes), and `mix-blend-mode` forcing full blend composite repaint on every frame.

---

## Solution Overview

### Architecture

```
CURRENT (broken on Safari):
  applyForcedDotSize() sets CSS custom property
    → CSS transition fires on width/height/margin (200ms)
    → SIMULTANEOUSLY JS RAF writes width/margin every frame
    → Safari: dual animation conflict → layer teardown → freeze → disappear

FIXED:
  applyForcedDotSize() sets CSS custom property
    → body class suppresses CSS transition (transition: none)
    → JS RAF writes width/margin every frame (no conflict)
    → 1 RAF later: remove class, restore transitions
    → Spring snaps to target at epsilon threshold (fewer frames)
    → Pixel values rounded (fewer re-layouts)
```

### Key Decisions

| Decision | Chosen | Why | Alternatives considered |
|----------|--------|-----|----------------------|
| How to prevent CSS/JS fight | Suppress transitions via body class during forced size | Existing pattern in codebase (`applyForcedType()` JS:2273-2277) — proven, minimal risk | Remove CSS transitions entirely (breaks non-Safari smoothness) |
| How to reduce animation frames | Spring epsilon snap (0.5px threshold) | Cuts 55-70 frames to ~15-20. Non-visual change — 0.5px is imperceptible | No epsilon (current: wastes ~40 frames of DOM writes) |
| How to reduce layout cost | Math.round() + skip-identical-writes cache | Fewer unique values = fewer Safari re-layouts. Zero visual impact | Transform-only sizing (too invasive for this WP) |
| Scope | Fixes A+B+C+D only | Low risk, high impact. Transform-only sizing (Fix E) is a separate future WP | Full refactor to transform:scale() — correct but too invasive |

---

## What This Changes

### New Files

```
logs/wp-027/phase-0-result.md    ← RECON results (already created)
logs/wp-027/phase-1-result.md    ← Phase 1 execution log
logs/wp-027/phase-2-result.md    ← Phase 2 execution log
logs/wp-027/phase-3-result.md    ← Phase 3 execution log
```

### Modified Files

```
assets/lib/custom-cursor/custom-cursor.js   ← Spring epsilon, skip-identical-writes, Math.round, transition suppression
assets/lib/custom-cursor/custom-cursor.css   ← Transition suppression rule, will-change fix on .cmsmasters-cursor-image
```

### Database Changes

N/A

---

## Implementation Phases

### Phase 1: Suppress CSS Transitions During Forced Size (1-2h)

**Goal:** Eliminate the CSS/JS dual animation conflict — the primary cause of Safari freeze.

**Tasks:**

1.1. **Add transition suppression class** — Add CSS rule: `body.cmsmasters-cursor-size-transitioning .cmsmasters-cursor-dot, body.cmsmasters-cursor-size-transitioning .cmsmasters-cursor-ring { transition: none !important; }`

1.2. **Apply class in applyForcedDotSize()** — Before setting `--cmsmasters-cursor-dot-size`, add `cmsmasters-cursor-size-transitioning` to body. Remove after 1 RAF frame (same pattern as `applyForcedType()` JS:2273-2277).

1.3. **Apply same pattern in applyForcedDotHoverSize()** (JS:2333-2340) and in the reverse path (leaving element, restoring default size).

1.4. **Fix `will-change` on `.cmsmasters-cursor-image`** — Change `will-change: transform, width` (CSS:295) to `will-change: transform` — `width` in `will-change` makes Safari worse, not better.

**Verification:** Manual test on Safari — hover over element with smaller custom cursor size. Cursor should smoothly transition without lag/freeze/disappear. DevTools Performance tab should show no forced reflows during transition.

---

### Phase 2: Spring Epsilon + Value Rounding (1h)

**Goal:** Reduce unnecessary DOM writes from 55-70 frames to ~15-20 per size transition.

**Tasks:**

2.1. **Add epsilon snap to spring physics** — In image cursor spring (JS:2805-2808) and icon cursor spring (JS:2928-2931), add: `if (Math.abs(velocity) < 0.5 && Math.abs(target - current) < 0.5) { current = target; velocity = 0; }`

2.2. **Round pixel values before DOM write** — Apply `Math.round()` to `imgSize` before writing to `style.width`, `style.marginLeft`, `style.marginTop` (JS:2838-2840). Same for `iconSize` before `style.fontSize` (JS:2943).

2.3. **Skip identical DOM writes** — Cache last written values. Only write if rounded value differs from cached value. This eliminates ~80% of DOM writes during spring settling.

**Verification:** Add temporary console.log counting DOM writes per transition. Confirm count dropped from ~60 to ~15. Remove console.log after verification.

---

### Phase 3: Testing & Edge Cases (1h)

**Goal:** Verify fix doesn't break Chrome/Firefox behavior or edge cases.

**Tasks:**

3.1. **Test all cursor types** — dot (default), image, text, icon — each with per-element size override both larger and smaller than default.

3.2. **Test blend mode interaction** — Verify with `mix-blend-mode` active (exclusion, difference, soft-light). This is the worst case for Safari.

3.3. **Test rapid hover** — Quickly move between elements with different cursor sizes. Verify no stuck classes or stale cached values.

3.4. **Test Chrome + Firefox** — Confirm no visual regression. Transitions should feel identical to current behavior.

**Verification:** Manual QA on all browsers available. Execution log documents each test result.

---

### Phase 4: Documentation Update (mandatory, always last)

**Goal:** All docs reflect what was actually built.

**Tasks:**

4.1. **CC reads all phase logs** — understands what was done, what deviated from plan
4.2. **CC proposes doc updates** — list of files to update with proposed changes
4.3. **Brain approves** — reviews proposed changes
4.4. **CC executes doc updates** — updates canonical `Docsv2/` where relevant
4.5. **Update DEVLOG** — append entry to `Docsv2/DEVLOG.md`
4.6. **Update KNOWN-ISSUES / BACKLOG** — close/update Safari issue

**Files to update:**
- `Docsv2/DEVLOG.md` — new entry
- `Docsv2/TRAPS.md` — add TRAP for CSS/JS dual animation on Safari
- `Docsv2/ref/REF-EFFECTS.md` — if spring physics changed
- `Docsv2/BACKLOG.md` — close Safari item if listed
- `logs/wp-027/phase-*-result.md` — phase evidence (must exist)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Transition suppression causes visible snap/jump on non-Safari | Visual regression on Chrome/Firefox | The class is removed after 1 RAF — transitions resume immediately. Test on Chrome/Firefox in Phase 3 |
| Spring epsilon too aggressive (visible size jump) | 0.5px visible as a "pop" at end of animation | 0.5px is below perceptual threshold. Can reduce to 0.25px if needed |
| Cached write values become stale | Cursor stuck at wrong size | Reset cache on cursor type change and on `showDefaultCursor()` |
| Cannot test on Safari directly | Fix might not work | Use Safari-specific WebKit documentation + existing codebase pattern that already works (`applyForcedType`) |

---

## Acceptance Criteria (Definition of Done)

- [ ] Safari: cursor does not lag/freeze/disappear when entering element with smaller custom size
- [ ] Chrome/Firefox: no visual regression in cursor transitions
- [ ] Spring physics snaps to target within 0.5px (no endless asymptotic approach)
- [ ] DOM writes reduced by ~70% during size transitions (measured via console counter)
- [ ] `will-change: transform, width` removed from `.cmsmasters-cursor-image` (CSS:295)
- [ ] All phases logged in `logs/wp-027/`
- [ ] Core docs updated in `Docsv2/` (Phase 4)
- [ ] No known blockers for next WP

---

## Dependencies

| Depends on | Status | Blocks |
|------------|--------|--------|
| None | — | — |

---

## Notes

- RECON (Phase 0) completed 2026-03-26 via 4 parallel agents. Full results in `logs/wp-027/phase-0-result.md`
- Safari testing requires Mac access — developer does not have Mac/Safari available. Fix is theory-based using documented WebKit behavior and existing proven patterns in the codebase.
- Fix E (transform-only sizing) is the most thorough solution but requires significant refactor. Deferred to a future WP if Fixes A-D are insufficient.
- WebKit Bug #27684 (compositor bitmap rasterization on scale, open since 2009) means some sub-pixel rendering issues are unfixable from our side.
