# TASK: Structural Refactor — Constants + State Machine

**Type:** Refactor (zero behavioral change)
**Target:** `assets/lib/custom-cursor/custom-cursor.js`
**Priority:** HIGH — addresses root cause of unpredictable cascade bugs
**Estimated scope:** ~200 lines added/reorganized, 0 features changed

---

## ⚠️ Build System Reminder

```
Source file:   assets/lib/custom-cursor/custom-cursor.js    ← EDIT THIS
Minified file: assets/lib/custom-cursor/custom-cursor.min.js ← server reads this
Build:         npm run build (= grunt build)
```

**NEVER edit `.min.js` files.** After all changes, remind user to run `npm run build`.

---

## Problem Statement

`custom-cursor.js` is a 2100-line monolith where body class manipulation happens from **15+ scattered locations** with no central coordination. This causes:

1. **Unpredictable cascades** — fixing one thing breaks another (P4 v1 had to be fully removed)
2. **Invalid state combinations** — nothing prevents `cmsm-cursor-on-light` + `cmsm-cursor-on-dark` coexisting
3. **Impossible debugging** — no way to trace which code changed which class when
4. **Magic numbers everywhere** — `0.15`, `500`, `2147483647`, `0.05`, `0.08`, `6.28`, `10` scattered with no explanation

## Solution: Two-Phase Refactor

### Phase 1: Extract named constants
### Phase 2: Extract CursorState object (centralized body class management)

**Critical constraint:** ZERO behavioral changes. Every visual effect, every timing, every interaction must be identical before and after.

---

## Phase 1: Named Constants Extraction

### What to do

Create a `CONSTANTS` section at the top of the IIFE (after the sanitizer block, ~line 130, before variable declarations). Extract ALL magic numbers into named constants.

### Complete constant inventory

Extract these from the codebase into named constants:

```javascript
// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

// --- Position interpolation ---
// (L and dotL already exist as variables at ~line 70, keep them)

// --- Adaptive mode ---
var DETECT_DISTANCE = 5;           // already exists at line ~229
var HYSTERESIS = 3;                // already exists at line ~230
var MAX_DEPTH = 10;                // already exists at line ~234
var STICKY_MODE_DURATION = 500;    // already exists at line ~233

// --- Spring physics (size/rotate transitions) ---
var TRANSITION_STIFFNESS = 0.15;   // already exists at line ~279
var TRANSITION_DAMPING = 0.75;     // already exists at line ~280

// --- Wobble effect ---
var WOBBLE_MAX = 0.6;              // already exists at line ~309
var WOBBLE_STIFFNESS = 0.25;       // already exists at line ~310
var WOBBLE_DAMPING = 0.78;         // already exists at line ~311
var WOBBLE_THRESHOLD = 6;          // already exists at line ~312
var WOBBLE_VELOCITY_SCALE = 0.012; // NEW: extract from line ~1503 (velocity * 0.012)
var WOBBLE_DEFORMATION_MULT = 2;   // NEW: extract from line ~1503 (targetScale * 2)
var WOBBLE_SCALE_MAX = 1.2;        // NEW: extract from line ~1510 (Math.min(..., 1.2))
var WOBBLE_STRETCH_FACTOR = 0.5;   // NEW: extract from line ~1517 (wobbleScale * 0.5)
var WOBBLE_ANGLE_MULTIPLIER = 2;   // NEW: extract from line ~1519 (wobbleAngle * 2)
var WOBBLE_MIN_SCALE = 0.001;      // NEW: extract from line ~1515 (wobbleScale > 0.001)

// --- Pulse effect ---
var PULSE_TIME_INCREMENT = 0.05;   // NEW: extract from render() effectTime += 0.05
var PULSE_CORE_AMPLITUDE = 0.15;   // NEW: sin(t) * 0.15 (±15% for dot/ring)
var PULSE_SPECIAL_AMPLITUDE = 0.08; // NEW: sin(t) * 0.08 (±8% for image/text/icon)

// --- Shake effect ---
var SHAKE_TIME_INCREMENT = 0.08;   // NEW: extract from render() effectTime += 0.08
var SHAKE_CYCLE_DURATION = 10;     // NEW: effectTime % 10
var SHAKE_WAVE_PHASE = 6.28;       // NEW: cycle < 6.28 (≈ 2π)
var SHAKE_WAVE_MULTIPLIER = 2;     // NEW: sin(cycle * 2)
var SHAKE_CORE_AMPLITUDE = 4;      // NEW: sin(...) * 4 (±4px)
var SHAKE_SPECIAL_AMPLITUDE = 5;   // NEW: sin(...) * 5 (±5px)

// --- Buzz effect ---
var BUZZ_TIME_INCREMENT = 0.08;    // NEW: same timing as shake
var BUZZ_CYCLE_DURATION = 10;      // NEW: same cycle as shake
var BUZZ_WAVE_PHASE = 6.28;        // NEW: same phase structure as shake
var BUZZ_WAVE_MULTIPLIER = 2;      // NEW: sin(cycle * 2)
var BUZZ_CORE_AMPLITUDE = 15;      // NEW: sin(...) * 15 (±15°)
var BUZZ_SPECIAL_AMPLITUDE = 12;   // NEW: sin(...) * 12 (±12°)

// --- Smoothness presets (line ~213-215) ---
var SMOOTH_PRECISE = 1;
var SMOOTH_SNAPPY = 0.5;
var SMOOTH_NORMAL = 0.25;
var SMOOTH_SMOOTH = 0.12;
var SMOOTH_FLUID = 0.06;
var DOT_SPEED_MULTIPLIER = 2;

// --- Position initialization ---
var OFFSCREEN_POSITION = -200;     // NEW: extract from lines ~187, 206, 305, 317

// --- Event throttling ---
var POPUP_CHECK_INTERVAL_MS = 100;
var DETECTION_THROTTLE_MS = 100;
var SCROLL_THROTTLE_MS = 50;
var FADE_TRANSITION_DELAY_MS = 150;

// --- Element detection ---
var TRANSPARENT_ALPHA_THRESHOLD = 0.15;
var VALID_POSITION_THRESHOLD = 5;
var INITIAL_CURSOR_SIZE_PX = 8;
```

