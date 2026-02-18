# Custom Cursor v5.6 - Known Issues

**Last Updated:** February 9, 2026
**Version:** 5.6

---

## Overview

This document consolidates all known issues, bugs, and technical debt across the Custom Cursor system. Issues are categorized by type and priority.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ISSUE SUMMARY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Critical:  3 issues    (Architecture, Compatibility)                     │
│   High:      4 issues    (Memory Leaks)                                    │
│   Medium:   12 issues    (Performance, UX)                                  │
│   Low:       4 issues    (Code Quality) — 2 resolved in v5.6               │
│   Deferred:  1 issue     (PERF-001 - too risky)                            │
│   ─────────────────────                                                     │
│   Total:    24 active issues                                                │
│                                                                             │
│   Resolved: 42 issues (tracked for reference)                               │
│   ❌ False Positives: BUG-001, UX-001, UX-002 (not bugs after review)      │
│   ✅ v5.5-SEC: SEC-001/002/003, BUG-002, BUG-003, MEM-001/002/003          │
│   ✅ v5.6: CSS-001, CSS-002, MEM-004, CODE-002, CODE-003, VIS-001          │
│   ✅ v5.6 P4 v2 enhancements: P4-004, P4-005, P4-006 (form bugs)           │
│   ✅ v5.6: DEPLOY-001 (frontend.php breaking other widgets)                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues

### ~~SEC-001: XSS via innerHTML (custom-cursor.js)~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:10-115` |
| **Type** | Security |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v4.0 |
| **Fixed** | February 5, 2026 |

**Resolution:**
Added `sanitizeSvgHtml()` function (~120 lines) that:
- Whitelists 47 SVG tags + 7 HTML tags (all lowercase)
- Whitelists 90+ safe attributes (all lowercase)
- Strips all `on*` event handlers
- Removes `javascript:` URLs
- Sanitizes style attributes (removes `expression()`, `-moz-binding`)

**CRITICAL Note:** All whitelist entries MUST be lowercase (sanitizer uses `toLowerCase()` for comparison).

See: [SVG-SANITIZER.md](../version-5.5-SEC/SVG-SANITIZER.md) for full documentation.

---

### ~~SEC-002: postMessage No Origin Validation (navigator-indicator.js)~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:1-50` |
| **Type** | Security |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v5.0 |
| **Fixed** | February 5, 2026 |

**Resolution:**
- Added `TRUSTED_ORIGIN` constant
- Origin validation in message listener
- All 5 outgoing `postMessage` calls now specify `TRUSTED_ORIGIN` instead of `'*'`

---

### ~~SEC-003: postMessage No Origin Validation (cursor-editor-sync.js)~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `cursor-editor-sync.js:1-30` |
| **Type** | Security |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v5.0 |
| **Fixed** | February 5, 2026 |

**Resolution:**
Same fix as SEC-002:
- Added `TRUSTED_ORIGIN` constant
- Origin check in message listener
- Specified trusted origin for outgoing messages

---

### ~~BUG-003: Multiple Cursor Instances Possible~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:152-158` |
| **Type** | Architecture |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v3.0 |
| **Fixed** | February 5, 2026 |

**Resolution:** Added singleton guard after DOM ready check:
```javascript
// === SINGLETON GUARD (BUG-003 + MEM-003 fix) ===
if (window.cmsmCursorInstanceActive) {
    return; // Already initialized - don't create duplicate listeners
}
window.cmsmCursorInstanceActive = true;
```

**Also fixes MEM-003:** Prevents event listener accumulation in Elementor SPA navigation.
- Recommended: Add instance guard

---

### ~~CSS-001: Z-Index Conflicts~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.css` |
| **Type** | Compatibility |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v1.0 |
| **Fixed** | February 6, 2026 |

**Resolution:** Replaced three hardcoded z-index values with CSS custom properties:
- Default: `--cmsmasters-cursor-z-default: 999999` (was `2147483647`)
- Blend: `--cmsmasters-cursor-z-blend: 9999` (unchanged value, now via variable)
- Popup: uses `--cmsmasters-cursor-z-default` (removed `!important`)

