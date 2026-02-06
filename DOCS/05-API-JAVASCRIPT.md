# Custom Cursor v5.6 - JavaScript API Reference

**Last Updated:** February 6, 2026

---

## Overview

| File | Functions | Global Export |
|------|-----------|---------------|
| custom-cursor.js | 25+ | `window.cmsmastersCursor` |
| cursor-editor-sync.js | 20+ | `window.cmsmastersCursorEditorSync` |
| navigator-indicator.js | 30+ | `window.cmsmastersNavigatorIndicator` |

---

## custom-cursor.js

**Location:** `assets/lib/custom-cursor/custom-cursor.js`

### Constants (CONSTANTS Section)

**Location:** Lines ~160-256

All magic numbers have been extracted to named constants for maintainability.

#### Position & Smoothness

| Name | Line | Value | Description |
|------|------|-------|-------------|
| OFFSCREEN_POSITION | ~168 | `-200` | Initial offscreen position |
| SMOOTH_PRECISE | ~175 | `1` | Lerp factor: instant |
| SMOOTH_SNAPPY | ~176 | `0.5` | Lerp factor: fast |
| SMOOTH_NORMAL | ~177 | `0.25` | Lerp factor: default |
| SMOOTH_SMOOTH | ~178 | `0.12` | Lerp factor: smooth |
| SMOOTH_FLUID | ~179 | `0.06` | Lerp factor: very smooth |
| DOT_SPEED_MULTIPLIER | ~180 | `2` | Dot moves 2x faster than ring |

#### Adaptive Mode Detection

| Name | Line | Value | Description |
|------|------|-------|-------------|
| DETECT_DISTANCE | ~186 | `5` | Min pixels moved before re-detecting |
| HYSTERESIS | ~187 | `3` | Consecutive frames before mode change |
| MAX_DEPTH | ~188 | `10` | Max DOM depth for bg detection |
| STICKY_MODE_DURATION | ~189 | `500` | Lock mode for 500ms (prevents flicker) |

#### Spring Physics

| Name | Line | Value | Description |
|------|------|-------|-------------|
| TRANSITION_STIFFNESS | ~195 | `0.15` | Size/rotate spring stiffness |
| TRANSITION_DAMPING | ~196 | `0.75` | Damping (< 1 = slight overshoot) |

#### Wobble Effect

| Name | Line | Value | Description |
|------|------|-------|-------------|
| WOBBLE_MAX | ~202 | `0.6` | 60% max stretch (reference) |
| WOBBLE_STIFFNESS | ~203 | `0.25` | Spring stiffness |
| WOBBLE_DAMPING | ~204 | `0.78` | Damping (< 1 = overshoot) |
| WOBBLE_THRESHOLD | ~205 | `6` | Min velocity for angle update |
| WOBBLE_VELOCITY_SCALE | ~206 | `0.012` | Velocity to target multiplier |
| WOBBLE_DEFORMATION_MULT | ~207 | `2` | Deformation visibility multiplier |
| WOBBLE_SCALE_MAX | ~208 | `1.2` | Max wobble scale (clamped) |
| WOBBLE_STRETCH_FACTOR | ~209 | `0.5` | Stretch factor for matrix |
| WOBBLE_ANGLE_MULTIPLIER | ~210 | `2` | Double angle for symmetric stretch |
| WOBBLE_MIN_SCALE | ~211 | `0.001` | Threshold for applying matrix |

#### Pulse Effect

| Name | Line | Value | Description |
|------|------|-------|-------------|
| PULSE_TIME_INCREMENT | ~217 | `0.05` | Per-frame time increment |
| PULSE_CORE_AMPLITUDE | ~218 | `0.15` | ±15% for dot/ring |
| PULSE_SPECIAL_AMPLITUDE | ~219 | `0.08` | ±8% for image/text/icon |

#### Shake Effect

| Name | Line | Value | Description |
|------|------|-------|-------------|
| SHAKE_TIME_INCREMENT | ~225 | `0.08` | Per-frame time increment |
| SHAKE_CYCLE_DURATION | ~226 | `10` | Full cycle length |
| SHAKE_WAVE_PHASE | ~227 | `6.28` | ~2π, active wave duration |
| SHAKE_WAVE_MULTIPLIER | ~228 | `2` | 2 oscillations per cycle |
| SHAKE_CORE_AMPLITUDE | ~229 | `4` | ±4px for dot/ring |
| SHAKE_SPECIAL_AMPLITUDE | ~230 | `5` | ±5px for image/text/icon |

#### Buzz Effect

| Name | Line | Value | Description |
|------|------|-------|-------------|
| BUZZ_TIME_INCREMENT | ~236 | `0.08` | Per-frame time increment |
| BUZZ_CYCLE_DURATION | ~237 | `10` | Full cycle length |
| BUZZ_WAVE_PHASE | ~238 | `6.28` | ~2π, active rotation duration |
| BUZZ_WAVE_MULTIPLIER | ~239 | `2` | 2 oscillations per cycle |
| BUZZ_CORE_AMPLITUDE | ~240 | `15` | ±15° for dot/ring |
| BUZZ_SPECIAL_AMPLITUDE | ~241 | `12` | ±12° for image/text/icon |

