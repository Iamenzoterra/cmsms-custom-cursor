# Custom Cursor v5.6 - CSS API Reference

**Last Updated:** February 17, 2026

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
| `--cmsmasters-cursor-color` | #222 | Main cursor color |
| `--cmsmasters-cursor-color-light` | #fff | Light mode color (adaptive) |
| `--cmsmasters-cursor-color-dark` | #222 | Dark mode color (adaptive) |
| `--cmsmasters-cursor-dot-size` | 8px | Dot diameter |
| `--cmsmasters-cursor-dot-hover-size` | 40px | Dot hover diameter (default, classic theme uses 40px, theme-dot uses 20px) |
| `--cmsmasters-cursor-ring-offset` | 32px | Gap between dot edge and ring edge; ring diameter = dot size + offset |
| `--cmsmasters-cursor-z-default` | 999999 | Default z-index (high but not max-int) |
| `--cmsmasters-cursor-z-blend` | 9999 | Z-index when blend modes active |

**Scoped Properties (inside `.cmsmasters-cursor-ring` rules — not user-overridable):**

| Property | Formula | Description |
|----------|---------|-------------|
| `--_ring` | `calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset))` | Default ring diameter (8 + 32 = 40px) |
| `--_ring-hover` | `calc(var(--cmsmasters-cursor-dot-hover-size) + 20px)` | Hover ring diameter (40 + 20 = 60px) |
| `--_ring-down` | `calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset) * 0.7)` | Down ring diameter (8 + 22.4 = 30.4px) |

### Editor Navigator Variables (editor-navigator.css)

| Variable | Default | Description |
|----------|---------|-------------|
| `--cmsmasters-indicator-core` | #b07cc5 | Purple indicator (dark mode) |
| `--cmsmasters-indicator-special` | #5dade2 | Blue indicator (dark mode) |
| `--cmsmasters-indicator-hidden` | #a0adb5 | Gray indicator (dark mode) |
| `--cmsmasters-indicator-show` | #4caf50 | Green indicator (dark mode) |
| `--cmsmasters-legend-border` | rgba(255, 255, 255, 0.1) | Legend border color |

### Usage

```css
/* Variables set in :root by PHP */
:root {
    --cmsmasters-cursor-color: #222;
    --cmsmasters-cursor-color-light: #fff;
    --cmsmasters-cursor-color-dark: #222;
    --cmsmasters-cursor-dot-size: 8px;
    --cmsmasters-cursor-dot-hover-size: 40px;
    --cmsmasters-cursor-ring-offset: 32px;
}

/* Override in custom CSS */
:root {
    --cmsmasters-cursor-color: #ff0000;
    --cmsmasters-cursor-dot-size: 10px;
}
```

---

## Container Classes

### #cmsmasters-cursor-container

Main container element. Z-index uses CSS custom properties for easy override.

```css
#cmsmasters-cursor-container {
    --cmsmasters-cursor-z-default: 999999;
    --cmsmasters-cursor-z-blend: 9999;
    z-index: var(--cmsmasters-cursor-z-default);
}
```

**Note:** When blend modes are active, z-index drops to blend value:

```css
body.cmsmasters-cursor-blend-soft #cmsmasters-cursor-container,
body.cmsmasters-cursor-blend-medium #cmsmasters-cursor-container,
body.cmsmasters-cursor-blend-strong #cmsmasters-cursor-container {
    z-index: var(--cmsmasters-cursor-z-blend);
}
```

**User Override:** If z-index conflicts occur with other UI elements, users can lower the value:

```css
#cmsmasters-cursor-container {
    --cmsmasters-cursor-z-default: 99999; /* lower if conflicts */
}
```

---

### .cmsmasters-cursor

Cursor wrapper. Positioned fixed with off-screen initial transform.

```css
.cmsmasters-cursor {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform, opacity;
    opacity: 0;
    transition: opacity 0.3s ease;
    transform: translate3d(-200px, -200px, 0);
}

.cmsmasters-cursor-enabled .cmsmasters-cursor {
    opacity: 1;
}
```

---

### .cmsmasters-cursor-dot

Center dot element. Uses CSS variables for sizing.

```css
.cmsmasters-cursor-dot {
    width: var(--cmsmasters-cursor-dot-size);
    height: var(--cmsmasters-cursor-dot-size);
    background: var(--cmsmasters-cursor-color);
    border-radius: 50%;
    margin-left: calc(var(--cmsmasters-cursor-dot-size) / -2);
    margin-top: calc(var(--cmsmasters-cursor-dot-size) / -2);
    transition: background-color 0.15s ease-out,
                width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                height 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                margin 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
```