Users can override via custom CSS: `#cmsmasters-cursor-container { --cmsmasters-cursor-z-default: 99999; }`

**Further fix (February 18, 2026 — 3 iterations):** Blend mode cursor was invisible on themes with stacked elements (e.g. Pixel Craft):
1. `--cmsmasters-cursor-z-blend` raised from `9999` to `999999` (matched default z-index)
2. Added `--cmsmasters-cursor-color: #fff` to blend body rules — black cursor is identity element of exclusion/difference math and produces no visual change; white inverts correctly
3. Removed `isolation: isolate` from blend body rules — it was creating a stacking context that prevented blending with body background in gaps between Elementor containers

---

### UX-003: Custom Cursor Not Working in CMSMasters Popups

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js` (isFormZone line 918, detectCursorMode, moveCursorToPopup, setInterval) |
| **Type** | UX Limitation |
| **Status** | ⚠️ GRACEFUL DEGRADATION (system cursor works in both modes) |
| **Since** | v5.5 |
| **Investigated** | February 6, 2026 |
| **Updated** | February 11, 2026 (CSS fallback fix) |

**Description:**
Custom cursor shows system cursor inside CMSMasters Elementor popups. Cursor falls back to system cursor which is functional but not styled.

**Root Cause (investigated):**
Three systems conflict:
1. `moveCursorToPopup()` moves cursor container into popup DOM ✅ works
2. P4 v2 detects `role="dialog"` → hides cursor ❌ overrides step 1
3. `setInterval` popup check → `moveCursorToBody()` fires during popup entrance animation ❌ reverses step 1

**Attempted fixes and why they failed:**
- **isInsidePopup guard** — skip dialog hide when container already in popup. Didn't work because setInterval reversed moveCursorToPopup before the guard could take effect
- **Grace period (500ms)** — delay setInterval checks after moveCursorToPopup. Fixed first open, but second open failed because Elementor doesn't remove popup from DOM on close
- **Re-open detection** — scan for visible `.elementor-popup-modal` in setInterval. Failed because CMSMasters popup wrapper stays `visibility: hidden` even when popup content is visible — visibility is controlled at a deeper nested level
- **Elementor popup events** — `elementor/popup/show` and `elementor/popup/hide` jQuery events don't fire for CMSMasters custom popups
- **CSS class/inline style detection** — popup has identical classes and no inline styles in both open and closed states. No CSS-based detection possible
- **Blend + popup specificity fix** — higher specificity rule for blend inside popup. Fixed z-index but cursor still hidden by P4 v2

**Why graceful degradation instead of full fix:**
CMSMasters popup uses non-standard open/close mechanism with no JavaScript events, no CSS class changes, and nested visibility control. Reliably detecting popup state would require reverse-engineering CMSMasters popup internals, which is fragile and maintenance-heavy.

**Current behavior (as of February 11, 2026):**
- **isFormZone()** detects popups/modals BEFORE button exclusion — ALL elements inside popups now hide custom cursor
- **CSS fallback** ensures system cursor visible in BOTH dual and solo modes:
  ```css
  body.cmsm-cursor-hidden,
  body.cmsm-cursor-hidden * {
      cursor: default !important
  }
  ```
- **System cursor works normally** in popups. All popup functionality (forms, buttons, links, close buttons) works correctly with system cursor.
- **Previously:** CSS fallback only worked in dual mode, leaving users with no cursor in solo mode
- **Now:** CSS fallback works in both modes, ensuring usable cursor at all times

**Possible future fix:** If CMSMasters adds standard popup events or Elementor popup API support, revisit custom cursor inside popups.

---

### ~~CSS-002: color-mix() No Fallback~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.css:341-365` |
| **Type** | Compatibility |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v5.3 |
| **Fixed** | February 5, 2026 |

