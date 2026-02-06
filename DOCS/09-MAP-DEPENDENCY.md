# Custom Cursor v5.6 - Dependency Map

**Last Updated:** February 6, 2026

---

## Overview

This document shows function call graphs and dependencies for all major files.

**Note:** Line numbers are approximate due to the v5.6 refactor which added:
- CONSTANTS section (~lines 160-256)
- CursorState state machine (~lines 278-399)

Many functions have shifted ~120+ lines from v5.5 references.

---

## custom-cursor.js

**File:** `assets/lib/custom-cursor/custom-cursor.js`

### Major Sections

| Lines | Section | Description |
|-------|---------|-------------|
| ~10-143 | SVG Sanitizer | XSS prevention for icon HTML |
| ~145-158 | Singleton Guard | Prevents duplicate instances |
| ~160-256 | **CONSTANTS** | All named constants (v5.6) |
| ~278-399 | **CursorState** | State machine for body classes (v5.6) |
| ~564-689 | **SpecialCursorManager** | Special cursor lifecycle coordination (v5.6) |
| ~690+ | Core Functions | Cursor creation, detection, rendering |

### Function Index (Line Numbers - Approximate)

| Line | Function | Description |
|------|----------|-------------|
| ~7 | `initCursor()` | Main IIFE, entry point |
| ~278 | `CursorState{}` | State machine object (v5.6) |
| ~294 | `CursorState.init(bodyEl)` | Initialize state with body ref |
| ~303 | `CursorState.transition(change, source)` | Apply state change |
| ~326 | `CursorState.get(key)` | Get current state value |
| ~335 | `CursorState.resetHover()` | Reset interaction state |
| ~348 | `CursorState._applyToDOM(prev)` | Sync body classes from state |
| ~564 | `SpecialCursorManager{}` | Special cursor lifecycle manager (v5.6) |
| ~580 | `SpecialCursorManager.activate(type, createFn)` | Activate special cursor |
| ~620 | `SpecialCursorManager.deactivate()` | Deactivate and restore default |
| ~660 | `SpecialCursorManager.isActive(type)` | Check if type is active |
| ~675 | `SpecialCursorManager.getActive()` | Get currently active type |
| ~690 | `isWobbleEnabled()` | Check if wobble effect is enabled |
| ~430 | `pauseCursor()` | Pause render loop (editor processing) |
| ~445 | `resumeCursor()` | Resume render loop with teleport |
| ~500 | `setBlendIntensity(intensity)` | Set blend mode via CursorState |
| ~515 | `moveCursorToPopup(el)` | Move cursor container to popup |
| ~520 | `moveCursorToBody()` | Move cursor container back to body |
| ~540 | `createImageCursor(src)` | Create image cursor element |
| ~565 | `removeImageCursor()` | Remove image cursor from DOM |
| ~585 | `showDefaultCursor()` | Show default dot/ring cursor |
| ~590 | `hideDefaultCursor()` | Hide default dot/ring cursor |
| ~600 | `createTextCursor(content, styles)` | Create text cursor element |
| ~700 | `removeTextCursor()` | Remove text cursor from DOM |
| ~715 | `createIconCursor(content, styles)` | Create icon cursor element |
| ~820 | `removeIconCursor()` | Remove icon cursor from DOM |
| ~890 | `escapeCssUrl(url)` | Escape URL for CSS url() |
| ~895 | `getLuminance(r, g, b)` | Calculate luminance for adaptive mode |
| ~905 | `applyMode(mode)` | Apply on-light/on-dark via CursorState |
| ~915 | `detectCursorMode(x, y)` | Main detection function for cursor modes |
| ~970 | `hasCursorSettings(el)` | Check if element has cursor attributes |
| ~985 | `findWithBoundary(startEl, attrName, excludeAttrs)` | Find attribute with smart boundary |
| ~1025 | `getDepthTo(element, ancestor)` | Calculate DOM depth between elements |
| ~1520 | `render()` | Main RAF render loop |
| ~2200 | `resetCursorState()` | Reset all cursor state (touch device) |
| ~2220 | `handleTouchChange(e)` | Handle touch/mouse mode switch |
| ~2245 | `handleResize()` | Handle viewport resize |

---

### Main Entry Point