### Rules for this phase

1. **Only rename, never change values** — `0.15` becomes `TRANSITION_STIFFNESS` (still `0.15`)
2. **Some constants already exist** — `DETECT_DISTANCE`, `HYSTERESIS`, `MAX_DEPTH`, `TRANSITION_STIFFNESS`, `TRANSITION_DAMPING`, `WOBBLE_*` are already declared. Move them into the organized constants section
3. **Don't extract constants from CSS** — only from JavaScript. CSS values stay in CSS
4. **Group by subsystem** with clear comment headers
5. **Use JSDoc** on each group:

```javascript
/**
 * Wobble Effect — spring-based directional stretch
 * See: DOCS/13-REF-EFFECTS.md → Wobble Effect
 */
var WOBBLE_STIFFNESS = 0.25;
```

### How to find them

Run these searches on `assets/lib/custom-cursor/custom-cursor.js`:

```bash
# Find all numeric literals
grep -n '[^a-zA-Z_][0-9]\+\.[0-9]\+' assets/lib/custom-cursor/custom-cursor.js

# Find common magic numbers
grep -n '0\.15\|0\.25\|0\.78\|0\.05\|0\.08\|6\.28\|500\|0\.12' assets/lib/custom-cursor/custom-cursor.js

# Find effect calculations in render()
grep -n 'effectTime\|Math\.sin\|Math\.cos\|wobbleScale\|wobbleAngle' assets/lib/custom-cursor/custom-cursor.js

# Find z-index
grep -n 'zIndex\|z-index\|2147483647' assets/lib/custom-cursor/custom-cursor.js
```

### Verification

After Phase 1, the only bare magic numbers remaining should be outside the render/effect functions (CSS property values, DOM constants like element indices).

---

## Phase 2: CursorState Object

### What to do

Create a `CursorState` object that becomes the **single gateway** for all body class modifications. No code outside `CursorState` may call `body.classList.add()` or `body.classList.remove()` with cursor classes.

### The state model

Based on `DOCS/12-REF-BODY-CLASSES.md`, here is the complete state:

