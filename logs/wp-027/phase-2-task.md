# WP-027 Phase 2: Spring Epsilon + Value Rounding

> Workplan: WP-027 Safari Cursor Freeze on Per-Element Size Override
> Phase: 2 of 4
> Priority: P1
> Estimated: 1 hour
> Type: Frontend
> Previous: Phase 1 ✅ (CSS transition suppression during forced size, 2-frame RAF fence, will-change fix)
> Next: Phase 3 (Testing & Edge Cases)

---

## Context

Phase 1 fixed the primary cause (CSS/JS dual animation conflict). Phase 2 addresses the secondary causes: spring physics that never converges (55-70 frames of sub-pixel DOM writes) and raw float values triggering unnecessary Safari re-layouts.

```
CURRENT:  Spring physics has no epsilon — asymptotically approaches target forever   ❌
          Image cursor writes width/marginLeft/marginTop EVERY frame as raw floats    ❌
          Icon cursor writes fontSize EVERY frame as raw float                        ❌
          ~55-70 frames of DOM writes per size transition                             ❌
MISSING:  Snap threshold to stop spring at < 0.5px from target                       ❌
          Math.round() on pixel values before DOM write                               ❌
          Skip-identical-writes cache                                                 ❌
```

---

## PHASE 0: Audit (do FIRST — CRITICAL)

```bash
# 1. Find image cursor spring physics (stiffness/damping/velocity)
grep -n "imgSizeForce\|imgSizeVelocity\|imgCurrentSize\|TRANSITION_STIFFNESS\|TRANSITION_DAMPING" assets/lib/custom-cursor/custom-cursor.js | head -20

# 2. Find icon cursor spring physics
grep -n "iconSizeForce\|iconSizeVelocity\|iconCurrentSize" assets/lib/custom-cursor/custom-cursor.js | head -15

# 3. Find image cursor DOM writes (width/margin every frame)
grep -n "imageCursorEl.style.width\|imageCursorEl.style.margin" assets/lib/custom-cursor/custom-cursor.js

# 4. Find icon cursor DOM writes (fontSize every frame)
grep -n "iconCursorInner.style.fontSize" assets/lib/custom-cursor/custom-cursor.js

# 5. Find icon cursor offsetWidth/offsetHeight reads (layout thrash)
grep -n "iconCursorEl.offsetWidth\|iconCursorEl.offsetHeight\|iconCachedWidth\|iconCachedHeight\|iconCachedSize" assets/lib/custom-cursor/custom-cursor.js | head -15

# 6. Verify TRANSITION_STIFFNESS and TRANSITION_DAMPING constants
grep -n "TRANSITION_STIFFNESS\|TRANSITION_DAMPING" assets/lib/custom-cursor/custom-cursor.js
```

**Document your findings before writing any code.**

**IMPORTANT:** The spring physics is used for IMAGE and ICON cursor types only. The default dot/ring cursor uses CSS transitions (no spring). Changes must target only the spring-driven code paths.

---

## Task 2.1: Add Spring Epsilon Snap — Image Cursor

### What to Build

In the image cursor spring physics (around JS line 2805-2808), add a convergence guard AFTER the spring calculation:

```javascript
// Existing spring physics:
var imgSizeForce = (imgTargetSize - imgCurrentSize) * TRANSITION_STIFFNESS;
imgSizeVelocity += imgSizeForce;
imgSizeVelocity *= TRANSITION_DAMPING;
imgCurrentSize += imgSizeVelocity;

// ADD after:
if (Math.abs(imgSizeVelocity) < 0.5 && Math.abs(imgTargetSize - imgCurrentSize) < 0.5) {
    imgCurrentSize = imgTargetSize;
    imgSizeVelocity = 0;
}
```

This snaps the spring to target when both velocity AND distance are below 0.5px — imperceptible visually but cuts ~40 frames of unnecessary work.

### Integration

Find the image cursor spring block in `render()`. Add the epsilon check immediately after `imgCurrentSize += imgSizeVelocity;`.

---

## Task 2.2: Add Spring Epsilon Snap — Icon Cursor

### What to Build

Same pattern for icon cursor spring (around JS line 2928-2931):

```javascript
// Existing spring physics:
var iconSizeForce = (iconTargetSize - iconCurrentSize) * TRANSITION_STIFFNESS;
iconSizeVelocity += iconSizeForce;
iconSizeVelocity *= TRANSITION_DAMPING;
iconCurrentSize += iconSizeVelocity;

// ADD after:
if (Math.abs(iconSizeVelocity) < 0.5 && Math.abs(iconTargetSize - iconCurrentSize) < 0.5) {
    iconCurrentSize = iconTargetSize;
    iconSizeVelocity = 0;
}
```

---

## Task 2.3: Round Pixel Values + Skip Identical Writes — Image Cursor

### What to Build

Before writing to DOM (around JS line 2838-2840), round the value and skip if unchanged:

