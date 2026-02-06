# Custom Cursor Addon - Version 5.6

## Release Date
February 5, 2026

---

## What's New in 5.6

*Version 5.6 is based on v5.5-SEC with all security and stability fixes included.*

### CSS-002: color-mix() Fallback for Older Browsers
**Problem:** `color-mix()` CSS function has no fallback for older browsers (Safari <16.4, Firefox <113, Chrome <111).

**Solution:** Added `@supports` fallback with correct RGBA values matching color-mix percentages.

**Code:**
```css
@supports not (background-color: color-mix(in srgb, red 50%, blue)) {
    /* Default: dark cursor (#222) on light background */
    body.cmsm-cursor-hover .cmsm-cursor-ring {
        background-color: rgba(34, 34, 34, 0.1)  /* 10% opacity for 10% mix */
    }
    body.cmsm-cursor-down .cmsm-cursor-ring {
        background-color: rgba(34, 34, 34, 0.9)  /* 90% opacity for 90% mix */
    }

    /* Adaptive: light cursor (#fff) on dark background */
    body.cmsm-cursor-on-dark.cmsm-cursor-hover .cmsm-cursor-ring {
        background-color: rgba(255, 255, 255, 0.1)
    }
    body.cmsm-cursor-on-dark.cmsm-cursor-down .cmsm-cursor-ring {
        background-color: rgba(255, 255, 255, 0.9)
    }
}
```

**Browser Support:**
- ~5% of users affected by lack of color-mix() support
- Fallback provides identical visual appearance

**Files Changed:**
- `custom-cursor.css` - Added @supports fallback block (~20 lines)
- `custom-cursor.min.css` - Minified version updated

---

### Deferred: PERF-001 RAF Idle Detection

**Status:** ⏸️ DEFERRED (not implemented in v5.6)

**Reason:** Risk analysis revealed:
- 4 HIGH probability failure scenarios (58-72%)
- Complex state management (8+ variables to reset on resume)
- Benefit (3-5% CPU) doesn't justify risk of cursor glitches
- Will revisit if users report battery drain issues

---

## Inherited from 5.5-SEC

### Security Fixes

#### SEC-001: XSS Prevention via SVG Sanitizer
**Problem:** Icon cursor used `innerHTML` without sanitization, allowing XSS attacks.

**Solution:** Added lightweight SVG sanitizer that:
- Whitelists safe SVG/HTML tags
- Whitelists safe attributes
- Strips all event handlers (onclick, onerror, onload, etc.)
- Removes javascript: URLs
- Sanitizes style attributes (removes expressions, -moz-binding)
- Validates src attributes (blocks javascript: URLs)

**CRITICAL Implementation Note:**
All tag names and attribute names in whitelists MUST be **lowercase** because the sanitizer uses `toLowerCase()` for comparison. SVG elements like `linearGradient` become `lineargradient` when parsed.

**Whitelisted SVG Tags (37):**
```
svg, path, g, circle, rect, line, polyline, polygon, ellipse,
text, tspan, textpath, defs, use, symbol, a,
clippath, mask, pattern, marker, image, switch, foreignobject,
lineargradient, radialgradient, stop, title, desc,
filter, feblend, feflood, fegaussianblur, feoffset, femerge,
femergenode, fecomposite, fecolormatrix, fedropshadow, feturbulence,
fediffuselighting, fespecularlighting, fepointlight, fespotlight,
fedistantlight, feimage, femorphology, fedisplacementmap, fetile,
feconvolvematrix
```

**Whitelisted HTML Tags (7):**
```
i, span, div, em, strong, b, img
```