```javascript
// ═══════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════

/**
 * Centralized cursor state management.
 * ALL body class changes go through CursorState.transition().
 * This enforces mutually exclusive groups and enables debug tracing.
 *
 * State shape:
 *   hover: boolean          — over interactive element
 *   down: boolean           — mouse button pressed
 *   hidden: boolean         — cursor hidden (form/video/iframe/leave)
 *   text: boolean           — text input mode
 *   mode: null|'on-light'|'on-dark'  — adaptive mode
 *   size: null|'sm'|'md'|'lg'        — ring size modifier
 *   blend: null|'soft'|'medium'|'strong' — blend intensity
 *
 * See: DOCS/12-REF-BODY-CLASSES.md for full state machine diagram
 */
var CursorState = {
    _state: {
        hover: false,
        down: false,
        hidden: false,
        text: false,
        mode: null,       // 'on-light' | 'on-dark' | null
        size: null,        // 'sm' | 'md' | 'lg' | null
        blend: null        // 'soft' | 'medium' | 'strong' | null
    },

    /**
     * Apply a state change. Only changed properties trigger DOM updates.
     * @param {object} change — partial state object, e.g. { hover: true, size: 'lg' }
     * @param {string} [source] — caller identifier for debug tracing
     */
    transition: function(change, source) {
        var prev = {};
        var changed = false;

        for (var key in change) {
            if (change.hasOwnProperty(key) && this._state[key] !== change[key]) {
                prev[key] = this._state[key];
                this._state[key] = change[key];
                changed = true;
            }
        }

        if (changed) {
            this._applyToDOM(prev);
        }
    },

    /**
     * Get current state value
     * @param {string} key — state property name
     * @returns {*} current value
     */
    get: function(key) {
        return this._state[key];
    },

    /**
     * Reset interaction state on mouseout.
     * Resets: hover, text, hidden (from hover), size.
     * Does NOT reset: mode, blend, down.
     */
    resetHover: function() {
        this.transition({
            hover: false,
            text: false,
            size: null
        }, 'resetHover');
    },

    /**
     * Sync DOM classes from state. Only touches changed properties.
     * @private
     */
    _applyToDOM: function(prev) {
        // --- Boolean toggles ---
        if ('hover' in prev) {
            body.classList.toggle('cmsm-cursor-hover', this._state.hover);
        }
        if ('down' in prev) {
            body.classList.toggle('cmsm-cursor-down', this._state.down);
        }
        if ('hidden' in prev) {
            body.classList.toggle('cmsm-cursor-hidden', this._state.hidden);
        }
        if ('text' in prev) {
            body.classList.toggle('cmsm-cursor-text', this._state.text);
        }

        // --- Mutually exclusive: Adaptive mode ---
        if ('mode' in prev) {
            if (prev.mode) {
                body.classList.remove('cmsm-cursor-' + prev.mode);
            }
            if (this._state.mode) {
                body.classList.add('cmsm-cursor-' + this._state.mode);
            }
        }

        // --- Mutually exclusive: Size ---
        if ('size' in prev) {
            if (prev.size) {
                body.classList.remove('cmsm-cursor-size-' + prev.size);
            }
            if (this._state.size) {
                body.classList.add('cmsm-cursor-size-' + this._state.size);
            }
        }

        // --- Mutually exclusive: Blend ---
        if ('blend' in prev) {
            if (prev.blend) {
                body.classList.remove('cmsm-cursor-blend-' + prev.blend);
                if (!this._state.blend) {
                    body.classList.remove('cmsm-cursor-blend');
                }
            }
            if (this._state.blend) {
                body.classList.add('cmsm-cursor-blend');
                body.classList.add('cmsm-cursor-blend-' + this._state.blend);
            }
        }
    }
};
```

### Where body classes are currently manipulated

Here is every location in `custom-cursor.js` that touches body classes. **Each must be replaced with a `CursorState.transition()` call.**

These line numbers are from CC's own verification scan of the actual file:

