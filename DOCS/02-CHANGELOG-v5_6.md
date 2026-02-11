# Custom Cursor v5.6 - Changelog

**Last Updated:** February 9, 2026

---

## Version History

| Version | Date | Type | Summary |
|---------|------|------|---------|
| v5.6 | 2026-02-06 | Refactor + Fix | Constants, CursorState, z-index consolidation |
| v5.5 | 2026-02-05 | Feature | P4 v2 Forms/popups + P5 Video/iframe auto-hide |
| v5.5-SEC | 2026-02-05 | Security | SVG sanitization for XSS prevention |

---

## v5.6 - February 6, 2026

### Type: Refactor + Bug Fix

This release extracts magic numbers into named constants, introduces a centralized state machine for body class management, and consolidates z-index values with CSS custom properties.

---

### Changes

#### 1. Z-Index Consolidation (CSS-001 Fix)

Resolved long-standing z-index conflict issue by replacing hardcoded maximum integer with CSS custom properties.

**Before:**
```css
#cmsm-cursor-container {
    z-index: 2147483647; /* max-int - conflicts with browser extensions */
}
```

**After:**
```css
#cmsm-cursor-container {
    --cmsm-cursor-z-default: 999999;
    --cmsm-cursor-z-blend: 9999;
    z-index: var(--cmsm-cursor-z-default);
}
```

**Changes:**
- Default z-index reduced from `2147483647` to `999999`
- Blend mode z-index now uses `var(--cmsm-cursor-z-blend)` instead of hardcoded `9999`
- Popup/datepicker overrides now use `var(--cmsm-cursor-z-default)` (removed `!important`)
- Users can now override z-index via CSS custom properties if conflicts occur

**Why 999999?** High enough to be above normal page content, low enough to not conflict with browser extensions that use max-int.

---

#### 2. CONSTANTS Section (Lines ~160-256)

Extracted 35 magic numbers into named constants for improved maintainability and documentation.

**Categories:**

| Category | Constants | Example |
|----------|-----------|---------|
| Position & Smoothness | 7 | `SMOOTH_NORMAL = 0.25` |
| Adaptive Mode | 4 | `STICKY_MODE_DURATION = 500` |
| Spring Physics | 2 | `TRANSITION_STIFFNESS = 0.15` |
| Wobble Effect | 10 | `WOBBLE_DAMPING = 0.78` |
| Pulse Effect | 3 | `PULSE_CORE_AMPLITUDE = 0.15` |
| Shake Effect | 6 | `SHAKE_CORE_AMPLITUDE = 4` |
| Buzz Effect | 6 | `BUZZ_CORE_AMPLITUDE = 15` |
| Throttling | 4 | `DETECTION_THROTTLE_MS = 100` |
| Thresholds | 3 | `TRANSPARENT_ALPHA_THRESHOLD = 0.15` |

**Benefits:**
- Self-documenting code with meaningful names
- Easy tuning without searching for magic numbers
- JSDoc comments link to relevant documentation files

---

#### 3. CursorState State Machine (Lines ~278-399)

Introduced `CursorState` object to centralize all body class manipulation.

**State Shape:**

```javascript
CursorState._state = {
    hover: boolean,    // cmsm-cursor-hover
    down: boolean,     // cmsm-cursor-down
    hidden: boolean,   // cmsm-cursor-hidden
    text: boolean,     // cmsm-cursor-text
    mode: string|null, // cmsm-cursor-on-light | cmsm-cursor-on-dark
    size: string|null, // cmsm-cursor-size-sm | -md | -lg
    blend: string|null // cmsm-cursor-blend-soft | -medium | -strong
}
```

**API:**

| Method | Purpose |
|--------|---------|
| `CursorState.init(bodyEl)` | Initialize with body reference |
| `CursorState.transition(change, source)` | Apply state change |
| `CursorState.get(key)` | Get current state value |
| `CursorState.resetHover()` | Reset interaction state on mouseout |
| `CursorState._applyToDOM(prev)` | Sync body classes (private) |

**Benefits:**
- Single source of truth for cursor state
- Automatic handling of mutually exclusive class groups
- Debug traceability via `source` parameter
- Prevents race conditions from scattered classList calls

