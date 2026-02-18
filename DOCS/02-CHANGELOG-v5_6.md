# Custom Cursor v5.6 - Changelog

**Last Updated:** February 18, 2026

---

## Version History

| Version | Date | Type | Summary |
|---------|------|------|---------|
| Fix | 2026-02-18 | Navigator JS | Indicator type 'show' → 'core'; mode-conditional legend |
| Fix | 2026-02-17 | CSS Refactor + Settings | Ring sizing calc-based; Radius → Diameter labels |
| PR #144 | 2026-02-12 | Cleanup + Vendor | Code review: prefix rename, extract inline assets, vendor Pickr |
| v5.6 | 2026-02-06 | Refactor + Fix | Constants, CursorState, z-index consolidation |
| v5.5 | 2026-02-05 | Feature | P4 v2 Forms/popups + P5 Video/iframe auto-hide |
| v5.5-SEC | 2026-02-05 | Security | SVG sanitization for XSS prevention |

---

## Fix: Navigator Indicator — 'show' Type Replaced with 'core' + Mode-Conditional Legend (February 18, 2026)

### Type: Bug Fix (navigator-indicator.js)

#### Problem

In Widgets Only mode, elements with the cursor toggle enabled but no special cursor or inherit setting received a green indicator dot of type `'show'`. This type was:
- Not present in the legend (users saw a dot with no explanation)
- Inconsistent with the rest of the indicator vocabulary
- A dead code path — `getTooltip()` had a `case 'show':` that never matched because the type was checked before reaching that branch

#### S1 — Indicator Type Fix

**File:** `assets/js/navigator-indicator.js`

**Line 379:** Changed the Widgets Only mode final fallback:

```javascript
// Before:
return { type: 'show' };

// After:
return { type: 'core' };
```

**Line 350 (JSDoc):** Return type updated:

```javascript
// Before:
// @returns {Object|null} - { type: 'core'|'special'|'hidden'|'show'|'inherit', subtype?: string }

// After:
// @returns {Object|null} - { type: 'core'|'special'|'hidden'|'inherit', subtype?: string }
```

**`getTooltip()` switch:** Dead `case 'show':` removed. The existing `case 'core':` returns "Custom Cursor" for both full-mode core settings and widget-only active elements.

#### S2 — Mode-Conditional Legend

**File:** `assets/js/navigator-indicator.js`, function `addLegend()`

The legend now adapts to cursor mode:

| Mode | Legend Items |
|------|-------------|
| Widgets Only (`isShowMode=true`) | Core / Special / Inherit (no Hidden) |
| Enabled Globally (`isShowMode=false`) | Core / Special / Hidden / Inherit |
| Disabled (`isDisabledMode=true`) | No indicators, no legend |

Hidden is excluded in Widgets Only mode because "hiding" the cursor is not possible there — the toggle controls whether the cursor is shown, not hidden.

---

## Fix: Ring Sizing — CSS Variables + Settings Labels (February 17, 2026)

### Type: CSS Refactor + Settings Label Fix

#### 1. CSS Ring Sizing — Replaced Hardcoded Values with `calc()`

Replaced all hardcoded ring pixel sizes in `custom-cursor.css` with dynamic `calc()` expressions driven by CSS custom properties.

**New `:root` property:**
```css
--cmsmasters-cursor-ring-offset: 32px  /* gap between dot edge and ring edge */
```

**Fixed `:root` default:**
```css
--cmsmasters-cursor-dot-hover-size: 40px  /* was incorrectly 8px */
```

**Before (hardcoded):**
```css
.cmsmasters-cursor-ring { width: 40px; height: 40px; margin-left: -20px; margin-top: -20px; }
body.cmsmasters-cursor-hover .cmsmasters-cursor-ring { width: 60px; height: 60px; margin-left: -30px; margin-top: -30px; }
body.cmsmasters-cursor-down  .cmsmasters-cursor-ring { width: 30px; height: 30px; margin-left: -15px; margin-top: -15px; }
```

**After (calc-based via scoped custom properties):**
```css
.cmsmasters-cursor-ring {
    --_ring: calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset));
    width: var(--_ring);  /* 8 + 32 = 40px */
}
body.cmsmasters-cursor-hover .cmsmasters-cursor-ring {
    --_ring-hover: calc(var(--cmsmasters-cursor-dot-hover-size) + 20px);
    width: var(--_ring-hover);  /* 40 + 20 = 60px */
}
body.cmsmasters-cursor-down .cmsmasters-cursor-ring {
    --_ring-down: calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset) * 0.7);
    width: var(--_ring-down);  /* 8 + 22.4 ≈ 30px */
}
```