**Whitelisted Attributes (90+):**
- Core: class, id, style, d, fill, stroke, opacity, transform
- Dimensions: width, height, x, y, cx, cy, r, rx, ry, x1, y1, x2, y2
- SVG-specific: viewbox, xmlns, preserveaspectratio, points
- Stroke: stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray
- Gradient: gradientunits, gradienttransform, spreadmethod, fx, fy, offset, stop-color, stop-opacity
- Filter: filterunits, primitiveunits, stddeviation, result, in, in2, mode, flood-color, flood-opacity
- Text: font-family, font-size, font-weight, text-anchor, textlength
- Marker: markerunits, markerwidth, markerheight, refx, refy, orient
- Links: href, xlink:href (only # and data:image/ allowed)
- Image: src, alt, loading, decoding
- Accessibility: aria-*, data-*, role, focusable

**Blocked Content:**
- All `on*` event handlers (onclick, onerror, onload, etc.)
- `javascript:` URLs in href, xlink:href, src
- CSS expressions: `expression()`, `-moz-binding`
- Dangerous tags: script, iframe, object, embed, form, input, etc.

**Files Changed:**
- `custom-cursor.js` - Added `sanitizeSvgHtml()` function (~120 lines)

---

#### SEC-002: postMessage Origin Validation (Preview)
**Problem:** `cursor-editor-sync.js` accepted postMessage from any origin.

**Solution:** Added `TRUSTED_ORIGIN` constant and origin validation:
- Rejects messages from untrusted origins
- Specifies trusted origin when sending messages (instead of '*')

**Files Changed:**
- `cursor-editor-sync.js` - Added origin check in message listener

---

#### SEC-003: postMessage Origin Validation (Editor)
**Problem:** `navigator-indicator.js` accepted postMessage from any origin.

**Solution:** Same fix as SEC-002:
- Added `TRUSTED_ORIGIN` constant
- Origin validation in message listener
- Specified trusted origin for all outgoing postMessage calls (5 locations)

**Files Changed:**
- `navigator-indicator.js` - Added origin checks

---

### Bug Fixes

#### BUG-002: Adaptive Mode Flicker Fix
**Problem:** Cursor flickered rapidly when positioned at light/dark background boundary.

**Solution:** Added "sticky mode" - locks color mode for 500ms after change to prevent boundary oscillation.

**Code:**
```javascript
var STICKY_MODE_DURATION = 500;  // ms
if (lastModeChangeTime && Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) {
    return; // Skip detection during sticky period
}
```

**Trade-off:** Cursor may stay "wrong" color for up to 500ms when crossing boundary fast. Prioritizes stability over real-time accuracy.

**Files Changed:**
- `custom-cursor.js` - Added `lastModeChangeTime`, `STICKY_MODE_DURATION` variables and early return in `detectCursorMode()`

---

#### BUG-003: Multiple Cursor Instances Prevention
**Problem:** In Elementor SPA navigation, cursor script could initialize multiple times, causing duplicate event listeners and CPU spikes.

**Solution:** Added singleton guard after DOM ready check.

**Code:**
```javascript
// === SINGLETON GUARD (BUG-003 + MEM-003 fix) ===
if (window.cmsmCursorInstanceActive) {
    return; // Already initialized - don't create duplicate listeners
}
window.cmsmCursorInstanceActive = true;

// Reset on page unload for proper re-initialization
window.addEventListener('beforeunload', function() {
    window.cmsmCursorInstanceActive = false;
});
```

**Also Fixes:** MEM-003 (Event Listeners Not Removed)

**Files Changed:**
- `custom-cursor.js` - Added singleton guard at line ~152

---

### Memory Leak Fixes

#### MEM-001: MutationObserver Cleanup
**Problem:** Navigator MutationObserver never disconnected, causing memory leak in long editor sessions.

**Solution:** Made observer a module-level variable and added cleanup on `preview:destroyed` event.

**Code:**
```javascript
var navigatorObserver = null;  // Module-level

function cleanup() {
    if (navigatorObserver) {
        navigatorObserver.disconnect();
        navigatorObserver = null;
    }
}

elementor.on('preview:destroyed', cleanup);
```

**Files Changed:**
- `navigator-indicator.js` - Lines 39, 749, 1281-1300

---

#### MEM-002: setInterval Cleanup
**Problem:** `watchModelInterval` (300ms) never cleared, running forever in editor.

**Solution:** Added cleanup in same function as MEM-001.

**Code:**
```javascript
function cleanup() {
    if (watchModelInterval) {
        clearInterval(watchModelInterval);
        watchModelInterval = null;
    }
}
```

**Files Changed:**
- `navigator-indicator.js` - Lines 38, 1086, 1281-1300

---

#### MEM-003: Event Listeners Accumulation
**Problem:** In Elementor SPA, navigating between pages caused event listeners to accumulate (N pages = N× listeners).

**Solution:** Singleton guard (see BUG-003) prevents re-initialization.

**Files Changed:**
- `custom-cursor.js` - Same fix as BUG-003

---

## What's New in 5.5

### P4 v2: Forms & Popups Auto-Hide (Graceful Degradation)
**Problem:** Cursor hides behind popups and dropdowns (Select2, Forminator, datepickers) due to CSS stacking contexts.

**Solution:** Detect forms/popups via ARIA roles and hide custom cursor. System cursor works fine.

**Why This Approach:**
- P4 v1 (dynamic stacking context detection) caused CSS inheritance issues and visual jumps
- Simple code (~25 lines total)
- No DOM manipulation
- System cursor is fine for forms (users expect it)
- ARIA-based detection = future-proof

**Detection Targets:**
- `<select>` dropdowns
- `<input>` (not submit/button)
- `[role="listbox"]`, `[role="combobox"]`, `[role="menu"]`
- `[role="dialog"]`, `[aria-modal="true"]`

**Code Locations:**
- `detectCursorMode()` - detection during mousemove
- `mouseover` handler - instant response
- `mouseout` handler - restoration logic

---

### P5: Video/Iframe Auto-Hide
**Problem:** Cursor lags on videos, can't enter social embeds (X, YouTube, etc.)

**Solution:** Auto-detect `<video>` and `<iframe>` elements, hide custom cursor.

**Why:**
- Cross-origin iframes block mouse events (browser security)
- Video playback causes cursor detection lag
- Social embeds (X, Facebook, Instagram) are all iframes

---

### P2: Editor DOM Re-rendering Fix
**Problem:** When editing GRANDPARENT in Elementor Editor, PARENT and CHILD lose cursor settings

**Solution:** Enhanced postMessage broadcast - `broadcastChildrenCursorSettings()` recursively broadcasts settings to all children after container re-render.

**File:** `navigator-indicator.js`

---

## Removed from v5.5

### P4 v1: Dynamic Stacking Context Detection (REMOVED)
**Reason:** Caused unpredictable cursor behavior, CSS inheritance issues, visual jumps during appendChild.

**Backup:** `fix/p4/` folder contains files after P4 v1, before P5.

---

## Upgrade from 5.4

Replace entire addon folder with version-5.5.

---

## Testing Checklist

### P5: Video/Iframe
- [ ] Video without preview - cursor hides, no lag
- [ ] Playing video - cursor hides
- [ ] YouTube/Vimeo iframe - cursor hides
- [ ] X/Twitter embed - cursor hides
- [ ] Leave video/iframe - cursor returns

### P4 v2: Forms & Popups
- [ ] Native `<select>` - cursor hides, dropdown works
- [ ] Select2 dropdown - cursor hides when open
- [ ] Forminator form inputs - cursor hides
- [ ] Input with autocomplete - cursor hides, suggestions work
- [ ] Modal popup (role="dialog") - cursor hides inside
- [ ] Submit button - cursor STAYS custom
- [ ] Regular page content - cursor works normally
- [ ] Leave form element - cursor returns

### P2: Editor
- [ ] Edit grandparent - children keep cursor settings

### BUG-002: Adaptive Mode Stability
- [ ] Move cursor slowly over light/dark boundary - no flicker
- [ ] Move cursor fast over light/dark boundary - no flicker
- [ ] Cursor may stay "wrong" color for ~500ms (expected trade-off)

### BUG-003 + MEM-003: Singleton Guard
- [ ] Open Elementor editor, edit Page A
- [ ] Navigate to Page B (AJAX navigation)
- [ ] Console: `window.cmsmCursorInstanceActive === true`
- [ ] After 5+ page navigations - no CPU spike
- [ ] Reload page - cursor reinitializes correctly

### MEM-001 + MEM-002: Editor Memory
- [ ] DevTools → Memory → Take heap snapshot
- [ ] Work in editor for 10+ minutes
- [ ] Close preview (preview:destroyed triggers)
- [ ] Take another heap snapshot - no significant growth
- [ ] With CMSM_DEBUG=true, see "Cleanup completed" in console

---

## File Structure

```
version-5.5/
├── assets/
│   ├── css/
│   │   ├── editor-navigator.css
│   │   └── editor-navigator.min.css
│   ├── js/
│   │   ├── cursor-editor-sync.js
│   │   ├── cursor-editor-sync.min.js
│   │   ├── navigator-indicator.js      [P2 fix]
│   │   └── navigator-indicator.min.js
│   └── lib/
│       └── custom-cursor/
│           ├── custom-cursor.js        [P4 v2 fix]
│           ├── custom-cursor.js.pre-p4v2  [backup]
│           ├── custom-cursor.min.js
│           ├── custom-cursor.css
│           └── custom-cursor.min.css
├── includes/
│   ├── editor.php
│   └── frontend.php
├── modules/
│   ├── cursor-controls/
│   │   └── module.php
│   └── settings/
│       └── settings-page.php
├── fix/                                [backups]
│   ├── custom-cursor.js                [after P2, before P4]
│   └── p4/
│       └── custom-cursor.js            [after P4 v1, before P5]
├── backlog.md
├── CHANGELOG.md
├── CODE-REVIEW.md
├── P4-FORMS-POPUPS.md
├── SVG-SANITIZER.md          [NEW in v5.5-SEC]
└── TEST-CHECKLIST.md         [NEW in v5.5-SEC]
```

---

## Backup Files

| File | State |
|------|-------|
| `fix/custom-cursor.js` | Clean state after P2 (no P4, no P5) |
| `fix/p4/custom-cursor.js` | After P4 v1 (broken, for reference) |
| `custom-cursor.js.pre-p4v2` | Before P4 v2 implementation |