**Resolution:** Added `@supports` fallback with correct opacity values:
```css
@supports not (background-color: color-mix(in srgb, red 50%, blue)) {
    body.cmsm-cursor-hover .cmsm-cursor-ring {
        background-color: rgba(34, 34, 34, 0.1)  /* 10% mix */
    }
    body.cmsm-cursor-down .cmsm-cursor-ring {
        background-color: rgba(34, 34, 34, 0.9)  /* 90% mix */
    }
    /* Also handles adaptive mode (cmsm-cursor-on-dark) */
}
```

**CRITICAL Note:** Opacity values MUST match color-mix percentages (10% → 0.1, 90% → 0.9)

---

### ~~MEM-001: MutationObserver Not Disconnected~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:39, 749, 1281-1295` |
| **Type** | Memory Leak |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v5.4 |
| **Fixed** | February 5, 2026 |

**Resolution:** Added cleanup on `preview:destroyed` event:
```javascript
var navigatorObserver = null;  // Module-level variable

function cleanup() {
    if (navigatorObserver) {
        navigatorObserver.disconnect();
        navigatorObserver = null;
    }
}

elementor.on('preview:destroyed', cleanup);
```

---

## High Priority Issues

### ~~MEM-002: setInterval Not Cleared (navigator-indicator.js)~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:38, 1084, 1281-1295` |
| **Type** | Memory Leak |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v5.4 |
| **Fixed** | February 5, 2026 |

**Resolution:** Same cleanup function handles both:
```javascript
function cleanup() {
    if (watchModelInterval) {
        clearInterval(watchModelInterval);
        watchModelInterval = null;
    }
}
```

---

### ~~MEM-003: Event Listeners Not Removed~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:152-158` |
| **Type** | Memory Leak |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v3.0 |
| **Fixed** | February 5, 2026 |

**Resolution:** Singleton guard prevents duplicate listener registration:
- In Elementor SPA, script could run multiple times per session
- Now `window.cmsmCursorInstanceActive` prevents re-initialization
- Listeners only attached once per browser session
- See BUG-003 for implementation details

---

### ~~MEM-004: Special Cursor Elements Not Cleaned~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:564-689` |
| **Type** | Memory Leak |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v4.0 |
| **Fixed** | February 6, 2026 |
| **Commit** | `a6e5604` |

**Resolution:**
Added `SpecialCursorManager` object that centralizes special cursor lifecycle:
- Tracks currently active special cursor type (`'image'`, `'text'`, `'icon'`)
- `activate(type, createFn)` automatically deactivates previous type before creating new one
- `deactivate()` removes current special cursor and restores default
- Prevents DOM element accumulation from rapid hover changes

```javascript
// SpecialCursorManager ensures only one special cursor exists at a time
SpecialCursorManager.activate('image', function() {
    createImageCursor(src);
});
// Previous text/icon cursors are automatically removed
```

---

### MEM-005: Typography Cache Unbounded

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:100-150` |
| **Type** | Memory Leak |
| **Status** | Open |
| **Since** | v5.4 |

**Description:**
Typography cache grows without limit or expiration.

---

### ~~BUG-001: Wobble Effect on Ring Only~~ ❌ FALSE POSITIVE

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:1880` |
| **Type** | ~~Bug~~ False Positive |
| **Status** | ❌ **Not a Bug** |
| **Verified** | February 5, 2026 |

**Finding:** Code review confirmed wobble ALREADY applies to BOTH dot and ring:
```javascript
// Line 1880:
dot.style.transform = '...' + coreTransform;
ring.style.transform = '...' + coreTransform;
```

**Why Ring Appears to Wobble More:**
- Ring is larger (40px vs 8px dot)
- Same wobble scale produces more visible deformation on larger element
- Ring has slower lerp (0.25 vs 0.5 for dot), so velocity changes more

---

### ~~BUG-002: Adaptive Mode Flicker~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:230, 791, 800` |
| **Type** | Bug |
| **Status** | ✅ **Resolved in v5.5-SEC** |
| **Since** | v4.5 |
| **Fixed** | February 5, 2026 |

