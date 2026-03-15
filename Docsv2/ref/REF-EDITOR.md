# Custom Cursor - Editor Sync Protocol Reference

**Last Updated:** February 18, 2026

---

## Overview

The editor sync system enables real-time cursor preview in Elementor editor. It uses postMessage for cross-frame communication between the editor and preview iframe.

---

## Architecture

```
+-----------------------------------------------------------------------------+
|                        ELEMENTOR EDITOR ENVIRONMENT                         |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +-------------------------------+    +-------------------------------+    |
|  |        EDITOR FRAME           |    |       PREVIEW IFRAME          |    |
|  |                               |    |                               |    |
|  |  navigator-indicator.js       |    |  cursor-editor-sync.js        |    |
|  |  - Watch settings model       |    |  - Toggle panel               |    |
|  |  - Update Navigator           |    |  - Apply attributes           |    |
|  |  - Broadcast changes     -----------> Live preview                 |    |
|  |                          <-----------  Request init                |    |
|  |                               | PM |                               |    |
|  |  Elementor Settings Model     |    |  custom-cursor.js             |    |
|  |  - Widget settings            |    |  - Cursor engine              |    |
|  |  - Change events              |    |  - Effect rendering           |    |
|  +-------------------------------+    +-------------------------------+    |
|                                                                             |
|                           PM = postMessage                                  |
+-----------------------------------------------------------------------------+
```

---

## Message Protocol

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `cmsmasters:cursor:init` | Editor -> Preview | Send all cursor settings |
| `cmsmasters:cursor:update` | Editor -> Preview | Send single element update |
| `cmsmasters:cursor:request-init` | Preview -> Editor | Request settings resend |
| `cmsmasters:cursor:device-mode` | Editor -> Preview | Notify responsive mode change |
| `cmsmasters:cursor:template-check` | Editor -> Preview | Hide/show panel on template type change |
| `cmsmasters:cursor:page-settings` | Editor -> Preview | Send page-level cursor settings (real-time sync) |

---

### cmsmasters:cursor:init

**Direction:** Editor -> Preview
**Triggered By:** Editor initialization, preview reload, typography cache ready
**Source:** `navigator-indicator.js` - `sendInitialCursorSettings()` and `sendInitialCursorSettingsWithRetry()`

Sends all elements with cursor settings to preview. Payload includes `elements` array (each with `id` and `settings` containing all `cmsmasters_cursor_*` keys) and optional `pageSettings` for initial page-level sync.

**Handler:** `cursor-editor-sync.js` caches settings per element ID and calls `applySettings()` for each.

---

### cmsmasters:cursor:update

**Direction:** Editor -> Preview
**Triggered By:** User changes cursor settings in widget panel, `$e.hooks 'document/elements/settings'`
**Source:** `navigator-indicator.js` - `broadcastCursorChange()` and `broadcastSingleElement()`

Updates single element's cursor settings in real-time. When a parent element re-renders, `broadcastChildrenCursorSettings()` also re-sends cursor settings for all children (P2 fix for DOM re-render issue).

---

### cmsmasters:cursor:request-init

**Direction:** Preview -> Editor
**Triggered By:** Preview iframe load (500ms after DOMContentLoaded)
**Source:** `cursor-editor-sync.js` - `requestInit()`

Requests full settings resend from editor. Handler in `navigator-indicator.js` calls `sendInitialCursorSettings()`.

---

### cmsmasters:cursor:device-mode

**Direction:** Editor -> Preview
**Triggered By:** Responsive mode toolbar changes in Elementor editor
**Purpose:** Hide cursor preview on touch-screen modes (tablet/mobile)

**Rule:** Cursor visible when `innerWidth > 1024px`, hidden when `<= 1024px`

**Primary Detection:** Preview iframe monitors its own width via `window.resize`.
**Backup Detection:** Editor sends postMessage with mode string (`'desktop'|'tablet'|'mobile'|'widescreen'|'laptop'`).

**Editor Detection Methods (navigator-indicator.js):**
1. Elementor Backbone Radio: `elementor.channels.deviceMode.on('change', ...)`
2. MutationObserver: Watches editor body class `elementor-device-{mode}`
3. `preview:loaded` re-sync: Force-sends current mode 700ms after each preview load

---

### cmsmasters:cursor:template-check

**Direction:** Editor -> Preview
**Triggered By:** Elementor document changes (including soft-switches)
**Purpose:** Hide cursor panel on Entry and Popup template types

**Excluded Template Types:** `cmsmasters_popup`, any type ending with `_entry`
**Enabled Template Types:** `cmsmasters_header`, `cmsmasters_footer`, archive/singular templates

**Detection Methods (navigator-indicator.js):**
1. `isCursorExcludedTemplate(type)` - Returns `true` if popup or ends with `_entry`
2. `isHiddenTemplate()` - Checks current document via Elementor API + DOM fallback

---

### cmsmasters:cursor:page-settings

**Direction:** Editor -> Preview
**Triggered By:** Page Settings model change (blend, theme, color, etc.)
**Source:** `navigator-indicator.js` - `broadcastPageCursorChange()`

Payload contains all 7 page cursor keys (`cmsmasters_page_cursor_disable`, `_theme`, `_color`, `_smoothness`, `_blend_mode`, `_effect`, `_adaptive`).

**Handler:** `cursor-editor-sync.js` - `applyPageCursorSettings()` applies changes via body classes + window props.

---

## Communication Flows

### Initialization Sequence

