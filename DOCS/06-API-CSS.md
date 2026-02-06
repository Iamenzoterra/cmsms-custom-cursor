# Custom Cursor v5.5 - CSS API Reference

**Last Updated:** February 5, 2026

---

## Overview

| File | Classes | Variables | Lines |
|------|---------|-----------|-------|
| custom-cursor.css | 35+ | 5 | ~341 |
| editor-navigator.css | 20+ | 8 | ~246 |

---

## CSS Variables

### Core Variables (custom-cursor.css)

| Variable | Default | Description |
|----------|---------|-------------|
| `--cmsm-cursor-color` | #222 | Main cursor color |
| `--cmsm-cursor-color-light` | #fff | Light mode color (adaptive) |
| `--cmsm-cursor-color-dark` | #222 | Dark mode color (adaptive) |
| `--cmsm-cursor-dot-size` | 8px | Dot diameter |
| `--cmsm-cursor-dot-hover-size` | 8px | Dot hover diameter (default, theme-dot uses 20px) |

### Editor Navigator Variables (editor-navigator.css)

| Variable | Default | Description |
|----------|---------|-------------|
| `--cmsm-indicator-core` | #b07cc5 | Purple indicator (dark mode) |
| `--cmsm-indicator-special` | #5dade2 | Blue indicator (dark mode) |
| `--cmsm-indicator-hidden` | #a0adb5 | Gray indicator (dark mode) |
| `--cmsm-indicator-show` | #4caf50 | Green indicator (dark mode) |
| `--cmsm-legend-border` | rgba(255, 255, 255, 0.1) | Legend border color |

### Usage

```css
/* Variables set in :root by PHP */
:root {
    --cmsm-cursor-color: #222;
    --cmsm-cursor-color-light: #fff;
    --cmsm-cursor-color-dark: #222;
    --cmsm-cursor-dot-size: 8px;
    --cmsm-cursor-dot-hover-size: 8px;
}

/* Override in custom CSS */
:root {
    --cmsm-cursor-color: #ff0000;
    --cmsm-cursor-dot-size: 10px;
}
```

---

## Container Classes

### #cmsm-cursor-container

Main container element. Z-index is maximum possible integer value.

```css
#cmsm-cursor-container {
    z-index: 2147483647;
}
```

**Note:** When blend modes are active, z-index drops to 9999:

```css
body.cmsm-cursor-blend-soft #cmsm-cursor-container,
body.cmsm-cursor-blend-medium #cmsm-cursor-container,
body.cmsm-cursor-blend-strong #cmsm-cursor-container {
    z-index: 9999;
}
```

---

### .cmsm-cursor

Cursor wrapper. Positioned fixed with off-screen initial transform.

```css
.cmsm-cursor {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform, opacity;
    opacity: 0;
    transition: opacity 0.3s ease;
    transform: translate3d(-200px, -200px, 0);
}

.cmsm-cursor-enabled .cmsm-cursor {
    opacity: 1;
}
```

---

### .cmsm-cursor-dot

Center dot element. Uses CSS variables for sizing.

```css
.cmsm-cursor-dot {
    width: var(--cmsm-cursor-dot-size);
    height: var(--cmsm-cursor-dot-size);
    background: var(--cmsm-cursor-color);
    border-radius: 50%;
    margin-left: calc(var(--cmsm-cursor-dot-size) / -2);
    margin-top: calc(var(--cmsm-cursor-dot-size) / -2);
    transition: background-color 0.15s ease-out,
                width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                height 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                margin 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
```

---

### .cmsm-cursor-ring

Outer ring element. **Hardcoded sizes** (not CSS variables).

```css
.cmsm-cursor-ring {
    width: 40px;                    /* Default size - hardcoded */
    height: 40px;
    border: 2px solid var(--cmsm-cursor-color);
    border-radius: 50%;
    margin-left: -20px;
    margin-top: -20px;
    box-sizing: border-box;
    transition: width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                height 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                margin 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                opacity 0.2s ease,
                background-color 0.2s ease,
                border-color 0.15s ease-out;
}
```

**Ring Size States:**

| State | Width/Height | Margin |
|-------|--------------|--------|
| Default | 40px | -20px |
| Hover | 60px | -30px |
| Down (click) | 30px | -15px |
| Size SM | 20px | -10px |
| Size LG | 80px | -40px |

---

## Body State Classes