**Resolution:** Added "sticky mode" - locks color mode for 500ms after change.
```javascript
var STICKY_MODE_DURATION = 500;  // Lock mode for 500ms
if (lastModeChangeTime && Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) {
    return; // Skip detection during sticky period
}
```

**Trade-off:** Cursor may stay "wrong" color for up to 500ms when crossing boundary fast.
This prioritizes stability over real-time accuracy (better UX).

---

### PERF-001: RAF Loop Always Running ⏸️ DEFERRED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:1500-1600` |
| **Type** | Performance |
| **Status** | ⏸️ **Deferred** (too risky) |
| **Since** | v1.0 |
| **Analyzed** | February 5, 2026 |

**Description:**
requestAnimationFrame loop runs constantly even when cursor stationary.

**Impact:**
- ~3-5% CPU usage even when idle
- Battery drain on laptops

**Why Deferred (v5.6 risk analysis):**
- 4 HIGH probability failure scenarios (58-72%):
  - Lerp interruption mid-animation (65%) → cursor jump
  - Spring physics incomplete reset (72%) → wobble glitch
  - Image prev position not reset (68%) → velocity spike
  - Effect timer drift (58%) → pulse/shake desync
- Complex state management: 8+ variables to reset on resume
- Benefit (3-5% CPU) doesn't justify risk of cursor glitches

**Decision:** Will revisit if users report battery drain issues

---

### ~~DEPLOY-001: frontend.php Breaking Other Widgets (Swap Button)~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `includes/frontend.php` |
| **Type** | Deployment / Compatibility |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v5.5 |
| **Fixed** | February 9, 2026 |

**Description:**
Deploying our `frontend.php` to another site broke the CMSMasters Swap Button widget (lost animation/styles) and potentially other widgets. Removing ALL our files fixed the button. Even after reverting the `wp_strip_all_tags()` change, the button remained broken. Only restoring the original addon's `frontend.php` fixed it.

**Root Cause (3 issues in our old frontend.php):**

1. **PERF-001 conditional loading** — Removed `basicScroll`, `vanilla-tilt`, `anime`, `hc-sticky`, `headroom` from `cmsmasters-frontend` script dependencies. Swap Button depends on `anime.js` which was no longer loaded as a dependency.

2. **Missing widget style registrations** — `widget-cmsmasters-swap-button` and `widget-cmsmasters-image-accordion` were missing from the `widgets_responsive_styles_files_names()` and `widgets_styles_files_names()` arrays respectively.

3. **~1000 lines of non-cursor code** — Font preload, resource hints, Google Fonts display:swap forcing, and conditional loading logic were added to the file, modifying original addon behavior.

**Resolution:**
Rewrote `frontend.php` from scratch using the clean original addon file (1,126 lines) and surgically added ONLY cursor-related code:
- 3 hook registrations in `init_actions()` (lines 118-121)
- 7 cursor methods at the end of the class (lines 1131-1466)
- Total: 1,467 lines (down from 2,131)

**Lessons Learned:**

| Rule | Why |
|------|-----|
| **NEVER modify original addon methods** | Other widgets depend on exact script dependencies and style registrations |
| **NEVER remove script dependencies** | `anime.js`, `vanilla-tilt`, etc. are needed by widgets we don't control |
| **NEVER use `wp_strip_all_tags()` on CSS** | It strips CSS `>` child selectors |
| **ONLY add cursor methods** | Keep our code isolated at the end of the class |
| **Always diff against clean original** | Our repo's reference copy (`cmsmasters-elementor-addon/`) already had our changes and was not a clean baseline |

**Clean original location:** `c:\work\cmsaddon\cmsmasters-elementor-addon-main\cmsmasters-elementor-addon-main\includes\frontend.php`

---

## Medium Priority Issues

