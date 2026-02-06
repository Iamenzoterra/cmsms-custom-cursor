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
body.classList.add('cmsm-cursor-hover');
body.classList.remove('cmsm-cursor-on-light');
body.classList.add('cmsm-cursor-on-dark');

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
|                     cmsm-cursor-enabled                               |
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

### cmsm-cursor-enabled

**Required for cursor to work.** The JS script checks for this class before initializing.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1949` | `should_enable_custom_cursor()` returns true |

```php
// frontend.php add_cursor_body_class()
if ( $this->should_enable_custom_cursor() ) {
    $classes[] = 'cmsm-cursor-enabled';
}
```

**CSS Effect:**
```css
.cmsm-cursor-enabled .cmsm-cursor {
    opacity: 1;
}

.cmsm-cursor-enabled,
.cmsm-cursor-enabled * {
    cursor: none !important;
}
```

---

### cmsm-cursor-theme-{theme}

Theme classes control which cursor elements are visible.

| Class | Description |
|-------|-------------|
| `cmsm-cursor-theme-classic` | Ring + Dot cursor (default) |
| `cmsm-cursor-theme-dot` | Dot only cursor |

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1955` | Based on `elementor_custom_cursor_theme` option |
| JS | `custom-cursor.js:75` | Fallback/override from `window.cmsmCursorTheme` |

```php
// PHP adds theme class
$cursor_theme = get_option( 'elementor_custom_cursor_theme', 'classic' );
$classes[] = 'cmsm-cursor-theme-' . sanitize_html_class( $cursor_theme );
```

```javascript
// JS also sets theme (for dynamic override)
var theme = window.cmsmCursorTheme || 'classic';
body.classList.add('cmsm-cursor-theme-' + theme);
```

**CSS Effect:**
```css
body.cmsm-cursor-theme-dot .cmsm-cursor-ring {
    display: none !important;
}

body.cmsm-cursor-theme-dot {
    --cmsm-cursor-dot-size: 10px;
    --cmsm-cursor-dot-hover-size: 20px;
}
```

---

### cmsm-cursor-dual

Shows system cursor alongside custom cursor. Useful for accessibility.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1963` | `elementor_custom_cursor_dual_mode` = 'yes' |

```php
$dual_mode = get_option( 'elementor_custom_cursor_dual_mode', '' );
if ( 'yes' === $dual_mode ) {
    $classes[] = 'cmsm-cursor-dual';
}
```

**CSS Effect:**
```css
.cmsm-cursor-enabled.cmsm-cursor-dual,
.cmsm-cursor-enabled.cmsm-cursor-dual * {
    cursor: default !important;
}
```

---

### cmsm-cursor-blend / cmsm-cursor-blend-{intensity}

Enables blend mode effect on cursor for contrast against backgrounds.

| Class | Mix-Blend-Mode | Effect |
|-------|----------------|--------|
| `cmsm-cursor-blend-soft` | exclusion | Subtle inversion |
| `cmsm-cursor-blend-medium` | difference | Standard inversion |
| `cmsm-cursor-blend-strong` | difference + contrast(1.5) | High contrast |

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
        $classes[] = 'cmsm-cursor-blend';
        $classes[] = 'cmsm-cursor-blend-' . $blend_mode;
    }
}
```

**CSS Effect:**
```css
body.cmsm-cursor-blend-soft,
body.cmsm-cursor-blend-medium,
body.cmsm-cursor-blend-strong {
    isolation: isolate;
}

body.cmsm-cursor-blend-medium #cmsm-cursor-container {
    mix-blend-mode: difference;
}
```

---

### cmsm-cursor-wobble

Enables directional stretch effect based on cursor velocity.

| Source | Location | Condition |
|--------|----------|-----------|
| PHP | `frontend.php:1980-1981` | `elementor_custom_cursor_wobble` = 'yes' |

```php
$wobble = get_option( 'elementor_custom_cursor_wobble', '' );
if ( 'yes' === $wobble ) {
    $classes[] = 'cmsm-cursor-wobble';
}
```

**Note:** Wobble uses JS matrix transforms for deformation. The class is used for targeting and as a feature flag.

---

## JavaScript Classes (Runtime)

These classes are added/removed by JavaScript during user interaction.

**v5.6 Note:** All runtime class changes now go through `CursorState.transition()` instead of direct `classList` manipulation. The line numbers below refer to where the transition is triggered, not direct classList calls.

