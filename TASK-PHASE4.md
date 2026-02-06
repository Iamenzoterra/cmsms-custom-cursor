# TASK-PHASE4: Effects as Pure Functions

**Priority:** LOW — code quality / maintainability
**Risk:** MEDIUM — directly touches render() (60fps hot path)
**File:** `assets/lib/custom-cursor/custom-cursor.js`
**Fixes:** CODE-005 (long functions), reduces render() by ~350 lines

---

## Problem

4 effects × 4 cursor types = 16 inline calculations in render(), with massive duplication:

| Effect | Lines per type | Total | Pattern |
|--------|---------------|-------|---------|
| Pulse | 3-4 | ~16 | Identical math, different amplitude |
| Shake | 10-12 | ~44 | Identical math, different amplitude |
| Buzz | 12-14 | ~52 | Identical math, different amplitude |
| Wobble | 25-30 | ~108 | Identical spring physics, different state vars |
| Other (spring, apply) | ~65/type | ~260 | NOT extracted — type-specific |

Pulse/shake/buzz differ only in amplitude constant (CORE vs SPECIAL).
Wobble differs only in which state variables (imgWobbleScale vs textWobbleScale vs iconWobbleScale vs wobbleScale).

---

## Solution

Extract 4 pure functions + 1 helper. Call them from render() instead of inline code.

**CRITICAL PERFORMANCE CONSTRAINTS:**
- NO object allocation per frame (GC pressure at 60fps)
- Wobble state mutated in-place via passed object reference
- Pure functions are simple math — V8 will inline them
- No closures created inside render()

---

## Step 1: Add Pure Effect Functions

**WHERE:** After SpecialCursorManager (after line ~677), before `isWobbleEnabled()`.

**INSERT:**

```javascript
// === EFFECT PURE FUNCTIONS (Phase 4) ===
// Extracted from render() to eliminate 4x code duplication.
// Each function is pure math — no DOM access, no side effects.
// Wobble mutates state object in-place to avoid GC pressure.

function calcPulseScale(time, amplitude) {
    return 1 + Math.sin(time) * amplitude;
}

function calcShakeOffset(time, amplitude) {
    var cycle = time % SHAKE_CYCLE_DURATION;
    if (cycle < SHAKE_WAVE_PHASE) {
        return Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * amplitude;
    }
    var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
    return Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * amplitude * (1 - pauseProgress);
}

function calcBuzzRotation(time, amplitude) {
    var cycle = time % BUZZ_CYCLE_DURATION;
    if (cycle < BUZZ_WAVE_PHASE) {
        return Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * amplitude;
    }
    var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
    return Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * amplitude * (1 - pauseProgress);
}

// Wobble mutates wState in-place. Returns matrix string or '' if below threshold.
// wState shape: { velocity, scale, angle, prevDx, prevDy }
function calcWobbleMatrix(wState, dx, dy) {
    var deltaDx = dx - wState.prevDx;
    var deltaDy = dy - wState.prevDy;
    wState.prevDx = dx;
    wState.prevDy = dy;

    var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);
    var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

    var force = (targetScale - wState.scale) * WOBBLE_STIFFNESS;
    wState.velocity += force;
    wState.velocity *= WOBBLE_DAMPING;
    wState.scale += wState.velocity;
    wState.scale = Math.max(0, Math.min(wState.scale, WOBBLE_SCALE_MAX));

    if (velocity > WOBBLE_THRESHOLD) {
        wState.angle = Math.atan2(deltaDy, deltaDx);
    }

    if (wState.scale > WOBBLE_MIN_SCALE) {
        var s = wState.scale * WOBBLE_STRETCH_FACTOR;
        var angle2 = wState.angle * WOBBLE_ANGLE_MULTIPLIER;
        var cos2 = Math.cos(angle2);
        var sin2 = Math.sin(angle2);
        return 'matrix(' + (1 + s * cos2) + ',' + (s * sin2) + ',' + (s * sin2) + ',' + (1 - s * cos2) + ',0,0)';
    }
    return '';
}

function resolveEffect(cursorEffect, globalWobble) {
    if (cursorEffect) {
        return cursorEffect;
    }
    return globalWobble ? 'wobble' : '';
}
```

---