#### Throttling & Thresholds

| Name | Line | Value | Description |
|------|------|-------|-------------|
| POPUP_CHECK_INTERVAL_MS | ~246 | `100` | Popup visibility check interval |
| DETECTION_THROTTLE_MS | ~247 | `100` | Background detection throttle |
| SCROLL_THROTTLE_MS | ~248 | `50` | Scroll detection throttle |
| FADE_TRANSITION_DELAY_MS | ~249 | `150` | Viewport change debounce |
| TRANSPARENT_ALPHA_THRESHOLD | ~254 | `0.15` | Alpha below = transparent |
| VALID_POSITION_THRESHOLD | ~255 | `5` | Pixels from origin to be valid |
| INITIAL_CURSOR_SIZE_PX | ~256 | `8` | Default cursor dot size |

---

### CursorState (State Machine)

**Location:** Lines ~278-399

Centralized cursor state management. ALL body class changes go through `CursorState.transition()`.

#### State Shape

```javascript
CursorState._state = {
    hover: boolean,          // Over interactive element
    down: boolean,           // Mouse button pressed
    hidden: boolean,         // Cursor hidden (form/video/iframe/leave)
    text: boolean,           // Text input mode
    mode: null|'on-light'|'on-dark',     // Adaptive mode
    size: null|'sm'|'md'|'lg',           // Ring size modifier
    blend: null|'soft'|'medium'|'strong' // Blend intensity
}
```

#### CursorState.init(bodyEl)

**Line:** ~294

```javascript
CursorState.init(document.body)
```

Initialize with body reference. Called once during cursor init.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| bodyEl | HTMLElement | `document.body` reference |

**Returns:** `void`

---

#### CursorState.transition(change, source)

**Line:** ~303

```javascript
CursorState.transition({ hover: true, size: 'lg' }, 'mouseover')
```

Apply a state change. Only changed properties trigger DOM updates.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| change | object | Partial state object |
| source | string | (optional) Caller ID for debug tracing |

**Returns:** `void`

**Example:**

```javascript
// On mousedown
CursorState.transition({ down: true }, 'mousedown');

// On adaptive mode change
CursorState.transition({ mode: 'on-light' }, 'detectCursorMode');

// Multiple changes at once
CursorState.transition({ hover: true, size: 'lg', hidden: false }, 'mouseover');
```

**Side Effects:** Updates body classes via `_applyToDOM()`

---

#### CursorState.get(key)

**Line:** ~326

```javascript
CursorState.get('hover')  // Returns: true|false
CursorState.get('mode')   // Returns: null|'on-light'|'on-dark'
```

Get current state value.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| key | string | State property name |

**Returns:** Current value for that property

---

#### CursorState.resetHover()

**Line:** ~335

```javascript
CursorState.resetHover()
```

Reset interaction state on mouseout. Called when cursor leaves an element.

**Resets:**
- `hover` → false
- `text` → false
- `hidden` → false
- `size` → null

**Does NOT reset:**
- `mode` (adaptive stays)
- `blend` (blend stays)
- `down` (mouse button stays until mouseup)

**Returns:** `void`

---

#### CursorState._applyToDOM(prev)

**Line:** ~348 (private)

Sync DOM classes from state. Only touches changed properties.

**Body Class Mappings:**

| State | Body Class |
|-------|------------|
| `hover: true` | `cmsm-cursor-hover` |
| `down: true` | `cmsm-cursor-down` |
| `hidden: true` | `cmsm-cursor-hidden` |
| `text: true` | `cmsm-cursor-text` |
| `mode: 'on-light'` | `cmsm-cursor-on-light` |
| `mode: 'on-dark'` | `cmsm-cursor-on-dark` |
| `size: 'lg'` | `cmsm-cursor-size-lg` |
| `blend: 'medium'` | `cmsm-cursor-blend cmsm-cursor-blend-medium` |

**Mutually Exclusive Groups:**
- Mode: only one of `on-light`/`on-dark` at a time
- Size: only one of `sm`/`md`/`lg` at a time
- Blend: only one of `soft`/`medium`/`strong` at a time

---

### SpecialCursorManager (Internal)

**Location:** Lines ~564-689

Coordinates special cursor lifecycle (image, text, icon). Ensures only one special cursor type is active at a time and handles cleanup automatically.

**Note:** This is an internal API, not exposed publicly.

#### State

```javascript
SpecialCursorManager._activeType = null  // 'image' | 'text' | 'icon' | null
```

#### SpecialCursorManager.activate(type, createFn)

**Line:** ~580

```javascript
SpecialCursorManager.activate('image', function() {
    createImageCursor(src);
})
```

Activates a special cursor type. Automatically deactivates any previously active type first.

**Parameters:**

