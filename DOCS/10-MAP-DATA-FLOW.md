# Custom Cursor v5.5 - Data Flow

**Last Updated:** February 5, 2026

---

## Overview

This document traces how cursor settings flow from WordPress options to visual output on screen.

---

## Complete Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SETTINGS → OUTPUT PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────────┘

 STEP 1: WordPress Options (Database)
 ─────────────────────────────────────

 wp_options table:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ option_name                              │ option_value                    │
 ├────────────────────────────────────────────────────────────────────────────┤
 │ elementor_custom_cursor_enabled          │ yes                             │
 │ elementor_custom_cursor_default_style    │ classic                         │
 │ elementor_custom_cursor_default_color    │ #000000                         │
 │ elementor_custom_cursor_blend            │ medium                          │
 │ elementor_custom_cursor_effect           │ wobble                          │
 │ elementor_custom_cursor_adaptive         │ yes                             │
 │ elementor_custom_cursor_dot_size         │ 8                               │
 │ elementor_custom_cursor_ring_size        │ 32                              │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ get_option()
                                    ▼

 STEP 2: PHP Processing (frontend.php)
 ──────────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ should_enable_custom_cursor()                                             │
 │                                                                            │
 │ Checks:                                                                    │
 │ • Is option enabled?                                                       │
 │ • Is admin page? (skip)                                                   │
 │ • Is preview mode?                                                        │
 │ • Is mobile device? (skip)                                                │
 │                                                                            │
 │ Returns: true/false                                                       │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ If true
                                    ▼

 STEP 3: Body Classes (body_class filter)
 ─────────────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <body class="                                                             │
 │     cmsm-cursor-enabled              ← Always when enabled                │
 │     cmsm-cursor-theme-classic        ← From default_style option          │
 │     cmsm-cursor-blend-medium         ← From blend option                  │
 │     cmsm-cursor-wobble               ← From effect option                 │
 │     cmsm-cursor-dual                 ← If theme is classic                │
 │ ">                                                                        │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 4: Inline CSS Variables (wp_footer)
 ─────────────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <style>                                                                   │
 │     :root {                                                               │
 │         --cmsm-cursor-color: #000000;                                     │
 │         --cmsm-cursor-color-light: #ffffff;                               │
 │         --cmsm-cursor-color-dark: #000000;                                │
 │         --cmsm-cursor-dot-size: 8px;                                      │
 │         --cmsm-cursor-dot-hover-size: 12px;                               │
 │         --cmsm-cursor-ring-size: 32px;                                    │
 │         --cmsm-cursor-ring-hover-size: 48px;                              │
 │     }                                                                     │
 │ </style>                                                                  │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 5: HTML Structure (wp_footer)
 ──────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <div id="cmsm-cursor-container">                                          │
 │     <div class="cmsm-cursor">                                             │
 │         <div class="cmsm-cursor-dot"></div>                               │
 │         <div class="cmsm-cursor-ring"></div>                              │
 │     </div>                                                                │
 │ </div>                                                                    │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 6: Critical Inline JS (wp_footer priority 5)
 ──────────────────────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <script>                                                                  │
 │ (function() {                                                             │
 │     var c = document.getElementById('cmsm-cursor-container');             │
 │     if (!c) return;                                                       │
 │     document.onmousemove = function(e) {                                  │
 │         c.style.transform = 'translate(' + e.clientX + 'px, '             │
 │                           + e.clientY + 'px)';                            │
 │     };                                                                    │
 │ })();                                                                     │
 │ </script>                                                                 │
 │                                                                            │
 │ Purpose: Instant cursor following before main JS loads                    │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 7: Main JS Load (deferred)
 ───────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <script src="custom-cursor.js" defer></script>                            │
 │                                                                            │
 │ On DOMContentLoaded:                                                      │
 │ └─▶ initCursor()                                                          │
 │     ├─ Cache DOM elements                                                 │
 │     ├─ Set up event listeners                                             │
 │     └─ Start RAF loop                                                     │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 8: Runtime Loop
 ────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │   Mouse Event ──┬──▶ Update mx/my target position                         │
 │                 │                                                          │
 │                 └──▶ detectCursorMode(element)                            │
 │                      │                                                     │
 │                      ├─▶ Check data-cursor-* attributes                   │
 │                      │                                                     │
 │                      ├─▶ Apply color/blend/effect                         │
 │                      │                                                     │
 │                      └─▶ Create special cursor if needed                  │
 │                                                                            │
 │   RAF Loop ─────────▶ render()                                            │
 │                       │                                                    │
 │                       ├─▶ Lerp: cx += (mx - cx) * 0.15                    │
 │                       │                                                    │
 │                       ├─▶ Calculate effects (wobble matrix)               │
 │                       │                                                    │
 │                       └─▶ Apply transform to container                    │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 9: Visual Output
 ─────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │    #cmsm-cursor-container {                                               │
 │        transform: translate(X, Y);  ← From RAF loop                       │
 │    }                                                                       │
 │                                                                            │
 │    .cmsm-cursor {                                                         │
 │        transform: matrix(...);      ← Wobble effect                       │
 │    }                                                                       │
 │                                                                            │
 │    .cmsm-cursor-dot {                                                     │
 │        width/height: from CSS var   ← Size from options                   │
 │        background: from CSS var     ← Color from options                  │
 │        transition: from CSS         ← Smooth state changes                │
 │    }                                                                       │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## Widget Settings Flow

