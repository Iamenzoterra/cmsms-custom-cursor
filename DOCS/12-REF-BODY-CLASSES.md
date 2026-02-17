# Custom Cursor v5.6 - Body Classes Reference

**Last Updated:** February 6, 2026

---

## Overview

Custom Cursor uses body classes to control cursor state and appearance. Classes are added by PHP on page load and toggled by JavaScript during runtime.

### CursorState (v5.6)

**As of v5.6, all runtime body class changes go through the `CursorState` state machine.**

Direct `classList.add/remove` calls have been replaced with `CursorState.transition()` for:
- Centralized state management
- Automatic handling of mutually exclusive groups (mode, size, blend)
- Debug traceability via optional `source` parameter

```javascript
// OLD (pre-v5.6): Direct classList manipulation
body.classList.add('cmsmasters-cursor-hover');
body.classList.remove('cmsmasters-cursor-on-light');
body.classList.add('cmsmasters-cursor-on-dark');

// NEW (v5.6): CursorState.transition()
CursorState.transition({ hover: true, mode: 'on-dark' }, 'mouseover');
```

**See:** [05-API-JAVASCRIPT.md](./05-API-JAVASCRIPT.md) for full CursorState API documentation.

---

## State Machine Diagram

```
                            CURSOR DISABLED
                        (no classes on body)
                                 |
                                 | Enable cursor (PHP)
                                 v
+-----------------------------------------------------------------------+
|                                                                       |
|                          CURSOR ENABLED                               |
|                     cmsmasters-cursor-enabled                               |
|                             |                                         |
|             +---------------+----------------+                        |
|             |               |                |                        |
|             v               v                v                        |
|  +-----------------+ +-------------+ +------------------+             |
|  | THEME (PHP+JS)  | | BLEND (PHP) | | EFFECT (PHP)     |             |
|  |                 | |             | |                  |             |
|  | theme-classic   | | blend       | | wobble           |             |
|  | theme-dot       | | blend-soft  | |                  |             |
|  |                 | | blend-medium| +------------------+             |
|  | MODE (PHP)      | | blend-strong|                                  |
|  | dual            | +-------------+                                  |
|  +-----------------+                                                  |
|             |                                                         |
|             |  Interaction Events (JS)                                |
|             |                                                         |
|  +----------+----------+----------+----------+----------+             |
|  |          |          |          |          |          |             |
|  v          v          v          v          v          v             |
| +------+ +------+ +------+ +--------+ +--------+ +--------+           |
| |hover | |down  | |text  | |hidden  | |on-light| |on-dark |           |
| +------+ +------+ +------+ +--------+ +--------+ +--------+           |
|                                                                       |
|  Size Modifiers: size-sm, size-lg                                     |
+-----------------------------------------------------------------------+
```

---

## PHP Classes (Page Load)

These classes are added by PHP in `frontend.php` via the `body_class` filter.

### cmsmasters-cursor-enabled

**Required for cursor to work.** The JS script checks for this class before initializing.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1949` | `should_enable_custom_cursor()` returns true |

```php
// frontend.php add_cursor_body_class()
if ( $this->should_enable_custom_cursor() ) {
    $classes[] = 'cmsmasters-cursor-enabled';
}
```

**CSS Effect:**
```css
.cmsmasters-cursor-enabled .cmsmasters-cursor {
    opacity: 1;
}

.cmsmasters-cursor-enabled,
.cmsmasters-cursor-enabled * {
    cursor: none !important;
}
```

---

### cmsmasters-cursor-theme-{theme}

Theme classes control which cursor elements are visible.

| Class | Description |
|-------|-------------|
| `cmsmasters-cursor-theme-classic` | Ring + Dot cursor (default) |
| `cmsmasters-cursor-theme-dot` | Dot only cursor |

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1955` | Based on `elementor_custom_cursor_theme` option |
| JS | `custom-cursor.js:75` | Fallback/override from `window.cmsmCursorTheme` |

```php
// PHP adds theme class
$cursor_theme = get_option( 'elementor_custom_cursor_theme', 'classic' );
$classes[] = 'cmsmasters-cursor-theme-' . sanitize_html_class( $cursor_theme );
```

```javascript
// JS also sets theme (for dynamic override)
var theme = window.cmsmCursorTheme || 'classic';
body.classList.add('cmsmasters-cursor-theme-' + theme);
```