**Computed sizes remain identical** to previous hardcoded values at default settings. The refactor enables ring size to scale automatically when dot size or ring offset is customized.

**Scoped properties** (`--_ring`, `--_ring-hover`, `--_ring-down`) are declared inside their rule block — they are not global overrides and do not pollute the `:root` namespace.

#### 2. Settings Page — Renamed "Radius" Labels to "Diameter"

Updated `modules/settings/settings-page.php` field labels:

| Field | Before | After |
|-------|--------|-------|
| `custom_cursor_dot_size` label | Normal Radius | Dot Diameter |
| `custom_cursor_dot_size` desc | (generic) | "Dot diameter in pixels. Ring scales proportionally. Default: 8px." |
| `custom_cursor_dot_hover_size` label | Hover Radius | Hover Diameter |
| `custom_cursor_dot_hover_size` desc | (generic) | "Hover diameter in pixels. Default: 40px." |

**Rationale:** The settings control the dot *diameter* (the full width/height), not a radius. The previous "Radius" label was misleading — a user entering 8 would expect an 8px radius (16px dot), but actually gets an 8px diameter dot.

### Files Changed

| File | Changes |
|------|---------|
| `assets/lib/custom-cursor/custom-cursor.css` | Added `--cmsmasters-cursor-ring-offset: 32px` to `:root`; fixed `--cmsmasters-cursor-dot-hover-size` default to `40px`; replaced hardcoded 40/60/30px ring sizes with `calc()` + scoped properties |
| `modules/settings/settings-page.php` | "Normal Radius" → "Dot Diameter"; "Hover Radius" → "Hover Diameter"; updated descriptions |
| `DOCS/06-API-CSS.md` | Added `--cmsmasters-cursor-ring-offset` variable; documented scoped `--_ring*` properties; updated ring size state table; updated hover/down CSS snippets |
| `DOCS/12-REF-BODY-CLASSES.md` | Updated hover and down ring CSS snippets to show calc-based sizing |
| `DOCS/15-REF-SETTINGS.md` | Updated field labels and descriptions to "Diameter"; fixed CSS variable name in output example |

---

## PR #144 — Code Review Cleanup (February 12, 2026)

### Type: Cleanup + Vendor Localization

Code review by CMSArchitect (13 comments). 11 items implemented in 6 phases, 1 deferred (var→const/let in main JS), 1 declined (ES modules/Class refactor).

### Changes

#### 1. Global Prefix Rename (`cmsm-`/`cmsms-` → `cmsmasters-`)

Unified all CSS class prefixes, CSS custom property prefixes, and JS string references to use the full `cmsmasters-` prefix.

- ~385 replacements across 8 source files + 7 minified files
- CSS classes: `cmsm-cursor-*` → `cmsmasters-cursor-*`
- CSS variables: `--cmsm-cursor-*` → `--cmsmasters-cursor-*`
- DOM IDs: `#cmsm-cursor-container` → `#cmsmasters-cursor-container`
- Body classes: `cmsm-cursor-enabled` → `cmsmasters-cursor-enabled`, etc.
- Responsive classes: `cmsms-responsive-hidden` → `cmsmasters-responsive-hidden`

#### 2. Default Cursor Color Constant

Replaced 7 magic `'#222222'` strings in `frontend.php` with `DEFAULT_CURSOR_COLOR` class constant.

#### 3. Inline var → const/let (IIFE script)

Converted `var` to `const`/`let` in the inline IIFE script output by `frontend.php`. (Main JS file deferred to future refactor.)

#### 4. Inline Asset Consolidation

Reduced inline calls in `frontend.php`:
- 2 `wp_add_inline_style()` → 1
- 3 `wp_add_inline_script()` → 1

#### 5. Settings Page — Extract Inline CSS/JS

Extracted ~260 lines of inline CSS/JS from `settings-page.php` into dedicated files:
- `assets/css/admin-settings.css`
- `assets/js/admin-settings.js`
- PHP data passed via `wp_localize_script()`

#### 6. Vendor Pickr Locally

Replaced Pickr 1.9.1 CDN (jsDelivr) with local copies:
- `assets/lib/pickr/pickr.min.js`
- `assets/lib/pickr/monolith.min.css`
- Zero external CDN requests on settings page

#### 7. CSS Section Comments

