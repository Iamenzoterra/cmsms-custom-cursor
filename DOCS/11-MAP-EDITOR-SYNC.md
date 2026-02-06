# Custom Cursor v5.5 - Editor Sync Protocol

**Last Updated:** February 5, 2026

---

## Overview

The editor sync system enables real-time cursor preview in Elementor editor. It uses postMessage for cross-frame communication between the editor and preview iframe.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ELEMENTOR EDITOR ENVIRONMENT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────┐    ┌───────────────────────────────┐    │
│  │        EDITOR FRAME           │    │       PREVIEW IFRAME          │    │
│  │                               │    │                               │    │
│  │  ┌─────────────────────────┐  │    │  ┌─────────────────────────┐  │    │
│  │  │ navigator-indicator.js  │  │    │  │ cursor-editor-sync.js   │  │    │
│  │  │                         │  │    │  │                         │  │    │
│  │  │ • Watch settings model  │  │    │  │ • Toggle panel          │  │    │
│  │  │ • Update Navigator      │  │    │  │ • Apply attributes      │  │    │
│  │  │ • Broadcast changes     │──────────▶ • Live preview          │  │    │
│  │  │                         │  │ PM │  │                         │  │    │
│  │  │                         │◀──────────│ • Request init          │  │    │
│  │  └─────────────────────────┘  │    │  └─────────────────────────┘  │    │
│  │                               │    │                               │    │
│  │  ┌─────────────────────────┐  │    │  ┌─────────────────────────┐  │    │
│  │  │ Elementor Settings      │  │    │  │ custom-cursor.js        │  │    │
│  │  │ Model                   │  │    │  │                         │  │    │
│  │  │                         │  │    │  │ • Cursor engine         │  │    │
│  │  │ • Widget settings       │  │    │  │ • Effect rendering      │  │    │
│  │  │ • Change events         │  │    │  │                         │  │    │
│  │  └─────────────────────────┘  │    │  └─────────────────────────┘  │    │
│  │                               │    │                               │    │
│  └───────────────────────────────┘    └───────────────────────────────┘    │
│                                                                             │
│                           PM = postMessage                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Message Protocol

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `cmsmasters:cursor:init` | Editor → Preview | Send all cursor settings |
| `cmsmasters:cursor:update` | Editor → Preview | Send single element update |
| `cmsmasters:cursor:request-init` | Preview → Editor | Request settings resend |

---

### cmsmasters:cursor:init

**Direction:** Editor → Preview

**Triggered By:** Editor initialization, preview reload, typography cache ready

**Purpose:** Send all elements with cursor settings to preview

**Source:** `navigator-indicator.js` - `sendInitialCursorSettings()` and `sendInitialCursorSettingsWithRetry()`