| Name | Type | Values | Description |
|------|------|--------|-------------|
| type | string | `'image'` \| `'text'` \| `'icon'` | Special cursor type to activate |
| createFn | function | required | Function that creates the cursor element |

**Returns:** `void`

**Side Effects:**
- Calls appropriate `remove*Cursor()` for previous type
- Calls `hideDefaultCursor()`
- Calls the provided `createFn()`
- Updates `_activeType`

---

#### SpecialCursorManager.deactivate()

**Line:** ~620

```javascript
SpecialCursorManager.deactivate()
```

Deactivates the currently active special cursor and restores the default cursor.

**Returns:** `void`

**Side Effects:**
- Calls `remove*Cursor()` for current type
- Calls `showDefaultCursor()`
- Sets `_activeType = null`

---

#### SpecialCursorManager.isActive(type)

**Line:** ~660

```javascript
SpecialCursorManager.isActive('image')  // Returns: true|false
```

Checks if a specific special cursor type is currently active.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| type | string | Type to check (`'image'`, `'text'`, `'icon'`) |

**Returns:** `boolean`

---

#### SpecialCursorManager.getActive()

**Line:** ~675

```javascript
SpecialCursorManager.getActive()  // Returns: 'image'|'text'|'icon'|null
```

Gets the currently active special cursor type.

**Returns:** `string | null`

---

### Pure Effect Functions (Internal)

**Location:** Lines ~714-768

Pure functions for effect calculations, extracted from `render()` in v5.6 Phase 4. These functions have no side effects and are deterministic.

#### calcPulseScale(time, amplitude)

**Line:** ~714

```javascript
calcPulseScale(time, amplitude)  // Returns: number (1 ± amplitude)
```

Calculates the pulse scale multiplier using sine wave.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| time | number | Animation time counter |
| amplitude | number | Pulse amplitude (0.08 for special, 0.15 for core) |

**Returns:** `number` - Scale multiplier (e.g., 0.85-1.15 for core)

**Formula:** `1 + Math.sin(time) * amplitude`

---

#### calcShakeOffset(time, amplitude)

**Line:** ~718

```javascript
calcShakeOffset(time, amplitude)  // Returns: number (pixels)
```

Calculates X-axis offset for shake effect with wave + pause phases.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| time | number | Animation time counter |
| amplitude | number | Shake amplitude (4px for core, 5px for special) |

**Returns:** `number` - Pixel offset

**Algorithm:** Wave phase for ~63% of cycle, then linear fade to 0.

---

#### calcBuzzRotation(time, amplitude)

**Line:** ~728

```javascript
calcBuzzRotation(time, amplitude)  // Returns: number (degrees)
```

Calculates rotation angle for buzz effect with wave + pause phases.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| time | number | Animation time counter |
| amplitude | number | Buzz amplitude (15° for core, 12° for special) |

**Returns:** `number` - Rotation in degrees

**Algorithm:** Same as shake but applied to rotation instead of position.

---

#### calcWobbleMatrix(wState, dx, dy)

**Line:** ~738

```javascript
calcWobbleMatrix(wState, dx, dy)  // Returns: string (CSS matrix or '')
```

Calculates wobble matrix transform using spring physics. Mutates state object in-place for 60fps performance.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| wState | object | Wobble state object (mutated in-place) |
| dx | number | Current smoothed X position |
| dy | number | Current smoothed Y position |

**State Object Shape:**

```javascript
{
    velocity: number,  // Spring velocity
    scale: number,     // Current wobble scale (0-1.2)
    angle: number,     // Movement direction angle (radians)
    prevDx: number,    // Previous X for velocity calculation
    prevDy: number     // Previous Y for velocity calculation
}
```

**Returns:** `string` - CSS matrix transform or empty string if scale < 0.001

---

#### resolveEffect(cursorEffect, globalWobble)

**Line:** ~764

```javascript
resolveEffect('default', true)   // Returns: 'wobble'
resolveEffect('pulse', true)     // Returns: 'pulse'
resolveEffect('none', false)     // Returns: ''
```

Resolves the effective effect type based on cursor and global settings.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| cursorEffect | string\|null | Effect from data attribute |
| globalWobble | boolean | Whether global wobble is enabled |

**Returns:** `string` - Resolved effect name (`'wobble'`, `'pulse'`, `'shake'`, `'buzz'`, or `''`)

**Logic:**
- `'none'` → `''` (explicitly disabled)
- `null`/`undefined`/`'default'` → `'wobble'` if global enabled, else `''`
- Other values → returned as-is

---

### Public API

#### pauseCursor()

**Line:** 184

```javascript
window.cmsmastersCursor.pause()
```

Pauses cursor render loop. Used during Elementor processing to prevent cursor drift.

**Returns:** `void`

**Side Effects:**
- Cancels pending RAF
- Sets isPaused flag

---

#### resumeCursor()

**Line:** 199

```javascript
window.cmsmastersCursor.resume()
```

Resumes cursor render loop. Teleports cursor to current mouse position (no spring animation).