```
DOMContentLoaded / initCursor() [line 6]
│
├─▶ Guardrails
│   ├─ Check body exists
│   ├─ Check .cmsm-cursor-enabled class
│   ├─ Check prefers-reduced-motion
│   ├─ Check hover:none / pointer:coarse
│   └─ Block elementor-editor-wp-page
│
├─▶ Cache DOM elements
│   ├─ container = #cmsm-cursor-container
│   ├─ dot = .cmsm-cursor-dot
│   └─ ring = .cmsm-cursor-ring
│
├─▶ Critical script takeover [line 35-49]
│   └─ Get position from cmsmCursorCriticalPos
│
├─▶ Admin bar setup [line 51-57]
│   └─ Set data-cursor="hide" on #wpadminbar
│
├─▶ MutationObserver for popups [line 574-592]
│   ├─ On add: moveCursorToPopup()
│   └─ On remove: moveCursorToBody()
│
├─▶ Event listeners [line 1754-1994]
│   ├─ mousemove ──▶ detectCursorMode(mx, my) [throttled]
│   ├─ scroll ──▶ detectCursorMode(mx, my) [throttled]
│   ├─ mousedown/up ──▶ toggle .cmsm-cursor-down
│   ├─ mouseover ──▶ hover detection, P4/P5 auto-hide
│   ├─ mouseout ──▶ reset hover state
│   ├─ mouseleave/enter ──▶ toggle .cmsm-cursor-hidden
│   └─ visibilitychange ──▶ resetCursorState()
│
└─▶ Start render loop [line 2004]
    └─▶ requestAnimationFrame(render)
```

---

### Detection Flow

```
detectCursorMode(x, y) [line 645]
│
├─▶ Get element at point [line 647-656]
│   └─ document.elementsFromPoint(x, y)
│
├─▶ Skip popup overlays [line 661-666]
│
├─▶ Check data-cursor="hide" [line 670-673]
│   └─ Return early if hidden
│
├─▶ P4 v2: Forms/popups detection [line 678-689]
│   ├─ SELECT element?
│   ├─ INPUT element (not submit/button)?
│   ├─ role="listbox/combobox/menu/dialog"?
│   └─ aria-modal="true"?
│
├─▶ P5: Video/iframe detection [line 693-697]
│
├─▶ Find special cursor (Image/Text/Icon) [line 752-784]
│   ├─▶ findWithBoundary(el, 'data-cursor-image') [line 716]
│   ├─▶ findWithBoundary(el, 'data-cursor-text')
│   ├─▶ findWithBoundary(el, 'data-cursor-icon')
│   └─▶ getDepthTo() to find closest [line 757]
│
├─▶ Find core cursor settings [line 791-810]
│   └─▶ findWithBoundary(el, 'data-cursor', excludeAttrs)
│
├─▶ IMAGE CURSOR [line 822-885]
│   └─▶ SpecialCursorManager.activate('image', fn) [line 580]
│       ├─▶ (internal) removeTextCursor()
│       ├─▶ (internal) removeIconCursor()
│       ├─▶ createImageCursor(src)
│       ├─▶ hideDefaultCursor()
│       └─▶ setBlendIntensity()
│
├─▶ TEXT CURSOR [line 887-965]
│   └─▶ SpecialCursorManager.activate('text', fn) [line 580]
│       ├─▶ (internal) removeImageCursor()
│       ├─▶ (internal) removeIconCursor()
│       ├─▶ createTextCursor(content, styles)
│       ├─▶ hideDefaultCursor()
│       └─▶ setBlendIntensity()
│
├─▶ ICON CURSOR [line 968-1047]
│   └─▶ SpecialCursorManager.activate('icon', fn) [line 580]
│       ├─▶ (internal) removeImageCursor()
│       ├─▶ (internal) removeTextCursor()
│       ├─▶ createIconCursor(content, styles)
│       ├─▶ hideDefaultCursor()
│       └─▶ setBlendIntensity()
│
├─▶ Restore default cursor [line 1049-1055]
│   └─▶ SpecialCursorManager.deactivate() [line 620]
│       ├─▶ (internal) remove[Image|Text|Icon]Cursor()
│       └─▶ showDefaultCursor()
│
├─▶ Apply color [line 1058-1095]
│   └─▶ hasCursorSettings() for boundary [line 701]
│
├─▶ Apply blend mode [line 1100-1166]
│   └─▶ setBlendIntensity() [line 251]
│
├─▶ Apply effect [line 1168-1178]
│   └─▶ findWithBoundary(el, 'data-cursor-effect')
│
└─▶ Adaptive mode [line 1181-1246]
    ├─▶ getLuminance() [line 629]
    └─▶ applyMode() [line 637]
```

