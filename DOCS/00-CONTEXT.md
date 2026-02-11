# Custom Cursor Addon - Context for Claude

**Version:** 5.6
**Date:** February 11, 2026
**Status:** Production

---

## Quick Start

This folder contains all documentation needed to work on the CMSMasters Custom Cursor addon. Read files in this order:

1. **This file** - Overview and navigation
2. **01-ARCHITECTURE.md** - How the system works
3. **04-KNOWN-ISSUES.md** - Current bugs and their status
4. **02-CHANGELOG-v5.6.md** - Recent changes
5. **03-BACKLOG.md** - Planned work

Then reference API docs as needed during implementation.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CUSTOM CURSOR ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FRONTEND (custom-cursor.js + custom-cursor.css)                          │
│   ├── Cursor rendering (dot + ring via RAF loop)                           │
│   ├── Special cursors (image, text, icon)                                  │
│   ├── Effects (wobble, pulse, shake, buzz)                                 │
│   ├── Adaptive mode (light/dark detection)                                 │
│   └── Form/video/iframe auto-hide (graceful degradation)                   │
│                                                                             │
│   EDITOR (navigator-indicator.js + cursor-editor-sync.js)                  │
│   ├── Navigator panel indicators                                           │
│   ├── Real-time preview sync via postMessage                               │
│   └── Elementor controls integration                                        │
│                                                                             │
│   SECURITY (v5.5-SEC)                                                       │
│   ├── SVG sanitizer for XSS prevention                                     │
│   └── postMessage origin validation                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current State (v5.6)

### Resolved Issues (v5.5-SEC + v5.6)
| ID | Description | Fix |
|----|-------------|-----|
| SEC-001 | XSS via innerHTML | SVG sanitizer with whitelist |
| SEC-002/003 | postMessage no origin check | TRUSTED_ORIGIN validation |
| BUG-002 | Adaptive mode flicker | Sticky mode (500ms lock) |
| BUG-003 | Multiple cursor instances | Singleton guard |
| MEM-001 | Observer not disconnected | preview:destroyed cleanup |
| MEM-002 | setInterval not cleared | preview:destroyed cleanup |
| MEM-003 | Event listeners accumulate | Singleton guard |
| CSS-002 | color-mix() no fallback | @supports rgba fallback |

### Open Issues (prioritized)
| ID | Type | Priority | Description |
|----|------|----------|-------------|
| CSS-001 | Compatibility | HIGH | Z-index 2147483647 conflicts |
| MEM-004 | Memory | MEDIUM | Special cursor elements accumulate |
| MEM-005 | Memory | LOW | Typography cache unbounded |
| PERF-001 | Performance | DEFERRED | RAF always running (3-5% CPU) |

### False Positives (confirmed NOT bugs)
- BUG-001: Wobble on ring only - WORKS correctly (both dot+ring)
- UX-001: Cursor disappears fast - INTENTIONAL lerp design
- UX-002: No touch detection - ALREADY implemented via matchMedia

---

## File Structure

```
version-5.6/
├── assets/
│   ├── css/
│   │   ├── editor-navigator.css      # Editor panel styles
│   │   └── editor-navigator.min.css
│   ├── js/
│   │   ├── cursor-editor-sync.js     # Preview ↔ Editor sync
│   │   ├── navigator-indicator.js    # Navigator panel indicators
│   │   └── *.min.js
│   └── lib/
│       └── custom-cursor/
│           ├── custom-cursor.js      # Main cursor logic (~2100 lines)
│           ├── custom-cursor.css     # Cursor styles (~370 lines)
│           └── *.min.*
├── includes/
│   ├── editor.php                    # Elementor editor integration
│   └── frontend.php                  # WordPress frontend hooks
└── modules/
    ├── cursor-controls/module.php    # Elementor controls
    └── settings/settings-page.php    # WP admin settings
```

---

## Key Code Locations

### custom-cursor.js (Main File)
| Lines | Function | Purpose |
|-------|----------|---------|
| 10-115 | `sanitizeSvgHtml()` | XSS prevention via SVG whitelist |
| 152-158 | Singleton guard | Prevents multiple instances |
| 230, 791-800 | Sticky mode | Prevents adaptive mode flicker |
| 428-708 | Special cursors | Image/text/icon cursor logic |
| 1328-1365 | `detectCursorMode()` | Background luminance detection |
| 1344-1388 | Icon SVG color fix | Inline SVG attribute stripping for icon color |
| 1387-1887 | `render()` | RAF animation loop |
| 1891-2131 | Event listeners | Mouse, scroll, visibility handlers |
| 2050-2080 | Touch detection | Hide on touch devices |

### navigator-indicator.js (Editor)
| Lines | Function | Purpose |
|-------|----------|---------|
| 38-39 | Module variables | watchModelInterval, navigatorObserver |
| 711-729 | MutationObserver | Popup detection |
| 1281-1295 | `cleanup()` | Memory leak prevention |

---

## Documentation Index

### Core Understanding (01-04)
- `01-ARCHITECTURE.md` - System components and data flow
- `02-CHANGELOG-v5.6.md` - What's new in v5.6
- `03-BACKLOG.md` - Planned work and priorities
- `04-KNOWN-ISSUES.md` - All bugs with status