**CSS Effect:**
```css
body.cmsmasters-cursor-theme-dot .cmsmasters-cursor-ring {
    display: none !important;
}

body.cmsmasters-cursor-theme-dot {
    --cmsmasters-cursor-dot-size: 10px;
    --cmsmasters-cursor-dot-hover-size: 20px;
}
```

---

### cmsmasters-cursor-dual

Shows system cursor alongside custom cursor. Useful for accessibility.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1963` | `elementor_custom_cursor_dual_mode` = 'yes' |

```php
$dual_mode = get_option( 'elementor_custom_cursor_dual_mode', '' );
if ( 'yes' === $dual_mode ) {
    $classes[] = 'cmsmasters-cursor-dual';
}
```

**CSS Effect:**
```css
.cmsmasters-cursor-enabled.cmsmasters-cursor-dual,
.cmsmasters-cursor-enabled.cmsmasters-cursor-dual * {
    cursor: default !important;
}
```

---

### cmsmasters-cursor-blend / cmsmasters-cursor-blend-{intensity}

Enables blend mode effect on cursor for contrast against backgrounds.

| Class | Mix-Blend-Mode | Effect |
|-------|----------------|--------|
| `cmsmasters-cursor-blend-soft` | exclusion | Subtle inversion |
| `cmsmasters-cursor-blend-medium` | difference | Standard inversion |
| `cmsmasters-cursor-blend-strong` | difference + contrast(1.5) | High contrast |

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1971-1974` | `elementor_custom_cursor_blend_mode` option |
| JS | `custom-cursor.js:253-258` | Dynamic blend changes via `setBlendIntensity()` |

```php
$blend_mode = get_option( 'elementor_custom_cursor_blend_mode', '' );
if ( $blend_mode ) {
    if ( 'yes' === $blend_mode ) {
        $blend_mode = 'medium';  // Legacy support
    }
    if ( in_array( $blend_mode, array( 'soft', 'medium', 'strong' ), true ) ) {
        $classes[] = 'cmsmasters-cursor-blend';
        $classes[] = 'cmsmasters-cursor-blend-' . $blend_mode;
    }
}
```

**CSS Effect:**
```css
body.cmsmasters-cursor-blend-soft,
body.cmsmasters-cursor-blend-medium,
body.cmsmasters-cursor-blend-strong {
    isolation: isolate;
}

body.cmsmasters-cursor-blend-medium #cmsmasters-cursor-container {
    mix-blend-mode: difference;
}
```

---

### cmsmasters-cursor-wobble

Enables directional stretch effect based on cursor velocity.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1980-1981` | `elementor_custom_cursor_wobble` = 'yes' |

```php
$wobble = get_option( 'elementor_custom_cursor_wobble', '' );
if ( 'yes' === $wobble ) {
    $classes[] = 'cmsmasters-cursor-wobble';
}
```

**Note:** Wobble uses JS matrix transforms for deformation. The class is used for targeting and as a feature flag.

---

## JavaScript Classes (Runtime)

These classes are added/removed by JavaScript during user interaction.

**v5.6 Note:** All runtime class changes now go through `CursorState.transition()` instead of direct `classList` manipulation. The line numbers below refer to where the transition is triggered, not direct classList calls.

### cmsmasters-cursor-hover

Added when hovering over interactive elements.

| Added | Removed |
|-------|---------|
| `mouseover` on hover selector | `mouseout` via `CursorState.resetHover()` |

**Hover selectors** (`hoverSel`):
- `a`
- `button`
- `input[type="submit"]`
- `input[type="button"]`
- `[role="button"]`
- `.elementor-button`
- `select`
- `[data-cursor]`

```javascript
// custom-cursor.js - via CursorState (v5.6)
CursorState.transition({ hover: true }, 'mouseover');
```

**CSS Effect:**
```css
body.cmsmasters-cursor-hover .cmsmasters-cursor-ring {
    /* hover ring = dot-hover-size + 20px (e.g. 40px + 20px = 60px) */
    --_ring-hover: calc(var(--cmsmasters-cursor-dot-hover-size) + 20px);
    width: var(--_ring-hover);
    height: var(--_ring-hover);
    margin-left: calc(var(--_ring-hover) / -2);
    margin-top: calc(var(--_ring-hover) / -2);
    opacity: 0.5;
    background-color: color-mix(in srgb, var(--cmsmasters-cursor-color) 10%, transparent);
}
```

---

### cmsmasters-cursor-down

Added during mouse button press.

| Added | Removed |
|-------|---------|
| `mousedown` | `mouseup` |

```javascript
// custom-cursor.js - via CursorState (v5.6)
// mousedown
CursorState.transition({ down: true }, 'mousedown');
// mouseup
CursorState.transition({ down: false }, 'mouseup');
```

**CSS Effect:**
```css
body.cmsmasters-cursor-down .cmsmasters-cursor-ring {
    /* down ring = dot-size + ring-offset * 0.7 (e.g. 8px + 22.4px ≈ 30px) */
    --_ring-down: calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset) * 0.7);
    width: var(--_ring-down);
    height: var(--_ring-down);
    margin-left: calc(var(--_ring-down) / -2);
    margin-top: calc(var(--_ring-down) / -2);
    background-color: color-mix(in srgb, var(--cmsmasters-cursor-color) 90%, transparent);
}