**Payload:**
```javascript
{
    type: 'cmsmasters:cursor:init',
    elements: [
        {
            id: 'abc123',           // Elementor element ID
            settings: {
                // Core settings
                cmsmasters_cursor_hover_style: 'hover',
                cmsmasters_cursor_force_color: 'yes',
                cmsmasters_cursor_color: '#ff0000',
                cmsmasters_cursor_blend_mode: 'medium',
                cmsmasters_cursor_effect: 'wobble',

                // Special cursor settings (when cmsmasters_cursor_special_active === 'yes')
                cmsmasters_cursor_special_active: 'yes',
                cmsmasters_cursor_special_type: 'image', // 'image' | 'text' | 'icon'
                cmsmasters_cursor_special_blend: 'soft',

                // Image cursor
                cmsmasters_cursor_image: { url: 'https://...' },
                cmsmasters_cursor_size_normal: { size: 32, unit: 'px' },
                cmsmasters_cursor_size_hover: { size: 48, unit: 'px' },
                cmsmasters_cursor_rotate_normal: { size: 0, unit: 'deg' },
                cmsmasters_cursor_rotate_hover: { size: 0, unit: 'deg' },

                // Text cursor
                cmsmasters_cursor_text_content: 'View',
                cmsmasters_cursor_text_color: '#000000',
                cmsmasters_cursor_text_bg_color: '#ffffff',
                cmsmasters_cursor_text_typography_font_family: 'Roboto',
                cmsmasters_cursor_text_typography_font_size: { size: 14, unit: 'px' },
                cmsmasters_cursor_text_typography_font_weight: '500',
                cmsmasters_cursor_text_fit_circle: 'yes',
                cmsmasters_cursor_text_circle_spacing: { size: 10, unit: 'px' },
                cmsmasters_cursor_text_border_radius: { top: 4, right: 4, bottom: 4, left: 4, unit: 'px' },
                cmsmasters_cursor_text_padding: { top: 8, right: 12, bottom: 8, left: 12, unit: 'px' },

                // Icon cursor
                cmsmasters_cursor_icon: { library: 'fa-solid', value: 'fas fa-arrow-right' },
                cmsmasters_cursor_icon_color: '#000000',
                cmsmasters_cursor_icon_bg_color: '#ffffff',
                cmsmasters_cursor_icon_preserve_colors: 'yes',
                cmsmasters_cursor_icon_size_normal: { size: 32, unit: 'px' },
                cmsmasters_cursor_icon_size_hover: { size: 48, unit: 'px' },
                cmsmasters_cursor_icon_fit_circle: 'yes',

                // Hide cursor
                cmsmasters_cursor_hide: 'yes',

                // Global references (resolved before sending)
                __globals__: {
                    cmsmasters_cursor_color: 'globals/colors?id=primary',
                    cmsmasters_cursor_text_typography_typography: 'globals/typography?id=primary'
                }
            }
        },
        // ... more elements
    ]
}
```

**Handler (cursor-editor-sync.js lines 269-279):**
```javascript
window.addEventListener('message', function(event) {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'cmsmasters:cursor:init') {
        var els = event.data.elements;
        if (els && Array.isArray(els)) {
            els.forEach(function(el) {
                if (el.id && el.settings) {
                    settingsCache[el.id] = el.settings;  // Cache for DOM re-sync
                    applySettings(el.id, el.settings);
                }
            });
        }
    }
});
```

---

### cmsmasters:cursor:update

**Direction:** Editor → Preview

**Triggered By:** User changes cursor settings in widget panel, $e.hooks 'document/elements/settings'

**Purpose:** Update single element's cursor settings in real-time

**Source:** `navigator-indicator.js` - `broadcastCursorChange()` and `broadcastSingleElement()`

**Payload:**
```javascript
{
    type: 'cmsmasters:cursor:update',
    elementId: 'abc123',       // Elementor element ID
    settings: {
        // All cursor settings (same structure as cmsmasters:cursor:init)
        cmsmasters_cursor_hover_style: 'hover',
        cmsmasters_cursor_force_color: 'yes',
        cmsmasters_cursor_color: '#0000ff',  // Changed value
        // ... all other cursor settings
    }
}
```

**Handler (cursor-editor-sync.js lines 262-268):**
```javascript
window.addEventListener('message', function(event) {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'cmsmasters:cursor:update') {
        var id = event.data.elementId, s = event.data.settings;
        if (id && s) {
            settingsCache[id] = s;  // Cache for DOM re-sync
            applySettings(id, s);
        }
    }
});
```

**Note:** When a parent element re-renders, `broadcastChildrenCursorSettings()` is also called to re-send cursor settings for all children (P2 fix for DOM re-render issue).

---

### cmsmasters:cursor:request-init

**Direction:** Preview → Editor

**Triggered By:** Preview iframe load (500ms after DOMContentLoaded)

**Purpose:** Request full settings resend from editor

**Source:** `cursor-editor-sync.js` - `requestInit()`

**Payload:**
```javascript
{
    type: 'cmsmasters:cursor:request-init'
}
```