---

### Render Loop

```
render() [line 1250]
│
├─▶ Position interpolation [line 1252-1257]
│   ├─ dx += (mx - dx) * dotL
│   ├─ dy += (my - dy) * dotL
│   ├─ rx += (mx - rx) * L
│   └─ ry += (my - ry) * L
│
├─▶ IMAGE CURSOR rendering [line 1263-1397]
│   ├─ Spring physics for size/rotate [line 1274-1283]
│   ├─ Effect: pulse [line 1296-1299]
│   ├─ Effect: shake [line 1300-1311]
│   ├─ Effect: buzz [line 1312-1326]
│   ├─ Effect: wobble [line 1338-1371]
│   │   ├─ Calculate velocity
│   │   ├─ Spring physics for bounce
│   │   └─ Matrix transform
│   └─ Apply transform [line 1377-1396]
│
├─▶ TEXT CURSOR rendering [line 1399-1515]
│   ├─ Effect: pulse [line 1413-1416]
│   ├─ Effect: shake [line 1417-1428]
│   ├─ Effect: buzz [line 1429-1441]
│   ├─ Effect: wobble [line 1453-1486]
│   │   └─ Inverse matrix for inner
│   └─ Apply transform [line 1488-1514]
│
├─▶ ICON CURSOR rendering [line 1517-1659]
│   ├─ Spring physics for size/rotate [line 1528-1541]
│   ├─ Effect: pulse [line 1562-1564]
│   ├─ Effect: shake [line 1565-1573]
│   ├─ Effect: buzz [line 1574-1585]
│   ├─ Effect: wobble [line 1597-1630]
│   └─ Apply transform [line 1632-1658]
│
├─▶ CORE cursor effects [line 1662-1741]
│   ├─ Effect: wobble [line 1679-1713]
│   ├─ Effect: pulse [line 1714-1718]
│   ├─ Effect: shake [line 1719-1728]
│   └─ Effect: buzz [line 1729-1741]
│
├─▶ Apply transforms to dot/ring [line 1743-1745]
│
└─▶ Request next frame [line 1748-1750]
    └─▶ requestAnimationFrame(render)
```

---

### Special Cursor Functions

```
createImageCursor(src) [line 292]
│
├─▶ Create outer wrapper: .cmsm-cursor-image
├─▶ Create inner wrapper: .cmsm-cursor-inner
├─▶ Create img element
└─▶ Append to container


createTextCursor(content, styles) [line 345]
│
├─▶ Create outer wrapper: .cmsm-cursor-text-el
├─▶ Create inner span: .cmsm-cursor-inner
├─▶ Apply typography styles [line 363-377]
├─▶ Apply colors [line 380-381]
├─▶ Fit in Circle mode [line 384-417]
│   └─ Calculate padding from diagonal
├─▶ Set initial position [line 420-433]
└─▶ Cache dimensions [line 436-437]


createIconCursor(content, styles) [line 452]
│
├─▶ Create outer wrapper: .cmsm-cursor-icon-el
├─▶ Create inner span: .cmsm-cursor-inner
├─▶ Apply color/preserve mode [line 470-478]
├─▶ SVG mask technique [line 483-505]
│   └─▶ escapeCssUrl() [line 623]
├─▶ Fit in Circle mode [line 508-537]
├─▶ Set initial position [line 540-548]
└─▶ Cache dimensions [line 551-553]
```

---

## cursor-editor-sync.js

**File:** `version-5.5/assets/js/cursor-editor-sync.js`

### Function Index (Line Numbers)

