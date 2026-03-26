# WP-027 Phase 1: Suppress CSS Transitions During Forced Size

> Workplan: WP-027 Safari Cursor Freeze on Per-Element Size Override
> Phase: 1 of 4
> Priority: P1
> Estimated: 1-2 hours
> Type: Frontend
> Previous: Phase 0 RECON ✅ (identified 5 root causes, primary = CSS/JS dual animation conflict)
> Next: Phase 2 (Spring epsilon + value rounding)

---

## Context

Safari-specific bug: cursor lags → freezes → disappears when hovering over an element with custom cursor size smaller than default.

```
CURRENT:  CSS transitions on dot/ring width/height/margin (200ms)       ✅ smooth on Chrome/Firefox
          JS RAF writes width/margin every frame via spring physics      ✅ smooth on Chrome/Firefox
          Safari runs BOTH simultaneously → compositor layer teardown    ❌ BROKEN on Safari
MISSING:  Transition suppression during JS-driven size changes           ❌
          will-change fix on .cmsmasters-cursor-image                    ❌
```

The codebase ALREADY has the exact pattern we need — `applyForcedType()` (JS:2273-2277) suppresses transitions on the ring during type changes. We extend this pattern to cover size changes.

---

## PHASE 0: Audit (do FIRST — CRITICAL)

```bash
# 1. Verify the existing transition suppression pattern in applyForcedType()
grep -n "transition" assets/lib/custom-cursor/custom-cursor.js | head -30

# 2. Find applyForcedDotSize and applyForcedDotHoverSize — the functions we'll modify
grep -n "applyForcedDotSize\|applyForcedDotHoverSize" assets/lib/custom-cursor/custom-cursor.js

# 3. Find the CSS transitions on dot and ring that we need to suppress
grep -n "transition:" assets/lib/custom-cursor/custom-cursor.css | head -20

# 4. Find the will-change declaration on .cmsmasters-cursor-image
grep -n "will-change" assets/lib/custom-cursor/custom-cursor.css

# 5. Find where forced size is cleared (leaving element / restoring default)
grep -n "removeProperty.*dot-size\|clearForcedDot\|showDefaultCursor" assets/lib/custom-cursor/custom-cursor.js | head -10

# 6. Check existing body classes related to cursor transitions
grep -n "cmsmasters-cursor.*class\|classList.*add\|classList.*remove" assets/lib/custom-cursor/custom-cursor.js | grep -i "transit\|size\|forced" | head -10
```

**Document your findings before writing any code.**

**IMPORTANT:** The existing pattern at `applyForcedType()` uses inline `ring.style.transition = 'none'` then restores via RAF. For size changes we use a body class instead because BOTH dot AND ring need suppression simultaneously, and a body class is cleaner than setting inline transition on two elements.

---

## Task 1.1: Add CSS Transition Suppression Rule

### What to Build

Add a CSS rule that suppresses all transitions on dot and ring when a body class is present.

```css
/* Suppress transitions during JS-driven size changes (Safari fix - WP-027) */
body.cmsmasters-cursor-size-transitioning .cmsmasters-cursor-dot,
body.cmsmasters-cursor-size-transitioning .cmsmasters-cursor-ring {
	transition: none !important;
}
```

### Integration

Add this in `assets/lib/custom-cursor/custom-cursor.css` after the existing dot/ring transition declarations (after line ~180, in the same section). Place it with a clear comment linking to WP-027.

---

## Task 1.2: Apply Transition Suppression in applyForcedDotSize()

### What to Build

Before setting the CSS custom property, add the suppression class. Remove it after 1 RAF frame.

```javascript
// In applyForcedDotSize() — before the setProperty call:
document.body.classList.add('cmsmasters-cursor-size-transitioning');

// existing: body.style.setProperty('--cmsmasters-cursor-dot-size', forcedDotSize + 'px', 'important');

// After setProperty — remove class after 1 RAF to let transitions resume:
requestAnimationFrame(function() {
    document.body.classList.remove('cmsmasters-cursor-size-transitioning');
});
```

### Integration

Find `applyForcedDotSize()` (JS around line 2320-2328). Wrap the existing `setProperty` call with the class add/remove pattern.

**IMPORTANT:** Study how `applyForcedType()` (JS:2273-2277) does this exact pattern with `ring.style.transition`. Follow the same structure — the pattern is proven.

---

## Task 1.3: Apply Transition Suppression in applyForcedDotHoverSize()

### What to Build

Same pattern as Task 1.2 but for `applyForcedDotHoverSize()` (JS around line 2333-2340).

```javascript
document.body.classList.add('cmsmasters-cursor-size-transitioning');
// existing setProperty call
requestAnimationFrame(function() {
    document.body.classList.remove('cmsmasters-cursor-size-transitioning');
});
```

---

## Task 1.4: Apply Transition Suppression When Clearing Forced Size

### What to Build