1. Elementor fires `preview:loaded` event
2. Editor loads typography cache via `$e.data.get`
3. Preview iframe loads, `init()` creates toggle panel
4. Preview sends `cmsmasters:cursor:request-init` (500ms after DOMContentLoaded)
5. Editor traverses all containers, resolves global colors/typography
6. Editor sends `cmsmasters:cursor:init` with all elements + page settings
7. Preview caches settings, applies to DOM, starts preloader

### Settings Change Sequence

1. User changes widget setting
2. Multiple listeners catch change (settings.on, channels.editor, $e.hooks)
3. `onSettingsModelChange()` resolves globals, updates Navigator indicator
4. `broadcastCursorChange()` sends `cmsmasters:cursor:update` (200ms throttle)
5. Also broadcasts children settings (P2 fix for DOM re-render)
6. Preview caches and applies via `applySettings()`

---

## Navigator Indicator System

### Loading & Dependencies

**Script loading** (via `editor.php`):
- `navigator-indicator.js` is always enqueued in Elementor editor
- Does NOT depend on `cursor_enabled` option -- loads even when cursor is disabled
- Depends on: `jquery`, `elementor-editor`, `cmsmasters-elementor`

**Configuration** passed via inline script:
```js
window.cmsmastersNavigatorConfig = { cursorMode: 'yes'|'widgets'|'' };
```
- `cursorMode: 'yes'` -- Enabled Globally: shows core/special/hidden/inherit indicators
- `cursorMode: 'widgets'` -- Widgets Only: shows core/special/inherit indicators (no Hidden)
- `cursorMode: ''` -- Disabled: no indicators, no legend

### Indicator Types

| Type | CSS Class | Color | Trigger |
|------|-----------|-------|---------|
| `core` | `.cmsm-nav-cursor-core` | Purple | Hover style, color, blend, effect changes; or toggle=yes in Widgets Only |
| `special` | `.cmsm-nav-cursor-special` | Blue | `cmsmasters_cursor_special_active='yes'` |
| `hidden` | `.cmsm-nav-cursor-hidden` | Gray | `cmsmasters_cursor_hide='yes'` (Enabled Globally only) |
| `inherit` | `.cmsm-nav-cursor-inherit` | -- | `cmsmasters_cursor_inherit_parent='yes'` |

**Priority Order:** Inherit > Special > Hidden > Core

**Legend:** Mode-conditional. Widgets Only shows 3 items (Core/Special/Inherit). Enabled Globally shows 4 items (adds Hidden). Legend is visible only when at least one indicator exists.

---

## Toggle Panel

Toggle panel in preview iframe provides ON/OFF switch for cursor preview.

- **Toggle ON:** 2-second loading animation -> `enableCursor()` -> show cursor container
- **Toggle OFF:** `disableCursor()` -> `cmsmasters-cursor-disabled` body class -> CSS hides cursor
- **Keyboard shortcut:** Press 'C' to toggle (when not in input/textarea)
- Settings are cached from `cmsmasters:cursor:init` -- no additional request on toggle

---

## Settings Resolution

### Global Color Resolution

`resolveGlobalColor(globalRef)` resolves global color references to hex values.

**Resolution Priority:**
1. LIVE - Kit document settings model (real-time)
2. CACHE - `$e.data.cache.storage.get('globals/colors')`
3. STATIC - `elementor.config.kit_config.global_colors`
4. FALLBACK - CSS variable from preview iframe: `--e-global-color-{id}`

**Resolved for:** `cmsmasters_cursor_color`, `cmsmasters_cursor_icon_color`, `cmsmasters_cursor_icon_bg_color`, `cmsmasters_cursor_text_color`, `cmsmasters_cursor_text_bg_color`

### Global Typography Resolution

`resolveGlobalTypography(globalRef)` resolves typography references.

**Resolution Priority:**
1. CACHE - `typographyCache` (loaded via `$e.data.get('globals/typography')`)
2. LIVE - Kit document system_typography settings
3. STATIC - `elementor.config.kit_config.global_typography`

**Important:** Typography cache is loaded on init. Initial cursor settings are only sent AFTER cache is ready.

---

## Performance Constants

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

## Error Handling

### Preview Not Ready
`sendInitialCursorSettingsWithRetry()` retries up to 5 times with 500ms delay if preview iframe isn't ready or only 1 element found (document root = children not loaded).

### Element Not Found
`findElement(id)` checks cache with `isConnected` guard for stale DOM references, falls back to `querySelector`.

### DOM Re-render Recovery (P2 Fix)
MutationObserver on `document.body` detects child list changes. 300ms debounced `syncMissingElements()` re-applies cached settings to elements missing cursor attributes.

### Preloader Fallback
If no message received within 2 seconds, preloader starts anyway (handles empty pages).

---

## Caching

| Cache | Location | TTL | Purpose |
|-------|----------|-----|---------|
| Container cache | navigator-indicator.js | 2000ms | CID -> Container mapping |
| Typography cache | navigator-indicator.js | Session | Global typography presets |
| Element cache | cursor-editor-sync.js | Session | DOM element by ID |
| Settings cache | cursor-editor-sync.js | Session | Settings by element ID (for P2 re-sync) |

---

## See Also

- `SOURCE-OF-TRUTH.md` -- Canonical behavior map
- `REF-SETTINGS.md` -- Legacy settings reference
- `REF-EFFECTS.md` -- Effect physics and algorithms

---

*Last Updated: February 18, 2026 | Version: 5.6 | Migrated to Docsv2*