**Handler (navigator-indicator.js lines 986-993):**
```javascript
function initPreviewMessageListener() {
    window.addEventListener('message', function(event) {
        if (!event.data || event.data.type !== 'cmsmasters:cursor:request-init') return;

        // Preview is requesting initial cursor settings
        sendInitialCursorSettings();
    });
}
```

---

## Communication Flow

### Initialization Sequence

```
┌─────────────────┐                              ┌─────────────────┐
│  EDITOR FRAME   │                              │  PREVIEW IFRAME │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  1. Elementor preview:loaded event             │
         │  2. Load typography cache ($e.data.get)        │
         │                                                │
         ├─────────────────────────────────────────────────▶
         │          [iframe loads]                        │
         │                                                │
         │                                                │ 3. init() creates panel
         │◀─────────────────────────────────────────────────
         │          cmsmasters:cursor:request-init        │
         │          (500ms after DOMContentLoaded)        │
         │                                                │
         │  4. sendInitialCursorSettings()                │
         │     - Traverse all containers                  │
         │     - Resolve global colors/typography         │
         │                                                │
         ├─────────────────────────────────────────────────▶
         │          cmsmasters:cursor:init                │
         │          { elements: [...] }                   │
         │                                                │
         │                                                │ 5. Start preloader
         │                                                │ 6. Cache settings
         │                                                │ 7. Apply to DOM
         │                                                │
         ▼                                                ▼
```

---

### Settings Change Sequence

```
┌─────────────────┐                              ┌─────────────────┐
│  EDITOR FRAME   │                              │  PREVIEW IFRAME │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  1. User changes widget setting                │
         │     (color: #ff0000 → #0000ff)                │
         │                                                │
         │  2. Multiple listeners catch change:           │
         │     - settings.on('change')                    │
         │     - elementor.channels.editor 'change'       │
         │     - $e.hooks 'document/elements/settings'    │
         │                                                │
         │  3. onSettingsModelChange() called             │
         │     - Resolve global colors/typography         │
         │     - Update Navigator indicator               │
         │     - broadcastCursorChange() (200ms throttle) │
         │                                                │
         ├─────────────────────────────────────────────────▶
         │          cmsmasters:cursor:update              │
         │          { elementId, settings }               │
         │                                                │
         │  4. Also broadcast children settings           │
         │     (P2 fix for DOM re-render)                 │
         │                                                │
         │                                                │ 5. settingsCache[id] = s
         │                                                │ 6. applySettings(id, s)
         │          [Cursor updates instantly]            │
         │                                                │
         ▼                                                ▼
```

---

### Preview Reload Sequence

```
┌─────────────────┐                              ┌─────────────────┐
│  EDITOR FRAME   │                              │  PREVIEW IFRAME │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │                                     [iframe reloads]
         │                                                │
         │                                                │ init() called
         │◀─────────────────────────────────────────────────
         │          cmsmasters:cursor:request-init        │
         │          (500ms delay)                         │
         │                                                │
         │  sendInitialCursorSettings()                   │
         │  - Traverse doc.container tree                 │
         │  - Filter elements with cmsmasters_cursor_*    │
         │  - Resolve global colors (resolveGlobalColors) │
         │  - Build elements array                        │
         │                                                │
         ├─────────────────────────────────────────────────▶
         │          cmsmasters:cursor:init                │
         │          { elements: [...] }                   │
         │                                                │
         │                                                │ Cache and apply all
         │                                                │
         ▼                                                ▼
```

---

## Navigator Indicator System

### Indicator Update Flow