Added 12 sectional comments to `custom-cursor.css` for code navigation.

#### 8. Kit Colors Fallback Comment

Added explanatory comment for Elementor Hello theme Kit Colors fallback defaults in `frontend.php`.

#### 9. Debug Logging Guard

Wrapped 9 `error_log()` calls in `resolve_global_typography()` with `WP_DEBUG` check.

#### 10. CSS Loading Bugfix

Fixed `get_css_assets_url('custom-cursor', ..., false)` loading non-minified CSS on server. Removed the `false` third parameter.

### Files Changed

| File | Changes |
|------|---------|
| `includes/frontend.php` | DEFAULT_CURSOR_COLOR constant, var→const/let in IIFE, inline consolidation, Kit Colors comment, prefix rename |
| `modules/settings/settings-page.php` | Extracted inline CSS/JS, Pickr local loading, prefix rename |
| `assets/lib/custom-cursor/custom-cursor.css` | Section comments, prefix rename |
| `assets/lib/custom-cursor/custom-cursor.js` | Prefix rename |
| `assets/js/navigator-indicator.js` | WP_DEBUG guard, prefix rename |
| `assets/js/cursor-editor-sync.js` | Prefix rename |
| `assets/css/editor-navigator.css` | Prefix rename |
| `assets/css/admin-settings.css` | **New** — extracted from settings-page.php |
| `assets/js/admin-settings.js` | **New** — extracted from settings-page.php |
| `assets/lib/pickr/pickr.min.js` | **New** — vendored from jsDelivr |
| `assets/lib/pickr/monolith.min.css` | **New** — vendored from jsDelivr |

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
#cmsmasters-cursor-container {
    z-index: 2147483647; /* max-int - conflicts with browser extensions */
}
```

**After:**
```css
#cmsmasters-cursor-container {
    --cmsmasters-cursor-z-default: 999999;
    --cmsmasters-cursor-z-blend: 9999;
    z-index: var(--cmsmasters-cursor-z-default);
}
```

**Changes:**
- Default z-index reduced from `2147483647` to `999999`
- Blend mode z-index now uses `var(--cmsmasters-cursor-z-blend)` instead of hardcoded `9999`
- Popup/datepicker overrides now use `var(--cmsmasters-cursor-z-default)` (removed `!important`)
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
    hover: boolean,    // cmsmasters-cursor-hover
    down: boolean,     // cmsmasters-cursor-down
    hidden: boolean,   // cmsmasters-cursor-hidden
    text: boolean,     // cmsmasters-cursor-text
    mode: string|null, // cmsmasters-cursor-on-light | cmsmasters-cursor-on-dark
    size: string|null, // cmsmasters-cursor-size-sm | -md | -lg
    blend: string|null // cmsmasters-cursor-blend-soft | -medium | -strong
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
body.classList.add('cmsmasters-cursor-hover');
body.classList.remove('cmsmasters-cursor-on-light');
body.classList.add('cmsmasters-cursor-on-dark');

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
   body.cmsmasters-cursor-hidden,
   body.cmsmasters-cursor-hidden * {
       cursor: default !important
   }
   ```
   - Ensures system cursor visible when custom cursor hides
   - Specificity (0,1,2) beats `.cmsmasters-cursor-enabled *` (0,1,1)
   - Works in both dual and solo modes

4. **CSS widget rules added (custom-cursor.css lines 60-75):**
   - Added `cursor: default !important` for all custom select/dropdown widget containers (alongside existing datepicker rules)
   - Ensures system cursor visible inside widgets even if parent has `cursor:none`

5. **Instant opacity restore in solo mode (_applyToDOM, line 486-500):**
   - When `hidden` transitions from true→false in solo mode, forces instant opacity=1 on `.cmsmasters-cursor` elements
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

**Rule:** Hide cursor on touch-screen modes (tablet/mobile), keep visible on mouse-driven modes (desktop/widescreen/laptop).

| Elementor Mode | Cursor | Reason |
|---|---|---|
| desktop | visible | mouse |
| widescreen | visible | mouse |
| laptop | visible | mouse |
| tablet | hidden | touchscreen |
| tablet_extra | hidden | touchscreen |
| mobile | hidden | touchscreen |
| mobile_extra | hidden | touchscreen |

**Problem:**
Cursor preview remained visible when switching to tablet/mobile responsive view.

**Solution (v2 — February 11, 2026):**
Primary detection via `window.resize` in the preview iframe. Elementor DOES resize the preview iframe when switching responsive modes. The previous postMessage-based approach was unreliable — the `elementor/device-mode/change` CustomEvent doesn't exist, and MutationObserver on body classes proved fragile.