### API Reference (05-08)
- `05-API-JAVASCRIPT.md` - All JS functions (1400 lines)
- `06-API-CSS.md` - CSS classes, variables (900 lines)
- `07-API-DATA-ATTRIBUTES.md` - data-cursor-* attributes (900 lines)
- `08-API-PHP.md` - WordPress hooks/filters (650 lines)

### System Maps (09-11)
- `09-MAP-DEPENDENCY.md` - Function call graphs
- `10-MAP-DATA-FLOW.md` - Settings → Visual output pipeline
- `11-MAP-EDITOR-SYNC.md` - postMessage protocol

### Technical Reference (12-15)
- `12-REF-BODY-CLASSES.md` - State machine for cursor states
- `13-REF-EFFECTS.md` - Animation formulas (wobble, pulse, etc.)
- `14-REF-FILES.md` - Complete file listing
- `15-REF-SETTINGS.md` - WordPress options

### Security (16-18)
- `16-SEC-CODE-REVIEW.md` - Security audit findings
- `17-SEC-SVG-SANITIZER.md` - XSS prevention implementation
- `18-SEC-TEST-CHECKLIST.md` - Testing procedures

### Development
- `DEVLOG.md` - **Living document** — session log with decisions, iterations, and lessons learned

---

## Implementation Guidelines

### Before Making Changes
1. Read `04-KNOWN-ISSUES.md` to understand existing problems
2. Check `maps/DEPENDENCY-MAP.md` for function dependencies
3. Review `security/CODE-REVIEW.md` for security patterns

### Code Patterns to Follow
```javascript
// Singleton guard (required for any initialization)
if (window.cmsmCursorInstanceActive) return;
window.cmsmCursorInstanceActive = true;

// postMessage with origin validation (required)
var TRUSTED_ORIGIN = window.location.origin;
window.addEventListener('message', function(e) {
    if (e.origin !== TRUSTED_ORIGIN) return;
    // ... handle message
});

// Sticky mode for mode changes (prevents flicker)
var STICKY_MODE_DURATION = 500;
if (Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) return;

// SVG sanitization (required for any innerHTML with user content)
container.innerHTML = sanitizeSvgHtml(userProvidedSvg);
```

### Testing Requirements
See `security/TEST-CHECKLIST.md` for full testing procedures.

Key tests:
- [ ] Singleton guard: `window.cmsmCursorInstanceActive === true`
- [ ] Memory: No growth after 10+ min editor session
- [ ] Adaptive: No flicker at light/dark boundary
- [ ] Forms: Cursor hides over select/input elements

---

## Quick Reference

### CSS Variables
```css
--cmsm-cursor-color: #222;           /* Current cursor color */
--cmsm-cursor-color-light: #fff;     /* Light mode color */
--cmsm-cursor-color-dark: #222;      /* Dark mode color */
--cmsm-cursor-dot-size: 8px;         /* Dot diameter */
```

### Body Classes (States)
```
.cmsm-cursor-enabled    - Cursor active
.cmsm-cursor-hover      - Over hoverable element
.cmsm-cursor-down       - Mouse pressed
.cmsm-cursor-hidden     - Cursor hidden
.cmsm-cursor-on-dark    - On dark background (adaptive)
.cmsm-cursor-on-light   - On light background (adaptive)
```

### Data Attributes
```html
<div data-cursor="hide">           <!-- Hide cursor -->
<div data-cursor-image="url.png">  <!-- Image cursor -->
<div data-cursor-text="Click">     <!-- Text cursor -->
<div data-cursor-icon="<svg>">     <!-- Icon cursor -->
<div data-cursor-effect="wobble">  <!-- Apply effect -->
```

---

## Contact & Resources

- **Source Code:** `version-5.6/` folder
- **Previous Version:** `version-5.5-SEC/` (frozen)
- **Backups:** `fix/` folder contains pre-fix states

---

## Key Code Locations

**Note:** Line numbers approximate due to v5.6 refactor which added CONSTANTS (~96 lines) and CursorState (~122 lines) sections.

### custom-cursor.js

| Lines | Section | Key Changes (Feb 11, 2026) |
|-------|---------|----------------------------|
| ~918-984 | `isFormZone()` | Restored form container check (line 946), added 9 custom select library detectors (lines 950-970) |
| ~1344-1388 | `createIconCursor()` | Inline SVG fill/stroke stripping for uploaded icon color fix |
| ~1493-1900 | `detectCursorMode()` | Native SELECT activeElement check (line 1526) prevents false restoration |
| ~2356+ | `mouseout` handler | Native SELECT activeElement check (line 2367) prevents false restoration |

### custom-cursor.css

| Lines | Section | Key Changes (Feb 11, 2026) |
|-------|---------|----------------------------|
| 60-75 | Widget rules | Added custom select/dropdown CSS fallback for 9 libraries (Select2, Chosen, Choices, Nice Select, Tom Select, Slim Select, Selectize, jQuery UI, Kendo UI) |

### Third-Party Widget Support (Feb 11, 2026)

**JavaScript Detection:** Lines 950-970 in `isFormZone()`
**CSS Fallback:** Lines 60-75 in `custom-cursor.css`

Supported libraries:
- Select2 / SelectWoo
- Chosen.js
- Choices.js
- Nice Select v1/v2
- Tom Select
- Slim Select
- Selectize
- jQuery UI Selectmenu
- Kendo UI

---

*This documentation package prepared for Claude Desktop - Last updated: February 11, 2026*