```
Settings change detected (via channels.editor, $e.hooks, or model.on('change'))
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ updateNavigatorIndicators()                                                 │
│                                                                             │
│  0. Guard: if (isUpdatingIndicators) return;  // Prevent infinite loop      │
│     isUpdatingIndicators = true;                                            │
│                                                                             │
│  1. addLegend() - Ensure legend exists                                      │
│                                                                             │
│  2. cidToContainerCache = null; // Invalidate for fresh data                │
│                                                                             │
│  3. For each $('.elementor-navigator__element'):                            │
│     │                                                                       │
│     ├─▶ Remove existing .cmsm-nav-cursor-indicator                         │
│     │                                                                       │
│     ├─▶ getContainerFromNavElement(navEl)                                   │
│     │   ├─▶ Get CID from data-model-cid attribute                          │
│     │   ├─▶ buildContainerCache() if needed                                │
│     │   └─▶ Return container from cache or jQuery data fallback            │
│     │                                                                       │
│     ├─▶ settings = container.model.get('settings')                         │
│     │                                                                       │
│     ├─▶ cursorInfo = hasNonDefaultCursor(settings)                         │
│     │   └─▶ Returns { type: 'core'|'special'|'hidden'|'show', ... }        │
│     │                                                                       │
│     └─▶ If cursorInfo:                                                      │
│         │                                                                   │
│         ├─▶ Find .elementor-navigator__element__indicators container       │
│         │   (create if not exists)                                          │
│         │                                                                   │
│         ├─▶ tooltip = getTooltip(cursorInfo, settings)                     │
│         │   Examples:                                                       │
│         │   - "Special Cursor: Image"                                       │
│         │   - "Cursor Hidden"                                               │
│         │   - "Custom Cursor: Hover, Color, Blend: soft"                   │
│         │                                                                   │
│         └─▶ Append indicator with class + title attribute                  │
│             class="cmsm-nav-cursor-indicator cmsm-nav-cursor-{type}"       │
│                                                                             │
│  4. updateLegendVisibility(hasAnyIndicator)                                 │
│     └─▶ Toggle .cmsm-legend-visible class                                  │
│                                                                             │
│  5. isUpdatingIndicators = false;                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Indicator Types

Based on `hasNonDefaultCursor()` function in navigator-indicator.js:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAVIGATOR INDICATORS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Type: 'core' - Core cursor settings changed                                │
│  ┌─────────┐                                                               │
│  │ Section │ [●] ←── cmsm-nav-cursor-core                                  │
│  └─────────┘     Triggers: hover_style, force_color, blend_mode, effect    │
│       │                                                                     │
│  Type: 'special' - Special cursor active                                    │
│       ├── ┌─────────┐                                                       │
│       │   │ Column  │ [◆] ←── cmsm-nav-cursor-special                      │
│       │   └─────────┘     Triggers: cmsmasters_cursor_special_active='yes' │
│       │                   Subtypes: 'image', 'text', 'icon'                │
│       │                                                                     │
│  Type: 'hidden' - Cursor hidden on element                                  │
│       └── ┌─────────┐                                                       │
│           │ Button  │ [○] ←── cmsm-nav-cursor-hidden                       │
│           └─────────┘     Triggers: cmsmasters_cursor_hide='yes'           │
│                                     (when cursor addon is ENABLED)         │
│                                                                             │
│  Type: 'show' - Show cursor override (when addon disabled globally)         │
│           ┌─────────┐                                                       │
│           │ Heading │ [◐] ←── cmsm-nav-cursor-show                         │
│           └─────────┘     Triggers: cmsmasters_cursor_hide='yes'           │
│                                     (when cursor addon is DISABLED)        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LEGEND (visible when indicators exist):                               │ │
│  │ .cmsm-nav-cursor-legend-wrapper                                       │ │
│  │                                                                       │ │
│  │ [●] Core    [◆] Special    [○] Hidden                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Indicator Priority Order:**
1. Special (highest) - `cmsmasters_cursor_special_active === 'yes'`
2. Hidden - `cmsmasters_cursor_hide === 'yes'` (when addon enabled)
3. Core - Any of: `hover_style`, `force_color`, `blend_mode`, `effect`

**CSS Classes:**
- `.cmsm-nav-cursor-indicator` - Base class
- `.cmsm-nav-cursor-core` - Core settings indicator
- `.cmsm-nav-cursor-special` - Special cursor indicator
- `.cmsm-nav-cursor-hidden` - Hidden cursor indicator
- `.cmsm-nav-cursor-show` - Show cursor override indicator

---

## Toggle Panel

### Panel Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PREVIEW IFRAME                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────┐                     │
│  │ TOGGLE PANEL (draggable)                          │                     │
│  │ ┌─────────────────────────────────────────────┐   │                     │
│  │ │  ◯ ──── Toggle Switch                       │   │                     │
│  │ │                                             │   │                     │
│  │ │  Custom Cursor: ON                          │   │                     │
│  │ └─────────────────────────────────────────────┘   │                     │
│  └───────────────────────────────────────────────────┘                     │
│                                                                             │
│                   ┌─────────────────────────────┐                          │
│                   │      PAGE CONTENT           │                          │
│                   │                             │                          │
│                   │      [Widgets with          │                          │
│                   │       cursor preview]       │                          │
│                   │                             │                          │
│                   │            ●                │  ←── Custom cursor       │
│                   │                             │                          │
│                   └─────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Toggle States

```
Toggle ON (after preloader completes):
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  1. User clicks toggle switch                                              │
│                                                                            │
│  2. startLoading() - 2 second loading animation                            │
│     - panel.classList.add('is-loading')                                    │
│     - Show spinner on knob                                                 │
│                                                                            │
│  3. enableCursor()                                                         │
│     - cursorEnabled = true                                                 │
│     - body.classList.remove('cmsms-cursor-disabled')                       │
│     - Show cursor container                                                │
│                                                                            │
│  NOTE: Settings are already cached from cmsmasters:cursor:init             │
│        No additional request-init is sent on toggle                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Toggle OFF:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  1. disableCursor()                                                        │
│     - cursorEnabled = false                                                │
│     - body.classList.add('cmsms-cursor-disabled')                          │
│     - CSS hides all [class*="cmsm-cursor"] except panel                    │
│                                                                            │
│  2. System cursor restored via CSS:                                        │
│     body.cmsms-cursor-disabled { cursor: auto !important; }                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Keyboard Shortcut: Press 'C' key to toggle (when not in input/textarea)
```

---

## Settings Resolution

Global colors and typography are resolved in `navigator-indicator.js` before broadcasting to preview.

### Global Color Resolution

`resolveGlobalColor(globalRef)` - Resolves global color references to hex values

**Input:** `'globals/colors?id=primary'`
**Output:** `'#3366ff'`

**Resolution Priority:**
1. **LIVE** - `elementor.documents.get(kitId).container.model.get('settings')` - Real-time kit settings
2. **CACHE** - `$e.data.cache.storage.get('globals/colors')` - Elementor data cache
3. **STATIC** - `elementor.config.kit_config.global_colors` - Initial load values
4. **FALLBACK** - CSS variable from preview iframe: `--e-global-color-{id}`

```javascript
// navigator-indicator.js - resolveGlobalColor()
// Called for these settings in resolveGlobalColors():
// - cmsmasters_cursor_color
// - cmsmasters_cursor_icon_color
// - cmsmasters_cursor_icon_bg_color
// - cmsmasters_cursor_text_color
// - cmsmasters_cursor_text_bg_color
```

---

### Global Typography Resolution

`resolveGlobalTypography(globalRef)` - Resolves global typography references

**Input:** `'globals/typography?id=primary'`
**Output:**
```javascript
{
    _id: 'primary',
    typography_font_family: 'Roboto',
    typography_font_size: { size: 16, unit: 'px' },
    typography_font_weight: '400',
    typography_font_style: 'normal',
    typography_text_transform: 'none',
    typography_line_height: { size: 1.5, unit: 'em' },
    typography_letter_spacing: { size: 0, unit: 'px' },
    typography_text_decoration: 'none',
    typography_word_spacing: { size: 0, unit: 'px' }
}
```

**Resolution Priority:**
1. **CACHE (BEST)** - `typographyCache[typoId]` - Loaded via `$e.data.get('globals/typography')`
2. **LIVE** - `elementor.documents.get(kitId).container.model.get('settings').system_typography`
3. **STATIC** - `elementor.config.kit_config.global_typography`

**Important:** Typography cache is loaded on init via `loadTypographyCache()` which calls `$e.data.get('globals/typography')`. Initial cursor settings are only sent AFTER cache is ready.

```javascript
// navigator-indicator.js - resolveGlobalTypography()
// NOTE: Elementor stores global typography reference at key + '_typography'
// So for control 'cmsmasters_cursor_text_typography', the global key is:
// __globals__.cmsmasters_cursor_text_typography_typography
```

---

### resolveGlobalColors() Function

Wrapper function that resolves ALL global references in settings:

```javascript
// navigator-indicator.js
function resolveGlobalColors(settings) {
    if (!settings || !settings.__globals__) return settings;
    var resolved = Object.assign({}, settings);
    var globals = settings.__globals__;

    // Resolve colors
    ['cmsmasters_cursor_color', 'cmsmasters_cursor_icon_color',
     'cmsmasters_cursor_icon_bg_color', 'cmsmasters_cursor_text_color',
     'cmsmasters_cursor_text_bg_color'].forEach(function(key) {
        if (globals[key]) {
            var color = resolveGlobalColor(globals[key]);
            if (color) resolved[key] = color;
        }
    });

    // Resolve typography
    // Key pattern: controlName + '_typography' in __globals__
    var typoControls = ['cmsmasters_cursor_text_typography'];
    typoControls.forEach(function(controlName) {
        var globalKey = controlName + '_typography';
        if (globals[globalKey]) {
            var typo = resolveGlobalTypography(globals[globalKey]);
            if (typo) {
                // Apply ALL typography properties to settings
                resolved[controlName + '_font_family'] = typo.typography_font_family;
                resolved[controlName + '_font_size'] = typo.typography_font_size;
                resolved[controlName + '_font_weight'] = typo.typography_font_weight;
                // ... all other typography properties
            }
        }
    });

    return resolved;
}
```

---

## Error Handling

### Preview Not Ready (navigator-indicator.js)

```javascript
function sendInitialCursorSettingsWithRetry(retries, delay) {
    retries = retries || 5;
    delay = delay || 500;

    var previewIframe = document.getElementById('elementor-preview-iframe');
    if (!previewIframe || !previewIframe.contentWindow) {
        if (retries > 0) {
            setTimeout(function() {
                sendInitialCursorSettingsWithRetry(retries - 1, delay);
            }, delay);
        }
        return;
    }

    // Also retry if only 1 element found (document root = children not loaded)
    if (elements.length <= 1 && retries > 0) {
        setTimeout(function() {
            sendInitialCursorSettingsWithRetry(retries - 1, delay);
        }, delay);
        return;
    }

    // Send cmsmasters:cursor:init
    previewIframe.contentWindow.postMessage({
        type: 'cmsmasters:cursor:init',
        elements: elements
    }, '*');
}
```

---

### Element Not Found (cursor-editor-sync.js)

```javascript
function findElement(id) {
    // Try cache first (with isConnected check for stale references)
    if (elementCache[id] && elementCache[id].isConnected) return elementCache[id];

    // Query DOM
    var el = document.querySelector('[data-id="' + id + '"]');
    if (el) elementCache[id] = el;
    return el;
}
```

---

### DOM Re-render Recovery (P2 Fix)

When Elementor re-renders a parent element, children get new DOM nodes without cursor attributes:

```javascript
// cursor-editor-sync.js - MutationObserver
var syncObserver = new MutationObserver(function(mutations) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(syncMissingElements, 300);  // 300ms debounce
});

