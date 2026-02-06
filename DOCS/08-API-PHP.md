# Custom Cursor v5.5 - PHP API Reference

**Last Updated:** February 5, 2026

---

## Overview

| File | Location | Functions | Hooks |
|------|----------|-----------|-------|
| frontend.php | `includes/frontend.php` | 7 | 4 |
| editor.php | `includes/editor.php` | 2 | 2 |
| module.php | `modules/cursor-controls/module.php` | 11 | 4 |
| settings-page.php | `modules/settings/settings-page.php` | 3 | 2 |

---

## frontend.php

Located at: `includes/frontend.php`
Class: `CmsmastersElementor\Frontend`

### Hook Registration (init_actions)

```php
// Lines 124-127 in init_actions()
add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_custom_cursor' ), 20 );
add_filter( 'body_class', array( $this, 'add_cursor_body_class' ) );
add_action( 'wp_footer', array( $this, 'print_custom_cursor_html' ), 5 );
```

---

### should_enable_custom_cursor()

**Line:** 1815-1856 (private method)

```php
private function should_enable_custom_cursor() { ... }
```

Determines if custom cursor should be enabled on current page.

**Returns:** `bool`

**Checks (in order):**
1. `elementor_custom_cursor_enabled` option must be `'yes'`
2. If in Elementor preview iframe, checks `elementor_custom_cursor_editor_preview`
3. Blocks on admin pages, customizer, and edit mode
4. Returns `true` for frontend

---

### enqueue_custom_cursor()

**Line:** 1863-1936

```php
public function enqueue_custom_cursor() { ... }
```

Enqueues cursor CSS and JS assets.

**Hook:** `wp_enqueue_scripts` (priority 20)

**Enqueued Assets:**
- `cmsmasters-custom-cursor` (CSS from `lib/custom-cursor/custom-cursor.css`)
- `cmsmasters-custom-cursor` (JS from `lib/custom-cursor/custom-cursor.js`)

**Inline Styles Added:**
- `--cmsm-cursor-color` - from `get_cursor_color()`
- `--cmsm-cursor-color-dark` - same color for dark mode
- `--cmsm-cursor-dot-size` - from `elementor_custom_cursor_dot_size`
- `--cmsm-cursor-dot-hover-size` - from `elementor_custom_cursor_dot_hover_size`

**Inline Scripts Added:**
- `window.cmsmCursorAdaptive` - if adaptive enabled
- `window.cmsmCursorTheme` - cursor theme (if not 'classic')
- `window.cmsmCursorSmooth` - smoothness level (if not 'normal')

---

### add_cursor_body_class($classes)

**Line:** 1947-1984

```php
public function add_cursor_body_class( $classes ) { ... }
```

Adds cursor-related classes to body element.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $classes | array | Existing body classes |

**Returns:** `array` - Modified classes

**Classes Added:**
- `cmsm-cursor-enabled` - Always when cursor enabled
- `cmsm-cursor-theme-{theme}` - Theme class (classic, dot)
- `cmsm-cursor-dual` - If dual mode enabled
- `cmsm-cursor-blend` - If blend mode enabled
- `cmsm-cursor-blend-{intensity}` - soft, medium, strong
- `cmsm-cursor-wobble` - If wobble effect enabled

**Filter:** `cmsmasters_custom_cursor_theme` - allows theme override

---

### print_custom_cursor_html()

**Line:** 1991-2009

```php
public function print_custom_cursor_html() { ... }
```

Outputs cursor HTML structure in footer.

**Hook:** `wp_footer` (priority 5)

**Output:**
```html
<div id="cmsm-cursor-container" style="position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;">
    <div class="cmsm-cursor cmsm-cursor-dot" aria-hidden="true"></div>
    <div class="cmsm-cursor cmsm-cursor-ring" aria-hidden="true"></div>
</div>
```

Also calls `print_cursor_critical_js()` for instant response.

---

### print_cursor_critical_js()

**Line:** 2020-2069 (private method)