**Returns:** `void`

**Side Effects:**
- Teleports all positions to current mouse position
- Resets all velocities to prevent spring momentum
- Restarts RAF loop

---

#### isPaused()

**Line:** 247

```javascript
window.cmsmastersCursor.isPaused()
```

Returns current pause state.

**Returns:** `boolean`

---

#### debug(enable)

**Line:** ~978

```javascript
window.cmsmastersCursor.debug(true)   // Enable debug mode
window.cmsmastersCursor.debug(false)  // Disable debug mode
```

Enables or disables debug mode. When enabled:
- Creates debug overlay in bottom-left corner
- Logs state dump to console
- Enables all `debugLog()` and `debugWarn()` output

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| enable | boolean | true to enable, false to disable |

**Returns:** `boolean` - Current debug mode state

**Alternative Activation Methods:**
- `window.CMSM_DEBUG = true` (legacy, auto-detected on init)
- `<body data-cursor-debug="true">` (auto-detected on init)

**Debug Overlay Shows:**
- Mode: on-light/on-dark (adaptive/fixed)
- Blend: off/soft/medium/strong
- Hover: YES/no
- Special: none/image/text/icon
- Effect: none/wobble/pulse/shake/buzz
- Wobble: ON/OFF
- Paused: YES/NO

---

### Debug Functions (Internal)

**Location:** Lines ~287-379

These functions are used internally for debug logging. Only `debugError` always logs; others require `debugMode = true`.

#### debugLog(category, message, data)

**Line:** ~287

```javascript
debugLog('mode', 'Mode changed to on-dark');
debugLog('special', 'Activated', { type: 'image', src: '...' });
```

Logs debug info when debugMode is active.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| category | string | Log category (init, mode, special, effect, event, sync) |
| message | string | Log message |
| data | any | (optional) Additional data to log |

**Returns:** `void`

---

#### debugWarn(category, message, data)

**Line:** ~303

Same as `debugLog` but uses `console.warn`.

---

#### debugError(category, message, data)

**Line:** ~319

```javascript
debugError('special', 'Failed to parse typography JSON', error);
```

Logs errors. **ALWAYS logs regardless of debugMode** — errors should never be silent.

**Returns:** `void`

---

### Internal Functions

#### setBlendIntensity(intensity)

**Line:** 251

```javascript
setBlendIntensity('medium')
```

Sets blend mode intensity by toggling body classes.

**Parameters:**

| Name | Type | Values | Description |
|------|------|--------|-------------|
| intensity | string | `''` \| `'soft'` \| `'medium'` \| `'strong'` | Blend mode intensity |

**Returns:** `void`

**Side Effects:** Toggles body classes `cmsm-cursor-blend-*`

---

#### moveCursorToPopup(el)

**Line:** 265

```javascript
moveCursorToPopup(popupElement)
```

Moves cursor container into a popup/modal element for z-index stacking.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| el | HTMLElement | Target popup container |

**Returns:** `void`

---

#### moveCursorToBody()

**Line:** 271

```javascript
moveCursorToBody()
```

Returns cursor container to body element after popup closes.

**Returns:** `void`

---

### Special Cursor Functions

#### createImageCursor(src)

**Line:** 292

```javascript
createImageCursor('path/to/image.png')
```

Creates image cursor element with specified source.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| src | string | Image URL |

**Returns:** `void`

---

#### removeImageCursor()

**Line:** 314

```javascript
removeImageCursor()
```

Removes image cursor and resets all related state.

**Returns:** `void`

---

#### showDefaultCursor()

**Line:** 332

```javascript
showDefaultCursor()
```

Shows the default dot/ring cursor (restores opacity).

**Returns:** `void`

---

#### hideDefaultCursor()

**Line:** 338

```javascript
hideDefaultCursor()
```

Hides default cursor with smooth fade (opacity 0).

**Returns:** `void`

---

#### createTextCursor(content, styles)

**Line:** 345

```javascript
createTextCursor('Click me', {
    typography: { font_family: 'Arial', font_size: 14, font_size_unit: 'px' },
    color: '#ffffff',
    bgColor: '#000000',
    fitCircle: true,
    circleSpacing: 10,
    borderRadius: '150px',
    padding: '10px'
})
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| content | string | required | Display text |
| styles.typography | object | {} | Font settings |
| styles.color | string | '#000000' | Text color |
| styles.bgColor | string | '#ffffff' | Background color |
| styles.fitCircle | boolean | false | Auto-fit in circle |
| styles.circleSpacing | number | 10 | Extra spacing for circle |
| styles.borderRadius | string | '150px' | Border radius |
| styles.padding | string | '10px' | Padding |

**Returns:** `void`

---

#### removeTextCursor()

**Line:** 440

```javascript
removeTextCursor()
```

Removes text cursor and resets state.

**Returns:** `void`

---

#### createIconCursor(content, styles)

**Line:** 452

```javascript
createIconCursor('<i class="fa fa-arrow"></i>', {
    color: '#ffffff',
    bgColor: '#000000',
    preserveColors: false,
    size: 32,
    sizeHover: 48,
    rotate: 0,
    rotateHover: 0,
    fitCircle: true,
    circleSpacing: 10
})
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| content | string | required | HTML icon markup |
| styles.color | string | '#000000' | Icon color |
| styles.bgColor | string | '#ffffff' | Background color |
| styles.preserveColors | boolean | false | Keep original icon colors |
| styles.size | number | 32 | Normal state size (px) |
| styles.sizeHover | number | 48 | Hover state size (px) |
| styles.rotate | number | 0 | Normal rotation (deg) |
| styles.rotateHover | number | 0 | Hover rotation (deg) |
| styles.fitCircle | boolean | false | Circular background |
| styles.circleSpacing | number | 10 | Extra spacing for circle |