## Step 2: Replace Wobble State Variables with Objects

**WHERE:** Lines ~695-704 (wobble state declarations).

**BEFORE:**
```javascript
var prevDx = OFFSCREEN, prevDy = OFFSCREEN;
var wobbleVelocity = 0, wobbleScale = 0, wobbleAngle = 0;
var imgWobbleVelocity = 0, imgWobbleScale = 0, imgWobbleAngle = 0, imgPrevDx = OFFSCREEN, imgPrevDy = OFFSCREEN;
var textWobbleVelocity = 0, textWobbleScale = 0, textWobbleAngle = 0, textPrevDx = OFFSCREEN, textPrevDy = OFFSCREEN;
var iconWobbleVelocity = 0, iconWobbleScale = 0, iconWobbleAngle = 0, iconPrevDx = OFFSCREEN, iconPrevDy = OFFSCREEN;
```

**AFTER:**
```javascript
// Wobble state objects — mutated in-place by calcWobbleMatrix() to avoid per-frame allocation
var coreWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN, prevDy: OFFSCREEN };
var imgWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN, prevDy: OFFSCREEN };
var textWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN, prevDy: OFFSCREEN };
var iconWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN, prevDy: OFFSCREEN };
```

**⚠️ CC CRITICAL:** These objects are allocated ONCE at init, then mutated in-place every frame. This is intentional — no GC pressure.

---

## Step 3: Refactor render() — IMAGE CURSOR Effects

**FIND:** IMAGE CURSOR effect block in render() (lines ~1734-1817).

**BEFORE (approximate — CC must grep exact code):**
```javascript
// Effect initialization
var effectScale = 1;
var effectOffsetX = 0;
var effectRotate = 0;

// PULSE
if (imageCursorEffect === 'pulse') {
    imageEffectTime += PULSE_TIME_INCREMENT;
    effectScale = 1 + Math.sin(imageEffectTime) * PULSE_SPECIAL_AMPLITUDE;
}

// SHAKE
if (imageCursorEffect === 'shake') {
    imageEffectTime += SHAKE_TIME_INCREMENT;
    var cycle = imageEffectTime % SHAKE_CYCLE_DURATION;
    if (cycle < SHAKE_WAVE_PHASE) {
        effectOffsetX = Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE;
    } else {
        var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
        effectOffsetX = Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE * (1 - pauseProgress);
    }
}

// BUZZ
if (imageCursorEffect === 'buzz') {
    imageEffectTime += BUZZ_TIME_INCREMENT;
    var cycle = imageEffectTime % BUZZ_CYCLE_DURATION;
    if (cycle < BUZZ_WAVE_PHASE) {
        effectRotate = Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE;
    } else {
        var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
        effectRotate = Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE * (1 - pauseProgress);
    }
}

// effectiveEffect + WOBBLE (25+ lines with matrix)
var effectiveEffect = imageCursorEffect || (isWobbleEnabled() ? 'wobble' : '');
if (effectiveEffect === 'wobble') {
    // ... 20 lines of spring physics ...
    // ... matrix calculation ...
}
```

**AFTER:**
```javascript
// Effect calculation via pure functions
var effectScale = 1;
var effectOffsetX = 0;
var effectRotate = 0;
var effectiveEffect = resolveEffect(imageCursorEffect, isWobbleEnabled());

if (effectiveEffect === 'pulse') {
    imageEffectTime += PULSE_TIME_INCREMENT;
    effectScale = calcPulseScale(imageEffectTime, PULSE_SPECIAL_AMPLITUDE);
} else if (effectiveEffect === 'shake') {
    imageEffectTime += SHAKE_TIME_INCREMENT;
    effectOffsetX = calcShakeOffset(imageEffectTime, SHAKE_SPECIAL_AMPLITUDE);
} else if (effectiveEffect === 'buzz') {
    imageEffectTime += BUZZ_TIME_INCREMENT;
    effectRotate = calcBuzzRotation(imageEffectTime, BUZZ_SPECIAL_AMPLITUDE);
} else if (effectiveEffect === 'wobble') {
    var wobbleMatrix = calcWobbleMatrix(imgWobbleState, dx, dy);
    if (wobbleMatrix) {
        imageCursorEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) ' + wobbleMatrix;
    }
}
```