```javascript
var imgSize = Math.round(imgCurrentSize);

// Skip DOM writes if value hasn't changed
if (imgSize !== imgLastWrittenSize) {
    imgLastWrittenSize = imgSize;
    imageCursorEl.style.width = imgSize + 'px';
    imageCursorEl.style.marginLeft = (-imgSize / 2) + 'px';
    imageCursorEl.style.marginTop = (-imgSize / 2) + 'px';
}
```

**IMPORTANT:** Declare `var imgLastWrittenSize = 0;` near the other image cursor state variables (around line 775-790 in SpecialCursorManager or wherever `imgCurrentSize` is declared). Reset it to `0` in the `deactivate()` or cleanup path so it doesn't persist stale values.

Find where `imgCurrentSize` is declared/initialized — declare the cache variable nearby.

---

## Task 2.4: Round Pixel Values + Skip Identical Writes — Icon Cursor

### What to Build

Same for icon cursor fontSize write (around JS line 2943):

```javascript
var iconSize = Math.round(iconCurrentSize);

// Skip DOM writes if value hasn't changed
if (iconSize !== iconLastWrittenSize) {
    iconLastWrittenSize = iconSize;
    if (iconCursorInner) iconCursorInner.style.fontSize = iconSize + 'px';
}
```

Declare `var iconLastWrittenSize = 0;` near the other icon cursor state variables. Reset in cleanup.

**NOTE:** The icon cursor also has the `offsetWidth`/`offsetHeight` read gated by `Math.abs(iconSize - iconCachedSize) > 1`. With rounded values and skip-identical-writes, this read fires MUCH less often — effectively only when `iconSize` actually changes by > 1px, which is a natural improvement.

---

## Task 2.5: Reset Cache Variables on Deactivation

### What to Build

Find where image/icon cursor state is reset (in `deactivate()`, `_removeCurrentType()`, or wherever `imgCurrentSize` is reset to 0). Reset the cache variables there:

```javascript
imgLastWrittenSize = 0;
iconLastWrittenSize = 0;
```

This prevents stale cache from blocking a correct first write on re-activation.

---

## Files to Modify

- `assets/lib/custom-cursor/custom-cursor.js` — spring epsilon in 2 places, round + skip-writes in 2 places, cache variable declarations + resets

---

## Acceptance Criteria

- [ ] Image cursor spring snaps to target within 0.5px (no asymptotic tail)
- [ ] Icon cursor spring snaps to target within 0.5px
- [ ] Image cursor DOM writes use `Math.round()` and skip identical values
- [ ] Icon cursor DOM writes use `Math.round()` and skip identical values
- [ ] Cache variables reset on cursor deactivation
- [ ] `npm run build` succeeds
- [ ] No visual regression — spring animation should feel identical (0.5px is imperceptible)

---

## MANDATORY: Verification (do NOT skip)

```bash
echo "=== Phase 2 Verification ==="

# 1. Spring epsilon — image cursor
grep -A2 "imgCurrentSize = imgTargetSize" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: snap guard with 0.5 threshold)"

# 2. Spring epsilon — icon cursor
grep -A2 "iconCurrentSize = iconTargetSize" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: snap guard with 0.5 threshold)"

# 3. Math.round on image size
grep -n "Math.round(imgCurrentSize)" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: found before DOM writes)"

# 4. Math.round on icon size
grep -n "Math.round(iconCurrentSize)" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: found before DOM writes)"

# 5. Skip-identical-writes cache
grep -n "imgLastWrittenSize\|iconLastWrittenSize" assets/lib/custom-cursor/custom-cursor.js
echo "(expect: declarations + comparisons + resets)"

# 6. Build
npm run build
echo "(expect: no errors)"

echo "=== Verification complete ==="
```

---

## MANDATORY: Write Execution Log (do NOT skip)

After verification (before committing), create the file:
`logs/wp-027/phase-2-result.md`

Structure (fill all sections — write N/A if not applicable, do NOT omit sections):

```markdown
# Execution Log: WP-027 Phase 2 — Spring Epsilon + Value Rounding
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
| Image spring epsilon | ✅/❌ |
| Icon spring epsilon | ✅/❌ |
| Image Math.round | ✅/❌ |
| Icon Math.round | ✅/❌ |
| Cache variables | ✅/❌ |
| Build | ✅/❌ |

## Git
- Commit: `{sha}` — `{message}`
```

---

## Git

```bash
git add assets/lib/custom-cursor/custom-cursor.js assets/lib/custom-cursor/custom-cursor.min.js logs/wp-027/phase-2-result.md
git commit -m "perf(safari): add spring epsilon snap + round pixel values [WP-027 phase 2]"
```

---

## IMPORTANT Notes for CC

- **Only modify spring-driven code paths** (image + icon cursor). The default dot/ring uses CSS transitions, not spring physics — don't touch those.
- **Find where `imgCurrentSize` and `iconCurrentSize` are declared** — that's where to put the cache variables.
- **`imgSize` variable may already exist** — the render loop likely already computes a local `imgSize` from `imgCurrentSize`. Check before creating a duplicate. If it exists, add `Math.round()` to it instead of creating a new variable.
- **Run `npm run build` after changes** — server reads only `.min.*` files.
- **Run security-sentinel and render-engine agents** after implementation per CLAUDE.md invocation matrix.