---

### Migration Notes

**For Developers:**

All direct `classList.add/remove` calls for cursor body classes have been replaced:

```javascript
// BEFORE (v5.5)
body.classList.add('cmsm-cursor-hover');
body.classList.remove('cmsm-cursor-on-light');
body.classList.add('cmsm-cursor-on-dark');

// AFTER (v5.6)
CursorState.transition({ hover: true, mode: 'on-dark' }, 'mouseover');
```

**Line Number Shifts:**

Due to the CONSTANTS (~96 lines) and CursorState (~122 lines) additions, all subsequent functions have shifted approximately 120+ lines from their v5.5 positions. Line number references in documentation are now marked as approximate.

---

### Testing Checklist

- [x] All existing cursor behaviors unchanged
- [x] Hover states apply/remove correctly
- [x] Adaptive mode (on-light/on-dark) switches correctly
- [x] Size modifiers (sm/md/lg) are mutually exclusive
- [x] Blend modes (soft/medium/strong) are mutually exclusive
- [x] mouseout resets interaction state but preserves mode/blend
- [x] No duplicate body classes appear
- [x] No memory leaks from state object

---

### Files Changed

| File | Changes |
|------|---------|
| `assets/lib/custom-cursor/custom-cursor.css` | Z-index CSS custom properties (CSS-001 fix) |
| `assets/lib/custom-cursor/custom-cursor.js` | Added CONSTANTS section, CursorState object |
| `DOCS/02-CHANGELOG-v5_6.md` | Updated (this file) |
| `DOCS/04-KNOWN-ISSUES.md` | Marked CSS-001 resolved |
| `DOCS/05-API-JAVASCRIPT.md` | Documented CONSTANTS and CursorState API |
| `DOCS/06-API-CSS.md` | Updated z-index documentation, added new CSS variables |
| `DOCS/09-MAP-DEPENDENCY.md` | Updated line number references |
| `DOCS/12-REF-BODY-CLASSES.md` | Added CursorState references |

---

#### 4. SpecialCursorManager (Lines ~564-689)

Introduced `SpecialCursorManager` object to coordinate special cursor lifecycle (image, text, icon).

**Purpose:**
- Centralizes special cursor activation/deactivation logic
- Fixes MEM-004 (DOM element accumulation from rapid hover changes)
- Removes ~90 lines of duplicated code from `detectCursorMode()`

**API:**

| Method | Purpose |
|--------|---------|
| `SpecialCursorManager.activate(type, createFn)` | Activate a special cursor type |
| `SpecialCursorManager.deactivate()` | Deactivate current special cursor, restore default |
| `SpecialCursorManager.isActive(type)` | Check if specific type is active |
| `SpecialCursorManager.getActive()` | Get currently active type (or null) |

**Supported Types:** `'image'`, `'text'`, `'icon'`

**Usage in detectCursorMode():**

```javascript
// BEFORE (v5.5) - duplicated in 3 places
if (imageEl) {
    removeTextCursor();
    removeIconCursor();
    createImageCursor(src);
    hideDefaultCursor();
}

// AFTER (v5.6) - centralized
if (imageEl) {
    SpecialCursorManager.activate('image', function() {
        createImageCursor(src);
    });
}
```

**Benefits:**
- Single responsibility for special cursor state
- Automatic cleanup of previous cursor type
- Prevents DOM element accumulation (MEM-004 fix)
- Easier to add new special cursor types in future

---

#### 5. Pure Effect Functions (Lines ~714-768)

Extracted effect calculations from `render()` into 5 pure functions to eliminate code duplication and improve testability.

**New Functions:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `calcPulseScale(time, amplitude)` | Calculate pulse scale multiplier | `1 + sin(time) * amplitude` |
| `calcShakeOffset(time, amplitude)` | Calculate shake X offset | Pixel offset with pause phase |
| `calcBuzzRotation(time, amplitude)` | Calculate buzz rotation angle | Degrees with pause phase |
| `calcWobbleMatrix(wState, dx, dy)` | Calculate wobble matrix transform | Matrix string or `''` |
| `resolveEffect(cursorEffect, globalWobble)` | Resolve effective effect type | Effect name or `''` |