body.cmsmasters-cursor-down .cmsmasters-cursor-dot {
    opacity: 0.5;
}
```

---

### cmsmasters-cursor-text

Added when hovering elements with `data-cursor="text"`.

| Added | Removed |
|-------|---------|
| `mouseover` on `[data-cursor="text"]` | `mouseout` |

```javascript
// custom-cursor.js - via CursorState (v5.6)
if (type === 'text') {
    CursorState.transition({ text: true }, 'mouseover');
}
```

**CSS Effect:**
```css
body.cmsmasters-cursor-text .cmsmasters-cursor-ring {
    width: 4px;
    height: 24px;
    border-radius: 2px;
    margin-left: -2px;
    margin-top: -12px;
    background-color: var(--cmsmasters-cursor-color);
    border: none;
    opacity: 1;
}

body.cmsmasters-cursor-text .cmsmasters-cursor-dot {
    opacity: 0;
}
```

---

### cmsmasters-cursor-hidden

Hides the custom cursor and shows system cursor.

| Added | Removed |
|-------|---------|
| Multiple triggers (see below) | `mouseout` to safe element, `mouseenter` on document |

**Triggers:**
1. `data-cursor="hide"` or `data-cursor="none"` on element or ancestor
2. Popups/modals: `.elementor-popup-modal`, `[role="dialog"]`, `[aria-modal="true"]` — ALL elements inside (including buttons)
3. `<select>` elements
4. `<textarea>` elements
5. `<input>` elements (except type="submit" and type="button")
6. `[role="listbox"]`
7. `[role="combobox"]`
8. Datepicker widgets (`.air-datepicker`, `.flatpickr-calendar`, etc.)
9. `<video>` elements
10. `<iframe>` elements
11. Mouse leaves document (`mouseleave` on `documentElement`)

**Note:** As of February 11, 2026, popup/modal detection occurs BEFORE button exclusion in `isFormZone()`, so ALL elements inside popups/dialogs hide the custom cursor (graceful degradation to system cursor).

```javascript
// custom-cursor.js - via CursorState (v5.6)
if (hideEl) {
    CursorState.transition({ hidden: true }, 'hide-element');
}
if (isFormZone(t)) {
    CursorState.transition({ hidden: true }, 'form-element');
}
// mouseleave
CursorState.transition({ hidden: true }, 'mouseleave');
```

**CSS Effect:**
```css
body.cmsmasters-cursor-hidden .cmsmasters-cursor {
    opacity: 0 !important;
}

/* System cursor fallback (added Feb 2026) */
body.cmsmasters-cursor-hidden,
body.cmsmasters-cursor-hidden * {
    cursor: default !important;
}
```

**CSS Fallback:** The `cursor:default!important` rule ensures system cursor is visible when custom cursor hides. Specificity (0,1,2) beats `.cmsmasters-cursor-enabled *` (0,1,1). This works in BOTH dual and solo modes, fixing the previous issue where solo mode users had no visible cursor in form zones.

---

### cmsmasters-cursor-on-light / cmsmasters-cursor-on-dark

Added by adaptive mode based on background luminance.

| Class | Condition |
|-------|-----------|
| `cmsmasters-cursor-on-light` | Background luminance > 0.5 |
| `cmsmasters-cursor-on-dark` | Background luminance <= 0.5 |

| Added | Removed |
|-------|---------|
| `detectCursorMode()` on mousemove/scroll | Replaced by opposite class |

```javascript
// custom-cursor.js - via CursorState (v5.6)
// Mode is mutually exclusive - CursorState handles removing old class
CursorState.transition({ mode: 'on-light' }, 'detectCursorMode');
// or
CursorState.transition({ mode: 'on-dark' }, 'detectCursorMode');
```

**CSS Effect:**
```css
body.cmsmasters-cursor-on-dark {
    --cmsmasters-cursor-color: var(--cmsmasters-cursor-color-light) !important;
}