| Line | Function | Description |
|------|----------|-------------|
| 287 | `hasCursorAttributes(el)` | Check if element has cursor data attributes |
| 294 | `syncMissingElements()` | P2 fix: Re-sync elements after DOM re-render |
| 317 | `startSyncObserver()` | Start MutationObserver for DOM changes |
| 346 | `createPanel()` | Create toggle panel with preloader |
| 373 | `makePanelDraggable(panel)` | Enable drag functionality |
| 411 | `startPreloader()` | Start 15s preloader animation |
| 417 | `animatePreloader()` | RAF loop for preloader progress |
| 437 | `showSwitch()` | Replace preloader with toggle switch |
| 463 | `getInput()` | Get checkbox input element |
| 464 | `getText()` | Get switch text element |
| 466 | `startLoading()` | Start 2s loading animation |
| 479 | `disableCursor()` | Disable cursor, update UI |
| 489 | `enableCursor()` | Enable cursor, update UI |
| 499 | `toggleCursor()` | Toggle cursor state |
| 505 | `clearAttributes(el)` | Remove all cursor data attributes |
| 519 | `getSize(v, d)` | Parse size value |
| 520 | `fmtDims(d)` | Format dimensions to CSS string |
| 522 | `applySettings(elementId, settings)` | Main settings application |
| 537 | `findElement(id)` | Find element by data-id |
| 544 | `applyCoreSettings(el, s)` | Apply core cursor attributes |
| 551 | `applyImageSettings(el, s)` | Apply image cursor attributes |
| 563 | `applyTextSettings(el, s)` | Apply text cursor attributes |
| 627 | `applyIconSettings(el, s)` | Apply icon cursor attributes |
| 650 | `requestInit()` | Request initial settings from parent |
| 656 | `init()` | Main initialization |

---

### Initialization

```
IIFE [line 5]
│
├─▶ Guards [line 8-9]
│   ├─ Check in iframe
│   └─ Check .cmsm-cursor-enabled
│
├─▶ Inject styles [line 25-241]
│
├─▶ Add .cmsms-cursor-disabled [line 243]
│
├─▶ Keyboard listener [line 245-251]
│   └─ 'C' key ──▶ toggleCursor()
│
├─▶ Message listener [line 253-280]
│   ├─ cmsmasters:cursor:update ──▶ applySettings()
│   └─ cmsmasters:cursor:init ──▶ forEach applySettings()
│
├─▶ P2 Fix: MutationObserver [line 310-328]
│   └─▶ syncMissingElements() [debounced]
│
├─▶ requestInit() after 500ms [line 331]
│
├─▶ DOMContentLoaded ──▶ init() [line 332-333]
│
└─▶ Expose API [line 335-344]
    └─ window.cmsmastersCursorEditorSync
```

---

### Message Handling

```
window.addEventListener('message') [line 253]
│
├─▶ Start preloader on first message [line 257-260]
│   └─▶ startPreloader() [line 411]
│
├─▶ cmsmasters:cursor:update [line 262-268]
│   ├─ Cache settings (P2 fix) [line 265]
│   └─▶ applySettings(elementId, settings) [line 522]
│
└─▶ cmsmasters:cursor:init [line 269-279]
    └─ forEach element:
        ├─ Cache settings (P2 fix) [line 274]
        └─▶ applySettings(id, settings) [line 522]


applySettings(elementId, settings) [line 522]
│
├─▶ findElement(elementId) [line 537]
│
├─▶ clearAttributes(element) [line 505]
│
├─▶ Check hide cursor [line 526]
│
├─▶ Check special_active [line 527]
│   ├─ type = 'image' ──▶ applyImageSettings() [line 551]
│   ├─ type = 'text' ──▶ applyTextSettings() [line 563]
│   └─ type = 'icon' ──▶ applyIconSettings() [line 627]
│
└─▶ Otherwise ──▶ applyCoreSettings() [line 544]


applyCoreSettings(el, s) [line 544]
├─ data-cursor = hover_style
├─ data-cursor-color = force_color
├─ data-cursor-blend = blend_mode
└─ data-cursor-effect = effect


applyImageSettings(el, s) [line 551]
├─ data-cursor-image = url
├─ data-cursor-image-size = size_normal
├─ data-cursor-image-size-hover = size_hover
├─ data-cursor-image-rotate = rotate_normal
├─ data-cursor-image-rotate-hover = rotate_hover
├─ data-cursor-image-effect = effect
└─ data-cursor-blend = special_blend


applyTextSettings(el, s) [line 563]
├─ data-cursor-text = content
├─ data-cursor-text-color = color
├─ data-cursor-text-bg = bg_color
├─ data-cursor-text-typography = JSON
├─ data-cursor-text-circle = yes/no
├─ data-cursor-text-circle-spacing = spacing
├─ data-cursor-text-radius = border_radius
├─ data-cursor-text-padding = padding
├─ data-cursor-text-effect = effect
└─ data-cursor-blend = special_blend


applyIconSettings(el, s) [line 627]
├─ data-cursor-icon = HTML
├─ data-cursor-icon-color = color
├─ data-cursor-icon-bg = bg_color
├─ data-cursor-icon-preserve = yes/no
├─ data-cursor-icon-size = size_normal
├─ data-cursor-icon-size-hover = size_hover
├─ data-cursor-icon-circle = yes/no
├─ data-cursor-icon-effect = effect
└─ data-cursor-blend = special_blend
```