**Returns:** `void`

---

#### removeIconCursor()

**Line:** 556

```javascript
removeIconCursor()
```

Removes icon cursor and resets state.

**Returns:** `void`

---

### Utility Functions

#### escapeCssUrl(url)

**Line:** 623

```javascript
escapeCssUrl('path/to/file (1).png')
// Returns: 'path/to/file \\(1\\).png'
```

Escapes special characters in URLs for CSS `url()` usage.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| url | string | Raw URL string |

**Returns:** `string` - Escaped URL

---

#### getLuminance(r, g, b)

**Line:** 629

```javascript
getLuminance(255, 0, 0) // Returns 0.2126 (red)
```

Calculates relative luminance of RGB values for WCAG contrast.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| r | number | Red (0-255) |
| g | number | Green (0-255) |
| b | number | Blue (0-255) |

**Returns:** `number` - Luminance value 0-1

**Formula:** `0.2126 * R + 0.7152 * G + 0.0722 * B`

---

#### applyMode(mode)

**Line:** 637

```javascript
applyMode('on-light')
```

Applies adaptive cursor mode class to body.

**Parameters:**

| Name | Type | Values | Description |
|------|------|--------|-------------|
| mode | string | `'on-light'` \| `'on-dark'` | Mode to apply |

**Returns:** `void`

---

### Detection Functions

#### isWobbleEnabled()

**Line:** 157

```javascript
isWobbleEnabled() // Returns true if global wobble enabled
```

Checks if wobble effect is globally enabled.

**Returns:** `boolean`

---

#### detectCursorMode(x, y)

**Line:** 645

```javascript
detectCursorMode(mouseX, mouseY)
```

Main detection function for cursor appearance based on position.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| x | number | Mouse X coordinate |
| y | number | Mouse Y coordinate |

**Returns:** `void`

**Detection Order:**
1. Skip cursor elements via elementsFromPoint
2. Skip popup overlay backgrounds
3. Check for HIDE cursor (data-cursor="hide")
4. P4 v2: Forms/popups auto-hide
5. P5: Video/iframe auto-hide
6. Special cursors (image/text/icon) - closest wins
7. Core cursor vs special depth comparison
8. Color override (data-cursor-color)
9. Blend mode override (data-cursor-blend)
10. Effect override (data-cursor-effect)
11. Adaptive background detection

**Internal Helpers (defined inside detectCursorMode):**

| Function | Line | Purpose |
|----------|------|---------|
| `hasCursorSettings(el)` | 701 | Check if element has any cursor attrs |
| `findWithBoundary(startEl, attrName, excludeAttrs)` | 716 | Find attr with smart cascade boundary |
| `getDepthTo(element, ancestor)` | 757 | Calculate DOM depth between elements |

---

### Animation Functions

#### render()

**Line:** 1250

```javascript
// Internal RAF loop - called automatically
function render() {
    // 1. Lerp dot position (dotL)
    // 2. Lerp ring position (L)
    // 3. Image cursor: spring physics for size/rotate
    // 4. Text cursor: position + effects
    // 5. Icon cursor: spring physics for size/rotate
    // 6. Core cursor effects (wobble/pulse/shake/buzz)
    // 7. Apply transforms
    // 8. Request next frame
}
```

Main animation loop running at 60fps.

**Key Variables:**

| Variable | Type | Description |
|----------|------|-------------|
| mx, my | number | Mouse target position |
| dx, dy | number | Dot current position (lerped) |
| rx, ry | number | Ring current position (lerped) |

---

#### resetCursorState()

**Line:** 1934

```javascript
resetCursorState()
```

Resets cursor to initial hidden state. Called on touch change, resize, visibility change.

**Returns:** `void`

---

#### handleTouchChange(e)

**Line:** 1954

```javascript
handleTouchChange(mediaQueryEvent)
```

Handles touch device detection via media query change.

**Returns:** `void`

---

#### handleResize()

**Line:** 1976

```javascript
handleResize()
```

Handles window resize with debounce (150ms).

**Returns:** `void`

---

## cursor-editor-sync.js

**Location:** `assets/js/cursor-editor-sync.js`

### Constants