body.cmsmasters-cursor-on-light {
    --cmsmasters-cursor-color: var(--cmsmasters-cursor-color-dark) !important;
}
```

---

### cmsmasters-cursor-size-{size}

Size modifier classes for cursor ring.

| Class | Ring Size |
|-------|-----------|
| `cmsmasters-cursor-size-sm` | 20px |
| `cmsmasters-cursor-size-lg` | 80px |

**Note:** `cmsmasters-cursor-size-md` is tracked in JS but not defined in CSS (uses default 40px).

| Added | Removed |
|-------|---------|
| `mouseover` with `data-cursor-size` attribute | `mouseout` (via resetCls) |

```javascript
// custom-cursor.js - via CursorState (v5.6)
// Size is mutually exclusive - CursorState handles removing old class
if (size) CursorState.transition({ size: size }, 'mouseover');
```

**CSS Effect:**
```css
body.cmsmasters-cursor-size-sm .cmsmasters-cursor-ring {
    width: 20px;
    height: 20px;
    margin-left: -10px;
    margin-top: -10px;
}

body.cmsmasters-cursor-size-lg .cmsmasters-cursor-ring {
    width: 80px;
    height: 80px;
    margin-left: -40px;
    margin-top: -40px;
}
```

---

## Special Cursor Element Classes

These classes are added to special cursor elements (image/text/icon), not body.

### cmsmasters-cursor-image-{effect}

Effect animation class on image cursor element.

| Class | Effect |
|-------|--------|
| `cmsmasters-cursor-image-wobble` | Directional stretch |
| `cmsmasters-cursor-image-pulse` | Scale pulsing |
| `cmsmasters-cursor-image-shake` | Random position shake |
| `cmsmasters-cursor-image-buzz` | Vibration effect |

```javascript
// custom-cursor.js:855
imageCursorEl.classList.add('cmsmasters-cursor-image-' + effectiveEffect);
```

---

### cmsmasters-cursor-text-{effect}

Effect animation class on text cursor element.

| Class | Effect |
|-------|--------|
| `cmsmasters-cursor-text-wobble` | Directional stretch |
| `cmsmasters-cursor-text-pulse` | Scale pulsing |
| `cmsmasters-cursor-text-shake` | Random position shake |
| `cmsmasters-cursor-text-buzz` | Vibration effect |

```javascript
// custom-cursor.js:939
textCursorEl.classList.add('cmsmasters-cursor-text-' + effectiveEffect);
```

---

### cmsmasters-cursor-icon-{effect}

Effect animation class on icon cursor element.

| Class | Effect |
|-------|--------|
| `cmsmasters-cursor-icon-wobble` | Directional stretch |
| `cmsmasters-cursor-icon-pulse` | Scale pulsing |
| `cmsmasters-cursor-icon-shake` | Random position shake |
| `cmsmasters-cursor-icon-buzz` | Vibration effect |

```javascript
// custom-cursor.js:1018
iconCursorEl.classList.add('cmsmasters-cursor-icon-' + effectiveEffect);
```

---

### cmsmasters-cursor-icon-preserve

Prevents icon from resetting when hovering clickable elements inside icon zone.

```javascript
// custom-cursor.js:472,475
iconCursorEl.classList.remove('cmsmasters-cursor-icon-preserve');
iconCursorEl.classList.add('cmsmasters-cursor-icon-preserve');
```

---

## Class Combinations

### Common State Combinations

```html
<!-- Default enabled state (classic theme) -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic">

<!-- Dot theme -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-dot">

<!-- Classic theme with dual mode (system cursor visible) -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-dual">

<!-- Hovering interactive element -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-hover">

<!-- Clicking (mousedown) -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-hover cmsmasters-cursor-down">

<!-- Over form element (hidden state) -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-hidden">

<!-- With wobble effect and blend mode -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-dot cmsmasters-cursor-wobble cmsmasters-cursor-blend cmsmasters-cursor-blend-medium">

<!-- Adaptive mode on light background -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-on-light">