**State Objects (Lines ~782-785):**

Replaced 15 wobble variables with 4 state objects (one per cursor type):

```javascript
var coreWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: -200, prevDy: -200 };
var imgWobbleState  = { velocity: 0, scale: 0, angle: 0, prevDx: -200, prevDy: -200 };
var textWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: -200, prevDy: -200 };
var iconWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: -200, prevDy: -200 };
```

**Benefits:**
- ~350 lines of duplicated effect code replaced with pure function calls
- State objects use in-place mutation (no GC pressure at 60fps)
- Easier to unit test effect calculations
- Consistent effect behavior across all cursor types
- Wobble state reset on special cursor activation (prevents stale deformation)

**CODE-005 Impact:** Partially addressed - `render()` reduced from ~550 lines to ~250 lines.

---

#### 6. Debug Mode + Console Cleanup (Phase 5)

Added structured debug tooling and removed stray console statements.

**New Debug Infrastructure:**

```javascript
// Enable via any of these methods:
window.cmsmastersCursor.debug(true);           // Public API
document.body.setAttribute('data-cursor-debug', 'true');  // Data attribute
window.CMSM_DEBUG = true;                      // Legacy flag
```

**Debug Functions:**

| Function | Always Logs | Purpose |
|----------|-------------|---------|
| `debugLog(category, message, data)` | No | General debug info |
| `debugWarn(category, message, data)` | No | Warnings |
| `debugError(category, message, data)` | Yes | Errors (never silent) |

**Categories:** `init`, `mode`, `special`, `effect`, `event`, `sync`, `error`

**Debug Overlay:**
- Fixed-position panel (bottom-left) showing live cursor state
- Updates at 200ms interval (not in 60fps render loop)
- Shows: mode, blend, hover, special cursor, effect, wobble, paused state
- Automatically removed on cleanup

**Console Cleanup:**
- Replaced 1 stray `console.log` in cursor-editor-sync.js with `CMSM_DEBUG` guard
- Added error logging to 9 empty catch blocks in navigator-indicator.js
- All console.* calls now either use debug functions or are guarded with `window.CMSM_DEBUG`

**Fixes:**
- CODE-002: Console.log in production — now all behind debug mode
- CODE-003: Empty catch blocks — now all log errors via debugError or CMSM_DEBUG guard

---

#### 7. Form Cursor Detection Fix (P4 v2 Enhancement)

Enhanced P4 v2 form zone detection to fix cursor restoration issues, improve reliability, support native `<select>` dropdowns, and enable graceful degradation in both dual and solo modes.

**Changes:**

1. **Added `isFormZone()` helper function (line ~918):**
   - Centralizes form zone detection logic
   - **Popup-first ordering:** Popup/modal detection BEFORE button exclusion — ALL elements inside popups/dialogs now hide custom cursor
   - Detects: SELECT, TEXTAREA, INPUT (except submit/button)
   - **Restored `<form>` container check (line 946):** Re-added after popup/button checks — now safe because popup detection runs first, so popup close buttons/links unaffected. Catches custom dropdown widgets that stay inside form, gaps between form fields.
   - Detects ARIA role widgets: `[role="listbox"]`, `[role="combobox"]`, `[role="option"]`
   - **Comprehensive custom select/dropdown detection (lines 950-970):** Detects 9 popular libraries:

   | Library | Selector | Appended to body? |
   |---------|----------|-------------------|
   | Select2 / SelectWoo | `.select2-dropdown`, `.select2-results` | Yes |
   | Chosen.js | `.chosen-drop`, `.chosen-results` | No |
   | Choices.js | `.choices__list--dropdown` | No |
   | Nice Select v1/v2 | `.nice-select-dropdown`, `.nice-select .list` | No |
   | Tom Select | `.ts-dropdown` | No |
   | Slim Select | `.ss-content` | Yes (v2+) |
   | Selectize | `.selectize-dropdown` | Yes |
   | jQuery UI Selectmenu | `.ui-selectmenu-menu` | No |
   | Kendo UI | `.k-animation-container`, `.k-list-container` | Yes |

   - Detects datepicker widgets: `.air-datepicker`, `.flatpickr-calendar`, `.daterangepicker`, `.ui-datepicker`
   - **Dual-mode bypass removed:** Auto-hide now works in BOTH dual and solo modes