| Name | Line | Value | Description |
|------|------|-------|-------------|
| PRELOAD_DURATION | 18 | `15000` | Preloader duration (15 seconds) |

---

### Public API

Exposed via `window.cmsmastersCursorEditorSync`:

| Method | Line | Description |
|--------|------|-------------|
| apply | 336 | Alias for applySettings |
| clear | 337 | Alias for clearAttributes |
| requestInit | 338 | Request initial settings from editor |
| enable | 339 | Enable cursor |
| disable | 340 | Disable cursor |
| toggle | 341 | Toggle cursor on/off |
| isEnabled | 342 | Returns cursor enabled state |
| isLoading | 343 | Returns loading state |

---

### Panel Functions

#### createPanel()

**Line:** 346

```javascript
createPanel()
```

Creates the floating toggle panel in preview iframe.

**Returns:** `void`

**HTML Structure:**
```html
<div id="cmsms-cursor-panel">
    <span class="panel-label">Custom Cursor Preview</span>
    <div class="preloader-wrap">...</div> <!-- or switch-wrap -->
</div>
```

---

#### makePanelDraggable(panel)

**Line:** 373

```javascript
makePanelDraggable(panelElement)
```

Adds drag functionality to the panel.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| panel | HTMLElement | Panel element |

**Returns:** `void`

---

### Preloader Functions

#### startPreloader()

**Line:** 411

```javascript
startPreloader()
```

Starts the 15-second preloader animation.

**Returns:** `void`

---

#### animatePreloader()

**Line:** 417

```javascript
animatePreloader()
```

RAF loop for preloader progress animation.

**Returns:** `void`

---

#### showSwitch()

**Line:** 437

```javascript
showSwitch()
```

Replaces preloader with toggle switch after completion.

**Returns:** `void`

---

### Toggle Functions

#### startLoading()

**Line:** 466

```javascript
startLoading()
```

Shows loading state on switch for 2 seconds.

**Returns:** `void`

---

#### disableCursor()

**Line:** 479

```javascript
disableCursor()
```

Disables custom cursor in editor preview.

**Returns:** `void`

---

#### enableCursor()

**Line:** 489

```javascript
enableCursor()
```

Enables custom cursor in editor preview.

**Returns:** `void`

---

#### toggleCursor()

**Line:** 499

```javascript
toggleCursor()
```

Toggles cursor on/off.

**Returns:** `void`

---

### Settings Functions

#### clearAttributes(el)

**Line:** 505

```javascript
clearAttributes(element)
```

Removes all data-cursor-* attributes from element.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| el | HTMLElement | Target element |

**Returns:** `void`

**Clears:** 26 cursor-related data attributes

---

#### getSize(v, d)

**Line:** 519

```javascript
getSize(value, defaultValue)
```

Extracts size from Elementor dimension object or raw value.

**Returns:** `number`

---

#### fmtDims(d)

**Line:** 520

```javascript
fmtDims({ top: 10, right: 15, bottom: 10, left: 15, unit: 'px' })
// Returns: '10px 15px 10px 15px'
```

Formats Elementor dimension object as CSS string.

**Returns:** `string`

---

#### applySettings(elementId, settings)

**Line:** 522

```javascript
applySettings('abc123', {
    cmsmasters_cursor_hover_style: 'hover',
    cmsmasters_cursor_color: '#ff0000'
})
```

Applies cursor settings to an element by Elementor ID.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| elementId | string | Elementor element ID |
| settings | object | Settings object from Elementor |

**Returns:** `void`

---

#### findElement(id)

**Line:** 537

```javascript
const element = findElement('abc123')
```

Finds element by Elementor ID with caching.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string | Elementor element ID |

**Returns:** `HTMLElement | null`

---

### Apply Functions

#### applyCoreSettings(el, s)

**Line:** 544

Applies core cursor settings (style, color, blend, effect).

---

#### applyImageSettings(el, s)

**Line:** 551

Applies image cursor settings.

---

#### applyTextSettings(el, s)

**Line:** 563

Applies text cursor settings with full typography support.

---

#### applyIconSettings(el, s)

**Line:** 627

Applies icon cursor settings.

---

### P2 Fix Functions

#### hasCursorAttributes(el)

**Line:** 287

Checks if element has any cursor data attributes.

---

#### syncMissingElements()

**Line:** 294

Re-syncs elements that lost cursor attributes after DOM re-render.

---

#### startSyncObserver()

**Line:** 317

Starts MutationObserver for DOM re-render detection.

---

### Communication Functions

#### requestInit()

**Line:** 650

```javascript
requestInit()
```

Sends message to parent requesting initial cursor settings.

**Message Format:**
```javascript
{
    type: 'cmsmasters:cursor:request-init'
}
```

---

### Message Handler

**Line:** 253

```javascript
window.addEventListener('message', function(e) {
    if (e.data.type === 'cmsmasters:cursor:init') { ... }
    if (e.data.type === 'cmsmasters:cursor:update') { ... }
})
```