### PERF-002: Background Sampling Expensive

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:850-900` |
| **Type** | Performance |
| **Status** | Open |
| **Since** | v4.5 |

**Description:**
`getComputedStyle()` called frequently for adaptive mode.

---

### PERF-003: No Throttling on Mousemove

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:1700-1750` |
| **Type** | Performance |
| **Status** | Open |
| **Since** | v1.0 |

**Description:**
Every mousemove event triggers full detection logic.

---

### PERF-004: Typography Cache Rebuild

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:50-100` |
| **Type** | Performance |
| **Status** | Open |
| **Since** | v5.4 |

**Description:**
Full typography fetch on every indicator update.

---

### ~~UX-001: Cursor Disappears on Fast Movement~~ ❌ FALSE POSITIVE

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:1397-1402` |
| **Type** | ~~UX~~ False Positive |
| **Status** | ❌ **Not an Issue** |
| **Verified** | February 5, 2026 |

**Finding:** Lerp design is SAFE and INTENTIONAL.
- Dot: 50% closer per frame → 2 frames to 75%, 4 frames to 94%
- Ring: 25% closer per frame → 12 frames to 95%
- The trailing effect is a DESIGN FEATURE, not a bug
- At 60fps, even extreme mouse movement is handled smoothly

---

### ~~UX-002: No Touch Device Detection~~ ❌ FALSE POSITIVE

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:2081-2119` |
| **Type** | ~~UX~~ False Positive |
| **Status** | ❌ **Already Implemented** |
| **Verified** | February 5, 2026 |

**Finding:** Touch detection IS implemented via matchMedia:
```javascript
var touchMQ = matchMedia('(hover:none),(pointer:coarse)');
// handleTouchChange hides cursor on touch devices
```
- Container hidden on touch: `container.style.display = 'none'`
- All state reset via `resetCursorState()`
- Live detection: responds to DevTools device emulator

---

### UX-003: Hover State Persists After Click

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:600-650` |
| **Type** | UX |
| **Status** | Open |
| **Since** | v4.0 |

**Description:**
Sometimes hover state remains after clicking away.

---

### UX-004: Navigator Indicators Flicker

| Field | Value |
|-------|-------|
| **Location** | `navigator-indicator.js:400-450` |
| **Type** | UX |
| **Status** | Open |
| **Since** | v5.4 |

**Description:**
Indicators briefly disappear during panel mode changes.

---

### COMPAT-001: Safari Transform Origin

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.css:50-60` |
| **Type** | Compatibility |
| **Status** | Open |
| **Since** | v4.0 |

**Description:**
Transform origin calculation differs in Safari, causing offset.

---

### COMPAT-002: Firefox Pointer Events

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.css:10-20` |
| **Type** | Compatibility |
| **Status** | Open |
| **Since** | v3.0 |

**Description:**
`pointer-events: none` occasionally fails in Firefox iframes.

---

### CODE-001: Hardcoded Magic Numbers

| Field | Value |
|-------|-------|
| **Location** | Multiple files |
| **Type** | Code Quality |
| **Status** | Open |
| **Since** | v1.0 |

**Description:**
Many hardcoded values without named constants:
- Lerp values: 0.15, 0.1
- Timeouts: 100, 200, 500
- Sizes: 40, 60, 32, 48

---

### ~~VIS-001: Ring Trail/Ghost on Special Cursor Entry~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:596, 1172, 1186-1197, 2318, 2368-2384` |
| **Type** | Visual Bug |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v4.0 |
| **Fixed** | February 11, 2026 |

**Description:**
When entering a special cursor zone (image/text/icon) horizontally, the ring cursor showed a visible trail/ghost effect for ~200ms.

**Root Cause:**
Two-part issue:
1. **CSS transition during opacity fade:** `ring.style.opacity` had CSS `transition: opacity .2s` that kept ring partially visible while lerp simultaneously moved ring position to new coordinates
2. **mix-blend-mode ghosting at opacity:0:** Ring had `mix-blend-mode: difference` that was still visible even at `opacity:0`, creating a faint ghost
3. **Render loop updating hidden ring:** Transform updates continued every frame (60fps) during the 200ms fade, moving the partially-visible ring