### cmsm-cursor-hover

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
body.cmsm-cursor-hover .cmsm-cursor-ring {
    width: 60px;
    height: 60px;
    margin-left: -30px;
    margin-top: -30px;
    opacity: 0.5;
    background-color: color-mix(in srgb, var(--cmsm-cursor-color) 10%, transparent);
}
```

---

### cmsm-cursor-down

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
body.cmsm-cursor-down .cmsm-cursor-ring {
    width: 30px;
    height: 30px;
    margin-left: -15px;
    margin-top: -15px;
    background-color: color-mix(in srgb, var(--cmsm-cursor-color) 90%, transparent);
}

body.cmsm-cursor-down .cmsm-cursor-dot {
    opacity: 0.5;
}
```

---

### cmsm-cursor-text

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
body.cmsm-cursor-text .cmsm-cursor-ring {
    width: 4px;
    height: 24px;
    border-radius: 2px;
    margin-left: -2px;
    margin-top: -12px;
    background-color: var(--cmsm-cursor-color);
    border: none;
    opacity: 1;
}

body.cmsm-cursor-text .cmsm-cursor-dot {
    opacity: 0;
}
```

---

### cmsm-cursor-hidden

Hides the custom cursor and shows system cursor.

| Added | Removed |
|-------|---------|
| Multiple triggers (see below) | `mouseout` to safe element, `mouseenter` on document |

**Triggers:**
1. `data-cursor="hide"` or `data-cursor="none"` on element or ancestor
2. `<select>` elements
3. `<input>` elements (except type="submit" and type="button")
4. `[role="listbox"]`
5. `[role="combobox"]`
6. `[role="menu"]`
7. `[role="dialog"]`
8. `[aria-modal="true"]`
9. `<video>` elements
10. `<iframe>` elements
11. Mouse leaves document (`mouseleave` on `documentElement`)

```javascript
// custom-cursor.js - via CursorState (v5.6)
if (hideEl) {
    CursorState.transition({ hidden: true }, 'hide-element');
}
if (t.tagName === 'SELECT' || ...) {
    CursorState.transition({ hidden: true }, 'form-element');
}
// mouseleave
CursorState.transition({ hidden: true }, 'mouseleave');
```

**CSS Effect:**
```css
body.cmsm-cursor-hidden .cmsm-cursor {
    opacity: 0 !important;
}
```

---

### cmsm-cursor-on-light / cmsm-cursor-on-dark

Added by adaptive mode based on background luminance.

| Class | Condition |
|-------|-----------|
| `cmsm-cursor-on-light` | Background luminance > 0.5 |
| `cmsm-cursor-on-dark` | Background luminance <= 0.5 |

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
body.cmsm-cursor-on-dark {
    --cmsm-cursor-color: var(--cmsm-cursor-color-light) !important;
}

body.cmsm-cursor-on-light {
    --cmsm-cursor-color: var(--cmsm-cursor-color-dark) !important;
}
```

---

### cmsm-cursor-size-{size}

Size modifier classes for cursor ring.

| Class | Ring Size |
|-------|-----------|
| `cmsm-cursor-size-sm` | 20px |
| `cmsm-cursor-size-lg` | 80px |

**Note:** `cmsm-cursor-size-md` is tracked in JS but not defined in CSS (uses default 40px).

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
body.cmsm-cursor-size-sm .cmsm-cursor-ring {
    width: 20px;
    height: 20px;
    margin-left: -10px;
    margin-top: -10px;
}

body.cmsm-cursor-size-lg .cmsm-cursor-ring {
    width: 80px;
    height: 80px;
    margin-left: -40px;
    margin-top: -40px;
}
```

---

## Special Cursor Element Classes

These classes are added to special cursor elements (image/text/icon), not body.

### cmsm-cursor-image-{effect}

Effect animation class on image cursor element.

| Class | Effect |
|-------|--------|
| `cmsm-cursor-image-wobble` | Directional stretch |
| `cmsm-cursor-image-pulse` | Scale pulsing |
| `cmsm-cursor-image-shake` | Random position shake |
| `cmsm-cursor-image-buzz` | Vibration effect |

```javascript
// custom-cursor.js:855
imageCursorEl.classList.add('cmsm-cursor-image-' + effectiveEffect);
```

---

### cmsm-cursor-text-{effect}

Effect animation class on text cursor element.

| Class | Effect |
|-------|--------|
| `cmsm-cursor-text-wobble` | Directional stretch |
| `cmsm-cursor-text-pulse` | Scale pulsing |
| `cmsm-cursor-text-shake` | Random position shake |
| `cmsm-cursor-text-buzz` | Vibration effect |

```javascript
// custom-cursor.js:939
textCursorEl.classList.add('cmsm-cursor-text-' + effectiveEffect);
```

---

### cmsm-cursor-icon-{effect}

Effect animation class on icon cursor element.

| Class | Effect |
|-------|--------|
| `cmsm-cursor-icon-wobble` | Directional stretch |
| `cmsm-cursor-icon-pulse` | Scale pulsing |
| `cmsm-cursor-icon-shake` | Random position shake |
| `cmsm-cursor-icon-buzz` | Vibration effect |

```javascript
// custom-cursor.js:1018
iconCursorEl.classList.add('cmsm-cursor-icon-' + effectiveEffect);
```

---

### cmsm-cursor-icon-preserve

Prevents icon from resetting when hovering clickable elements inside icon zone.

```javascript
// custom-cursor.js:472,475
iconCursorEl.classList.remove('cmsm-cursor-icon-preserve');
iconCursorEl.classList.add('cmsm-cursor-icon-preserve');
```

---

## Class Combinations

### Common State Combinations

```html
<!-- Default enabled state (classic theme) -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic">