### Enable/Disable

| Class | Purpose |
|-------|---------|
| `cmsm-cursor-enabled` | Enables cursor system, hides native cursor |

```css
.cmsm-cursor-enabled,
.cmsm-cursor-enabled * {
    cursor: none !important;
}

.cmsm-cursor-enabled .cmsm-cursor {
    opacity: 1;
}
```

---

### Dual Mode

| Class | Purpose |
|-------|---------|
| `cmsm-cursor-dual` | Shows native cursor alongside custom cursor |

```css
.cmsm-cursor-enabled.cmsm-cursor-dual,
.cmsm-cursor-enabled.cmsm-cursor-dual * {
    cursor: default !important;
}
```

---

### Theme Classes

| Class | Effect |
|-------|--------|
| `cmsm-cursor-theme-dot` | Dot only (ring hidden), larger hover effect |

```css
body.cmsm-cursor-theme-dot {
    --cmsm-cursor-dot-size: 10px;
    --cmsm-cursor-dot-hover-size: 20px;
}

body.cmsm-cursor-theme-dot .cmsm-cursor-ring {
    display: none !important;
}

body.cmsm-cursor-theme-dot.cmsm-cursor-hover .cmsm-cursor-dot {
    width: var(--cmsm-cursor-dot-hover-size);
    height: var(--cmsm-cursor-dot-hover-size);
    margin-left: calc(var(--cmsm-cursor-dot-hover-size) / -2);
    margin-top: calc(var(--cmsm-cursor-dot-hover-size) / -2);
}
```

---

### Interaction States

| Class | Trigger | Effect |
|-------|---------|--------|
| `cmsm-cursor-hover` | mouseover link/button | Ring expands to 60px, 50% opacity, 10% fill |
| `cmsm-cursor-down` | mousedown | Ring shrinks to 30px, 90% fill |
| `cmsm-cursor-text` | hover text input | I-beam style (4x24px bar) |
| `cmsm-cursor-hidden` | forms/video/leave | Hide cursor |

```css
body.cmsm-cursor-hover .cmsm-cursor-ring {
    width: 60px;
    height: 60px;
    margin-left: -30px;
    margin-top: -30px;
    opacity: 0.5;
    background-color: color-mix(in srgb, var(--cmsm-cursor-color) 10%, transparent);
}

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

body.cmsm-cursor-hidden .cmsm-cursor {
    opacity: 0 !important;
}
```

---

### Size Classes

| Class | Ring Size |
|-------|-----------|
| `cmsm-cursor-size-sm` | 20px |
| `cmsm-cursor-size-lg` | 80px |

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

### Adaptive Mode Classes

| Class | Effect |
|-------|--------|
| `cmsm-cursor-on-light` | Uses dark cursor color |
| `cmsm-cursor-on-dark` | Uses light cursor color |

```css
body.cmsm-cursor-on-dark {
    --cmsm-cursor-color: var(--cmsm-cursor-color-light) !important;
}

body.cmsm-cursor-on-light {
    --cmsm-cursor-color: var(--cmsm-cursor-color-dark) !important;
}
```

---

### Blend Mode Classes

| Class | Mix Blend Mode | Filter | Z-Index |
|-------|----------------|--------|---------|
| `cmsm-cursor-blend-soft` | exclusion | none | 9999 |
| `cmsm-cursor-blend-medium` | difference | none | 9999 |
| `cmsm-cursor-blend-strong` | difference | contrast(1.5) | 9999 |

```css
body.cmsm-cursor-blend-soft,
body.cmsm-cursor-blend-medium,
body.cmsm-cursor-blend-strong {
    isolation: isolate;
}

body.cmsm-cursor-blend-soft #cmsm-cursor-container {
    z-index: 9999;
    mix-blend-mode: exclusion;
}

body.cmsm-cursor-blend-medium #cmsm-cursor-container {
    z-index: 9999;
    mix-blend-mode: difference;
}

body.cmsm-cursor-blend-strong #cmsm-cursor-container {
    z-index: 9999;
    mix-blend-mode: difference;
    filter: contrast(1.5);
}
```

---

## Special Cursor Classes

### Image Cursor

| Class | Purpose |
|-------|---------|
| `.cmsm-cursor-image` | Image cursor element |
| `.cmsm-cursor-image-wobble` | Wobble effect (disables transition) |
| `.cmsm-cursor-image-pulse` | Pulse effect |
| `.cmsm-cursor-image-shake` | Shake effect |
| `.cmsm-cursor-image-buzz` | Buzz effect |