syncObserver.observe(document.body, { childList: true, subtree: true });

function syncMissingElements() {
    var elements = document.querySelectorAll('[data-id]');
    elements.forEach(function(el) {
        var id = el.getAttribute('data-id');
        // Re-apply if cached settings exist but DOM attributes missing
        if (settingsCache[id] && !hasCursorAttributes(el)) {
            applySettings(id, settingsCache[id]);
        }
    });
}
```

---

### Preloader Fallback (cursor-editor-sync.js)

If Elementor doesn't send any message within 2 seconds, start preloader anyway:

```javascript
// Fallback for empty pages where no cursor:update/init messages are sent
setTimeout(function() {
    if (!preloaderStarted) {
        preloaderStarted = true;
        startPreloader();
    }
}, 2000);
```

---

## Performance Considerations

### Constants (navigator-indicator.js)

```javascript
var CACHE_TTL_MS = 2000;              // Container cache expiry time
var DEBOUNCE_DELAY_MS = 300;          // Debounce delay for DOM mutations
var THROTTLE_DELAY_MS = 150;          // Throttle delay for settings changes
var INIT_DELAY_MS = 500;              // Delay for initial setup after preview:loaded
var NAV_TOGGLE_DELAY_MS = 200;        // Delay after Navigator panel toggle
var LEGEND_RETRY_ATTEMPTS = 5;        // Max retries for legend placement
var LEGEND_RETRY_DELAY_MS = 300;      // Delay between legend retries
var BROADCAST_THROTTLE_MS = 200;      // Throttle for broadcastCursorChange per element
```

---

### Throttling (navigator-indicator.js)

```javascript
// Broadcast throttle - per element, 200ms window
var lastBroadcastElementId = null;
var lastBroadcastTime = 0;