```php
private function print_cursor_critical_js() { ... }
```

Outputs critical inline JavaScript for instant cursor following.

**Purpose:** Eliminates initial cursor lag before main JS loads.

**Sets:**
- `window.cmsmCursorInit` - flag for main script takeover
- `window.cmsmCursorCriticalPos` - current position `{x, y}`
- `window.cmsmCursorCriticalActive` - flag indicating critical script active

---

### validate_hex_color($color)

**Line:** 2079-2088 (private method)

```php
private function validate_hex_color( $color ) { ... }
```

Validates and sanitizes hex color format.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $color | string | Color value to validate |

**Returns:** `string` - Valid hex color or `'#222222'` fallback

**Valid Formats:**
- `#fff` (3 digits)
- `#ffffff` (6 digits)

---

### get_cursor_color()

**Line:** 2090-2129 (private method)

```php
private function get_cursor_color() { ... }
```

Gets cursor color based on color source setting.

**Returns:** `string` - Hex color value

**Logic:**
1. Get `elementor_custom_cursor_color_source` option
2. If `'custom'` - return validated `elementor_custom_cursor_color`
3. If global (primary/secondary/text/accent) - resolve from Kit system_colors
4. Fallback: `'#222222'`

---

## editor.php

Located at: `includes/editor.php`
Class: `CmsmastersElementor\Editor`

### Hook Registration (init_actions)

```php
// Lines 94, 98 in init_actions()
add_action( 'elementor/preview/enqueue_scripts', array( $this, 'enqueue_preview_scripts' ) );
add_action( 'elementor/admin/after_create_settings/' . Settings::PAGE_ID, array( $this, 'add_tab_settings' ), 100 );
```

---

### enqueue_editor_scripts()

**Line:** 140-188

```php
public function enqueue_editor_scripts() { ... }
```

Enqueues Navigator indicator script in editor panel.

**Hook:** `elementor/editor/before_enqueue_scripts`

**Enqueued:**
- `cmsmasters-navigator-indicator` (JS)
- Config via `window.cmsmastersNavigatorConfig`

---

### enqueue_preview_scripts()

**Line:** 200-217

```php
public function enqueue_preview_scripts() { ... }
```

Enqueues editor sync script in preview iframe.

**Hook:** `elementor/preview/enqueue_scripts`

**Conditions:**
- `elementor_custom_cursor_enabled` must be `'yes'`
- `elementor_custom_cursor_editor_preview` must be `'yes'`

**Enqueued:**
- `cmsmasters-cursor-editor-sync` (JS)

---

## module.php

Located at: `modules/cursor-controls/module.php`
Class: `CmsmastersElementor\Modules\CursorControls\Module`

### Hook Registration

```php
// Lines 21-25 in init_actions()
add_action( 'elementor/element/container/section_layout/after_section_end', array( $this, 'register_controls' ) );
add_action( 'elementor/element/section/section_layout/after_section_end', array( $this, 'register_controls' ) );
add_action( 'elementor/element/column/section_layout/after_section_end', array( $this, 'register_controls' ) );
add_action( 'elementor/element/common/_section_style/after_section_end', array( $this, 'register_controls' ) );

// Lines 29-32 in init_filters()
add_action( 'elementor/frontend/element/before_render', array( $this, 'apply_cursor_attributes' ) );
add_action( 'elementor/frontend/widget/before_render', array( $this, 'apply_cursor_attributes' ) );
add_action( 'elementor/frontend/section/before_render', array( $this, 'apply_cursor_attributes' ) );
add_action( 'elementor/frontend/container/before_render', array( $this, 'apply_cursor_attributes' ) );
```

---

### register_controls($element)

**Line:** 35-733

```php
public function register_controls( $element ) { ... }
```

Registers cursor controls in element Advanced tab.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $element | Element_Base | Elementor element |

**Section Created:** `cmsmasters_section_cursor` (Tab: Advanced)

**Controls Registered:**

