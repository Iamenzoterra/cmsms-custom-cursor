# Custom Cursor v5.6 - Changelog

**Last Updated:** February 6, 2026

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

## See Also

- [05-API-JAVASCRIPT.md](./05-API-JAVASCRIPT.md) - Full CursorState API documentation
- [12-REF-BODY-CLASSES.md](./12-REF-BODY-CLASSES.md) - Body class state machine diagram

---

*Last Updated: February 6, 2026 | Version: 5.6*