| Line | Current code | Replace with |
|---|---|---|
| 219 | `body.classList.add('cmsm-cursor-theme-' + theme)` | **KEEP AS-IS** (init-only) |
| 398-407 | `setBlendIntensity()` removes/adds `blend-*` | `CursorState.transition({ blend: intensity \|\| null })` |
| 785-787 | `applyMode()` removes/adds `on-light`/`on-dark` | `CursorState.transition({ mode: mode })` |
| 842 | `body.classList.add('cmsm-cursor-hidden')` for hide | `CursorState.transition({ hidden: true })` |
| 850 | `body.classList.add('cmsm-cursor-hidden')` for P4 | `CursorState.transition({ hidden: true })` |
| 1395 | `body.classList.remove('on-light', 'on-dark')` | `CursorState.transition({ mode: null })` |
| 1942 | mousedown add `cmsm-cursor-down` | `CursorState.transition({ down: true })` |
| 1945 | mouseup remove `cmsm-cursor-down` | `CursorState.transition({ down: false })` |
| 1973 | mouseover hidden (data-cursor="hide") | `CursorState.transition({ hidden: true })` |
| 1988 | mouseover hidden (forms) | `CursorState.transition({ hidden: true })` |
| 1995 | mouseover hidden (video/iframe) | `CursorState.transition({ hidden: true })` |
| 2005 | `body.classList.add('cmsm-cursor-text')` | `CursorState.transition({ text: true, hover: true })` |
| 2007 | `body.classList.add('cmsm-cursor-hover')` | `CursorState.transition({ hover: true })` |
| 2009 | `body.classList.add('cmsm-cursor-size-' + size)` | `CursorState.transition({ size: size })` |
| 2029 | mouseout remove hidden (forms) | `CursorState.transition({ hidden: false })` |
| 2038 | mouseout remove hidden (video) | `CursorState.transition({ hidden: false })` |
| 2075 | `resetCls.forEach(remove)` | `CursorState.resetHover()` |
| 2080 | mouseleave add hidden | `CursorState.transition({ hidden: true })` |
| 2083 | mouseenter remove hidden | `CursorState.transition({ hidden: false })` |

### What NOT to include in CursorState

These classes are managed differently and should **NOT** go through CursorState:

| Class | Why excluded |
|---|---|
| `cmsm-cursor-enabled` | Set by PHP, checked by JS, never toggled by JS |
| `cmsm-cursor-theme-*` | Set once at init, not a runtime state change |
| `cmsm-cursor-dual` | Set by PHP only |
| `cmsm-cursor-wobble` | Set by PHP only (feature flag) |
| Special cursor element classes (`cmsm-cursor-image-wobble`, etc.) | On cursor elements, not `<body>` |

### The resetCls variable

Currently at approximately line 764:

```javascript
var resetCls = [
    'cmsm-cursor-hover',
    'cmsm-cursor-text',
    'cmsm-cursor-hidden',
    'cmsm-cursor-size-sm',
    'cmsm-cursor-size-md',
    'cmsm-cursor-size-lg'
];
```

This gets replaced by `CursorState.resetHover()`. **Remove the `resetCls` variable** and its `forEach(remove)` call at line ~2075.

### setBlendIntensity() refactor

Replace body of `setBlendIntensity(intensity)` (~line 398):

```javascript
function setBlendIntensity(intensity) {
    CursorState.transition({ blend: intensity || null }, 'setBlendIntensity');
}
```

### applyMode() refactor

Replace body of `applyMode()` (~line 785):

```javascript
CursorState.transition({ mode: mode }, 'applyMode');
```

### Sticky mode integration

The sticky mode check stays as a **guard before** `CursorState.transition()`:

```javascript
if (Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) return;
CursorState.transition({ mode: newMode }, 'detectCursorMode');
lastModeChangeTime = Date.now();
```

---

## Implementation Steps

### Step 1: Create a backup

```bash
cp assets/lib/custom-cursor/custom-cursor.js assets/lib/custom-cursor/custom-cursor.js.pre-refactor
```

### Step 2: Phase 1 — Extract constants

1. Read the full `assets/lib/custom-cursor/custom-cursor.js` file
2. Find all magic numbers listed in the inventory above
3. Create the `CONSTANTS` section after the sanitizer (~line 130)
4. Replace each magic number with its constant name
5. Move existing constant declarations into the organized section
6. **Verify**: No behavioral change. Every value must be identical.

### Step 3: Phase 2 — Add CursorState object

1. Add the `CursorState` object after the constants section
2. **One location at a time**, replace each `body.classList.add/remove` call with `CursorState.transition()`
3. Follow the mapping table above
4. Remove `resetCls` variable and its usage
5. Refactor `setBlendIntensity()` and `applyMode()`
6. **Verify after each change**: Load page, cursor must behave identically

### Step 4: Verify no direct body class manipulation remains

```bash
# This should return ZERO results for cursor classes (except theme at init)
grep -n 'classList\.\(add\|remove\|toggle\).*cmsm-cursor-' assets/lib/custom-cursor/custom-cursor.js | grep -v 'CursorState' | grep -v 'theme' | grep -v 'enabled' | grep -v 'wobble' | grep -v 'cursor-image-\|cursor-text-\|cursor-icon-'
```

### Step 5: Build reminder

After all changes are complete, tell the user:

> ⚠️ Changes are in the source file. Run `npm run build` to generate the minified version that the server reads.

