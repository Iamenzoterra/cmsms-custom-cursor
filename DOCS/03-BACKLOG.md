# Custom Cursor v5.6 - Backlog

**Created:** February 5, 2026
**Updated:** February 6, 2026
**Based on:** v5.5-SEC (all security/stability fixes included)

---

## Current State

**v5.6 Refactoring Phases (Complete):**
- ✅ Phase 1-2: CSS-001 z-index fix, CSS-002 color-mix fallback, CONSTANTS section, CursorState
- ✅ Phase 3: SpecialCursorManager (MEM-004 fix)
- ✅ Phase 4: Pure Effect Functions (CODE-005 partially addressed)
- ✅ Phase 5: Debug Mode + Console Cleanup (CODE-002, CODE-003 fix)

**v5.6 New Fixes:**
- ✅ CSS-002: color-mix() Fallback for older browsers (custom-cursor.css)
- ✅ MEM-004: SpecialCursorManager for special cursor lifecycle
- ✅ CODE-002: Debug mode infrastructure (no console.log in production)
- ✅ CODE-003: Empty catch blocks now log errors

**v5.6 contains (inherited from v5.5-SEC):**
- ✅ P2: Editor DOM Re-rendering fix (navigator-indicator.js)
- ✅ P4 v2: Forms & Popups Auto-Hide (graceful degradation)
- ✅ P5: Video/Iframe Auto-Hide
- ❌ P4 v1: Removed (caused issues) → backup in fix/p4/

**Deferred to Future Version:**
- ⏸️ PERF-001: RAF Idle Detection → Too complex, risk/benefit ratio poor

**v5.5-SEC Security & Stability Fixes:**
- ✅ SEC-001: XSS Prevention via SVG Sanitizer (custom-cursor.js)
- ✅ SEC-002: postMessage Origin Validation (cursor-editor-sync.js)
- ✅ SEC-003: postMessage Origin Validation (navigator-indicator.js)
- ✅ BUG-002: Adaptive Mode Flicker - sticky mode 500ms (custom-cursor.js)
- ✅ BUG-003: Multiple Cursor Instances - singleton guard (custom-cursor.js)
- ✅ MEM-001: Navigator Observer Cleanup (navigator-indicator.js)
- ✅ MEM-002: setInterval Cleanup (navigator-indicator.js)
- ✅ MEM-003: Event Listeners Accumulation - singleton guard (custom-cursor.js)

---

## P4 v2: Forms & Popups Detection - IMPLEMENTED

**Status:** ✅ IMPLEMENTED
**Documentation:** `P4-FORMS-POPUPS.md`

### Solution (Graceful Degradation)
Detect forms/popups via ARIA roles and disable custom cursor. System cursor works fine.

### Detection:
- `<select>`, `<input>` (not submit/button)
- `[role="listbox"]`, `[role="combobox"]`, `[role="menu"]`
- `[role="dialog"]`, `[aria-modal="true"]`

### Code Locations:
- `detectCursorMode()` line ~678
- `mouseover` handler line ~1808
- `mouseout` handler line ~1858

---

## P5: Video/Iframe Auto-Hide - IMPLEMENTED

**Status:** ✅ IMPLEMENTED

### Problem
Cursor lags on videos, can't enter social embeds (X, YouTube, etc.)

### Solution
Auto-detect `<video>` and `<iframe>` elements, hide custom cursor.

### Code Locations:
- `detectCursorMode()` line ~690
- `mouseover` handler line ~1830
- `mouseout` handler line ~1870

---

## P3: Popup Cursor Regression - WON'T FIX

**Status:** ⚠️ WON'T FIX
**Priority:** N/A
**Investigated:** February 6, 2026

### Problem
Custom cursor shows SYSTEM cursor on CMSMasters Elementor popup.

### Investigation Summary
Extensive debugging revealed three conflicting systems that cannot be reliably fixed without reverse-engineering CMSMasters popup internals. See `DOCS/04-KNOWN-ISSUES.md` for full investigation findings.