```css
.cmsm-cursor-image {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform, width;
    transition: width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                margin 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    transform: translate3d(-200px, -200px, 0);
    height: auto;
    object-fit: contain;
}

[data-cursor-image],
[data-cursor-image] * {
    cursor: none !important;
}

/* Effects disable transitions for JS animation */
.cmsm-cursor-image.cmsm-cursor-image-wobble,
.cmsm-cursor-image.cmsm-cursor-image-pulse,
.cmsm-cursor-image.cmsm-cursor-image-shake,
.cmsm-cursor-image.cmsm-cursor-image-buzz {
    transition: none;
}
```

---

### Text Cursor

| Class | Purpose |
|-------|---------|
| `.cmsm-cursor-text-el` | Text cursor element |
| `.cmsm-cursor-text-wobble` | Wobble effect |
| `.cmsm-cursor-text-pulse` | Pulse effect |
| `.cmsm-cursor-text-shake` | Shake effect |
| `.cmsm-cursor-text-buzz` | Buzz effect |

```css
.cmsm-cursor-text-el {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform;
    transition: transform 0.1s ease-out;
    transform: translate3d(-200px, -200px, 0);
    white-space: nowrap;
    display: inline-block;
    box-sizing: border-box;
}

[data-cursor-text],
[data-cursor-text] * {
    cursor: none !important;
}

.cmsm-cursor-text-el.cmsm-cursor-text-wobble,
.cmsm-cursor-text-el.cmsm-cursor-text-pulse,
.cmsm-cursor-text-el.cmsm-cursor-text-shake,
.cmsm-cursor-text-el.cmsm-cursor-text-buzz {
    transition: none;
}
```

---

### Icon Cursor

| Class | Purpose |
|-------|---------|
| `.cmsm-cursor-icon-el` | Icon cursor element |
| `.cmsm-cursor-icon-wobble` | Wobble effect |
| `.cmsm-cursor-icon-pulse` | Pulse effect |
| `.cmsm-cursor-icon-shake` | Shake effect |
| `.cmsm-cursor-icon-buzz` | Buzz effect |

```css
.cmsm-cursor-icon-el {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    transition: width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                height 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                padding 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                font-size 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    transform: translate3d(-200px, -200px, 0);
}

.cmsm-cursor-icon-el i,
.cmsm-cursor-icon-el img,
.cmsm-cursor-icon-el svg {
    display: block;
    width: 1em;
    height: 1em;
}

.cmsm-cursor-icon-el svg {
    fill: currentColor;
}

[data-cursor-icon],
[data-cursor-icon] * {
    cursor: none !important;
}

.cmsm-cursor-icon-el.cmsm-cursor-icon-wobble,
.cmsm-cursor-icon-el.cmsm-cursor-icon-pulse,
.cmsm-cursor-icon-el.cmsm-cursor-icon-shake,
.cmsm-cursor-icon-el.cmsm-cursor-icon-buzz {
    transition: none;
}
```

---

### Inner Wrapper

| Class | Purpose |
|-------|---------|
| `.cmsm-cursor-inner` | Inner content wrapper for special cursors |

```css
.cmsm-cursor-inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
}

.cmsm-cursor-image .cmsm-cursor-inner {
    width: 100%;
    height: 100%;
}

.cmsm-cursor-text-el .cmsm-cursor-inner {
    white-space: nowrap;
}

.cmsm-cursor-icon-el .cmsm-cursor-inner {
    line-height: 1;
}
```

---

## Data Attributes

| Attribute | Effect |
|-----------|--------|
| `[data-cursor=hide]` | Restores native cursor on element |
| `[data-cursor=none]` | Restores native cursor on element |
| `[data-cursor-image]` | Triggers image cursor |
| `[data-cursor-text]` | Triggers text cursor |
| `[data-cursor-icon]` | Triggers icon cursor |

```css
[data-cursor=hide],
[data-cursor=hide] *,
[data-cursor=none],
[data-cursor=none] * {
    cursor: auto !important;
}
```

---

## Exclusions (Native Cursor Restored)

### Date Pickers

