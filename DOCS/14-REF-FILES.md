# Custom Cursor v5.6 - File Reference

**Last Updated:** February 9, 2026

---

## Overview

| Category | Files | Total Lines |
|----------|-------|-------------|
| JavaScript | 3 | 4,002 |
| PHP | 5 | ~4,250 |
| CSS | 2 | 586 |
| **Total** | **10** | **~8,840** |

> **Note:** `includes/managers/modules.php` is part of the full addon plugin but
> is required for cursor module registration. See [01-ARCHITECTURE.md](01-ARCHITECTURE.md#module-loading-chain).

---

## JavaScript Files

### custom-cursor.js

**Location:** `assets/lib/custom-cursor/custom-cursor.js`
**Lines:** 2,026
**Minified:** `custom-cursor.min.js`

**Purpose:** Main cursor engine for frontend pages

**Global Export:** `window.cmsmastersCursor`

**Key Responsibilities:**
- Cursor position tracking and smooth interpolation (lerp)
- Element detection and attribute inheritance
- Special cursor creation (image, text, icon)
- Effect calculations (wobble, pulse, shake, buzz)
- Background luminance detection (adaptive mode)
- Form/popup/video auto-hide (P4/P5)

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `initCursor()` | ~85 | Initialize cursor system |
| `pauseCursor()` | ~95 | Pause cursor updates |
| `resumeCursor()` | ~100 | Resume cursor updates |
| `detectCursorMode()` | ~660 | Main detection logic |
| `render()` | ~1450 | RAF animation loop |
| `createImageCursor()` | ~200 | Create image cursor |
| `createTextCursor()` | ~300 | Create text cursor |
| `createIconCursor()` | ~400 | Create icon cursor |
| `getLuminance()` | ~600 | Calculate background brightness |

**Dependencies:**
- Body classes from PHP (cmsm-cursor-enabled, etc.)
- CSS variables from inline styles
- DOM elements with data-cursor-* attributes

---

### cursor-editor-sync.js

**Location:** `assets/js/cursor-editor-sync.js`
**Lines:** 680

**Purpose:** Sync cursor settings between Elementor editor and preview iframe

**Global Export:** `window.cmsmastersCursorEditorSync`

**Key Responsibilities:**
- Create floating toggle panel in preview
- Listen for settings changes from editor
- Apply cursor attributes to preview elements
- Enable/disable cursor for testing

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `createPanel()` | ~346 | Create floating UI panel |
| `makePanelDraggable()` | ~373 | Add drag functionality |
| `applySettings()` | ~522 | Apply settings to element |
| `clearAttributes()` | ~505 | Remove cursor attributes |
| `toggleCursor()` | ~499 | Enable/disable cursor |
| `findElement()` | ~537 | Find element by ID |

**Communication:**
- Receives `cursor:init` and `cursor:update` from editor
- Sends `cursor:request-init` to editor

---

### navigator-indicator.js

**Location:** `assets/js/navigator-indicator.js`
**Lines:** 1,296

**Purpose:** Show cursor indicator icons in Elementor Navigator panel

**Global Export:** `window.cmsmastersNavigatorIndicator`

**Key Responsibilities:**
- Display cursor icons in Navigator tree
- Show cursor type legend
- Broadcast cursor settings to preview
- Watch for settings model changes
- Resolve global colors/typography

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `init()` | ~1243 | Initialize indicator system |
| `updateNavigatorIndicators()` | ~571 | Update all indicators |
| `hasNonDefaultCursor()` | ~343 | Check if element has cursor |
| `getTooltip()` | ~418 | Generate tooltip text |
| `addLegend()` | ~650 | Add legend to Navigator |
| `broadcastCursorChange()` | ~793 | Send to preview iframe |
| `resolveGlobalColor()` | ~131 | Resolve Elementor global color |

**Communication:**
- Sends `cursor:init` and `cursor:update` to preview
- Receives `cursor:request-init` from preview

---

## PHP Files

### frontend.php

**Location:** `includes/frontend.php`
**Lines:** 1,467 (1,126 original addon + 341 cursor code)

**Purpose:** Frontend initialization and output (extends CMSMasters addon Frontend class)

**Architecture:** This file is the original addon's `Frontend` class with ONLY cursor methods added at the end. Original addon code (script registration, widget styles, template rendering) is untouched. See DEPLOY-001 in [04-KNOWN-ISSUES.md](04-KNOWN-ISSUES.md) for why this approach is critical.

**Key Responsibilities (cursor-only additions):**
- Check if cursor should be enabled
- Enqueue cursor scripts and styles
- Add cursor body classes
- Print cursor HTML structure + critical inline JS

**Cursor Methods (added to original class):**

| Function | Line | Purpose |
|----------|------|---------|
| `should_enable_custom_cursor()` | ~1142 | Check if cursor enabled |
| `enqueue_custom_cursor()` | ~1190 | Enqueue cursor assets |
| `add_cursor_body_class()` | ~1274 | Add cursor body classes |
| `print_custom_cursor_html()` | ~1318 | Output HTML structure |
| `print_cursor_critical_js()` | ~1347 | Output critical inline JS |
| `validate_hex_color()` | ~1407 | Validate color format |
| `get_cursor_color()` | ~1425 | Get color with fallback |

**Cursor Hooks (in init_actions, lines 118-121):**
- `wp_enqueue_scripts` - Enqueue cursor assets
- `body_class` - Add cursor classes
- `wp_footer` - Print cursor HTML/JS

---

### editor.php

**Location:** `includes/editor.php`
**Lines:** 365

**Purpose:** Elementor editor script enqueuing

**Key Responsibilities:**
- Enqueue editor scripts (navigator-indicator.js)
- Enqueue preview scripts (cursor-editor-sync.js)
- Pass localization data

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `enqueue_editor_scripts()` | ~140 | Load navigator-indicator.js |
| `enqueue_preview_scripts()` | ~200 | Load cursor-editor-sync.js |

**WordPress Hooks:**
- `elementor/editor/before_enqueue_scripts`
- `elementor/preview/enqueue_scripts`

---

### module.php

**Location:** `modules/cursor-controls/module.php`
**Lines:** 1,190

**Purpose:** Register Elementor widget controls and apply data attributes

**Key Responsibilities:**
- Register cursor controls in Advanced tab
- Apply data-cursor-* attributes to elements
- Handle all cursor types (core, image, text, icon)
- Resolve global colors and typography

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `register_controls()` | ~35 | Register all controls |
| `apply_cursor_attributes()` | ~875 | Main attribute application |
| `apply_core_cursor_attributes()` | ~1079 | Apply core type attrs |
| `apply_image_cursor_attributes()` | ~907 | Apply image cursor attrs |
| `apply_text_cursor_attributes()` | ~941 | Apply text cursor attrs |
| `apply_icon_cursor_attributes()` | ~1024 | Apply icon cursor attrs |
| `resolve_global_color()` | ~845 | Resolve Elementor global |
| `resolve_global_typography()` | ~791 | Resolve global typography |

**Elementor Hooks:**
- `elementor/element/common/_section_style/after_section_end`
- `elementor/element/section/section_layout/after_section_end`
- `elementor/element/container/section_layout/after_section_end`
- `elementor/frontend/element/before_render`

---

### settings-page.php

**Location:** `modules/settings/settings-page.php`
**Lines:** ~830

**Purpose:** Admin settings page for global cursor configuration

**Key Responsibilities:**
- Create admin menu page
- Register cursor settings fields
- Validate and sanitize input
- Save settings to database

**Major Functions:**

| Function | Line | Purpose |
|----------|------|---------|
| `register_admin_menu()` | ~544 | Add admin menu item |
| `create_tabs()` | ~570 | Create settings tabs |
| `enqueue_admin_scripts()` | ~68 | Enqueue admin assets |

**WordPress Options:**
- `elementor_custom_cursor_enabled`
- `elementor_custom_cursor_editor_preview`
- `elementor_custom_cursor_default_style`
- `elementor_custom_cursor_default_color`
- (see [SETTINGS.md](SETTINGS.md) for full list)

---

## CSS Files

### custom-cursor.css

**Location:** `assets/lib/custom-cursor/custom-cursor.css`
**Lines:** 341

**Purpose:** Frontend cursor styles

**Key Contents:**

| Section | Lines | Purpose |
|---------|-------|---------|
| Root variables | 1-12 | CSS custom properties |
| Body states | 13-91 | on-dark, on-light, blend modes |
| Core cursor | 93-113 | .cmsm-cursor-dot, .cmsm-cursor-ring |
| Blend modes | 114-138 | soft, medium, strong isolation |
| Hover states | 139-178 | hover, down, text states |
| Theme dot | 193-208 | dot-only theme variant |
| Special cursors | 209-341 | image, text, icon cursors |

**CSS Variables:**
```css
--cmsm-cursor-color
--cmsm-cursor-color-light
--cmsm-cursor-color-dark
--cmsm-cursor-dot-size
--cmsm-cursor-dot-hover-size
```

---

### editor-navigator.css

**Location:** `assets/css/editor-navigator.css`
**Lines:** 245

**Purpose:** Editor Navigator indicator styles

**Key Contents:**

| Section | Lines | Purpose |
|---------|-------|---------|
| Base indicator | 20-28 | .cmsm-nav-cursor-indicator base |
| Indicator types | 33-52 | core, special, hidden, show colors |
| Tooltips | 58-60 | title attribute tooltip |
| Legend bar | 68-141 | Legend wrapper, header, items |
| Dark mode | 147-212 | Dark theme support |
| Alignment fix | 218-245 | Navigator element positioning |

**Classes:**
- `.cmsm-nav-cursor-indicator`
- `.cmsm-nav-cursor-legend-wrapper`
- `.cmsm-legend-item`

---

## File Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FILE DEPENDENCIES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

              BACKEND                              FRONTEND
              ───────                              ────────

         settings-page.php
               │
               ▼ (WordPress options)
         frontend.php ────────────────────▶ custom-cursor.js
               │                                  │
               │ (enqueue)                        │ (runtime)
               ▼                                  ▼
         custom-cursor.css ◀─────────────── [RAF loop]


              EDITOR                               PREVIEW
              ──────                               ───────

         editor.php
               │
               ├──▶ navigator-indicator.js ──┐    (ALWAYS loaded)
               │                             │ postMessage
               └──▶ cursor-editor-sync.js ◀──┘    (only if cursor + editor preview enabled)
                           │
                           ▼
                    custom-cursor.js


              MODULE REGISTRATION
              ───────────────────

         includes/managers/modules.php
               │
               └──▶ 'cursor-controls' (must be in modules array!)
                           │
                           ▼
                    module.php
                           │
                           ▼ (data attributes)
                    [HTML elements] ─────────────▶ custom-cursor.js
```

---

## Backup Files

During development, backup files are created:

| Backup | Original | Purpose |
|--------|----------|---------|
| `custom-cursor.js.pre-p4v2` | custom-cursor.js | Before P4 v2 changes |
| `custom-cursor.js.pre-p5` | custom-cursor.js | Before P5 changes |
| `custom-cursor.js.pre-h1-fix` | custom-cursor.js | Before H1 fix (P0) |

---

## See Also

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System overview
- [JAVASCRIPT-API.md](../api/JAVASCRIPT-API.md) - All JS functions
- [PHP-API.md](../api/PHP-API.md) - All PHP functions
- [CSS-API.md](../api/CSS-API.md) - All CSS classes

---

*Last Updated: February 9, 2026 | Version: 5.6*