```
 STEP 1: Elementor Editor (Widget Settings)
 ──────────────────────────────────────────

 User edits widget:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ Advanced Tab > Custom Cursor                                              │
 │                                                                            │
 │ ┌──────────────────────────────────────────────────────────────────────┐  │
 │ │ Hover Style:     [ Hover ▼ ]                                        │  │
 │ │ Color:           [ #ff0000 ]                                        │  │
 │ │ Blend Mode:      [ Medium ▼ ]                                       │  │
 │ │ Effect:          [ Wobble ▼ ]                                       │  │
 │ │ Cursor Type:     [ Image ▼ ]                                        │  │
 │ │                                                                      │  │
 │ │ Image URL:       [ https://... ]                                    │  │
 │ │ Size:            [ 64 ]                                             │  │
 │ │ Hover Size:      [ 80 ]                                             │  │
 │ └──────────────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Settings saved to element model
                                    ▼

 STEP 2: PHP Rendering (module.php)
 ──────────────────────────────────

 elementor/frontend/before_render hook:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ apply_cursor_attributes($element)                                         │
 │                                                                            │
 │ $settings = $element->get_settings();                                     │
 │                                                                            │
 │ // Core attributes                                                        │
 │ $element->add_render_attribute('_wrapper', [                              │
 │     'data-cursor' => $settings['cmsmasters_cursor_hover_style'],          │
 │     'data-cursor-color' => resolve_global_color($settings['..._color']),  │
 │     'data-cursor-blend' => $settings['cmsmasters_cursor_blend'],          │
 │     'data-cursor-effect' => $settings['cmsmasters_cursor_effect'],        │
 │ ]);                                                                       │
 │                                                                            │
 │ // Image attributes (if type is image)                                    │
 │ $element->add_render_attribute('_wrapper', [                              │
 │     'data-cursor-image' => $settings['cmsmasters_cursor_image']['url'],   │
 │     'data-cursor-image-size' => $settings['cmsmasters_cursor_image_size'],│
 │     'data-cursor-image-size-hover' => $settings['..._size_hover'],        │
 │ ]);                                                                       │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 3: HTML Output
 ───────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │ <div class="elementor-widget elementor-widget-button"                     │
 │      data-id="abc123"                                                     │
 │      data-cursor="hover"                                                  │
 │      data-cursor-color="#ff0000"                                          │
 │      data-cursor-blend="medium"                                           │
 │      data-cursor-effect="wobble"                                          │
 │      data-cursor-image="https://example.com/arrow.png"                    │
 │      data-cursor-image-size="64"                                          │
 │      data-cursor-image-size-hover="80">                                   │
 │                                                                            │
 │     <button>Click Me</button>                                             │
 │                                                                            │
 │ </div>                                                                    │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 4: JS Detection (custom-cursor.js)
 ───────────────────────────────────────

 On mouseover widget:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ detectCursorMode(widgetElement)                                           │
 │                                                                            │
 │ // Read attributes                                                        │
 │ var cursor = el.getAttribute('data-cursor');         // "hover"           │
 │ var color = el.getAttribute('data-cursor-color');    // "#ff0000"         │
 │ var image = el.getAttribute('data-cursor-image');    // "https://..."     │
 │ var size = el.getAttribute('data-cursor-image-size');// "64"              │
 │                                                                            │
 │ // Apply color                                                            │
 │ cursor.style.setProperty('--cmsm-cursor-color', color);                   │
 │                                                                            │
 │ // Create image cursor                                                    │
 │ createImageCursor({                                                       │
 │     url: image,                                                           │
 │     size: parseInt(size),                                                 │
 │     sizeHover: parseInt(sizeHover)                                        │
 │ });                                                                       │
 │                                                                            │
 │ // Add body class                                                         │
 │ body.classList.add('cmsm-cursor-hover');                                  │
 │ body.classList.add('cmsm-cursor-image');                                  │
 └────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼

 STEP 5: Visual Update
 ─────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │ • Default cursor hidden (.cmsm-cursor-dot, .cmsm-cursor-ring)             │
 │ • Image cursor displayed (.cmsm-cursor-image-el)                          │
 │ • Image size: 64px                                                        │
 │ • Wobble effect applied via matrix transform                              │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## Inheritance Resolution Flow

```
 Mouse Position over CHILD element
 ─────────────────────────────────

 DOM Structure:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ GRANDPARENT (data-cursor="hover", data-cursor-color="#red")               │
 │ ┌──────────────────────────────────────────────────────────────────────┐  │
 │ │ PARENT (data-id="widget1", data-cursor-color="#blue")               │  │
 │ │ ┌────────────────────────────────────────────────────────────────┐  │  │
 │ │ │ CHILD (no cursor attributes)                                  │  │  │
 │ │ │                                                                │  │  │
 │ │ │      ← Mouse is here                                          │  │  │
 │ │ │                                                                │  │  │
 │ │ └────────────────────────────────────────────────────────────────┘  │  │
 │ └──────────────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────────┘

 findWithBoundary(child, 'data-cursor-color'):
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │ Step 1: Check CHILD                                                       │
 │         → No data-cursor-color                                            │
 │         → Continue                                                        │
 │                                                                            │
 │ Step 2: Check PARENT                                                      │
 │         → Has data-cursor-color="#blue"                                   │
 │         → STOP and return "#blue"                                         │
 │                                                                            │
 │ (GRANDPARENT is never checked because PARENT had the attribute)           │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘

 findWithBoundary(child, 'data-cursor'):
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │ Step 1: Check CHILD                                                       │
 │         → No data-cursor                                                  │
 │         → Continue                                                        │
 │                                                                            │
 │ Step 2: Check PARENT                                                      │
 │         → Has data-id="widget1" (widget boundary!)                        │
 │         → No data-cursor attribute                                        │
 │         → STOP at boundary, return null                                   │
 │                                                                            │
 │ (GRANDPARENT is never checked due to widget boundary)                     │
 │                                                                            │
 │ Result: CHILD uses DEFAULT cursor style (not grandparent's "hover")       │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## Blend Mode Data Flow (v5.6 - February 2026)

### Priority Chain

**Fix:** Page blend mode no longer leaks into widget cursors. Widgets use true WP Admin global, default cursor uses page > global.

```
Widget Cursor Blend Priority:
1. Widget explicit blend (soft/medium/strong/off) → use it
2. Widget "Default (Global)" / no data-cursor-blend → trueGlobalBlend (WP Admin only)
3. (Widget fallback never reaches page blend)

Default Cursor Blend Priority (on body, not hovering widget):
1. Page blend override → globalBlendIntensity
2. WP Admin global → globalBlendIntensity
```

### Data Sources

| Variable | Source | Used For |
|----------|--------|----------|
| `trueGlobalBlend` | `window.cmsmCursorTrueGlobalBlend` from PHP `get_option('elementor_custom_cursor_blend_mode')` | Widget fallback "Default (Global)" |
| `globalBlendIntensity` | Body classes (page > global merge) + `cmsmasters:cursor:page-blend-update` event | Default cursor on body |

### Widget Fallback Walk-Up

When widget has no `data-cursor-blend` attribute, inner content detection walks up:

```javascript
// Walk up from inner content to widget floor
var stoppedAtWidget = false;
while (current && current !== document.body) {
    if (current.hasAttribute('data-cursor-blend')) return current.getAttribute('data-cursor-blend');
    if (current.hasAttribute('data-id')) {
        stoppedAtWidget = true;
        break;  // Hit widget boundary
    }
    current = current.parentElement;
}

// Fallback logic
if (stoppedAtWidget) {
    // Dirty widget floor (inner content, no blend on widget) → use true global
    return trueGlobalBlend;
} else {
    // Clean walk to body → use page > global for default cursor
    return globalBlendIntensity;
}
```

**Why:** Inner content (like buttons inside sections) should inherit widget blend if set, else use global. Default cursor on body should use page override.

---

## Adaptive Mode Data Flow

```
 Mouse moves over different backgrounds
 ──────────────────────────────────────

 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │  ┌─────────────────────┐      ┌─────────────────────┐                     │
 │  │  LIGHT BACKGROUND   │      │   DARK BACKGROUND   │                     │
 │  │  (white, #f0f0f0)   │      │   (black, #1a1a1a)  │                     │
 │  │                     │      │                     │                     │
 │  │     ● (cursor)      │      │      ○ (cursor)     │                     │
 │  │                     │      │                     │                     │
 │  └─────────────────────┘      └─────────────────────┘                     │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼

 detectCursorMode():
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │ // Get background color at cursor position                                │
 │ var bgColor = getComputedStyle(element).backgroundColor;                  │
 │                                                                            │
 │ // Calculate luminance                                                    │
 │ var luminance = getLuminance(bgColor);                                    │
 │                                                                            │
 │ // Determine mode                                                         │
 │ if (luminance > 0.5) {                                                    │
 │     // Light background → use dark cursor                                 │
 │     applyMode('on-light');                                                │
 │ } else {                                                                  │
 │     // Dark background → use light cursor                                 │
 │     applyMode('on-dark');                                                 │
 │ }                                                                         │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼

 Body class toggle:
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │ Light background:                      Dark background:                   │
 │ ┌────────────────────────┐            ┌────────────────────────┐          │
 │ │ body.cmsm-cursor-on-   │            │ body.cmsm-cursor-on-   │          │
 │ │      light             │            │      dark              │          │
 │ │                        │            │                        │          │
 │ │ .cmsm-cursor-dot {     │            │ .cmsm-cursor-dot {     │          │
 │ │   background:          │            │   background:          │          │
 │ │   var(--cmsm-cursor-   │            │   var(--cmsm-cursor-   │          │
 │ │       color-dark);     │            │       color-light);    │          │
 │ │ }                      │            │ }                      │          │
 │ └────────────────────────┘            └────────────────────────┘          │
 │                                                                            │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## See Also

- [DEPENDENCY-MAP.md](DEPENDENCY-MAP.md) - Function dependencies
- [EDITOR-SYNC.md](EDITOR-SYNC.md) - Editor communication
- [SETTINGS.md](../reference/SETTINGS.md) - WordPress options

---

*Last Updated: February 5, 2026 | Version: 5.5*