---

### Panel & Preloader

```
init() [line 656]
│
├─▶ createPanel() [line 346]
│   ├─ Create #cmsms-cursor-panel
│   ├─ Add .is-preloading class
│   ├─ Create preloader HTML
│   └─▶ makePanelDraggable() [line 373]
│
├─▶ disableCursor() [line 479]
│
└─▶ Fallback: startPreloader() after 2s [line 662-666]


startPreloader() [line 411]
│
├─ Record start time
└─▶ animatePreloader() [line 417]


animatePreloader() [line 417]
│
├─ Calculate progress
├─ Update fill width
├─ Update percent text
│
└─ If progress < 1:
│   └─▶ requestAnimationFrame(animatePreloader)
└─ If complete:
    └─▶ showSwitch() [line 437]


showSwitch() [line 437]
│
├─ Remove .is-preloading
├─ Replace innerHTML with switch
└─ Add change listener ──▶ startLoading() or disableCursor()


startLoading() [line 466]
│
├─ Set isLoading = true
├─ Add .is-loading class
└─ After 2s ──▶ enableCursor() [line 489]
```

---

## navigator-indicator.js

**File:** `version-5.5/assets/js/navigator-indicator.js`

### Function Index (Line Numbers)

| Line | Function | Description |
|------|----------|-------------|
| 24 | `throttle(fn, delay)` | Throttle helper |
| 36 | `debounce(fn, delay)` | Debounce helper |
| 60 | `loadTypographyCache(callback)` | Load global typography via $e.data |
| 104 | `getTypographyFromCache(typoId)` | Get typography by ID from cache |
| 131 | `resolveGlobalColor(globalRef)` | Resolve global color reference to hex |
| 220 | `resolveGlobalTypography(globalRef)` | Resolve global typography reference |
| 278 | `resolveGlobalColors(settings)` | Resolve all globals in settings |
| 343 | `hasNonDefaultCursor(settings)` | Check if element has cursor settings |
| 418 | `getTooltip(cursorInfo, settings)` | Build tooltip text for indicator |
| 476 | `buildContainerCache()` | Build CID to Container map |
| 492 | `traverse(container)` | Recursive container traversal |
| 543 | `getContainerFromNavElement(navEl)` | Get container from Navigator element |
| 571 | `updateNavigatorIndicators()` | Update all Navigator indicators |
| 650 | `addLegend()` | Add legend bar to Navigator panel |
| 718 | `updateLegendVisibility(hasIndicators)` | Show/hide legend based on indicators |
| 734 | `initNavigatorObserver()` | Initialize Navigator MutationObserver |
| 793 | `broadcastCursorChange(view)` | Send cursor update to preview iframe |
| 841 | `broadcastChildrenCursorSettings(container, previewIframe)` | P2 fix: Broadcast children settings |
| 844 | `traverseChildren(cont)` | Recursive children traversal |
| 875 | `broadcastSingleElement(container, previewIframe)` | Send single element settings |
| 904 | `sendInitialCursorSettings()` | Send all cursor settings to preview |
| 915 | `traverseForCursor(container)` | Traverse and collect cursor elements |
| 986 | `initPreviewMessageListener()` | Listen for cursor:request-init |
| 1006 | `watchSelectedElementModel()` | Watch selected element for changes |
| 1029 | `onSettingsModelChange(model, options)` | Handle settings model change |
| 1065 | `initSettingsListener()` | Initialize all settings listeners |
| 1128 | `tryAddLegend(retries)` | Add legend with retry logic |
| 1162 | `sendInitialCursorSettingsWithRetry(retries, delay)` | Send initial settings with retry |
| 1188 | `traverseForCursor(container)` | Traverse for cursor (retry version) |
| 1243 | `init()` | Main initialization |

---

### Initialization