---

## navigator-indicator.js

**Location:** `assets/js/navigator-indicator.js`

### Constants

| Name | Line | Value | Description |
|------|------|-------|-------------|
| CACHE_TTL_MS | 11 | `2000` | Container cache expiry time |
| DEBOUNCE_DELAY_MS | 12 | `300` | Debounce delay for DOM mutations |
| THROTTLE_DELAY_MS | 13 | `150` | Throttle delay for settings changes |
| INIT_DELAY_MS | 14 | `500` | Delay for initial setup |
| NAV_TOGGLE_DELAY_MS | 15 | `200` | Delay after Navigator toggle |
| LEGEND_RETRY_ATTEMPTS | 16 | `5` | Max retries for legend placement |
| LEGEND_RETRY_DELAY_MS | 17 | `300` | Delay between legend retries |
| BROADCAST_THROTTLE_MS | 784 | `200` | Throttle for broadcast per element |

---

### Public API

Exposed via `window.cmsmastersNavigatorIndicator`:

| Method | Line | Description |
|--------|------|-------------|
| update | 1289 | updateNavigatorIndicators |
| hasNonDefaultCursor | 1290 | Check if element has cursor settings |
| sendInitialCursorSettings | 1291 | Send all settings to preview |
| broadcastCursorChange | 1292 | Broadcast single element change |

---

### Utility Functions

#### throttle(fn, delay)

**Line:** 24

```javascript
throttle(myFunc, 100)
```

Creates throttled function using setTimeout.

**Returns:** `void` (calls fn after delay)

---

#### debounce(fn, delay)

**Line:** 36

```javascript
const debounced = debounce(myFunc, 100)
```

Creates debounced function.

**Returns:** `function`

---

### Typography Cache Functions

#### loadTypographyCache(callback)

**Line:** 60

```javascript
loadTypographyCache(function() {
    // Cache ready
})
```

Loads typography data from Elementor's $e.data API.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| callback | function | Called when cache ready |

**Returns:** `void`

---

#### getTypographyFromCache(typoId)

**Line:** 104

```javascript
getTypographyFromCache('primary')
// Returns { _id, typography_font_family, typography_font_size, ... }
```

Retrieves typography settings by ID from cache.

**Returns:** `object | null`

---

### Global Resolution Functions

#### resolveGlobalColor(globalRef)

**Line:** 131

```javascript
resolveGlobalColor('globals/colors?id=primary')
// Returns '#3366ff'
```

Resolves Elementor global color reference to hex value.

**Resolution Priority:**
1. elementor.documents kit (LIVE)
2. $e.data cache (CACHE)
3. elementor.config.kit_config (STATIC)
4. CSS variable from preview iframe (FALLBACK)

**Returns:** `string | null`

---

#### resolveGlobalTypography(globalRef)

**Line:** 220

```javascript
resolveGlobalTypography('globals/typography?id=heading')
// Returns { _id, typography_font_family, ... }
```

Resolves Elementor global typography reference.

**Resolution Priority:**
1. Typography cache (BEST)
2. elementor.documents kit (LIVE)
3. elementor.config.kit_config (STATIC)

**Returns:** `object | null`

---

#### resolveGlobalColors(settings)

**Line:** 278

```javascript
resolveGlobalColors(widgetSettings)
```

Resolves ALL global colors AND typography in settings object.

**Resolves:**
- cmsmasters_cursor_color
- cmsmasters_cursor_icon_color
- cmsmasters_cursor_icon_bg_color
- cmsmasters_cursor_text_color
- cmsmasters_cursor_text_bg_color
- cmsmasters_cursor_text_typography_typography (global font ref)

**Returns:** `object` - Settings with resolved values

---

### Detection Functions

#### hasNonDefaultCursor(settings)

**Line:** 343

```javascript
hasNonDefaultCursor(widgetSettings)
// Returns { type: 'special', subtype: 'image' }
```

Checks if element has non-default cursor settings.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| settings | object | Backbone model settings |

**Returns:** `object | null`
- `{ type: 'special', subtype: 'image'|'text'|'icon' }` - Special cursor
- `{ type: 'hidden' }` - Hidden cursor
- `{ type: 'show' }` - Show cursor (when addon disabled)
- `{ type: 'core', details: {...} }` - Core settings modified
- `null` - No cursor settings

---

#### getTooltip(cursorInfo, settings)

**Line:** 418

```javascript
getTooltip(cursorInfo, settings)
// Returns 'Special Cursor: Image'
```

Generates tooltip text for cursor indicator.

**Returns:** `string`

---

### Container Cache Functions

#### buildContainerCache()

**Line:** 476

```javascript
buildContainerCache()
```

Builds CID to Container cache from current document.

**Returns:** `object` - Cache map

---

#### getContainerFromNavElement(navEl)

**Line:** 543

```javascript
getContainerFromNavElement(navigatorElement)
```

Gets Elementor container from Navigator DOM element.

**Returns:** `object | null` - Container object

---

