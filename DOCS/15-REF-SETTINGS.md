# Custom Cursor v5.5 - Settings Reference

**Last Updated:** February 5, 2026

---

## Overview

Custom Cursor uses WordPress options for global settings. These are managed through the Addon Settings page.

**Settings Page:** CMSMasters > Addon Settings > Custom Cursor

---

## WordPress Options

### Enable/Disable

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_enabled` | yes/empty | `''` (empty) | Enable cursor globally |
| `elementor_custom_cursor_editor_preview` | yes/empty | `''` (empty) | Show cursor in Elementor editor preview area |

**PHP Usage:**
```php
$enabled = get_option('elementor_custom_cursor_enabled', '') === 'yes';
$editor_preview = get_option('elementor_custom_cursor_editor_preview', '') === 'yes';
```

---

### Dual Mode

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_dual_mode` | yes/empty | `''` (empty) | Show both system and custom cursor |

```php
$dual_mode = get_option('elementor_custom_cursor_dual_mode', '') === 'yes';
```

---

### Color Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_color_source` | string | `'custom'` | Color source: primary, secondary, text, accent, custom |
| `elementor_custom_cursor_color` | hex | `'#222222'` | Custom hex color (used when color_source is 'custom') |

**Color Source Values:**
- `primary` - Primary (Global from Kit)
- `secondary` - Secondary (Global from Kit)
- `text` - Text (Global from Kit)
- `accent` - Accent (Global from Kit)
- `custom` - Custom Color (uses `elementor_custom_cursor_color`)

**PHP Usage:**
```php
$color_source = get_option('elementor_custom_cursor_color_source', 'custom');
$color = get_option('elementor_custom_cursor_color', '#222222');
```

**Output as CSS Variables:**
```css
:root {
    --cmsm-cursor-color: #222222;
    --cmsm-cursor-color-dark: #222222;
}
```

---

### Adaptive Color

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_adaptive` | yes/empty | `''` (empty) | Auto-switch color based on background brightness |

```php
$adaptive = get_option('elementor_custom_cursor_adaptive', '') === 'yes';
```

When enabled, cursor color automatically switches between light and dark based on background luminance.

---

### Cursor Theme

| Option | Type | Default | Values |
|--------|------|---------|--------|
| `elementor_custom_cursor_theme` | string | `'classic'` | classic, dot |

**Values:**
- `classic` - Dot + Ring (default)
- `dot` - Dot only (no ring)

```php
$theme = get_option('elementor_custom_cursor_theme', 'classic');
```

**Output as Body Class:**
```html
<body class="cmsm-cursor-theme-classic">
```

---

### Sizes

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_dot_size` | string | `'8'` | Normal radius in pixels |
| `elementor_custom_cursor_dot_hover_size` | string | `'40'` | Hover radius in pixels |

**PHP Usage:**
```php
$dot_size = get_option('elementor_custom_cursor_dot_size', '8');
$dot_hover_size = get_option('elementor_custom_cursor_dot_hover_size', '40');
```

**Output as CSS Variables:**
```css
body.cmsm-cursor-enabled[class] {
    --cmsm-cursor-dot-size: 8px;
    --cmsm-cursor-dot-hover-size: 40px;
}
```

---

### Smoothness

| Option | Type | Default | Values |
|--------|------|---------|--------|
| `elementor_custom_cursor_smoothness` | string | `'normal'` | precise, snappy, normal, smooth, fluid |

**Values:**
- `precise` - Instant (no smoothing)
- `snappy` - Quick response
- `normal` - Default smoothness
- `smooth` - More lag
- `fluid` - Very smooth (maximum lag)

```php
$smoothness = get_option('elementor_custom_cursor_smoothness', 'normal');
```

---

### Blend Mode

| Option | Type | Default | Values |
|--------|------|---------|--------|
| `elementor_custom_cursor_blend_mode` | string | `''` (empty) | '', soft, medium, strong |

**Values:**
- `''` (empty) - Disabled
- `soft` - Soft (Exclusion)
- `medium` - Medium (Difference)
- `strong` - Strong (High Contrast)

**Legacy Note:** Value `'yes'` maps to `'medium'` for backward compatibility.

```php
$blend_mode = get_option('elementor_custom_cursor_blend_mode', '');
```

**Output as Body Classes:**
```html
<body class="cmsm-cursor-blend cmsm-cursor-blend-medium">
```