**Technical Implementation:**

**Primary: Viewport Width Detection (cursor-editor-sync.js):**
- `TABLET_MAX_WIDTH = 1024` — threshold for touch vs mouse modes
- `checkResponsiveWidth()` function checks `window.innerWidth <= TABLET_MAX_WIDTH`
- `window.addEventListener('resize', checkResponsiveWidth)` — fires when Elementor resizes preview iframe
- Simple, reliable, no cross-frame communication needed

**Backup: postMessage from Editor (navigator-indicator.js):**
- `sendDeviceMode(mode)` — force-sends device mode (no deduplication), used on `preview:loaded` to re-sync new iframe
- `notifyDeviceMode(mode)` — sends with deduplication (skips if mode unchanged)
- Detection via `elementor.channels.deviceMode` Backbone Radio + MutationObserver on body class
- On each `preview:loaded`, re-sends current device mode after 700ms delay
- Touch mode check: `/tablet|mobile/i.test(mode)` — matches tablet, mobile, tablet_extra, mobile_extra

**Hiding Logic (cursor-editor-sync.js):**
- `setResponsiveHidden(hidden)` — saves cursor state, disables cursor, adds CSS classes
- `isResponsiveHidden` + `wasEnabledBeforeResponsive` state variables
- Panel gets `is-responsive-hidden` class → CSS `display: none !important`
- Body gets `cmsmasters-responsive-hidden` class → CSS hides cursor container

**CSS (cursor-editor-sync.js inline styles):**
```css
#cmsmasters-cursor-panel.is-responsive-hidden { display: none !important; }
body.cmsmasters-responsive-hidden #cmsmasters-cursor-container { display: none !important; }
body.cmsmasters-responsive-hidden .cmsmasters-cursor { display: none !important; }
```

**Why Previous v1 Approach Failed:**
- ❌ `elementor/device-mode/change` CustomEvent — Elementor never dispatches this native DOM event
- ❌ MutationObserver on editor body — detection code in navigator-indicator.js didn't execute reliably
- ❌ `data-elementor-device-mode` attribute — doesn't update on editor body
- ❌ Original assumption that Elementor doesn't resize iframe — **incorrect**, it does resize

**Correct Approach (v2):** Direct `window.resize` in preview iframe with `innerWidth <= 1024` threshold, backed by postMessage for edge cases.

**Files Changed:**
- `assets/js/cursor-editor-sync.js` - Width-based detection (primary) + postMessage handler (backup)
- `assets/js/navigator-indicator.js` - Backbone Radio + MutationObserver + preview:loaded re-sync

---

#### 11. Icon Cursor SVG Color Fix (createIconCursor)

Added inline SVG color recoloring for uploaded SVG icons from media library.