2. **Native `<select>` dropdown fix (lines 1526, 2367):**
   - Added `document.activeElement.tagName === 'SELECT'` check in TWO places to prevent premature cursor restore when native select dropdown is open:
   - **In `detectCursorMode()` form-zone restore branch (line 1526):** If a SELECT has focus, don't restore cursor (native dropdown blocks `elementsFromPoint`)
   - **In `mouseout` handler form-zone restore (line 2367):** If a SELECT has focus, don't restore (mouseout fires with null `relatedTarget` when mouse enters native dropdown)
   - **Why needed:** Native `<select>` dropdowns render in OS-level UI that blocks mouse events. When mouse enters dropdown, `elementsFromPoint()` returns elements *behind* the dropdown, triggering false restoration.

3. **CSS fallback added (custom-cursor.css line 181-185):**
   ```css
   body.cmsm-cursor-hidden,
   body.cmsm-cursor-hidden * {
       cursor: default !important
   }
   ```
   - Ensures system cursor visible when custom cursor hides
   - Specificity (0,1,2) beats `.cmsm-cursor-enabled *` (0,1,1)
   - Works in both dual and solo modes

4. **CSS widget rules added (custom-cursor.css lines 60-75):**
   - Added `cursor: default !important` for all custom select/dropdown widget containers (alongside existing datepicker rules)
   - Ensures system cursor visible inside widgets even if parent has `cursor:none`

5. **Instant opacity restore in solo mode (_applyToDOM, line 486-500):**
   - When `hidden` transitions from true→false in solo mode, forces instant opacity=1 on `.cmsm-cursor` elements
   - Bypasses 300ms CSS transition to prevent gap where neither cursor is visible
   - Uses `style.transition='none'` + forced reflow + RAF cleanup

6. **Added `formZoneActive` tracking variable (line ~999):**
   - Enables cursor restore when leaving form zones via continuous mouse movement
   - Works in addition to mouseout events

7. **Refactored P4 v2 detection in 3 places:**
   - `detectCursorMode()` (line ~1518) — now has else branch for restore
   - `mouseover` handler (line ~2280) — uses `isFormZone()`
   - `mouseout` handler (line ~2356) — symmetric with mouseover, checks `relatedTarget`

**Bugs Fixed:**

| Bug | Before | After |
|-----|--------|-------|
| Cursor not restoring when moving UP from form | `mouseout` only triggered when leaving downward | Checks `relatedTarget` in `mouseout` handler |
| TEXTAREA not hiding cursor | Missing from detection | Now explicitly detected |
| System cursor not visible in solo mode | CSS fallback only worked in dual mode | CSS fallback now works in both modes |
| Cursor visible on popup close buttons | Buttons excluded before popup check | Popup detection BEFORE button exclusion |
| **Native `<select>` dropdown causes cursor flicker** | Cursor restored when mouse enters native dropdown | ActiveElement check prevents restoration while SELECT focused |
| **Custom dropdowns not detected** | Only native form elements detected | 9 popular custom select libraries now detected |
| **Gaps between form fields show cursor** | No form container check | Form container check catches gaps (after button/popup exclusions) |

**Why These Changes:**

- **Popup-first ordering** ensures ALL elements in popups/dialogs hide custom cursor, including close buttons and clickable elements
- **Restored form container check** catches gaps between fields and widgets inside forms — safe because buttons/popup elements already excluded
- **Native SELECT activeElement check** prevents false positives when native dropdown blocks mouse events
- **Comprehensive widget detection** supports popular third-party select/dropdown libraries that append to `<body>` or stay inside forms
- **CSS widget rules** ensure system cursor visible inside widget dropdowns (graceful degradation)
- **CSS fallback specificity** ensures system cursor always visible when custom cursor hides, regardless of dual/solo mode
- **Instant opacity restore** prevents 300ms gap with no visible cursor when exiting form zones in solo mode
- **formZoneActive flag** enables restore when cursor moves continuously from form to non-form (not just on mouseout events)
- **Symmetric mouseout check** fixes asymmetry where cursor would hide on enter but not restore on exit in certain mouse movement patterns