| Control ID | Type | Default | Description |
|------------|------|---------|-------------|
| `cmsmasters_cursor_hide` | SWITCHER | '' | Hide custom cursor |
| `cmsmasters_cursor_special_active` | SWITCHER | '' | Enable special cursor |
| `cmsmasters_cursor_hover_style` | SELECT | '' | Hover style (default/hover) |
| `cmsmasters_cursor_force_color` | SWITCHER | '' | Force color override |
| `cmsmasters_cursor_color` | COLOR | '' | Custom color |
| `cmsmasters_cursor_blend_mode` | SELECT | '' | Blend mode override |
| `cmsmasters_cursor_special_type` | SELECT | 'image' | Special type (image/text/icon) |
| `cmsmasters_cursor_effect` | SELECT | '' | Animation effect |

**Image Controls:**
- `cmsmasters_cursor_image` - Media selector
- `cmsmasters_cursor_size_normal` - Normal size (default: 32px)
- `cmsmasters_cursor_size_hover` - Hover size (default: 48px)
- `cmsmasters_cursor_rotate_normal` - Normal rotation
- `cmsmasters_cursor_rotate_hover` - Hover rotation

**Text Controls:**
- `cmsmasters_cursor_text_content` - Text (default: 'View')
- `cmsmasters_cursor_text_typography` - Typography group
- `cmsmasters_cursor_text_color` - Text color (default: #000000)
- `cmsmasters_cursor_text_bg_color` - Background (default: #ffffff)
- `cmsmasters_cursor_text_fit_circle` - Auto-fit circle (default: yes)
- `cmsmasters_cursor_text_circle_spacing` - Inner spacing (default: 10px)
- `cmsmasters_cursor_text_border_radius` - Border radius
- `cmsmasters_cursor_text_padding` - Padding

**Icon Controls:**
- `cmsmasters_cursor_icon` - Icon selector
- `cmsmasters_cursor_icon_color` - Icon color (default: #000000)
- `cmsmasters_cursor_icon_bg_color` - Background (default: #ffffff)
- `cmsmasters_cursor_icon_preserve_colors` - Preserve original colors
- `cmsmasters_cursor_icon_size_normal` - Normal size (default: 32px)
- `cmsmasters_cursor_icon_size_hover` - Hover size (default: 48px)
- `cmsmasters_cursor_icon_rotate_normal` - Normal rotation
- `cmsmasters_cursor_icon_rotate_hover` - Hover rotation
- `cmsmasters_cursor_icon_fit_circle` - Auto-fit circle (default: yes)
- `cmsmasters_cursor_icon_circle_spacing` - Inner spacing
- `cmsmasters_cursor_icon_border_radius` - Border radius
- `cmsmasters_cursor_icon_padding` - Padding

**Shared Controls:**
- `cmsmasters_cursor_special_blend` - Blend mode for special cursors

---

### apply_cursor_attributes($element)

**Line:** 875-899

```php
public function apply_cursor_attributes( $element ) { ... }
```

Main dispatcher that routes to specific cursor type handlers.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $element | Element_Base | Elementor element |

**Flow:**
1. Check if `cmsmasters_cursor_special_active` is 'yes'
2. If special: route to image/text/icon handler based on type
3. If not special: call `apply_core_cursor_attributes()`

---

### apply_core_cursor_attributes($element, $settings, $raw_settings)

**Line:** 1079-1113 (private method)

```php
private function apply_core_cursor_attributes( $element, $settings, $raw_settings ) { ... }
```

Applies core cursor data attributes.

**Attributes Applied:**
- `data-cursor="hide"` - when hide enabled
- `data-cursor="{style}"` - hover style (hover)
- `data-cursor-color` - custom color
- `data-cursor-blend` - blend mode
- `data-cursor-effect` - animation effect

---

### apply_image_cursor_attributes($element, $settings)

**Line:** 907-932 (private method)

```php
private function apply_image_cursor_attributes( $element, $settings ) { ... }
```

Applies image cursor data attributes.

**Attributes Applied:**
- `data-cursor-image` - image URL
- `data-cursor-image-size` - normal size
- `data-cursor-image-size-hover` - hover size
- `data-cursor-image-rotate` - normal rotation
- `data-cursor-image-rotate-hover` - hover rotation
- `data-cursor-image-effect` - effect
- `data-cursor-blend` - blend mode

---

### apply_text_cursor_attributes($element, $settings, $raw_settings)

**Line:** 941-1015 (private method)

```php
private function apply_text_cursor_attributes( $element, $settings, $raw_settings ) { ... }
```

Applies text cursor data attributes.

**Attributes Applied:**
- `data-cursor-text` - text content
- `data-cursor-text-typography` - JSON typography object
- `data-cursor-text-color` - text color
- `data-cursor-text-bg` - background color
- `data-cursor-text-circle` - 'yes' if fit circle
- `data-cursor-text-circle-spacing` - inner spacing
- `data-cursor-text-radius` - border radius
- `data-cursor-text-padding` - padding
- `data-cursor-text-effect` - effect
- `data-cursor-blend` - blend mode

---

### apply_icon_cursor_attributes($element, $settings, $raw_settings)

**Line:** 1024-1070 (private method)

```php
private function apply_icon_cursor_attributes( $element, $settings, $raw_settings ) { ... }
```

Applies icon cursor data attributes.

**Attributes Applied:**
- `data-cursor-icon` - HTML icon markup
- `data-cursor-icon-color` - icon color
- `data-cursor-icon-bg` - background color
- `data-cursor-icon-preserve` - 'yes' if preserve colors
- `data-cursor-icon-size` - normal size
- `data-cursor-icon-size-hover` - hover size
- `data-cursor-icon-rotate` - normal rotation
- `data-cursor-icon-rotate-hover` - hover rotation
- `data-cursor-icon-circle` - 'yes' if fit circle
- `data-cursor-icon-circle-spacing` - inner spacing
- `data-cursor-icon-radius` - border radius
- `data-cursor-icon-padding` - padding
- `data-cursor-icon-effect` - effect
- `data-cursor-blend` - blend mode

---

### resolve_global_color($global_ref)

**Line:** 845-867 (private method)

```php
private function resolve_global_color( $global_ref ) { ... }
```

Resolves Elementor global color reference to hex value.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $global_ref | string | Global reference like `globals/colors?id=accent` |

**Returns:** `string|null` - Hex color or null

---

### resolve_global_typography($global_ref)

**Line:** 791-837 (private method)

```php
private function resolve_global_typography( $global_ref ) { ... }
```

Resolves Elementor global typography reference.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| $global_ref | string | Global reference like `globals/typography?id=primary` |

**Returns:** `array|null` - Typography values array:
```php
[
    'font_family'     => 'Roboto',
    'font_size'       => '16',
    'font_size_unit'  => 'px',
    'font_weight'     => '400',
    'font_style'      => 'normal',
    'line_height'     => '1.5',
    'line_height_unit' => 'em',
    'letter_spacing'  => '0',
    'letter_spacing_unit' => 'px',
    'text_transform'  => 'none',
    'text_decoration' => 'none',
    'word_spacing'    => '0',
    'word_spacing_unit' => 'px',
]
```

---

## settings-page.php

Located at: `modules/settings/settings-page.php`
Class: `CmsmastersElementor\Modules\Settings\Settings_Page`

### Registered Options

All options use prefix `elementor_custom_cursor_`

| Option Key | Type | Default | Description |
|------------|------|---------|-------------|
| `enabled` | select | '' | Enable cursor (yes/empty) |
| `editor_preview` | select | '' | Show in editor preview (yes/empty) |
| `dual_mode` | select | '' | Show both cursors (yes/empty) |
| `color_source` | select | 'custom' | Color source (primary/secondary/text/accent/custom) |
| `color` | text | '#222222' | Custom hex color |
| `adaptive` | select | '' | Adaptive color (yes/empty) |
| `theme` | select | 'classic' | Cursor theme (classic/dot) |
| `dot_size` | text | '8' | Normal radius in px |
| `dot_hover_size` | text | '40' | Hover radius in px |
| `smoothness` | select | 'normal' | Smoothness (precise/snappy/normal/smooth/fluid) |
| `blend_mode` | select | '' | Blend mode (empty/soft/medium/strong) |
| `wobble` | select | '' | Wobble effect (yes/empty) |

---

### create_tabs()

**Line:** 570-753

Creates settings tabs including Custom Cursor section.

**Tab:** `advanced`
**Section:** `custom_cursor`
**Fields:** See Registered Options above

---

### get_kit_colors_for_cursor()

**Line:** 389-415 (private method)

```php
private function get_kit_colors_for_cursor() { ... }
```

Gets Kit system colors for color picker swatches.

**Returns:** `array` - Associative array `[color_id => hex_value]`

**Default Colors:**
```php
[
    'primary'   => '#6EC1E4',
    'secondary' => '#54595F',
    'text'      => '#7A7A7A',
    'accent'    => '#61CE70',
]
```

---

### enqueue_admin_scripts($hook)

**Line:** 68-381

Enqueues Pickr color picker and custom UI for settings page.

**Hook:** `admin_enqueue_scripts`

**Enqueued:**
- Pickr CSS/JS (CDN)
- `cmsmasters-font-converter` (JS)
- Custom inline styles for color swatches UI

---

## WordPress Hooks Summary

### Actions Used

| Hook | File | Handler | Priority |
|------|------|---------|----------|
| `wp_enqueue_scripts` | frontend.php | enqueue_custom_cursor | 20 |
| `wp_footer` | frontend.php | print_custom_cursor_html | 5 |
| `elementor/editor/before_enqueue_scripts` | editor.php | enqueue_editor_scripts | 10 |
| `elementor/preview/enqueue_scripts` | editor.php | enqueue_preview_scripts | 10 |
| `elementor/frontend/element/before_render` | module.php | apply_cursor_attributes | 10 |
| `elementor/frontend/widget/before_render` | module.php | apply_cursor_attributes | 10 |
| `elementor/frontend/section/before_render` | module.php | apply_cursor_attributes | 10 |
| `elementor/frontend/container/before_render` | module.php | apply_cursor_attributes | 10 |
| `admin_enqueue_scripts` | settings-page.php | enqueue_admin_scripts | 10 |

### Filters Used

| Hook | File | Handler |
|------|------|---------|
| `body_class` | frontend.php | add_cursor_body_class |
| `cmsmasters_custom_cursor_theme` | frontend.php | (external filter for theme override) |

### Elementor Control Hooks

| Hook | File | Purpose |
|------|------|---------|
| `elementor/element/container/section_layout/after_section_end` | module.php | Register container controls |
| `elementor/element/section/section_layout/after_section_end` | module.php | Register section controls |
| `elementor/element/column/section_layout/after_section_end` | module.php | Register column controls |
| `elementor/element/common/_section_style/after_section_end` | module.php | Register widget controls |

---

## File Paths Reference

```
version-5.5/
├── includes/
│   ├── frontend.php      # Frontend class (cursor enqueue, body class, HTML)
│   └── editor.php        # Editor class (preview scripts, navigator)
└── modules/
    ├── cursor-controls/
    │   └── module.php    # Controls registration and attribute application
    └── settings/
        └── settings-page.php  # Admin settings page
```

---

## See Also

- [JAVASCRIPT-API.md](JAVASCRIPT-API.md) - JavaScript functions
- [DATA-ATTRIBUTES.md](DATA-ATTRIBUTES.md) - Data attributes reference
- [SETTINGS.md](../reference/SETTINGS.md) - All WordPress options
- [FILES.md](../reference/FILES.md) - File structure reference

---

*Last Updated: February 5, 2026 | Version: 5.5*