<!-- Dot theme -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-dot">

<!-- Classic theme with dual mode (system cursor visible) -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-dual">

<!-- Hovering interactive element -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-hover">

<!-- Clicking (mousedown) -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-hover cmsm-cursor-down">

<!-- Over form element (hidden state) -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-hidden">

<!-- With wobble effect and blend mode -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-dot cmsm-cursor-wobble cmsm-cursor-blend cmsm-cursor-blend-medium">

<!-- Adaptive mode on light background -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-on-light">

<!-- Adaptive mode on dark background -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-on-dark">

<!-- Hover with size modifier -->
<body class="cmsm-cursor-enabled cmsm-cursor-theme-classic cmsm-cursor-hover cmsm-cursor-size-lg">
```

---

## Complete Class Reference Table

| Class | Source | Trigger | Purpose |
|-------|--------|---------|---------|
| `cmsm-cursor-enabled` | PHP | Option enabled | Enable custom cursor |
| `cmsm-cursor-theme-classic` | PHP+JS | Option/config | Classic ring+dot style |
| `cmsm-cursor-theme-dot` | PHP+JS | Option/config | Dot-only style |
| `cmsm-cursor-dual` | PHP | Option | Show system cursor too |
| `cmsm-cursor-blend` | PHP+JS | Option | Enable blend mode |
| `cmsm-cursor-blend-soft` | PHP+JS | Option | Soft blend (exclusion) |
| `cmsm-cursor-blend-medium` | PHP+JS | Option | Medium blend (difference) |
| `cmsm-cursor-blend-strong` | PHP+JS | Option | Strong blend (contrast) |
| `cmsm-cursor-wobble` | PHP | Option | Enable wobble effect |
| `cmsm-cursor-hover` | JS | mouseover interactive | Hover state |
| `cmsm-cursor-down` | JS | mousedown | Click/press state |
| `cmsm-cursor-text` | JS | data-cursor="text" | Text input cursor |
| `cmsm-cursor-hidden` | JS | form/video/iframe/hide | Hide cursor |
| `cmsm-cursor-on-light` | JS | adaptive detection | Light background mode |
| `cmsm-cursor-on-dark` | JS | adaptive detection | Dark background mode |
| `cmsm-cursor-size-sm` | JS | data-cursor-size="sm" | Small ring (20px) |
| `cmsm-cursor-size-lg` | JS | data-cursor-size="lg" | Large ring (80px) |

### Element Classes (not on body)

| Class | Element | Purpose |
|-------|---------|---------|
| `cmsm-cursor-image-wobble` | `.cmsm-cursor-image` | Wobble effect |
| `cmsm-cursor-image-pulse` | `.cmsm-cursor-image` | Pulse effect |
| `cmsm-cursor-image-shake` | `.cmsm-cursor-image` | Shake effect |
| `cmsm-cursor-image-buzz` | `.cmsm-cursor-image` | Buzz effect |
| `cmsm-cursor-text-wobble` | `.cmsm-cursor-text-el` | Wobble effect |
| `cmsm-cursor-text-pulse` | `.cmsm-cursor-text-el` | Pulse effect |
| `cmsm-cursor-text-shake` | `.cmsm-cursor-text-el` | Shake effect |
| `cmsm-cursor-text-buzz` | `.cmsm-cursor-text-el` | Buzz effect |
| `cmsm-cursor-icon-wobble` | `.cmsm-cursor-icon-el` | Wobble effect |
| `cmsm-cursor-icon-pulse` | `.cmsm-cursor-icon-el` | Pulse effect |
| `cmsm-cursor-icon-shake` | `.cmsm-cursor-icon-el` | Shake effect |
| `cmsm-cursor-icon-buzz` | `.cmsm-cursor-icon-el` | Buzz effect |
| `cmsm-cursor-icon-preserve` | `.cmsm-cursor-icon-el` | Preserve on hover |

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

*Last Updated: February 6, 2026 | Version: 5.6*