**Resolution (3 changes):**

1. **Added `isRingHidden` state flag (line 596):**
   ```javascript
   var isRingHidden = false; // Skip ring paint when in special cursor zone
   ```

2. **Modified `hideDefaultCursor()` (lines 1186-1197):**
   - Sets `isRingHidden = true`
   - Sets `ring.style.visibility = 'hidden'` — removes ring from paint completely (prevents mix-blend-mode ghosting)
   - Temporarily disables CSS transition for one frame before setting `opacity:0` (prevents visible fade animation)

3. **Modified `showDefaultCursor()` (line 1172):**
   - Sets `isRingHidden = false` to resume ring paint
   - Restores `ring.style.visibility = ''`

4. **Guarded ring transform in render loop (line 2318):**
   ```javascript
   if (!isRingHidden) {
       ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)' + coreTransform;
   }
   ```
   Ring transform updates now skipped when hidden, preventing position drift during transition.

5. **Added mouseover detection bypass (lines 2368-2384):**
   - New `mouseover` event handler detects entry into special cursor zones
   - Calls `detectCursorMode(e.clientX, e.clientY)` immediately with event coordinates
   - Bypasses the 100ms detection throttle to prevent using stale mouse position
   - Syncs throttle state to prevent double detection on next `mousemove`

**Why This Works:**
- `visibility: hidden` removes element from paint layer completely (no mix-blend-mode ghosting)
- `isRingHidden` flag stops render loop from updating ring position while hidden
- Mouseover bypass ensures ring hides using current event coordinates, not stale mx/my

**Commits:**
- 83e9fd0 — Main fix (visibility + isRingHidden flag + render guard)
- ee443f0 — Mouseover detection bypass

**Side Note:**
Previous comment in code said ring transform was updated "for smooth transition back", but this caused the trail. Removing updates while hidden eliminates the artifact with no negative side effects.

---

### ~~CODE-002: Console.log in Production~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | Multiple files |
| **Type** | Code Quality |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v5.0 |
| **Fixed** | February 6, 2026 |

**Resolution:**
Added debug mode infrastructure with `debugLog()`, `debugWarn()`, `debugError()` functions.
- All console.* calls now behind `debugMode` flag or `window.CMSM_DEBUG` guard
- Debug mode activatable via: `window.cmsmastersCursor.debug(true)`, `data-cursor-debug="true"`, or `window.CMSM_DEBUG = true`
- Debug overlay shows live cursor state (updates at 200ms, not in render loop)

---

### ~~CODE-003: Empty Catch Blocks~~ ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Location** | Multiple files |
| **Type** | Code Quality |
| **Status** | ✅ **Resolved in v5.6** |
| **Since** | v4.0 |
| **Fixed** | February 6, 2026 |

**Resolution:**
- Added `debugError()` function that ALWAYS logs (errors should never be silent)
- custom-cursor.js: 1 catch block now uses `debugWarn()`
- navigator-indicator.js: 9 empty catch blocks now log via `if (window.CMSM_DEBUG) console.warn()`
- cursor-editor-sync.js: 1 stray console.log wrapped with `CMSM_DEBUG` guard

---

### CODE-004: Inconsistent Error Handling

| Field | Value |
|-------|-------|
| **Location** | Multiple files |
| **Type** | Code Quality |
| **Status** | Open |
| **Since** | v3.0 |

**Description:**
Mix of error handling patterns across files.

---

## Low Priority Issues