---

### Wobble Effect

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elementor_custom_cursor_wobble` | yes/empty | `''` (empty) | Elastic rubber-like deformation based on velocity |

```php
$wobble = get_option('elementor_custom_cursor_wobble', '') === 'yes';
```

**Output as Body Class:**
```html
<body class="cmsm-cursor-wobble">
```

---

## Complete Settings Table

| Option Key | Type | Default | Admin Field |
|------------|------|---------|-------------|
| `elementor_custom_cursor_enabled` | checkbox | `''` | Enable Custom Cursor |
| `elementor_custom_cursor_editor_preview` | checkbox | `''` | Show in Editor Preview |
| `elementor_custom_cursor_dual_mode` | checkbox | `''` | Dual Cursor Mode |
| `elementor_custom_cursor_color_source` | select | `'custom'` | Cursor Color |
| `elementor_custom_cursor_color` | text | `'#222222'` | Custom Color |
| `elementor_custom_cursor_adaptive` | checkbox | `''` | Adaptive Color |
| `elementor_custom_cursor_theme` | select | `'classic'` | Cursor Theme |
| `elementor_custom_cursor_dot_size` | text | `'8'` | Normal Radius |
| `elementor_custom_cursor_dot_hover_size` | text | `'40'` | Hover Radius |
| `elementor_custom_cursor_smoothness` | select | `'normal'` | Cursor Smoothness |
| `elementor_custom_cursor_blend_mode` | select | `''` | Blend Mode |
| `elementor_custom_cursor_wobble` | checkbox | `''` | Wobble Effect |

---

## Getting All Settings

```php
// frontend.php
function get_cursor_settings() {
    return [
        'enabled' => get_option('elementor_custom_cursor_enabled', '') === 'yes',
        'editor_preview' => get_option('elementor_custom_cursor_editor_preview', '') === 'yes',
        'dual_mode' => get_option('elementor_custom_cursor_dual_mode', '') === 'yes',
        'color_source' => get_option('elementor_custom_cursor_color_source', 'custom'),
        'color' => get_option('elementor_custom_cursor_color', '#222222'),
        'adaptive' => get_option('elementor_custom_cursor_adaptive', '') === 'yes',
        'theme' => get_option('elementor_custom_cursor_theme', 'classic'),
        'dot_size' => get_option('elementor_custom_cursor_dot_size', '8'),
        'dot_hover_size' => get_option('elementor_custom_cursor_dot_hover_size', '40'),
        'smoothness' => get_option('elementor_custom_cursor_smoothness', 'normal'),
        'blend_mode' => get_option('elementor_custom_cursor_blend_mode', ''),
        'wobble' => get_option('elementor_custom_cursor_wobble', '') === 'yes',
    ];
}
```

---

## Body Classes Reference

When cursor is enabled, the following classes are added to `<body>`:

| Class | Condition |
|-------|-----------|
| `cmsm-cursor-enabled` | Always when cursor enabled |
| `cmsm-cursor-theme-{theme}` | Theme class (classic, dot) |
| `cmsm-cursor-dual` | When dual_mode is 'yes' |
| `cmsm-cursor-blend` | When blend_mode is set |
| `cmsm-cursor-blend-{intensity}` | Blend intensity (soft, medium, strong) |
| `cmsm-cursor-wobble` | When wobble is 'yes' |

---

## JavaScript Globals

The following window variables are set before cursor script loads:

| Variable | Condition | Value |
|----------|-----------|-------|
| `window.cmsmCursorAdaptive` | When adaptive is 'yes' | `true` |
| `window.cmsmCursorTheme` | When theme is not 'classic' | Theme string |
| `window.cmsmCursorSmooth` | When smoothness is not 'normal' | Smoothness string |

---

## Filter Hooks

### `cmsmasters_custom_cursor_theme`

Allows themes/plugins to override cursor theme.

```php
add_filter('cmsmasters_custom_cursor_theme', function($theme) {
    // Force dot theme on specific pages
    if (is_page('minimal')) {
        return 'dot';
    }
    return $theme;
});
```

---

## See Also

- [PHP-API.md](../api/PHP-API.md) - PHP functions
- [CSS-API.md](../api/CSS-API.md) - CSS variables
- [BODY-CLASSES.md](BODY-CLASSES.md) - Body class states

---

*Last Updated: February 5, 2026 | Version: 5.5*