---

### .cmsmasters-cursor-ring

Outer ring element. Ring sizing uses CSS custom properties and `calc()` — no hardcoded pixel values.

```css
.cmsmasters-cursor-ring {
    /* Scoped property: dot-size + ring-offset (e.g. 8px + 32px = 40px) */
    --_ring: calc(var(--cmsmasters-cursor-dot-size) + var(--cmsmasters-cursor-ring-offset));
    width: var(--_ring);
    height: var(--_ring);
    border: 2px solid var(--cmsmasters-cursor-color);
    border-radius: 50%;
    margin-left: calc(var(--_ring) / -2);
    margin-top: calc(var(--_ring) / -2);
    box-sizing: border-box;
    transition: width 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                height 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                margin 0.2s cubic-bezier(0.25, 1, 0.5, 1),
                opacity 0.2s ease,
                background-color 0.2s ease,
                border-color 0.15s ease-out;
}
```

**Ring Size States (defaults with 8px dot, 32px offset, 40px hover-size):**

| State | Formula | Computed | Margin |
|-------|---------|----------|--------|
| Default | `dot-size + ring-offset` | 40px | -20px |
| Hover | `dot-hover-size + 20px` | 60px | -30px |
| Down (click) | `dot-size + ring-offset * 0.7` | ~30px | ~-15px |
| Size SM | hardcoded | 20px | -10px |
| Size LG | hardcoded | 80px | -40px |

**To resize the ring**, override `--cmsmasters-cursor-ring-offset` in `:root`:
```css
:root {
    --cmsmasters-cursor-ring-offset: 20px; /* tighter ring */
}
```

---

## Body State Classes

### Enable/Disable

| Class | Purpose |
|-------|---------|
| `cmsmasters-cursor-enabled` | Enables cursor system, hides native cursor |

```css
.cmsmasters-cursor-enabled,
.cmsmasters-cursor-enabled * {
    cursor: none !important;
}

.cmsmasters-cursor-enabled .cmsmasters-cursor {
    opacity: 1;
}
```

---

### Dual Mode

| Class | Purpose |
|-------|---------|
| `cmsmasters-cursor-dual` | Shows native cursor alongside custom cursor |

```css
.cmsmasters-cursor-enabled.cmsmasters-cursor-dual,
.cmsmasters-cursor-enabled.cmsmasters-cursor-dual * {
    cursor: default !important;
}
```

---

### Theme Classes

| Class | Effect |
|-------|--------|
| `cmsmasters-cursor-theme-dot` | Dot only (ring hidden), larger hover effect |

```css
body.cmsmasters-cursor-theme-dot {
    --cmsmasters-cursor-dot-size: 10px;
    --cmsmasters-cursor-dot-hover-size: 20px;
}

body.cmsmasters-cursor-theme-dot .cmsmasters-cursor-ring {
    display: none !important;
}

body.cmsmasters-cursor-theme-dot.cmsmasters-cursor-hover .cmsmasters-cursor-dot {
    width: var(--cmsmasters-cursor-dot-hover-size);
    height: var(--cmsmasters-cursor-dot-hover-size);
    margin-left: calc(var(--cmsmasters-cursor-dot-hover-size) / -2);
    margin-top: calc(var(--cmsmasters-cursor-dot-hover-size) / -2);
}
```

---

### Interaction States

| Class | Trigger | Effect |
|-------|---------|--------|
| `cmsmasters-cursor-hover` | mouseover link/button | Ring expands to `dot-hover-size + 20px` (default 60px), 50% opacity, 10% fill |
| `cmsmasters-cursor-down` | mousedown | Ring shrinks to `dot-size + ring-offset * 0.7` (default ~30px), 90% fill |
| `cmsmasters-cursor-text` | hover text input | I-beam style (4x24px bar) |
| `cmsmasters-cursor-hidden` | forms/video/leave | Hide cursor |

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