```css
.air-datepicker,
.daterangepicker,
.flatpickr-calendar,
.ui-datepicker {
    cursor: default !important;
}

/* Interactive elements within date pickers */
.air-datepicker-cell,
.air-datepicker-nav--action,
.daterangepicker .btn,
.daterangepicker select,
.daterangepicker td,
.daterangepicker th,
.flatpickr-calendar .flatpickr-day,
.flatpickr-calendar .flatpickr-monthDropdown-months,
.flatpickr-calendar .flatpickr-next-month,
.flatpickr-calendar .flatpickr-prev-month,
.flatpickr-calendar .numInputWrapper,
.ui-datepicker a,
.ui-datepicker button,
.ui-datepicker td {
    cursor: pointer !important;
}
```

### WordPress Admin Bar

```css
#wpadminbar,
#wpadminbar * {
    cursor: default !important;
}
```

---

## Mobile/Touch Handling

Cursor completely hidden on touch devices:

```css
@media (hover: none) and (pointer: coarse) {
    #cmsm-cursor-container,
    .cmsm-cursor {
        display: none !important;
    }
}
```

---

## Editor Navigator CSS (editor-navigator.css)

### Indicator Base Classes

| Class | Purpose |
|-------|---------|
| `.cmsm-nav-cursor-indicator` | Base indicator class |
| `.cmsm-nav-cursor-core` | Purple dot - Core settings active |
| `.cmsm-nav-cursor-special` | Blue dot - Special cursor active |
| `.cmsm-nav-cursor-hidden` | Gray dot - Cursor hidden on element |
| `.cmsm-nav-cursor-show` | Green dot - Cursor shown (when globally disabled) |

```css
.cmsm-nav-cursor-indicator {
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
    background-image: none !important;
    border: none !important;
    box-shadow: none !important;
    cursor: help;
    transition: transform 0.15s ease, opacity 0.15s ease;
}

.cmsm-nav-cursor-indicator:hover {
    transform: scale(1.4);
}

/* Indicator colors (light mode) */
.cmsm-nav-cursor-core {
    background: #9b59b6 !important;
}

.cmsm-nav-cursor-special {
    background: #3498db !important;
}

.cmsm-nav-cursor-hidden {
    background: #95a5a6 !important;
    opacity: 0.8;
}

.cmsm-nav-cursor-show {
    background: #27ae60 !important;
}
```

---

### Legend Classes

| Class | Purpose |
|-------|---------|
| `.cmsm-nav-cursor-legend-wrapper` | Legend container (hidden by default) |
| `.cmsm-legend-visible` | Shows legend |
| `.cmsm-nav-cursor-legend-header` | Legend header with help link |
| `.cmsm-nav-cursor-legend` | Legend items row |
| `.cmsm-legend-item` | Individual legend item |

```css
.cmsm-nav-cursor-legend-wrapper {
    display: none;
    flex-direction: column;
    border-top: 1px solid var(--e-a-border-color-bold, rgba(255, 255, 255, 0.1));
    border-bottom: 1px solid var(--e-a-border-color-bold, rgba(255, 255, 255, 0.1));
    background: var(--e-a-bg-default, #26292c);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
}

.cmsm-nav-cursor-legend-wrapper.cmsm-legend-visible {
    display: flex !important;
}

.cmsm-nav-cursor-legend-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px 0;
    font-size: 10px;
    color: var(--e-a-color-txt-muted, #888);
}

.cmsm-nav-cursor-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 6px 12px 8px;
    font-size: 10px;
    color: var(--e-a-color-txt-muted, #999);
}

.cmsm-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
}

.cmsm-legend-item .cmsm-nav-cursor-indicator {
    margin-left: 0;
    cursor: default;
    pointer-events: none;
    width: 6px !important;
    height: 6px !important;
}
```

---

### Navigator Element Fixes

```css
/* Position context for absolute indicators */
.elementor-navigator__item {
    position: relative !important;
}

/* Position indicators container */
.elementor-navigator__element__indicators {
    position: absolute !important;
    right: 8px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    z-index: 1;
}
```

---

### Dark Mode Support

Dark mode colors (applied via `.elementor-editor-dark` or auto dark mode):

| Indicator | Light Mode | Dark Mode |
|-----------|------------|-----------|
| Core | #9b59b6 | #b07cc5 |
| Special | #3498db | #5dade2 |
| Hidden | #95a5a6 | #a0adb5 |
| Show | #27ae60 | #4caf50 |