---

#### 8. frontend.php Clean Rewrite (DEPLOY-001 Fix)

Rewrote `frontend.php` from scratch using the clean original addon file, adding ONLY cursor-related code.

**Problem:**
Our previous `frontend.php` (2,131 lines) broke the Swap Button widget and potentially other widgets when deployed. Three issues:
1. PERF-001 removed `anime`, `vanilla-tilt`, `basicScroll`, `hc-sticky`, `headroom` from `cmsmasters-frontend` dependencies
2. Missing widget style registrations (`widget-cmsmasters-swap-button`, `widget-cmsmasters-image-accordion`)
3. `wp_strip_all_tags()` added to `print_styles()` stripped CSS `>` child selectors
4. ~1,000 lines of font preload/resource hints modified original addon behavior

**Solution:**
- Started from clean original (1,126 lines)
- Added 3 cursor hooks in `init_actions()` (lines 118-121)
- Added 7 cursor methods at class end (lines 1131-1466)
- Result: 1,467 lines (reduced from 2,131)

**Critical Rules Established:**
- NEVER modify original addon methods, script dependencies, or widget registrations
- ONLY add cursor-related code
- Always diff against the clean original (not our repo's reference copy which already has our changes)

---

#### 9. Theme Builder Template Detection (frontend.php)

Added template type detection to disable cursor preview on unsupported Elementor Theme Builder templates.

**Problem:**
Cursor doesn't render on CMSMasters Theme Builder template types (Entry, Popup, Archive, Singular, Header, Footer, Tribe Events, WooCommerce product templates) in Elementor editor preview, but the cursor scripts were still loading and attempting to initialize.

**Solution:**
Added document type check in `should_enable_custom_cursor()` (lines 1164-1176):

```php
// Skip cursor for Theme Builder templates (Entry, Popup, Archive, etc.)
// where cursor doesn't render in editor preview
if ( class_exists( '\Elementor\Plugin' ) ) {
    $preview_id = isset( $_GET['elementor-preview'] ) ? absint( $_GET['elementor-preview'] ) : 0;

    if ( $preview_id ) {
        $document = \Elementor\Plugin::$instance->documents->get( $preview_id );

        if ( $document && 0 === strpos( $document->get_name(), 'cmsmasters_' ) ) {
            return false;
        }
    }
}
```

**Detection Method:**
Uses document name prefix detection - all CMSMasters Theme Builder document types are prefixed with `cmsmasters_`.

**Benefit:**
Prevents unnecessary script loading and cursor initialization attempts on template types where cursor preview doesn't work.

---

#### 10. Responsive Mode Detection (Editor + Preview)

Added automatic cursor preview hiding when user switches to tablet/mobile responsive mode in Elementor editor toolbar.

**Problem:**
Cursor preview remained visible when switching to tablet/mobile responsive view, but the responsive CSS wrapper doesn't resize the iframe viewport - only changes the visible area via CSS. This made the cursor appear "stuck" and not properly testable in responsive mode.

**Solution:**
Implemented device mode detection in editor frame that communicates to preview iframe via postMessage.

**Technical Implementation:**

**Editor Frame (navigator-indicator.js):**
- Added `notifyDeviceMode(mode)` function (line 1299) that sends `cmsmasters:cursor:device-mode` postMessage
- Added `getDeviceModeFromBody()` (line 1311) that parses `elementor-device-{mode}` class from editor body
- Detection via two methods:
  1. `window.addEventListener('elementor/device-mode/change')` - CustomEvent from Elementor 3.x+ (line 1321)
  2. `MutationObserver` on editor body class - fallback for body class changes (line 1326)
- `lastDeviceMode` variable prevents duplicate messages

**Preview Iframe (cursor-editor-sync.js):**
- Added `isResponsiveHidden` and `wasEnabledBeforeResponsive` state variables (lines 23-25)
- Added `setResponsiveHidden(hidden)` function (line 683)
- Message handler listens for `cmsmasters:cursor:device-mode` (line 283)
- When tablet/mobile detected:
  - Panel gets `is-responsive-hidden` class → CSS `display: none !important`
  - Body gets `cmsms-responsive-hidden` class → CSS hides `#cmsm-cursor-container`
  - Current cursor state saved, cursor disabled
- When desktop restored:
  - Classes removed, cursor state restored if it was enabled before

**CSS (cursor-editor-sync.js inline styles):**
```css
/* Responsive mode: hide everything on tablet/mobile */
#cmsms-cursor-panel.is-responsive-hidden { display: none !important; }
body.cmsms-responsive-hidden #cmsm-cursor-container { display: none !important; }
body.cmsms-responsive-hidden .cmsm-cursor { display: none !important; }
```

**Why Previous Approaches Failed:**
- **window.resize** in preview iframe: Elementor doesn't resize the iframe viewport, only the CSS wrapper
- **data-elementor-device-mode** attribute in preview body: Doesn't update because CSS media queries don't fire (viewport unchanged)
- **data-elementor-device-mode** on editor body: This attribute doesn't exist on editor body, only on preview body
- **elementor.channels.deviceMode** Backbone Radio: API unreliable
- **style.display='none'** on panel: Overridden by panel CSS `display: flex !important`

**Correct Approach:** Editor frame body CLASS `elementor-device-desktop/tablet/mobile` detected via CustomEvent + MutationObserver, communicated to preview via postMessage.

**Files Changed:**
- `assets/js/navigator-indicator.js` - Device mode detection and notification
- `assets/js/cursor-editor-sync.js` - Responsive hiding logic and CSS

---

### Files Changed (v5.6 Complete)

| File | Changes |
|------|---------|
| `assets/lib/custom-cursor/custom-cursor.css` | Z-index CSS custom properties (CSS-001 fix) |
| `assets/lib/custom-cursor/custom-cursor.js` | Added CONSTANTS, CursorState, SpecialCursorManager, Pure Effect Functions, Debug Mode, Form Detection Fix |
| `assets/js/cursor-editor-sync.js` | Console cleanup (CMSM_DEBUG guard), responsive mode hiding |
| `assets/js/navigator-indicator.js` | Empty catch blocks now log errors, device mode detection |
| `includes/frontend.php` | Clean rewrite from original + cursor methods only (DEPLOY-001 fix) + Theme Builder template detection |
| `modules/settings/settings-page.php` | Removed performance tab (font preload not part of cursor) |
| `DOCS/02-CHANGELOG-v5_6.md` | Updated (this file) |
| `DOCS/03-BACKLOG.md` | Marked P4-004, P4-005, P4-006 resolved |
| `DOCS/04-KNOWN-ISSUES.md` | Marked CSS-001, MEM-004, CODE-002, CODE-003, P4-004, P4-005, P4-006 resolved |
| `DOCS/05-API-JAVASCRIPT.md` | Documented CONSTANTS, CursorState, SpecialCursorManager, Pure Functions, debug() API, isFormZone(), device mode functions |
| `DOCS/06-API-CSS.md` | Updated z-index documentation, added new CSS variables |
| `DOCS/08-API-PHP.md` | Updated should_enable_custom_cursor() with Theme Builder template detection |
| `DOCS/09-MAP-DEPENDENCY.md` | Updated with SpecialCursorManager and pure function dependencies |
| `DOCS/11-MAP-EDITOR-SYNC.md` | Added cmsmasters:cursor:device-mode message type |
| `DOCS/12-REF-BODY-CLASSES.md` | Added CursorState references |
| `DOCS/13-REF-EFFECTS.md` | Updated with pure function references |

---

## See Also

- [05-API-JAVASCRIPT.md](./05-API-JAVASCRIPT.md) - Full CursorState and SpecialCursorManager API documentation
- [12-REF-BODY-CLASSES.md](./12-REF-BODY-CLASSES.md) - Body class state machine diagram

---

*Last Updated: February 9, 2026 | Version: 5.6*