---

## Agent Invocation Plan

After implementing, invoke these agents in order:

| Order | Agent | Why |
|---|---|---|
| 1 | 🔒 **security-sentinel** | Verify sanitizer not touched, no new innerHTML paths |
| 2 | ⚡ **render-engine** | Verify render() loop performance unchanged, effect constants correct |
| 3 | 🎨 **css-compat** | Verify body class state machine preserved, no invalid combinations possible |
| 4 | 🧹 **memory-guardian** | Verify no new allocations, CursorState object is static |
| 5 | 📖 **doc-keeper** | Update DOCS/: 05-API-JAVASCRIPT (CursorState API), 09-MAP-DEPENDENCY (line numbers), 12-REF-BODY-CLASSES (reference CursorState), 02-CHANGELOG |
| 6 | 🧪 **qa-strategist** | Generate regression test plan covering all state transitions |
| 7 | 🔧 **code-quality** | Verify CODE-001 (magic numbers) partially resolved |

---

## Acceptance Criteria

### Functional (must all pass)
- [ ] Cursor follows mouse smoothly (lerp unchanged)
- [ ] Hover: ring grows, `cmsm-cursor-hover` class appears
- [ ] Click: ring shrinks during mousedown
- [ ] Special cursors (image/text/icon) render correctly
- [ ] Effects (wobble/pulse/shake/buzz) animate identically
- [ ] Adaptive mode: light/dark switch without flicker (sticky 500ms)
- [ ] Forms/video/iframe: cursor hides correctly (P4 v2 + P5)
- [ ] Popups: cursor works inside modal (`moveCursorToPopup`)
- [ ] Editor sync: Elementor changes reflect in preview
- [ ] Singleton guard: one instance only
- [ ] Touch devices: cursor hidden

### Structural (must all pass)
- [ ] All magic numbers in effects/timing/physics extracted to named constants
- [ ] Zero direct `body.classList.add/remove('cmsm-cursor-*')` outside CursorState (except init-only classes)
- [ ] `resetCls` array removed
- [ ] `setBlendIntensity()` delegates to CursorState
- [ ] `applyMode()` delegates to CursorState
- [ ] `CursorState._state` matches `DOCS/12-REF-BODY-CLASSES.md` state model
- [ ] Mutually exclusive groups enforced by CursorState

### Security (must all pass)
- [ ] Sanitizer untouched
- [ ] postMessage origin validation untouched
- [ ] Singleton guard untouched
- [ ] No new innerHTML/eval paths

### Performance (must all pass)
- [ ] No new allocations in render() loop
- [ ] CursorState.transition() not called from render() (event handlers only)
- [ ] Frame budget unchanged (~1-6ms per frame)

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Constants extraction breaks a value | Diff every constant against original number |
| CursorState misses a classList call | Grep verification in Step 4 |
| State transition order matters | CursorState applies all changes atomically in single `_applyToDOM` call |
| Performance regression | CursorState called from event handlers (max ~60/sec), not render() (60fps) |
| Elementor editor sync breaks | CursorState manages body classes in preview iframe only. Editor frame untouched |
| Minified file out of sync | Remind user to run `npm run build` after changes |

---

## What This Enables (Future)

Once CursorState exists, these become trivial:

1. **Debug mode**: Add `console.log` in `transition()` to trace every state change
2. **State snapshots**: `JSON.stringify(CursorState._state)` for bug reports
3. **Undo/redo**: Store state history for testing
4. **New states**: Adding a new cursor state = add property to `_state` + add DOM mapping
5. **Phase 3 (future)**: Special Cursor Lifecycle Manager can use CursorState
6. **Phase 4 (future)**: Effect system can check `CursorState.get('hover')` instead of querying DOM

---

## Notes for Claude Code

- Read `DOCS/00-CONTEXT.md` first for orientation
- Read `DOCS/12-REF-BODY-CLASSES.md` for the complete class reference
- Read `DOCS/13-REF-EFFECTS.md` for effect formula details
- Read `DOCS/09-MAP-DEPENDENCY.md` for function locations
- **Line numbers in this document are approximate** — always verify against the actual file before making changes
- **Edit source file only**: `assets/lib/custom-cursor/custom-cursor.js`
- **NEVER touch**: `assets/lib/custom-cursor/custom-cursor.min.js` (auto-generated)
- This is a refactor. If at any point you're changing behavior (not just structure), stop and reassess.