```css
.elementor-editor-dark,
.elementor-editor-auto.cmsm-dark-mode-active {
    --cmsm-indicator-core: #b07cc5;
    --cmsm-indicator-special: #5dade2;
    --cmsm-indicator-hidden: #a0adb5;
    --cmsm-indicator-show: #4caf50;
    --cmsm-legend-border: rgba(255, 255, 255, 0.1);
}

/* Auto dark mode via media query */
@media (prefers-color-scheme: dark) {
    .elementor-editor-auto {
        --cmsm-indicator-core: #b07cc5;
        --cmsm-indicator-special: #5dade2;
        --cmsm-indicator-hidden: #a0adb5;
        --cmsm-indicator-show: #4caf50;
        --cmsm-legend-border: rgba(255, 255, 255, 0.1);
    }
}
```

---

## Z-Index Reference

| Element | Z-Index | Condition |
|---------|---------|-----------|
| #cmsm-cursor-container | 2147483647 | Default (max int) |
| #cmsm-cursor-container | 9999 | Blend modes active |
| #cmsm-cursor-container | 999999 | Inside popups/date pickers |
| .cmsm-nav-cursor-legend-wrapper | 10 | Navigator legend |
| .elementor-navigator__element__indicators | 1 | Navigator indicators |

**Popup/Date Picker Override:**

```css
.air-datepicker #cmsm-cursor-container,
.daterangepicker #cmsm-cursor-container,
.elementor-popup-modal #cmsm-cursor-container,
.flatpickr-calendar #cmsm-cursor-container,
.ui-datepicker #cmsm-cursor-container {
    z-index: 999999 !important;
}
```

---

## Class Naming Conventions

| Prefix | Location | Purpose |
|--------|----------|---------|
| `cmsm-cursor-` | Body classes | Cursor state management |
| `cmsm-cursor-` | Element classes | Cursor elements (.cmsm-cursor-dot, .cmsm-cursor-ring) |
| `.cmsm-cursor-image` | Element | Image cursor element |
| `.cmsm-cursor-text-el` | Element | Text cursor element |
| `.cmsm-cursor-icon-el` | Element | Icon cursor element |
| `.cmsm-cursor-inner` | Element | Inner wrapper for special cursors |
| `.cmsm-nav-cursor-` | Editor | Navigator indicator classes |
| `.cmsm-legend-` | Editor | Legend-related classes |

---

## CSS Custom Properties Usage

### Override from PHP

```php
// frontend.php outputs:
<style>
:root {
    --cmsm-cursor-color: <?php echo $color; ?>;
    --cmsm-cursor-dot-size: <?php echo $dot_size; ?>px;
}
</style>
```

### Override in Theme

```css
/* In theme CSS */
:root {
    --cmsm-cursor-color: #3366ff;
    --cmsm-cursor-dot-size: 12px;
}

/* Per-page override */
.page-id-123 {
    --cmsm-cursor-color: #ff0000;
}
```

### Override Inline

```html
<div style="--cmsm-cursor-color: #00ff00;">
    <!-- Elements inside use green cursor -->
</div>
```

---

## Class Combinations

### Common States

```css
/* Enabled + Classic theme (default) */
body.cmsm-cursor-enabled

/* Enabled + Dot theme */
body.cmsm-cursor-enabled.cmsm-cursor-theme-dot

/* Enabled + Hover state */
body.cmsm-cursor-enabled.cmsm-cursor-hover

/* Enabled + Blend mode */
body.cmsm-cursor-enabled.cmsm-cursor-blend-medium

/* Enabled + Dual mode (native cursor visible) */
body.cmsm-cursor-enabled.cmsm-cursor-dual

/* Dot theme + Hover (larger dot) */
body.cmsm-cursor-enabled.cmsm-cursor-theme-dot.cmsm-cursor-hover

/* Adaptive dark background */
body.cmsm-cursor-enabled.cmsm-cursor-on-dark

/* Hidden state */
body.cmsm-cursor-enabled.cmsm-cursor-hidden
```

---

## See Also

- [BODY-CLASSES.md](../reference/BODY-CLASSES.md) - Body class state machine
- [EFFECTS.md](../reference/EFFECTS.md) - Animation details
- [DATA-ATTRIBUTES.md](DATA-ATTRIBUTES.md) - Element attributes

---

*Last Updated: February 5, 2026 | Version: 5.5*