**⚠️ NOTE:** The wobble branch applies transform directly (like current code). The other effects feed into the existing style application block below. CC must verify the exact flow — wobble may skip the normal transform apply, or combine with it. Match current behavior exactly.

---

## Step 4: Refactor render() — TEXT CURSOR Effects

**Same pattern as IMAGE**, but with:
- `textEffectTime` instead of `imageEffectTime`
- `textWobbleState` instead of `imgWobbleState`
- `textCursorEffect` instead of `imageCursorEffect`
- `PULSE_SPECIAL_AMPLITUDE`, `SHAKE_SPECIAL_AMPLITUDE`, `BUZZ_SPECIAL_AMPLITUDE` (same as image)

**⚠️ TEXT has no spring physics** — only effects. The wobble for text uses a counter-rotation on inner element. CC must verify this pattern and preserve it.

---

## Step 5: Refactor render() — ICON CURSOR Effects

**Same pattern as IMAGE**, but with:
- `iconEffectTime` instead of `imageEffectTime`
- `iconWobbleState` instead of `imgWobbleState`
- `iconCursorEffect` instead of `imageCursorEffect`

---

## Step 6: Refactor render() — CORE CURSOR Effects

**Same pattern**, but with:
- `coreEffectTime` instead of type-specific time
- `coreWobbleState` instead of type-specific state
- **CORE_AMPLITUDE** constants instead of SPECIAL_AMPLITUDE:
  - `PULSE_CORE_AMPLITUDE` (0.15 vs 0.08)
  - `SHAKE_CORE_AMPLITUDE` (4 vs 5)
  - `BUZZ_CORE_AMPLITUDE` (15 vs 12)
- Uses `dx, dy` for wobble (not smoothed position — CC verify which position vars core wobble uses)

---

## Step 7: Update SpecialCursorManager — Reset Wobble State

**FIND:** In `SpecialCursorManager.activate()`, each case where effect state is reset.

**ADD** wobble state reset per type:

```javascript
case 'image':
    // ... existing resets ...
    imgWobbleState.velocity = 0;
    imgWobbleState.scale = 0;
    imgWobbleState.angle = 0;
    imgWobbleState.prevDx = OFFSCREEN;
    imgWobbleState.prevDy = OFFSCREEN;
    break;

case 'text':
    // ... existing resets ...
    textWobbleState.velocity = 0;
    textWobbleState.scale = 0;
    textWobbleState.angle = 0;
    textWobbleState.prevDx = OFFSCREEN;
    textWobbleState.prevDy = OFFSCREEN;
    break;

case 'icon':
    // ... existing resets ...
    iconWobbleState.velocity = 0;
    iconWobbleState.scale = 0;
    iconWobbleState.angle = 0;
    iconWobbleState.prevDx = OFFSCREEN;
    iconWobbleState.prevDy = OFFSCREEN;
    break;
```

**Also update `resetCursorState()`** if it resets wobble vars — it should reset the state objects too.

---

## What NOT to Change

| Area | Why |
|------|-----|
| Spring physics (size/rotate) | Type-specific, not duplicated enough |
| DOM style application lines | Each type applies transforms differently |
| Effect TIME_INCREMENT values | Already constants, just referenced |
| detectCursorMode() | Phase 3 done, don't touch |
| `if (imageCursorEl)` guards in render | Structural, stay as-is |

---

## Verification (CC Must Do)

### Before coding:

```bash
# Show exact wobble code for IMAGE (to verify matrix application pattern)
grep -n -A 30 "wobble.*image\|imgWobble\|imageCursorEl.*matrix\|image.*wobble" assets/lib/custom-cursor/custom-cursor.js | head -80

# Show exact wobble code for CORE
grep -n -A 30 "coreTransform\|wobbleVelocity\|wobbleScale\|core.*wobble\|wobble.*core" assets/lib/custom-cursor/custom-cursor.js | head -60

# Verify WOBBLE_SCALE_CLAMP constant exists (used in calcWobbleMatrix)
grep -n "SCALE_CLAMP\|WOBBLE_SCALE_CLAMP" assets/lib/custom-cursor/custom-cursor.js

# Show text cursor wobble (counter-rotation on inner element)
grep -n -A 5 "textCursorInner.*transform\|textWobble\|text.*matrix\|inverse.*matrix\|counter.*rot" assets/lib/custom-cursor/custom-cursor.js
```

