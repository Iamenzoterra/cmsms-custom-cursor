# Custom Cursor v5.6 - Architecture Overview

**Last Updated:** February 6, 2026

---

## System at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CUSTOM CURSOR SYSTEM v5.6                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │    PHP      │───▶│    HTML     │───▶│     JS      │───▶│    CSS      │ │
│   │ (Settings)  │    │ (Structure) │    │ (Behavior)  │    │  (Visual)   │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │                    CURSOR OUTPUT ON SCREEN                          │ │
│   │    • Position follows mouse with smooth interpolation (lerp)        │ │
│   │    • Style changes based on hovered element attributes              │ │
│   │    • Effects (wobble, pulse, shake, buzz) animate in real-time      │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Production Pages)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND RUNTIME                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHP Layer                          JavaScript Layer                        │
│  ──────────                         ────────────────                        │
│  ┌──────────────┐                   ┌──────────────────────────────────┐   │
│  │ frontend.php │                   │       custom-cursor.js           │   │
│  │              │                   │                                  │   │
│  │ • Settings   │──────────────────▶│ • initCursor()                   │   │
│  │ • Body class │                   │ • detectCursorMode()             │   │
│  │ • HTML print │                   │ • render() [RAF loop]            │   │
│  │ • Critical JS│                   │ • Event handlers                 │   │
│  └──────────────┘                   └──────────────────────────────────┘   │
│         │                                        │                          │
│         ▼                                        ▼                          │
│  ┌──────────────┐                   ┌──────────────────────────────────┐   │
│  │  HTML Output │                   │       custom-cursor.css          │   │
│  │              │                   │                                  │   │
│  │ <body class= │                   │ • Container styles               │   │
│  │  "cmsm-..."> │                   │ • Theme variations               │   │
│  │              │                   │ • State classes                  │   │
│  │ <div id=     │                   │ • Effect animations              │   │
│  │  "cmsm-      │                   │ • CSS variables                  │   │
│  │  cursor-     │                   └──────────────────────────────────┘   │
│  │  container"> │                                                          │
│  └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Editor (Elementor Backend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDITOR ENVIRONMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐     ┌─────────────────────────────────┐   │
│  │      EDITOR FRAME           │     │       PREVIEW IFRAME            │   │
│  │                             │     │                                 │   │
│  │ ┌─────────────────────────┐ │     │ ┌─────────────────────────────┐ │   │
│  │ │  navigator-indicator.js │ │     │ │  cursor-editor-sync.js      │ │   │
│  │ │                         │ │     │ │                             │ │   │
│  │ │ • Cursor indicators     │ │     │ │ • Settings panel            │ │   │
│  │ │ • Legend management     │ │     │ │ • Live preview              │ │   │
│  │ │ • Settings broadcast    │◀─────▶│ │ • Attribute application    │ │   │
│  │ └─────────────────────────┘ │ PM  │ └─────────────────────────────┘ │   │
│  │                             │     │                                 │   │
│  │ ┌─────────────────────────┐ │     │ ┌─────────────────────────────┐ │   │
│  │ │  editor.php             │ │     │ │  custom-cursor.js           │ │   │
│  │ │                         │ │     │ │  (same as frontend)         │ │   │
│  │ │ • Script enqueue        │ │     │ │                             │ │   │
│  │ │ • Control registration  │ │     │ │ • Full cursor engine        │ │   │
│  │ └─────────────────────────┘ │     │ └─────────────────────────────┘ │   │
│  │                             │     │                                 │   │
│  │ ┌─────────────────────────┐ │     │                                 │   │
│  │ │  module.php             │ │     │        PM = postMessage         │   │
│  │ │                         │ │     │                                 │   │
│  │ │ • Elementor controls    │ │     │                                 │   │
│  │ │ • Data attributes       │ │     │                                 │   │
│  │ └─────────────────────────┘ │     │                                 │   │
│  └─────────────────────────────┘     └─────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Loading Chain

How the plugin loads cursor-related components:

```
cmsmasters-elementor-addon.php
    │
    └──▶ includes/plugin.php
              │
              ├──▶ new Editor()    (includes/editor.php)     — ALWAYS loaded
              │         │
              │         ├──▶ navigator-indicator.js           — ALWAYS enqueued in editor
              │         │       config: { cursorEnabled: bool }
              │         │
              │         ├──▶ cursor-editor-sync.js            — ONLY if cursor + editor preview enabled
              │         │
              │         └──▶ editor-navigator.css              — ALWAYS enqueued in editor
              │
              ├──▶ new Frontend()  (includes/frontend.php)   — ALWAYS loaded
              │         │
              │         ├──▶ custom-cursor.js                 — ONLY if should_enable() = true
              │         └──▶ custom-cursor.css                — ONLY if should_enable() = true
              │
              └──▶ Modules_Manager (includes/managers/modules.php)
                        │
                        └──▶ 'cursor-controls'               — Registered in modules list
                                  │
                                  └──▶ modules/cursor-controls/module.php
                                            │
                                            ├──▶ register_controls()        — Adds "Custom Cursor" section to Advanced tab
                                            └──▶ apply_cursor_attributes()  — Renders data-attributes on frontend
```

**Critical:** `includes/managers/modules.php` must contain `'cursor-controls'` in its modules array.
Without it, the cursor controls won't appear in Elementor editor's Advanced tab.

**Loading conditions:**

| Component | Loads when | Controls |
|---|---|---|
| `editor.php` | Always in editor | Script enqueue |
| `navigator-indicator.js` | Always in editor | Indicators + legend in Navigator panel |
| `cursor-editor-sync.js` | `cursor_enabled=yes` AND `editor_preview=yes` | Live cursor in preview |
| `module.php` | `'cursor-controls'` in `modules.php` | Advanced tab controls |
| `frontend.php` | Always on frontend | Cursor engine enqueue |
| `custom-cursor.js` | `should_enable()` = true | Cursor rendering |

---

## Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW: Settings → Visual                      │
└─────────────────────────────────────────────────────────────────────────────┘

     WORDPRESS                    PAGE LOAD                    RUNTIME
     ─────────                    ─────────                    ───────

┌─────────────────┐
│ WordPress       │
│ Options API     │
│                 │
│ • cursor_enabled│
│ • default_style │
│ • default_color │
│ • blend_mode    │
│ • effect        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ frontend.php    │
│                 │
│ should_enable() │───▶ Returns false? ───▶ EXIT (no cursor)
│                 │
└────────┬────────┘
         │ Returns true
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ Body Classes    │       │                                          │
│                 │       │  <body class="cmsm-cursor-enabled        │
│ add_cursor_     │──────▶│               cmsm-cursor-theme-classic  │
│ body_class()    │       │               cmsm-cursor-blend-medium   │
│                 │       │               cmsm-cursor-wobble">       │
└─────────────────┘       └──────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ Inline CSS      │       │  <style>                                 │
│                 │       │    :root {                               │
│ print_custom_   │──────▶│      --cmsm-cursor-color: #ff0000;       │
│ cursor_html()   │       │      --cmsm-cursor-dot-size: 8px;        │
│                 │       │    }                                     │
└─────────────────┘       │  </style>                                │
         │                └──────────────────────────────────────────┘
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ HTML Structure  │       │  <div id="cmsm-cursor-container">        │
│                 │       │    <div class="cmsm-cursor">             │
│ print_custom_   │──────▶│      <div class="cmsm-cursor-dot"></div> │
│ cursor_html()   │       │      <div class="cmsm-cursor-ring"></div>│
│                 │       │    </div>                                │
└─────────────────┘       │  </div>                                  │
         │                └──────────────────────────────────────────┘
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ Critical JS     │       │  <script>                                │
│                 │       │    // Instant cursor follow              │
│ print_cursor_   │──────▶│    document.onmousemove = function(e) {  │
│ critical_js()   │       │      cursor.style.transform = ...        │
│                 │       │    }                                     │
└─────────────────┘       │  </script>                               │
         │                └──────────────────────────────────────────┘
         ▼
┌─────────────────┐
│ Main JS Load    │
│                 │
│ custom-cursor.js│
│ (deferred)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ initCursor()    │       │  • Cache DOM elements                    │
│                 │──────▶│  • Set up event listeners                │
│ DOMContentLoaded│       │  • Start render loop                     │
└────────┬────────┘       └──────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RUNTIME LOOP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Mouse Event ──▶ detectCursorMode() ──▶ Body Class Toggle                 │
│        │                                        │                           │
│        ▼                                        ▼                           │
│   mx/my update            ┌─────────────────────────────────────┐          │
│        │                  │ cmsm-cursor-hover                   │          │
│        ▼                  │ cmsm-cursor-down                    │          │
│   render() [RAF]          │ cmsm-cursor-text                    │          │
│        │                  │ cmsm-cursor-hidden                  │          │
│        ▼                  │ cmsm-cursor-on-light/dark           │          │
│   Lerp Position           └─────────────────────────────────────┘          │
│        │                                        │                           │
│        ▼                                        ▼                           │
│   Apply Transform ◀────────────────────── CSS Transitions                  │
│        │                                                                    │
│        ▼                                                                    │
│   VISUAL OUTPUT                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Element Attribute Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ELEMENT ATTRIBUTE INHERITANCE                           │
└─────────────────────────────────────────────────────────────────────────────┘

     ELEMENTOR EDITOR                              FRONTEND
     ────────────────                              ────────

┌─────────────────┐
│ Widget Settings │
│                 │
│ Cursor Tab:     │
│ • Hover Style   │
│ • Color         │
│ • Blend Mode    │
│ • Effect        │
│ • Image/Text/   │
│   Icon settings │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ module.php      │       │  <div class="elementor-widget"           │
│                 │       │       data-cursor="hover"                │
│ apply_cursor_   │──────▶│       data-cursor-color="#ff0000"        │
│ attributes()    │       │       data-cursor-blend="medium"         │
│                 │       │       data-cursor-effect="wobble"        │
└─────────────────┘       │       data-cursor-image="url.png">       │
                          └──────────────────────────────────────────┘
                                            │
                                            ▼
                          ┌──────────────────────────────────────────┐
                          │        INHERITANCE CHAIN                 │
                          │                                          │
                          │  ┌────────────────────────────────────┐  │
                          │  │ GRANDPARENT: data-cursor="hover"   │  │
                          │  │              data-cursor-color     │  │
                          │  └────────────────┬───────────────────┘  │
                          │                   │                      │
                          │  ┌────────────────▼───────────────────┐  │
                          │  │ PARENT: data-cursor-color="#blue"  │  │
                          │  │         (overrides grandparent)    │  │
                          │  └────────────────┬───────────────────┘  │
                          │                   │                      │
                          │  ┌────────────────▼───────────────────┐  │
                          │  │ CHILD: inherits from PARENT        │  │
                          │  │        (closest ancestor wins)     │  │
                          │  └────────────────────────────────────┘  │
                          │                                          │
                          │  findWithBoundary() walks DOM upward,    │
                          │  stops at widget boundary (data-id)      │
                          │                                          │
                          └──────────────────────────────────────────┘
```

---

## Cursor Types & States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURSOR TYPE HIERARCHY                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   CURSOR    │
                              │   SYSTEM    │
                              └──────┬──────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
       │    CORE     │        │   SPECIAL   │        │    STATE    │
       │   CURSOR    │        │   CURSOR    │        │   CLASSES   │
       └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
              │                      │                      │
     ┌────────┼────────┐    ┌────────┼────────┐    ┌────────┼────────┐
     │        │        │    │        │        │    │        │        │
     ▼        ▼        ▼    ▼        ▼        ▼    ▼        ▼        ▼
  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
  │ dot │ │ring │ │dual │ │image│ │text │ │icon │ │hover│ │down │ │hide │
  │     │ │+dot │ │     │ │     │ │     │ │     │ │     │ │     │ │     │
  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘

  THEMES:               MANAGED BY:                   TOGGLED BY:
  • theme-dot           • SpecialCursorManager        • mouseover/mouseout
  • theme-classic         (v5.6 - lifecycle coord)    • mousedown/mouseup
                        • createImageCursor()         • forms/video detect
                        • createTextCursor()
                        • createIconCursor()
```

---

## File Structure

```
custom-cursor/
│
├── version-5.5/                          # Current version
│   │
│   ├── assets/
│   │   └── lib/
│   │       └── custom-cursor/
│   │           ├── custom-cursor.js      # Main cursor engine (2026 lines)
│   │           ├── custom-cursor.min.js  # Minified version
│   │           └── custom-cursor.css     # Frontend styles (341 lines)
│   │
│   ├── inc/
│   │   ├── frontend.php                  # Frontend initialization (2131 lines)
│   │   ├── editor.php                    # Editor scripts (364 lines)
│   │   ├── module.php                    # Elementor controls (1189 lines)
│   │   └── settings-page.php             # Admin settings (1071 lines)
│   │
│   └── editor/
│       ├── cursor-editor-sync.js         # Preview sync (679 lines)
│       ├── navigator-indicator.js        # Navigator icons (1295 lines)
│       └── editor-navigator.css          # Editor styles (200 lines)
│
└── DOCS/                                 # Documentation
    ├── INDEX.md                          # Navigation hub
    ├── ARCHITECTURE.md                   # This file
    ├── api/                              # API documentation
    ├── maps/                             # Dependency/flow maps
    ├── reference/                        # Quick reference guides
    ├── current/                          # Current version docs
    ├── changelogs/                       # Version history
    ├── code-reviews/                     # Security audits
    ├── investigations/                   # Bug investigations
    └── legacy/                           # Older documentation
```

---

## Key Concepts

### 1. Lerp (Linear Interpolation)

The cursor position uses lerp for smooth movement:

```
newPosition = currentPosition + (targetPosition - currentPosition) * lerpFactor

Where:
  • targetPosition = actual mouse position (mx, my)
  • currentPosition = cursor element position (cx, cy)
  • lerpFactor = 0.15 (adjustable smoothness)
```

### 2. Widget Boundary

Inheritance stops at widget boundaries to prevent settings from leaking:

```javascript
// findWithBoundary() stops when it hits data-id attribute
while (current && current !== document.body) {
    if (current.getAttribute(attrName)) return current;
    if (current.getAttribute('data-id')) break;  // Widget boundary
    current = current.parentElement;
}
```

### 3. postMessage Protocol

Editor ↔ Preview communication uses structured messages:

```javascript
// Editor → Preview
{ type: 'cursor:init', elements: [...] }
{ type: 'cursor:update', elementId: '123', settings: {...} }

// Preview → Editor
{ type: 'cursor:request-init' }
```

### 4. RAF Loop

The render loop runs at 60fps using requestAnimationFrame:

```javascript
function render() {
    // 1. Update cursor position (lerp)
    cx += (mx - cx) * LERP;
    cy += (my - cy) * LERP;

    // 2. Calculate effects (wobble, pulse, etc.)
    // 3. Apply transforms
    // 4. Request next frame
    requestAnimationFrame(render);
}
```

### 5. SpecialCursorManager (v5.6)

Coordinates special cursor lifecycle to prevent DOM element accumulation:

```javascript
// Only one special cursor type can be active at a time
SpecialCursorManager.activate('image', function() {
    createImageCursor(src);
});
// Previous text/icon cursors are automatically cleaned up

// When leaving special cursor zone:
SpecialCursorManager.deactivate();
// Removes current special cursor, restores default dot/ring
```

**Key Benefit:** Prevents MEM-004 (DOM accumulation from rapid hover changes between different special cursor types).

### 6. Pure Effect Functions (v5.6 Phase 4)

Effect calculations are extracted into pure functions for maintainability and testability:

```javascript
// Pure functions - no side effects, deterministic
calcPulseScale(time, amplitude)     // → scale multiplier
calcShakeOffset(time, amplitude)    // → X pixel offset
calcBuzzRotation(time, amplitude)   // → rotation degrees
calcWobbleMatrix(wState, dx, dy)    // → CSS matrix string
resolveEffect(cursorEffect, global) // → effective effect name
```

**Usage in render():**

```javascript
var effect = resolveEffect(cursorEffect, globalWobble);
switch (effect) {
    case 'pulse':  scale = calcPulseScale(pulseTime, PULSE_AMPLITUDE); break;
    case 'shake':  offset = calcShakeOffset(shakeTime, SHAKE_AMPLITUDE); break;
    case 'buzz':   rotate = calcBuzzRotation(buzzTime, BUZZ_AMPLITUDE); break;
    case 'wobble': matrix = calcWobbleMatrix(wState, dx, dy); break;
}
```

**Key Benefits:**
- Eliminates ~350 lines of duplicated effect code across 4 cursor types
- State objects use in-place mutation for 60fps performance (no GC pressure)
- Easy to unit test each effect calculation independently
- Wobble state reset on cursor type change prevents stale deformation

---

## Quick Reference

| Component | File | Purpose |
|-----------|------|---------|
| Cursor Engine | custom-cursor.js | Position, detection, effects |
| Styles | custom-cursor.css | Visual appearance |
| Settings | frontend.php | WordPress options, body classes |
| Controls | module.php | Elementor widget controls |
| Admin UI | settings-page.php | Admin settings page |
| Editor Preview | cursor-editor-sync.js | Live preview sync |
| Navigator | navigator-indicator.js | Navigator cursor indicators |

---

## See Also

- [FILES.md](reference/FILES.md) - Detailed file descriptions
- [JAVASCRIPT-API.md](api/JAVASCRIPT-API.md) - All JS functions
- [PHP-API.md](api/PHP-API.md) - All PHP functions
- [DATA-FLOW.md](maps/DATA-FLOW.md) - Complete data pipeline
- [EDITOR-SYNC.md](maps/EDITOR-SYNC.md) - Editor communication

---

*Last Updated: February 6, 2026 | Version: 5.6*