function broadcastCursorChange(view) {
    var elementId = view.container.model.get('id');
    var now = Date.now();

    // Skip if same element within throttle window
    if (elementId === lastBroadcastElementId && now - lastBroadcastTime < BROADCAST_THROTTLE_MS) {
        return;
    }
    lastBroadcastElementId = elementId;
    lastBroadcastTime = now;

    // ... send postMessage
}

// Navigator indicator update throttle - 150ms
throttle(updateNavigatorIndicators, THROTTLE_DELAY_MS);
```

---

### Debouncing (navigator-indicator.js)

```javascript
// Navigator DOM mutation observer - 300ms debounce
var debouncedUpdate = debounce(updateNavigatorIndicators, DEBOUNCE_DELAY_MS);
```

---

### Debouncing (cursor-editor-sync.js)

```javascript
// DOM re-sync observer - 300ms debounce
var syncDebounceTimer = null;

var syncObserver = new MutationObserver(function(mutations) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(syncMissingElements, 300);
});
```

---

### Caching

**Container Cache (navigator-indicator.js):**
```javascript
var cidToContainerCache = null;
var cacheTimestamp = 0;

function buildContainerCache() {
    var now = Date.now();
    // Refresh cache if expired (2000ms TTL)
    if (cidToContainerCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cidToContainerCache;
    }
    // ... rebuild cache by traversing document containers
}
```

**Typography Cache (navigator-indicator.js):**
```javascript
var typographyCache = null;

function loadTypographyCache(callback) {
    // Load once via $e.data.get('globals/typography')
    // Do NOT clear cache on global->global changes
    // All typography presets are already in cache
}
```

**Element Cache (cursor-editor-sync.js):**
```javascript
var elementCache = {};     // DOM element cache by ID
var settingsCache = {};    // Settings cache by ID (for P2 re-sync)
```

---

## See Also

- [DEPENDENCY-MAP.md](DEPENDENCY-MAP.md) - Function dependencies
- [DATA-FLOW.md](DATA-FLOW.md) - Complete data pipeline
- [JAVASCRIPT-API.md](../api/JAVASCRIPT-API.md) - API reference

---

*Last Updated: February 5, 2026 | Version: 5.5*