### Current Behavior
System cursor works normally in popups. All popup functionality (forms, buttons, links) works correctly.

---

## Completed

### v5.5-SEC: Security Fixes ✅

#### SEC-001: XSS Prevention via SVG Sanitizer
- File: `custom-cursor.js` lines 10-115
- Function: `sanitizeSvgHtml(html)`
- Whitelists 47 SVG + 7 HTML tags (lowercase)
- Whitelists 90+ attributes (lowercase)
- Strips event handlers, javascript: URLs, CSS expressions

#### SEC-002/003: postMessage Origin Validation
- Files: `cursor-editor-sync.js`, `navigator-indicator.js`
- Added `TRUSTED_ORIGIN` constant
- Origin check in message listeners
- All outgoing postMessage calls specify origin

### v5.5-SEC: Stability Fixes ✅

#### BUG-002: Adaptive Mode Flicker
- File: `custom-cursor.js` lines 230, 791, 800
- Added 500ms "sticky mode" to prevent boundary oscillation
- Variables: `lastModeChangeTime`, `STICKY_MODE_DURATION`

#### BUG-003 + MEM-003: Singleton Guard
- File: `custom-cursor.js` lines 152-158
- Prevents multiple instances in Elementor SPA
- Variable: `window.cmsmCursorInstanceActive`
- Also prevents event listener accumulation

#### MEM-001: Navigator Observer Cleanup
- File: `navigator-indicator.js` lines 39, 749, 1281-1295
- Module-level `navigatorObserver` variable
- Cleanup on `preview:destroyed` event

#### MEM-002: setInterval Cleanup
- File: `navigator-indicator.js` lines 38, 1086, 1281-1295
- Cleanup `watchModelInterval` on `preview:destroyed`

### v5.5: Feature Fixes ✅

### P5: Video/Iframe Auto-Hide ✅
Auto-detect video/iframe and hide custom cursor.
- File: `custom-cursor.js`

### P4 v2: Forms & Popups Auto-Hide ✅
Graceful degradation - detect forms/popups and hide custom cursor.
- File: `custom-cursor.js`
- Backup: `custom-cursor.js.pre-p4v2`

### P2: Editor DOM Re-rendering ✅
Enhanced postMessage broadcast for child elements.
- File: `navigator-indicator.js`
- Function: `broadcastChildrenCursorSettings()`

### v5.6: Refactoring Phases ✅

#### Phase 3: SpecialCursorManager (MEM-004)
- File: `custom-cursor.js` lines ~564-689
- Centralized special cursor lifecycle management
- Prevents DOM element accumulation from rapid hover changes
- API: `activate(type, config)`, `deactivate()`, `getActive()`, `isActive()`

#### Phase 4: Pure Effect Functions (CODE-005 partial)
- File: `custom-cursor.js` lines ~714-768
- Extracted effect calculations into pure functions
- `calcPulseScale()`, `calcShakeOffset()`, `calcBuzzRotation()`, `calcWobbleMatrix()`
- `render()` reduced from ~550 lines to ~250 lines

#### Phase 5: Debug Mode + Console Cleanup (CODE-002, CODE-003)
- Files: `custom-cursor.js`, `cursor-editor-sync.js`, `navigator-indicator.js`
- Added `debugLog()`, `debugWarn()`, `debugError()` functions
- Debug overlay with 200ms update interval
- Public API: `window.cmsmastersCursor.debug(true/false)`
- All console.* calls behind debug mode or CMSM_DEBUG guard
- 9 empty catch blocks in navigator-indicator.js now log errors

---

## Removed

### P4 v1: Dynamic Stacking Context Detection ❌
**Why Removed:** Caused CSS inheritance breaks, visual jumps during appendChild, unpredictable side effects.
**Backup:** `fix/p4/custom-cursor.js`

---