body.cmsmasters-cursor-down .cmsmasters-cursor-ring {
    /* down ring = dot-size + ring-offset * 0.7 (e.g. 8px + 22.4px = 30.4px) */
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

body.cmsmasters-cursor-hidden .cmsmasters-cursor {
    opacity: 0 !important;
}

/* System cursor fallback when custom cursor hides (form zones, video/iframe) */
body.cmsmasters-cursor-hidden,
body.cmsmasters-cursor-hidden * {
    cursor: default !important;
}
```

**Note:** The CSS fallback `body.cmsmasters-cursor-hidden { cursor:default!important }` has specificity (0,1,2) which beats `.cmsmasters-cursor-enabled *` (0,1,1), ensuring system cursor is visible when custom cursor hides in both dual and solo modes. Added in February 2026 to fix UX-003 graceful degradation.

---

### Size Classes

| Class | Ring Size |
|-------|-----------|
| `cmsmasters-cursor-size-sm` | 20px |
| `cmsmasters-cursor-size-lg` | 80px |

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

### Adaptive Mode Classes

| Class | Effect |
|-------|--------|
| `cmsmasters-cursor-on-light` | Uses dark cursor color |
| `cmsmasters-cursor-on-dark` | Uses light cursor color |

```css
body.cmsmasters-cursor-on-dark {
    --cmsmasters-cursor-color: var(--cmsmasters-cursor-color-light) !important;
}

body.cmsmasters-cursor-on-light {
    --cmsmasters-cursor-color: var(--cmsmasters-cursor-color-dark) !important;
}
```

---

### Blend Mode Classes

| Class | Mix Blend Mode | Filter | Z-Index |
|-------|----------------|--------|---------|
| `cmsmasters-cursor-blend-soft` | exclusion | none | 9999 |
| `cmsmasters-cursor-blend-medium` | difference | none | 9999 |
| `cmsmasters-cursor-blend-strong` | difference | contrast(1.5) | 9999 |

```css
body.cmsmasters-cursor-blend-soft,
body.cmsmasters-cursor-blend-medium,
body.cmsmasters-cursor-blend-strong {
    isolation: isolate;
}

body.cmsmasters-cursor-blend-soft #cmsmasters-cursor-container {
    z-index: 9999;
    mix-blend-mode: exclusion;
}

body.cmsmasters-cursor-blend-medium #cmsmasters-cursor-container {
    z-index: 9999;
    mix-blend-mode: difference;
}

body.cmsmasters-cursor-blend-strong #cmsmasters-cursor-container {
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
| `.cmsmasters-cursor-image` | Image cursor element |
| `.cmsmasters-cursor-image-wobble` | Wobble effect (disables transition) |
| `.cmsmasters-cursor-image-pulse` | Pulse effect |
| `.cmsmasters-cursor-image-shake` | Shake effect |
| `.cmsmasters-cursor-image-buzz` | Buzz effect |

```css
.cmsmasters-cursor-image {
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
.cmsmasters-cursor-image.cmsmasters-cursor-image-wobble,
.cmsmasters-cursor-image.cmsmasters-cursor-image-pulse,
.cmsmasters-cursor-image.cmsmasters-cursor-image-shake,
.cmsmasters-cursor-image.cmsmasters-cursor-image-buzz {
    transition: none;
}
```

---

### Text Cursor

| Class | Purpose |
|-------|---------|
| `.cmsmasters-cursor-text-el` | Text cursor element |
| `.cmsmasters-cursor-text-wobble` | Wobble effect |
| `.cmsmasters-cursor-text-pulse` | Pulse effect |
| `.cmsmasters-cursor-text-shake` | Shake effect |
| `.cmsmasters-cursor-text-buzz` | Buzz effect |

```css
.cmsmasters-cursor-text-el {
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

.cmsmasters-cursor-text-el.cmsmasters-cursor-text-wobble,
.cmsmasters-cursor-text-el.cmsmasters-cursor-text-pulse,
.cmsmasters-cursor-text-el.cmsmasters-cursor-text-shake,
.cmsmasters-cursor-text-el.cmsmasters-cursor-text-buzz {
    transition: none;
}
```

---

### Icon Cursor

| Class | Purpose |
|-------|---------|
| `.cmsmasters-cursor-icon-el` | Icon cursor element |
| `.cmsmasters-cursor-icon-wobble` | Wobble effect |
| `.cmsmasters-cursor-icon-pulse` | Pulse effect |
| `.cmsmasters-cursor-icon-shake` | Shake effect |
| `.cmsmasters-cursor-icon-buzz` | Buzz effect |

```css
.cmsmasters-cursor-icon-el {
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

.cmsmasters-cursor-icon-el i,
.cmsmasters-cursor-icon-el img,
.cmsmasters-cursor-icon-el svg {
    display: block;
    width: 1em;
    height: 1em;
}

.cmsmasters-cursor-icon-el svg {
    fill: currentColor;
}

[data-cursor-icon],
[data-cursor-icon] * {
    cursor: none !important;
}

.cmsmasters-cursor-icon-el.cmsmasters-cursor-icon-wobble,
.cmsmasters-cursor-icon-el.cmsmasters-cursor-icon-pulse,
.cmsmasters-cursor-icon-el.cmsmasters-cursor-icon-shake,
.cmsmasters-cursor-icon-el.cmsmasters-cursor-icon-buzz {
    transition: none;
}
```