<!-- Adaptive mode on dark background -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-on-dark">

<!-- Hover with size modifier -->
<body class="cmsmasters-cursor-enabled cmsmasters-cursor-theme-classic cmsmasters-cursor-hover cmsmasters-cursor-size-lg">
```

---

## Complete Class Reference Table

| Class | Source | Trigger | Purpose |
|-------|--------|---------|---------|
| `cmsmasters-cursor-enabled` | PHP | Option enabled | Enable custom cursor |
| `cmsmasters-cursor-theme-classic` | PHP+JS | Option/config | Classic ring+dot style |
| `cmsmasters-cursor-theme-dot` | PHP+JS | Option/config | Dot-only style |
| `cmsmasters-cursor-dual` | PHP | Option | Show system cursor too |
| `cmsmasters-cursor-blend` | PHP+JS | Option | Enable blend mode |
| `cmsmasters-cursor-blend-soft` | PHP+JS | Option | Soft blend (exclusion) |
| `cmsmasters-cursor-blend-medium` | PHP+JS | Option | Medium blend (difference) |
| `cmsmasters-cursor-blend-strong` | PHP+JS | Option | Strong blend (contrast) |
| `cmsmasters-cursor-wobble` | PHP | Option | Enable wobble effect |
| `cmsmasters-cursor-hover` | JS | mouseover interactive | Hover state |
| `cmsmasters-cursor-down` | JS | mousedown | Click/press state |
| `cmsmasters-cursor-text` | JS | data-cursor="text" | Text input cursor |
| `cmsmasters-cursor-hidden` | JS | form/video/iframe/hide | Hide cursor |
| `cmsmasters-cursor-on-light` | JS | adaptive detection | Light background mode |
| `cmsmasters-cursor-on-dark` | JS | adaptive detection | Dark background mode |
| `cmsmasters-cursor-size-sm` | JS | data-cursor-size="sm" | Small ring (20px) |
| `cmsmasters-cursor-size-lg` | JS | data-cursor-size="lg" | Large ring (80px) |

### Element Classes (not on body)

| Class | Element | Purpose |
|-------|---------|---------|
| `cmsmasters-cursor-image-wobble` | `.cmsmasters-cursor-image` | Wobble effect |
| `cmsmasters-cursor-image-pulse` | `.cmsmasters-cursor-image` | Pulse effect |
| `cmsmasters-cursor-image-shake` | `.cmsmasters-cursor-image` | Shake effect |
| `cmsmasters-cursor-image-buzz` | `.cmsmasters-cursor-image` | Buzz effect |
| `cmsmasters-cursor-text-wobble` | `.cmsmasters-cursor-text-el` | Wobble effect |
| `cmsmasters-cursor-text-pulse` | `.cmsmasters-cursor-text-el` | Pulse effect |
| `cmsmasters-cursor-text-shake` | `.cmsmasters-cursor-text-el` | Shake effect |
| `cmsmasters-cursor-text-buzz` | `.cmsmasters-cursor-text-el` | Buzz effect |
| `cmsmasters-cursor-icon-wobble` | `.cmsmasters-cursor-icon-el` | Wobble effect |
| `cmsmasters-cursor-icon-pulse` | `.cmsmasters-cursor-icon-el` | Pulse effect |
| `cmsmasters-cursor-icon-shake` | `.cmsmasters-cursor-icon-el` | Shake effect |
| `cmsmasters-cursor-icon-buzz` | `.cmsmasters-cursor-icon-el` | Buzz effect |
| `cmsmasters-cursor-icon-preserve` | `.cmsmasters-cursor-icon-el` | Preserve on hover |

---

## Reset Classes

**v5.6:** Classes are now reset via `CursorState.resetHover()` on `mouseout`:

```javascript
// CursorState.resetHover() resets:
CursorState.transition({
    hover: false,
    text: false,
    hidden: false,
    size: null       // Removes any size class
}, 'resetHover');

// Does NOT reset:
// - mode (on-light/on-dark stays)
// - blend (blend intensity stays)
// - down (mouse button state stays until mouseup)
```

---

## See Also

- [CSS-API.md](../api/CSS-API.md) - CSS class definitions and variables
- [SETTINGS.md](SETTINGS.md) - WordPress options reference
- [JAVASCRIPT-API.md](../api/JAVASCRIPT-API.md) - JS API functions

---

*Last Updated: February 17, 2026 | Version: 5.6*