**Problem:**
Uploaded SVG icons showed correct icon color in Elementor editor (uses `<img>` mask technique) but reverted to original SVG fill colors on frontend (Elementor's `Icons_Manager::render_icon()` renders inline `<svg>`). Child elements like `<path fill="#FF0000">` overrode CSS `fill: currentColor` rule.

**Solution (lines 1344-1388):**
Added `else` branch in `createIconCursor()` after existing `<img>` mask technique:

1. **Detection:** Only runs when `querySelector('img')` returns null (inline SVG case)
2. **Attribute stripping:** Removes explicit `fill` and `stroke` attributes from SVG child elements
3. **Preserve special values:** Keeps `none`, `currentColor`, `transparent`, `url(...)`, `inherit` (case-insensitive)
4. **Inline style handling:** Also clears `style.fill` and `style.stroke` if not special values
5. **Stroke-based icon support:** Sets `svgEl.style.stroke = 'currentColor'` on SVG root for line-art icons
6. **Respects preserveColors:** Gated by `!styles.preserveColors` — skipped when user wants original multicolor SVG

**Known Limitation:**
SVGs with internal `<style>` blocks containing class-based fills (e.g., `.cls-1{fill:#FF0000}`) won't be recolored. This requires CSS parsing which is not implemented.

**Why This Approach:**
- **Editor:** Elementor renders uploaded SVG icons via `<img src="library.svg">` → mask technique applies icon color
- **Frontend:** Elementor renders same icons via inline `<svg>` from `Icons_Manager::render_icon()` → needs attribute stripping
- Dual-mode support ensures both rendering methods produce consistent colored icons

**Files Changed:**
- `assets/lib/custom-cursor/custom-cursor.js` (lines 1344-1388)

---

#### 12. Entry + Popup Template Panel Hiding

Added cursor panel hiding for unsupported Elementor Theme Builder template types where cursor doesn't render in editor preview.

**Problem:**
Cursor preview panel (switcher) showed on Entry and Popup template types in Elementor editor, but cursor doesn't actually render on these templates, creating confusion.

**Template Types That HIDE Panel:**
- `cmsmasters_entry` — Blog/archive entry cards
- `cmsmasters_product_entry` — WooCommerce product cards
- `cmsmasters_tribe_events_entry` — Tribe Events entry cards
- `cmsmasters_popup` — Popup overlays

**Template Types That SHOW Panel Normally:**
- `cmsmasters_header`, `cmsmasters_footer`
- `cmsmasters_archive`, `cmsmasters_singular`
- `cmsmasters_product_archive`, `cmsmasters_product_singular`
- `cmsmasters_tribe_events_archive`, `cmsmasters_tribe_events_singular`

**Implementation (4 Layers):**

1. **PHP Guard (frontend.php:1164-1180):**
   - `should_enable_custom_cursor()` checks `$document->get_name()`
   - Returns `false` if name equals `cmsmasters_popup` OR ends with `_entry`
   - No `cmsmasters-cursor-enabled` class → no cursor JS/CSS loaded

2. **JS Early Guard (cursor-editor-sync.js:13-21):**
   - Checks `data-elementor-type` attribute on document element (from `elementor-preview` URL param)
   - Returns early if popup or *_entry — no panel created

3. **PostMessage from init() (navigator-indicator.js):**
   - New `isHiddenTemplate()` function uses `isCursorExcludedTemplate(type)` helper
   - Checks via Elementor JS API (`doc.config.type`) + preview iframe DOM fallback
   - Sends `cmsmasters:cursor:template-check` postMessage to hide/show panel

4. **document:loaded Event (navigator-indicator.js:1403-1420):**
   - Listens for `elementor.on('document:loaded')` — fires on every document change including soft-switches
   - Uses `isCursorExcludedTemplate(loadedDoc.config.type)`
   - Sends postMessage to sync panel visibility

**New postMessage Type:**
- `cmsmasters:cursor:template-check` with `{ isThemeBuilder: boolean }` — sent from editor to preview iframe

**New CSS Class:**
- `.is-template-hidden { display: none !important; }` — hides cursor panel on excluded templates

**New JS Functions:**
- `isCursorExcludedTemplate(type)` — returns true if type is popup or ends with _entry
- `isHiddenTemplate()` — checks current document via 2 methods (Elementor API + iframe DOM)

**Why Narrow to Entry + Popup:**
- Archive/Singular templates render full pages → cursor works normally
- Entry templates render in loops → cursor doesn't render in card context
- Popup templates are overlays → cursor doesn't render on popup preview

**Commits:**
- `4394407` — Initial implementation with cmsmasters_ prefix check
- `63c96f1` — Fix to use DOM check instead of timing-dependent API
- `4e96648` — Fix to check main document only (not header/footer in DOM)
- `bc90915` — Add document:loaded listener for soft document switches
- `473f214` — Narrow to Entry + Popup only (not all cmsmasters_ types)

**Files Changed:**
- `includes/frontend.php` (lines 1164-1180)
- `assets/js/cursor-editor-sync.js` (lines 13-21, postMessage handler)
- `assets/js/navigator-indicator.js` (new functions + document:loaded listener)

---

#### 13. Cursor Preview Panel — Center + Viewport Clamping

Improved cursor preview panel positioning and drag behavior in editor.

**Changes (`cursor-editor-sync.js`):**
- Panel now centered horizontally (`left:50% + translateX(-50%)`) instead of `right:20px`
- Drag handlers use `setProperty` with `!important` for reliable positioning over injected styles
- Added `clampPanelToViewport()` — prevents panel from going off-screen after drag
- Re-clamp on `window.resize` (e.g. Elementor responsive mode switch)

**Files Changed:**
- `assets/js/cursor-editor-sync.js` (panel CSS + drag logic)

---

#### 14. Hide Custom Cursor on Page Navigation

Added automatic cursor hiding during page navigation to prevent "double cursor" visual artifact.

**Problem:**
When clicking a link, custom cursor froze at click position while system cursor continued moving, creating an ugly "double cursor" effect during the 100-300ms page transition.

**Solution (lines ~2555-2587):**
- Added `hideCursorOnNav()` helper function that sets `container.style.visibility = 'hidden'`
- Called from existing `beforeunload` event handler (full cleanup already present)
- Added new `pagehide` event listener for BFCache/Safari coverage
- Guard `if (container)` prevents errors if called before cursor init

**Why Two Events:**
- `beforeunload` — fires on most page navigations (Chrome, Firefox)
- `pagehide` — fires when using browser back/forward with BFCache (Safari, Firefox)

**Files Changed:**
- `assets/lib/custom-cursor/custom-cursor.js` (lines ~2555-2587)

**Commit:** 2f2d133

---

#### 15. Ring Trail Fix on Special Cursor Entry

Fixed visible ring trail/ghost when entering special cursor zones (image/text/icon).

**Problem:**
When entering a special cursor zone, the ring had a ~200ms visible trail because CSS `opacity .2s` transition kept ring partially visible while lerp moved it to the new position.

**Solution (lines ~1183-1192):**
Modified `hideDefaultCursor()` to temporarily disable ring's transition for one frame before setting opacity to 0:

```javascript
var prevTransition = ring.style.transition;
ring.style.transition = 'none';       // Disable transition
ring.style.opacity = '0';              // Instant hide
requestAnimationFrame(function() {    // Restore transition next frame
    ring.style.transition = prevTransition;
});
```

**Why This Works:**
CSS transitions cause animation from old value to new value. While ring opacity animates 1 → 0 (200ms), lerp simultaneously moves ring position, creating a visible trail. Removing transition for one frame forces instant opacity change with no animation.

**Files Changed:**
- `assets/lib/custom-cursor/custom-cursor.js` (lines ~1183-1192)

**Commit:** 2f2d133

---

### Files Changed (v5.6 Complete)

| File | Changes |
|------|---------|
| `assets/lib/custom-cursor/custom-cursor.css` | Z-index CSS custom properties (CSS-001 fix) |
| `assets/lib/custom-cursor/custom-cursor.js` | Added CONSTANTS, CursorState, SpecialCursorManager, Pure Effect Functions, Debug Mode, Form Detection Fix, Icon SVG Color Fix, Page Navigation Hide, Ring Trail Fix |
| `assets/js/cursor-editor-sync.js` | Console cleanup (CMSM_DEBUG guard), responsive mode hiding, entry/popup template hiding, panel centering + viewport clamping |
| `assets/js/navigator-indicator.js` | Empty catch blocks now log errors, device mode detection, template-check postMessage |
| `includes/frontend.php` | Clean rewrite from original + cursor methods only (DEPLOY-001 fix) + Entry/Popup template detection |
| `modules/settings/settings-page.php` | Removed performance tab (font preload not part of cursor) |
| `DOCS/02-CHANGELOG-v5_6.md` | Updated (this file) |
| `DOCS/03-BACKLOG.md` | Marked P4-004, P4-005, P4-006 resolved |
| `DOCS/04-KNOWN-ISSUES.md` | Marked CSS-001, MEM-004, CODE-002, CODE-003, P4-004, P4-005, P4-006 resolved |
| `DOCS/05-API-JAVASCRIPT.md` | Documented CONSTANTS, CursorState, SpecialCursorManager, Pure Functions, debug() API, isFormZone(), device mode functions, createIconCursor() SVG fix, hideCursorOnNav(), hideDefaultCursor() ring trail fix |
| `DOCS/06-API-CSS.md` | Updated z-index documentation, added new CSS variables |
| `DOCS/08-API-PHP.md` | Updated should_enable_custom_cursor() with Theme Builder template detection |
| `DOCS/09-MAP-DEPENDENCY.md` | Updated with SpecialCursorManager and pure function dependencies |
| `DOCS/11-MAP-EDITOR-SYNC.md` | Added cmsmasters:cursor:device-mode message type |
| `DOCS/12-REF-BODY-CLASSES.md` | Added CursorState references |
| `DOCS/13-REF-EFFECTS.md` | Updated with pure function references |
| `DOCS/DEVLOG.md` | Added session entry for page navigation + ring trail fixes |

---

## See Also

- [05-API-JAVASCRIPT.md](./05-API-JAVASCRIPT.md) - Full CursorState and SpecialCursorManager API documentation
- [12-REF-BODY-CLASSES.md](./12-REF-BODY-CLASSES.md) - Body class state machine diagram

---

*Last Updated: February 17, 2026 | Version: 5.6*