### Navigator Functions

#### updateNavigatorIndicators()

**Line:** 571

```javascript
updateNavigatorIndicators()
```

Updates all cursor indicators in Navigator panel.

**Returns:** `void`

**Called:** On settings change, Navigator expand, DOM mutations

---

#### addLegend()

**Line:** 650

```javascript
addLegend()
```

Adds cursor legend bar to Navigator panel footer.

**Returns:** `void`

---

#### updateLegendVisibility(hasIndicators)

**Line:** 718

```javascript
updateLegendVisibility(true)
```

Shows/hides legend based on indicator presence.

**Returns:** `void`

---

#### initNavigatorObserver()

**Line:** 734

```javascript
initNavigatorObserver()
```

Sets up MutationObserver for Navigator panel changes.

**Returns:** `void`

---

#### tryAddLegend(retries)

**Line:** 1128

```javascript
tryAddLegend(5)
```

Adds legend with retry logic.

**Returns:** `void`

---

### Broadcast Functions

#### broadcastCursorChange(view)

**Line:** 793

```javascript
broadcastCursorChange(elementorView)
```

Sends cursor update to preview iframe with throttling.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| view | object | Elementor editor view with container |

**Message Format:**
```javascript
{
    type: 'cmsmasters:cursor:update',
    elementId: 'abc123',
    settings: { ... }
}
```

---

#### broadcastChildrenCursorSettings(container, previewIframe)

**Line:** 841

```javascript
broadcastChildrenCursorSettings(container, iframe)
```

Broadcasts cursor settings for all children recursively (P2 fix).

---

#### broadcastSingleElement(container, previewIframe)

**Line:** 875

```javascript
broadcastSingleElement(container, iframe)
```

Sends cursor settings for single element (no throttle).

---

#### sendInitialCursorSettings()

**Line:** 904

```javascript
sendInitialCursorSettings()
```

Sends all cursor settings to preview on init.

**Message Format:**
```javascript
{
    type: 'cmsmasters:cursor:init',
    elements: [
        { id: 'abc', settings: {...} },
        { id: 'def', settings: {...} }
    ]
}
```

---

#### sendInitialCursorSettingsWithRetry(retries, delay)

**Line:** 1162

```javascript
sendInitialCursorSettingsWithRetry(5, 500)
```

Sends initial settings with retry for children loading.

---

### Listener Functions

#### initPreviewMessageListener()

**Line:** 986

```javascript
initPreviewMessageListener()
```

Listens for messages from preview iframe.

**Handles:**
- `cmsmasters:cursor:request-init` - Resend all settings

---

#### watchSelectedElementModel()

**Line:** 1006

```javascript
watchSelectedElementModel()
```

Watches currently selected element's settings model for __globals__ changes.

**Called:** Every 300ms via setInterval

---

#### onSettingsModelChange(model, options)

**Line:** 1029

```javascript
onSettingsModelChange(backboneModel, options)
```

Handler for Backbone model change events.

---

#### initSettingsListener()

**Line:** 1065

```javascript
initSettingsListener()
```

Initializes all settings change listeners:
- Model watcher interval (300ms)
- elementor.channels.editor 'change'
- $e.hooks 'document/elements/settings'
- elementor.channels.data 'element:after:add/remove'
- elementor.channels.editor 'history:undo/redo'

---

### Init

#### init()

**Line:** 1243

```javascript
init()
```

Main initialization function.

**Returns:** `void`

**Called:** On `elementor.preview:loaded` event

---

## Event Reference

### custom-cursor.js Events

| Event | Handler | Action |
|-------|---------|--------|
| mousemove | inline (1754) | Update target position, throttled detection |
| scroll | inline (1777) | Re-detect background |
| mousedown | inline (1786) | Add down state class |
| mouseup | inline (1789) | Remove down state class |
| mouseover | inline (1793) | Set hover/hidden states |
| mouseout | inline (1858) | Reset hover states |
| mouseleave | inline (1924) | Add hidden class |
| mouseenter | inline (1927) | Remove hidden class |
| resize | handleResize (1986) | Reset cursor (debounced) |
| visibilitychange | inline (1990) | Reset cursor on visible |
| touchMQ change | handleTouchChange (1967) | Show/hide on device change |

### postMessage Events

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `cmsmasters:cursor:init` | Editor -> Preview | Send all settings |
| `cmsmasters:cursor:update` | Editor -> Preview | Send single update |
| `cmsmasters:cursor:request-init` | Preview -> Editor | Request resend |

---

## See Also

- [DEPENDENCY-MAP.md](../maps/DEPENDENCY-MAP.md) - Function call graphs
- [EVENT-FLOW.md](../maps/EVENT-FLOW.md) - Event handling
- [DATA-ATTRIBUTES.md](DATA-ATTRIBUTES.md) - Data attribute reference
- [EDITOR-SYNC.md](../maps/EDITOR-SYNC.md) - Editor communication

---

*Last Updated: February 6, 2026 | Version: 5.6*