---

### Inner Wrapper

| Class | Purpose |
|-------|---------|
| `.cmsmasters-cursor-inner` | Inner content wrapper for special cursors |

```css
.cmsmasters-cursor-inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
}

.cmsmasters-cursor-image .cmsmasters-cursor-inner {
    width: 100%;
    height: 100%;
}

.cmsmasters-cursor-text-el .cmsmasters-cursor-inner {
    white-space: nowrap;
}

.cmsmasters-cursor-icon-el .cmsmasters-cursor-inner {
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

### Date Pickers & Custom Select Widgets

**Lines:** 60-96 in `custom-cursor.css`

```css
/* Widget containers - restore system cursor */
.air-datepicker,
.daterangepicker,
.flatpickr-calendar,
.ui-datepicker,
.select2-dropdown,
.chosen-drop,
.choices__list--dropdown,
.nice-select-dropdown,
.nice-select .list,
.ts-dropdown,
.ss-content,
.selectize-dropdown,
.ui-selectmenu-menu,
.k-animation-container,
.k-list-container {
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

**Custom Select/Dropdown Libraries Supported:**

| Library | Container Selector | Appended to body? |
|---------|-------------------|-------------------|
| Select2 / SelectWoo | `.select2-dropdown` | Yes |
| Chosen.js | `.chosen-drop` | No |
| Choices.js | `.choices__list--dropdown` | No |
| Nice Select v1/v2 | `.nice-select-dropdown`, `.nice-select .list` | No |
| Tom Select | `.ts-dropdown` | No |
| Slim Select | `.ss-content` | Yes (v2+) |
| Selectize | `.selectize-dropdown` | Yes |
| jQuery UI Selectmenu | `.ui-selectmenu-menu` | No |
| Kendo UI | `.k-animation-container`, `.k-list-container` | Yes |

**Why These Rules Are Needed:**

- Custom cursor hides on form zones (P4 v2 feature)
- These CSS rules ensure system cursor is visible inside widgets even if parent has `cursor:none`
- Graceful degradation: If JavaScript detection fails, CSS fallback still works
- Widgets that append to `<body>` need explicit rules because they're outside the form context

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
    #cmsmasters-cursor-container,
    .cmsmasters-cursor {
        display: none !important;
    }
}
```

---

## Editor Navigator CSS (editor-navigator.css)

### Indicator Base Classes

| Class | Purpose |
|-------|---------|
| `.cmsmasters-nav-cursor-indicator` | Base indicator class |
| `.cmsmasters-nav-cursor-core` | Purple dot - Core settings active |
| `.cmsmasters-nav-cursor-special` | Blue dot - Special cursor active |
| `.cmsmasters-nav-cursor-hidden` | Gray dot - Cursor hidden on element |
| `.cmsmasters-nav-cursor-show` | Green dot - Cursor shown (when globally disabled) |

```css
.cmsmasters-nav-cursor-indicator {
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

.cmsmasters-nav-cursor-indicator:hover {
    transform: scale(1.4);
}

/* Indicator colors (light mode) */
.cmsmasters-nav-cursor-core {
    background: #9b59b6 !important;
}

.cmsmasters-nav-cursor-special {
    background: #3498db !important;
}

.cmsmasters-nav-cursor-hidden {
    background: #95a5a6 !important;
    opacity: 0.8;
}

.cmsmasters-nav-cursor-show {
    background: #27ae60 !important;
}
```

---

### Legend Classes

| Class | Purpose |
|-------|---------|
| `.cmsmasters-nav-cursor-legend-wrapper` | Legend container (hidden by default) |
| `.cmsmasters-legend-visible` | Shows legend |
| `.cmsmasters-nav-cursor-legend-header` | Legend header with help link |
| `.cmsmasters-nav-cursor-legend` | Legend items row |
| `.cmsmasters-legend-item` | Individual legend item |

```css
.cmsmasters-nav-cursor-legend-wrapper {
    display: none;
    flex-direction: column;
    border-top: 1px solid var(--e-a-border-color-bold, rgba(255, 255, 255, 0.1));
    border-bottom: 1px solid var(--e-a-border-color-bold, rgba(255, 255, 255, 0.1));
    background: var(--e-a-bg-default, #26292c);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
}

.cmsmasters-nav-cursor-legend-wrapper.cmsmasters-legend-visible {
    display: flex !important;
}

.cmsmasters-nav-cursor-legend-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px 0;
    font-size: 10px;
    color: var(--e-a-color-txt-muted, #888);
}

.cmsmasters-nav-cursor-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 6px 12px 8px;
    font-size: 10px;
    color: var(--e-a-color-txt-muted, #999);
}

.cmsmasters-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
}

.cmsmasters-legend-item .cmsmasters-nav-cursor-indicator {
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
.elementor-editor-auto.cmsmasters-dark-mode-active {
    --cmsmasters-indicator-core: #b07cc5;
    --cmsmasters-indicator-special: #5dade2;
    --cmsmasters-indicator-hidden: #a0adb5;
    --cmsmasters-indicator-show: #4caf50;
    --cmsmasters-legend-border: rgba(255, 255, 255, 0.1);
}

/* Auto dark mode via media query */
@media (prefers-color-scheme: dark) {
    .elementor-editor-auto {
        --cmsmasters-indicator-core: #b07cc5;
        --cmsmasters-indicator-special: #5dade2;
        --cmsmasters-indicator-hidden: #a0adb5;
        --cmsmasters-indicator-show: #4caf50;
        --cmsmasters-legend-border: rgba(255, 255, 255, 0.1);
    }
}
```

---

## Z-Index Reference

| Element | Z-Index | Condition |
|---------|---------|-----------|
| #cmsmasters-cursor-container | 999999 | Default (via `--cmsmasters-cursor-z-default`) |
| #cmsmasters-cursor-container | 9999 | Blend modes active (via `--cmsmasters-cursor-z-blend`) |
| .cmsmasters-nav-cursor-legend-wrapper | 10 | Navigator legend |
| .elementor-navigator__element__indicators | 1 | Navigator indicators |

**Why 999999?** High enough to be above normal page content, low enough to not conflict with browser extensions that use max-int (`2147483647`).

**Popup/Date Picker Override:**

```css
.air-datepicker #cmsmasters-cursor-container,
.daterangepicker #cmsmasters-cursor-container,
.elementor-popup-modal #cmsmasters-cursor-container,
.flatpickr-calendar #cmsmasters-cursor-container,
.ui-datepicker #cmsmasters-cursor-container {
    z-index: var(--cmsmasters-cursor-z-default);
}
```

---

## Class Naming Conventions

| Prefix | Location | Purpose |
|--------|----------|---------|
| `cmsmasters-cursor-` | Body classes | Cursor state management |
| `cmsmasters-cursor-` | Element classes | Cursor elements (.cmsmasters-cursor-dot, .cmsmasters-cursor-ring) |
| `.cmsmasters-cursor-image` | Element | Image cursor element |
| `.cmsmasters-cursor-text-el` | Element | Text cursor element |
| `.cmsmasters-cursor-icon-el` | Element | Icon cursor element |
| `.cmsmasters-cursor-inner` | Element | Inner wrapper for special cursors |
| `.cmsmasters-nav-cursor-` | Editor | Navigator indicator classes |
| `.cmsmasters-legend-` | Editor | Legend-related classes |

---

## CSS Custom Properties Usage

### Override from PHP

```php
// frontend.php outputs:
<style>
:root {
    --cmsmasters-cursor-color: <?php echo $color; ?>;
    --cmsmasters-cursor-dot-size: <?php echo $dot_size; ?>px;
}
</style>
```

### Override in Theme

```css
/* In theme CSS */
:root {
    --cmsmasters-cursor-color: #3366ff;
    --cmsmasters-cursor-dot-size: 12px;
}

/* Per-page override */
.page-id-123 {
    --cmsmasters-cursor-color: #ff0000;
}
```

### Override Inline

```html
<div style="--cmsmasters-cursor-color: #00ff00;">
    <!-- Elements inside use green cursor -->
</div>
```

---

## Class Combinations

### Common States

```css
/* Enabled + Classic theme (default) */
body.cmsmasters-cursor-enabled

/* Enabled + Dot theme */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-theme-dot

/* Enabled + Hover state */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-hover

/* Enabled + Blend mode */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-blend-medium

/* Enabled + Dual mode (native cursor visible) */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-dual

/* Dot theme + Hover (larger dot) */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-theme-dot.cmsmasters-cursor-hover

/* Adaptive dark background */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-on-dark

/* Hidden state */
body.cmsmasters-cursor-enabled.cmsmasters-cursor-hidden
```

---

## See Also

- [BODY-CLASSES.md](../reference/BODY-CLASSES.md) - Body class state machine
- [EFFECTS.md](../reference/EFFECTS.md) - Animation details
- [DATA-ATTRIBUTES.md](DATA-ATTRIBUTES.md) - Element attributes

---

*Last Updated: February 17, 2026 | Version: 5.6*