### CODE-005: Long Functions

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:render()` |
| **Type** | Maintainability |
| **Status** | Partially Addressed (v5.6 Phase 4) |

**Description:**
Some functions exceed 100 lines, reducing readability.

**v5.6 Update:**
Phase 4 extracted effect calculations into 5 pure functions (`calcPulseScale`, `calcShakeOffset`, `calcBuzzRotation`, `calcWobbleMatrix`, `resolveEffect`). The `render()` function was reduced from ~550 lines to ~250 lines. Still above 100-line threshold but significantly improved.

---

### CODE-006: Missing JSDoc

| Field | Value |
|-------|-------|
| **Location** | All JS files |
| **Type** | Documentation |
| **Status** | Open |

**Description:**
No JSDoc comments on public API functions.

---

### CODE-007: ES5 Syntax

| Field | Value |
|-------|-------|
| **Location** | All JS files |
| **Type** | Modernization |
| **Status** | Open |

**Description:**
Uses `var` and function declarations instead of modern ES6+.

---

### CODE-008: CSS Duplication

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.css`, `editor-navigator.css` |
| **Type** | Maintainability |
| **Status** | Open |

**Description:**
Some CSS rules duplicated between frontend and editor styles.

---

### CODE-009: PHP Option Naming

| Field | Value |
|-------|-------|
| **Location** | `settings-page.php` |
| **Type** | Consistency |
| **Status** | Open |

**Description:**
Inconsistent option naming (some use underscores, some use hyphens).

---