```
elementor.on('preview:loaded') [line 1267]
│
└─▶ init() [line 1243]
    │
    ├─▶ loadTypographyCache(callback) [line 60]
    │   └─ On complete ──▶ sendInitialCursorSettingsWithRetry() [line 1162]
    │
    └─▶ After INIT_DELAY_MS (500ms) [line 1252-1261]
        ├─▶ tryAddLegend() [line 1128]
        ├─▶ updateNavigatorIndicators() [line 571]
        ├─▶ initNavigatorObserver() [line 734]
        ├─▶ initSettingsListener() [line 1065]
        └─▶ initPreviewMessageListener() [line 986]


Navigator toggle click [line 1270-1275]
│
└─▶ After NAV_TOGGLE_DELAY_MS (200ms)
    ├─▶ addLegend() [line 650]
    └─▶ updateNavigatorIndicators() [line 571]
```

---

### Navigator Updates

```
updateNavigatorIndicators() [line 571]
│
├─▶ addLegend() [line 650]
│
├─▶ Invalidate cache [line 580]
│
├─▶ For each .elementor-navigator__element [line 585-637]
│   │
│   ├─▶ getContainerFromNavElement(navEl) [line 543]
│   │   └─▶ buildContainerCache() [line 476]
│   │       └─▶ traverse(container) [line 492]
│   │
│   ├─▶ hasNonDefaultCursor(settings) [line 343]
│   │
│   ├─▶ getTooltip(cursorInfo, settings) [line 418]
│   │
│   └─ Create/append indicator
│
└─▶ updateLegendVisibility(hasAnyIndicator) [line 718]


hasNonDefaultCursor(settings) [line 343]
│
├─▶ Check config.cursorEnabled [line 350-359]
│   └─ If disabled: check cmsmasters_cursor_hide = 'yes'
│
├─▶ Priority 1: Special cursor [line 365-372]
│   └─ cmsmasters_cursor_special_active = 'yes'
│
├─▶ Priority 2: Hidden cursor [line 376-379]
│   └─ cmsmasters_cursor_hide = 'yes'
│
└─▶ Priority 3: Core settings [line 383-404]
    ├─ hover_style
    ├─ force_color
    ├─ blend_mode
    └─ effect
```

---

### Settings Broadcast

```
broadcastCursorChange(view) [line 793]
│
├─▶ Throttle check (200ms per element) [line 797-803]
│
├─▶ Get settings as JSON [line 809]
│
├─▶ resolveGlobalColors(settings) [line 278]
│   │
│   ├─▶ resolveGlobalColor() for colors [line 131]
│   │   ├─ Method 1: elementor.documents kit (LIVE)
│   │   ├─ Method 2: $e.data cache
│   │   ├─ Method 3: elementor.config.kit_config (STATIC)
│   │   └─ Method 4: CSS variable from preview iframe
│   │
│   └─▶ resolveGlobalTypography() for typography [line 220]
│       ├─▶ getTypographyFromCache() [line 104]
│       └─ Fallback methods
│
├─▶ postMessage to preview iframe [line 825-829]
│   └─ { type: 'cmsmasters:cursor:update', elementId, settings }
│
└─▶ broadcastChildrenCursorSettings() [line 841] (P2 fix)
    └─▶ traverseChildren() [line 844]
        └─▶ broadcastSingleElement() [line 875]


sendInitialCursorSettings() [line 904]
│
├─▶ traverseForCursor(container) [line 915]
│   │
│   ├─▶ resolveGlobalColors(settings) [line 278]
│   │
│   └─ Push { id, settings } to elements array
│
└─▶ postMessage to preview iframe [line 974-977]
    └─ { type: 'cmsmasters:cursor:init', elements }
```

---

### Settings Listener

```
initSettingsListener() [line 1065]
│
├─▶ Start watchSelectedElementModel() interval [line 1073]
│   └─▶ watchSelectedElementModel() every 300ms [line 1006]
│       └─ settings.on('change', onSettingsModelChange)
│
├─▶ elementor.channels.editor.on('change') [line 1077-1081]
│   ├─▶ throttledUpdate()
│   └─▶ broadcastCursorChange(view) [line 793]
│
├─▶ $e.hooks.register('document/elements/settings') [line 1089-1099]
│   ├─▶ broadcastCursorChange() [line 793]
│   └─▶ throttledUpdate()
│
├─▶ elementor.channels.data events [line 1107-1110]
│   ├─ element:after:add ──▶ throttledUpdate()
│   └─ element:after:remove ──▶ throttledUpdate()
│
└─▶ elementor.channels.editor history events [line 1114-1117]
    ├─ history:undo ──▶ throttledUpdate()
    └─ history:redo ──▶ throttledUpdate()


onSettingsModelChange(model, options) [line 1029]
│
├─▶ Check for cursor or __globals__ changes [line 1036-1038]
│
├─▶ If __globals__ has typography [line 1044-1055]
│   └─▶ loadTypographyCache() if not loaded [line 60]
│
└─▶ If cursor change [line 1057-1062]
    ├─▶ broadcastCursorChange() [line 793]
    └─▶ throttle(updateNavigatorIndicators) [line 571]
```