### After coding:

```bash
# Verify pure functions exist
grep -n "function calcPulseScale\|function calcShakeOffset\|function calcBuzzRotation\|function calcWobbleMatrix\|function resolveEffect" assets/lib/custom-cursor/custom-cursor.js

# Verify pure functions are called in render
grep -n "calcPulseScale\|calcShakeOffset\|calcBuzzRotation\|calcWobbleMatrix\|resolveEffect" assets/lib/custom-cursor/custom-cursor.js

# Verify no inline effect math remains in render (no raw sin*amplitude patterns)
grep -n "Math.sin.*AMPLITUDE\|Math.sin.*amplitude" assets/lib/custom-cursor/custom-cursor.js
# Expected: ONLY inside the pure function definitions, NOT in render()

# Verify wobble state objects
grep -n "wobbleState\|WobbleState" assets/lib/custom-cursor/custom-cursor.js

# Verify old wobble variables are gone
grep -n "imgWobbleVelocity\|textWobbleVelocity\|iconWobbleVelocity\|wobbleVelocity" assets/lib/custom-cursor/custom-cursor.js
# Expected: NONE (replaced by state objects)

# Count lines in render function (should be ~300-350 less)
sed -n '/function render/,/^    function\|^    var /p' assets/lib/custom-cursor/custom-cursor.js | wc -l

# Build
npm run build
```

---

## Acceptance Criteria

1. ✅ 5 pure functions defined before `isWobbleEnabled()`
2. ✅ 4 wobble state objects replace 15 individual variables
3. ✅ render() uses pure function calls instead of inline math
4. ✅ No `Math.sin(...) * AMPLITUDE` patterns remain in render()
5. ✅ Wobble matrix calculation identical output (compare visually)
6. ✅ Pulse/shake/buzz visually identical to before
7. ✅ All 4 effects work on all 4 cursor types (image/text/icon/core)
8. ✅ No per-frame object allocation (wobble state mutated in-place)
9. ✅ Text cursor wobble counter-rotation preserved
10. ✅ `npm run build` succeeds
11. ✅ render() is ~300-350 lines shorter

---

## Agent Invocation Plan

1. **render-engine** — CRITICAL: verify 60fps path, no allocations, no perf regression
2. **code-quality** — verify DRY, function naming, consistency
3. **memory-guardian** — verify wobble state objects don't leak
4. **doc-keeper** — update DOCS

---

## Risk Mitigation

**If wobble looks different after refactor:**
- Most likely cause: different position vars passed to `calcWobbleMatrix()`
- IMAGE/ICON wobble uses smoothed dx,dy
- CORE wobble uses smoothed dx,dy too (or raw? CC must verify)
- TEXT wobble has counter-rotation on inner — this is OUTSIDE calcWobbleMatrix

**If performance degrades:**
- V8 inlines small functions aggressively — unlikely
- If profiling shows overhead: mark functions with `// @inline` comment (for humans) and verify V8 isn't creating hidden classes

**Text cursor wobble special case:**
- Text applies wobble matrix to outer, then INVERSE matrix to inner (counter-rotation keeps text readable)
- `calcWobbleMatrix()` returns the matrix string
- The inverse calculation stays inline in the text block — it's the ONLY type-specific wobble logic

---

## Notes for CC

- Line numbers are post-Phase 3. Always grep first.
- The `if/else if` chain (pulse/shake/buzz/wobble) is intentional — only one effect active at a time.
- `resolveEffect()` handles the global wobble fallback. Currently this logic is repeated 4 times as `var effectiveEffect = cursorEffect || (isWobbleEnabled() ? 'wobble' : '')`.
- `WOBBLE_SCALE_CLAMP` — verify this constant exists. It was `1.0` in the code. If it's not a named constant, CC should add it to the CONSTANTS section or use the literal `1.0`.
- effectTime increment (`+= TIME_INCREMENT`) stays in render() — it's the only mutable operation per frame besides the function call. Moving it inside the pure function would make the function impure.