### CODE-010: Inline Styles

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js` |
| **Type** | Maintainability |
| **Status** | Open |

**Description:**
Heavy use of inline styles instead of CSS classes.

---

### ICON-002: SVG Icons with Internal `<style>` Blocks

| Field | Value |
|-------|-------|
| **Location** | `custom-cursor.js:1344-1388` (createIconCursor) |
| **Type** | Limitation |
| **Status** | Known Limitation |
| **Since** | v5.6 |

**Description:**
Uploaded SVG icons that use internal `<style>` blocks with class-based fills won't be recolored by the icon cursor color setting.

**Example SVG that won't recolor:**
```xml
<svg>
  <style>
    .cls-1 { fill: #FF0000; }
    .cls-2 { fill: #00FF00; }
  </style>
  <path class="cls-1" d="..."/>
  <path class="cls-2" d="..."/>
</svg>
```

**Why:**
The current color fix (v5.6.11, lines 1344-1388) only strips inline `fill` and `stroke` attributes:
- ✅ Works: `<path fill="#FF0000">` → color removed, inherits `currentColor`
- ✅ Works: `<path style="fill:#FF0000">` → inline style cleared
- ❌ Doesn't work: `<path class="cls-1">` with internal stylesheet → class selector not detected

**Workaround:**
Users should upload SVG icons with inline fill attributes (not CSS classes) or enable "Preserve Colors" to keep original multicolor.

**Possible Future Fix:**
Parse and modify internal `<style>` blocks, but this requires CSS parser and is complex.

---

## Resolved Issues (v5.5-SEC)

These issues were resolved in the current version but tracked for reference.
Latest v5.5-SEC fixes: SEC-001/002/003 (security), BUG-002/003, MEM-001/002/003 (stability).

| ID | Description | Resolution | Version |
|----|-------------|------------|---------|
| CSS-001 | z-index 2147483647 conflicts; blend mode cursor invisible | CSS custom properties; z-blend raised to 999999; forced white color; removed isolation:isolate | v5.6 |
| CSS-002 | color-mix() no fallback | @supports rgba fallback | v5.6 |
| MEM-004 | Special cursor DOM accumulation | SpecialCursorManager | v5.6 |
| CODE-002 | Console.log in production | Debug mode infrastructure | v5.6 |
| CODE-003 | Empty catch blocks | debugError + CMSM_DEBUG guards | v5.6 |
| VIS-001 | Ring trail on special cursor entry | isRingHidden flag + visibility:hidden + render guard | v5.6 |
| SEC-001 | XSS via innerHTML | SVG sanitizer with whitelist | v5.5-SEC |
| SEC-002 | postMessage no origin check (editor) | TRUSTED_ORIGIN validation | v5.5-SEC |
| SEC-003 | postMessage no origin check (preview) | TRUSTED_ORIGIN validation | v5.5-SEC |
| BUG-002 | Adaptive mode flicker | Sticky mode (500ms lock) | v5.5-SEC |
| BUG-003 | Multiple cursor instances | Singleton guard | v5.5-SEC |
| MEM-001 | Navigator observer not disconnected | preview:destroyed cleanup | v5.5-SEC |
| MEM-002 | setInterval not cleared | preview:destroyed cleanup | v5.5-SEC |
| MEM-003 | Event listeners accumulate in SPA | Singleton guard | v5.5-SEC |
| P4-001 | Cursor over form dropdowns | P4 v2 auto-hide | v5.5 |
| P4-002 | Cursor over modal popups | P4 v2 ARIA detection | v5.5 |
| P4-003 | Cursor over select elements | P4 v2 graceful degradation | v5.5 |
| P4-004 | Cursor not restoring when moving UP from form | isFormZone() mouseout fix | v5.6 |
| P4-005 | Cursor flickering between form fields | Container detection | v5.6 |
| P4-006 | TEXTAREA not hiding cursor | Added to isFormZone() | v5.6 |
| DEPLOY-001 | frontend.php breaking Swap Button + other widgets | Clean rewrite from original | v5.6 |
| P5-001 | Cursor over video elements | P5 auto-hide | v5.5 |
| P5-002 | Cursor over iframes | P5 auto-hide | v5.5 |
| BUG-100 | Widget boundary not respected | v5.3 grandparent fix | v5.3 |
| BUG-101 | Editor inheritance broken | v5.3 P1 fix | v5.3 |
| BUG-102 | Cursor stuck on page leave | Mouse leave detection | v5.4 |
| BUG-103 | Double cursor in editor | Editor detection | v5.2 |
| BUG-104 | Wobble on wrong axis | Matrix calculation fix | v5.2 |
| PERF-100 | 60fps RAF on hidden tab | visibilitychange pause | v4.7 |
| PERF-101 | Memory leak in editor | Observer cleanup | v5.4 |
| PERF-102 | Slow global color resolution | Caching added | v5.4 |
| UX-100 | No loading indicator in editor | Preloader added | v5.0 |
| UX-101 | Settings panel not draggable | Draggable panel | v5.0 |
| UX-102 | No visual feedback on hover | Hover scale | v4.0 |
| SEC-100 | Unescaped CSS URL | escapeCssUrl() added | v5.1 |
| NAV-001 | No cursor indicators | Navigator indicators | v5.4 |
| NAV-002 | Indicators wrong color | Global color resolution | v5.4 |
| NAV-003 | Legend not showing | Legend visibility fix | v5.5 |
| EDIT-001 | Preview not syncing | postMessage protocol | v5.0 |
| EDIT-002 | Settings lost on re-render | MutationObserver | v5.3 |
| EDIT-003 | Wrong element selected | Element ID matching | v5.4 |
| TEXT-001 | Circle text not centered | Transform origin fix | v5.1 |
| TEXT-002 | Typography not resolving | Global typography | v5.4 |
| ICON-001 | Icon color not applying | Color inheritance fix | v5.2 |
| IMG-001 | Image cursor offset | Transform calculation | v5.1 |

---

## Issue Reporting

### How to Report New Issues

1. Check this document for existing issues
2. Check [CODE-REVIEW.md](CODE-REVIEW.md) for security audit findings
3. Create issue in project tracker with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/environment info
   - Screenshot if applicable

### Issue Template

```markdown
## Issue Title

| Field | Value |
|-------|-------|
| **Location** | file.js:line |
| **Type** | Bug/Security/Performance/UX |
| **Priority** | Critical/High/Medium/Low |
| **Browser** | Chrome 120, Firefox 121, etc. |

**Description:**
Clear description of the issue.

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen.

**Actual Behavior:**
What actually happens.

**Screenshots:**
If applicable.
```

---

## See Also

- [CODE-REVIEW.md](CODE-REVIEW.md) - Security and performance audit
- [backlog.md](backlog.md) - Current development tasks
- [CHANGELOG.md](CHANGELOG.md) - Version history

---

*Last Updated: February 18, 2026 | Version: 5.6*