When the cursor LEAVES an element with custom size and forced size is cleared (restoring default), the same CSS/JS conflict occurs in reverse. Find where `--cmsmasters-cursor-dot-size` and `--cmsmasters-cursor-dot-hover-size` are removed/cleared (look for `removeProperty` calls related to dot-size) and apply the same suppression pattern.

**IMPORTANT:** Trace the full flow — there may be multiple paths that clear forced size:
- Leaving the element (mouse out)
- `showDefaultCursor()` restoring defaults
- `deactivate()` on special cursor manager

Each path that removes the CSS custom property needs the transition suppression.

---

## Task 1.5: Fix will-change on .cmsmasters-cursor-image

### What to Build

Change `will-change: transform, width` to `will-change: transform` on `.cmsmasters-cursor-image` (CSS around line 295).

```css
/* BEFORE: */
will-change: transform, width;

/* AFTER: */
will-change: transform;
```

`width` in `will-change` tells Safari to promote width changes to the compositor — but Safari can't compositor-animate `width`, so it makes things WORSE by forcing re-rasterization on every width change.

---

## Files to Modify

- `assets/lib/custom-cursor/custom-cursor.css` — add transition suppression rule, fix will-change
- `assets/lib/custom-cursor/custom-cursor.js` — add class add/remove in applyForcedDotSize, applyForcedDotHoverSize, and size-clearing paths

---

## Acceptance Criteria

- [ ] `body.cmsmasters-cursor-size-transitioning` class is added before any `--cmsmasters-cursor-dot-size` setProperty/removeProperty
- [ ] Class is removed after exactly 1 RAF frame
- [ ] CSS rule suppresses ALL transitions on dot and ring when class is present
- [ ] `will-change: transform, width` changed to `will-change: transform` on `.cmsmasters-cursor-image`
- [ ] No visual regression on Chrome (transitions still work — class is removed after 1 frame)
- [ ] `npm run build` succeeds

---

## MANDATORY: Verification (do NOT skip)

```bash
echo "=== Phase 1 Verification ==="

# 1. CSS rule exists
grep -n "cmsmasters-cursor-size-transitioning" assets/lib/custom-cursor/custom-cursor.css
echo "(expect: transition suppression rule found)"

# 2. JS adds/removes class in applyForcedDotSize
grep -n "size-transitioning" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: classList.add and classList.remove calls found)"

# 3. will-change fixed
grep -n "will-change" assets/lib/custom-cursor/custom-cursor.css
echo "(expect: .cmsmasters-cursor-image has 'will-change: transform' without 'width')"

# 4. Build passes
npm run build
echo "(expect: no errors)"

# 5. Verify the existing applyForcedType pattern is intact (not broken)
grep -A5 "applyForcedType" assets/lib/custom-cursor/custom-cursor.js | head -10
echo "(expect: ring.style.transition pattern still present)"

echo "=== Verification complete ==="
```

---

## MANDATORY: Write Execution Log (do NOT skip)

After verification (before committing), create the file:
`logs/wp-027/phase-1-result.md`

Structure (fill all sections — write N/A if not applicable, do NOT omit sections):

```markdown
# Execution Log: WP-027 Phase 1 — Suppress CSS Transitions During Forced Size
> Epic: Safari Cursor Freeze Bug
> Executed: {ISO timestamp}
> Duration: {minutes}
> Status: COMPLETE | PARTIAL | FAILED

## What Was Implemented
{2-5 sentences describing what was actually built}

## Key Decisions
| Decision | Chosen | Why |
|----------|--------|-----|
| ... | ... | ... |

## Files Changed
| File | Change | Description |
|------|--------|-------------|
| `path` | created/modified/deleted | brief description |

## Issues & Workarounds
{Problems encountered and resolutions. "None" if clean.}

## Open Questions
{Non-blocking questions. "None" if none.}

## Verification Results
| Check | Result |
|-------|--------|
| CSS rule exists | /  |
| JS class add/remove | /  |
| will-change fixed | /  |
| Build passes | /  |
| applyForcedType intact | /  |

## Git
- Commit: `{sha}` — `{message}`
```

Then include `logs/` in your `git add` before committing.

---

## Git

```bash
git add assets/lib/custom-cursor/custom-cursor.js assets/lib/custom-cursor/custom-cursor.min.js assets/lib/custom-cursor/custom-cursor.css assets/lib/custom-cursor/custom-cursor.min.css logs/wp-027/phase-1-result.md
git commit -m "fix(safari): suppress CSS transitions during forced cursor size [WP-027 phase 1]"
```

---

## IMPORTANT Notes for CC

- **Study `applyForcedType()` first** (JS:2273-2277) — it's the proven pattern. Follow its structure.
- **Do NOT remove CSS transitions entirely** — they're needed for smooth appearance on Chrome/Firefox. We only suppress them for the 1 frame where JS writes the new size.
- **Trace ALL paths that set/clear forced dot size** — missing one path means the bug still occurs when leaving certain elements.
- **Run `npm run build` after changes** — server reads only `.min.*` files.
- **Run security-sentinel and render-engine agents** after implementation per CLAUDE.md invocation matrix (custom-cursor.js changed).