---

## Cross-File Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

     BACKEND                              FRONTEND
     ───────                              ────────

┌──────────────┐
│settings-page │
│    .php      │
└──────┬───────┘
       │ WordPress options
       ▼
┌──────────────┐       ┌───────────────────────────────────────┐
│ frontend.php │──────▶│ Body classes + CSS vars + HTML        │
└──────┬───────┘       └───────────────────┬───────────────────┘
       │                                   │
       │                                   ▼
       │               ┌───────────────────────────────────────┐
       │               │         custom-cursor.js              │
       │               │                                       │
       │               │ initCursor() [line 6]                 │
       │               │   ├─▶ detectCursorMode() [line 645]   │
       │               │   └─▶ render() [line 1250]            │
       │               └───────────────────────────────────────┘
       │
       │
┌──────▼───────┐
│  module.php  │
└──────┬───────┘
       │ data-cursor-* attributes
       ▼
┌──────────────┐
│ HTML elements│
│ (widgets)    │
└──────────────┘


     EDITOR                               PREVIEW IFRAME
     ──────                               ──────────────

┌──────────────┐                   ┌──────────────┐
│  editor.php  │                   │  editor.php  │
└──────┬───────┘                   └──────┬───────┘
       │ enqueue                          │ enqueue
       ▼                                  ▼
┌──────────────┐                   ┌──────────────┐
│ navigator-   │◀─────────────────▶│ cursor-      │
│ indicator.js │   postMessage     │ editor-sync  │
│              │                   │    .js       │
│ init() [1243]│                   │              │
│ ├─broadcastCursorChange() [793]  │ init() [656] │
│ └─updateNavigatorIndicators()    │ ├─applySettings() [522]
│   [571]      │                   │ └─createPanel() [346]
└──────────────┘                   └──────┬───────┘
       │                                  │
       │                                  ▼
       │                           ┌──────────────┐
       │                           │custom-cursor │
       │                           │    .js       │
       │                           │              │
       │                           │ initCursor() │
       │                           │ [line 6]     │
       │                           └──────────────┘
       │
       ▼
┌──────────────┐
│  module.php  │
│ (controls)   │
└──────────────┘


MESSAGE FLOW:

navigator-indicator.js                cursor-editor-sync.js
────────────────────                  ─────────────────────

broadcastCursorChange() ─────────▶ message listener [line 253]
[line 793]                                 │
    │                                      │
    │ { type: 'cmsmasters:cursor:update',  │
    │   elementId, settings }              │
    │                                      ▼
    │                              applySettings() [line 522]
    │                                      │
    │                                      ├─▶ applyCoreSettings()
    │                                      ├─▶ applyImageSettings()
    │                                      ├─▶ applyTextSettings()
    │                                      └─▶ applyIconSettings()

sendInitialCursorSettings() ─────▶ message listener [line 253]
[line 904]                                 │
    │                                      │
    │ { type: 'cmsmasters:cursor:init',    │
    │   elements: [...] }                  │
    │                                      ▼
    │                              forEach applySettings()


                                   requestInit() [line 650]
initPreviewMessageListener() ◀───────────  │
[line 986]                                 │
    │                                      │
    │ { type: 'cmsmasters:cursor:request-init' }
    │                                      │
    ▼                                      │
sendInitialCursorSettings()                │
[line 904]                                 │
```

---

## See Also

- [DATA-FLOW.md](DATA-FLOW.md) - Complete data pipeline
- [EDITOR-SYNC.md](EDITOR-SYNC.md) - Editor communication
- [EVENT-FLOW.md](EVENT-FLOW.md) - Event handling

---

*Last Updated: February 6, 2026 | Version: 5.6*
