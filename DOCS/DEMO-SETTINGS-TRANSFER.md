# Demo Content: Custom Cursor Settings Transfer

Reference document for the CMSMasters theme team.

## Problem

After demo import, the custom cursor is disabled because global cursor options in `wp_options` are not included in the WXR export. The most critical gap: `elementor_custom_cursor_enabled` defaults to `''` (disabled).

## What Already Transfers Automatically

| Data | Mechanism |
|------|-----------|
| Per-widget cursor controls (special cursors, hide/show, effects) | WXR XML (Elementor JSON in `wp_posts`) |
| Page-level cursor overrides (theme, smoothness, blend, color) | WXR XML (document settings) |
| Elementor Kit colors/typography | `elementor-kit.php` importer |

## What Does NOT Transfer — 12 Global Options

These must be added to each demo's theme-options data package processed by `admin/installer/importer/theme-options.php`.

| # | Option Key | Type | Allowed Values | Default |
|---|-----------|------|----------------|---------|
| 1 | `elementor_custom_cursor_enabled` | select | `''`, `'widgets'`, `'yes'` | `''` |
| 2 | `elementor_custom_cursor_editor_preview` | select | `''`, `'yes'` | `''` |
| 3 | `elementor_custom_cursor_dual_mode` | select | `''`, `'yes'` | `''` |
| 4 | `elementor_custom_cursor_color_source` | select | `'primary'`, `'secondary'`, `'text'`, `'accent'`, `'custom'` | `'custom'` |
| 5 | `elementor_custom_cursor_color` | text | Hex color (e.g. `#222222`) | `'#222222'` |
| 6 | `elementor_custom_cursor_adaptive` | select | `''`, `'yes'` | `''` |
| 7 | `elementor_custom_cursor_theme` | select | `'classic'`, `'dot'` | `'classic'` |
| 8 | `elementor_custom_cursor_dot_size` | text | Numeric string (pixels) | `'8'` |
| 9 | `elementor_custom_cursor_dot_hover_size` | text | Numeric string (pixels) | `'40'` |
| 10 | `elementor_custom_cursor_smoothness` | select | `'precise'`, `'snappy'`, `'normal'`, `'smooth'`, `'fluid'` | `'normal'` |
| 11 | `elementor_custom_cursor_blend_mode` | select | `''`, `'soft'`, `'medium'`, `'strong'` | `''` |
| 12 | `elementor_custom_cursor_wobble` | select | `''`, `'yes'` | `''` |

## Minimum Viable Config

For demos that just need cursor enabled with defaults, only ONE option is required:

```php
'elementor_custom_cursor_enabled' => 'yes',
```

## Full Example (demo with blend + wobble)

```php
'elementor_custom_cursor_enabled'        => 'yes',
'elementor_custom_cursor_editor_preview' => '',
'elementor_custom_cursor_dual_mode'      => '',
'elementor_custom_cursor_color_source'   => 'primary',
'elementor_custom_cursor_color'          => '#222222',
'elementor_custom_cursor_adaptive'       => '',
'elementor_custom_cursor_theme'          => 'classic',
'elementor_custom_cursor_dot_size'       => '8',
'elementor_custom_cursor_dot_hover_size' => '40',
'elementor_custom_cursor_smoothness'     => 'normal',
'elementor_custom_cursor_blend_mode'     => 'medium',
'elementor_custom_cursor_wobble'         => 'yes',
```

## Sanitization

The addon validates all options on read in `includes/frontend.php`:
- **Color**: `validate_hex_color()` — regex enforces `#XXXXXX` or `#XXX`, falls back to `#222222`
- **Numeric**: `is_numeric()` + `intval()` before CSS output
- **Select**: strict comparison against known values

Values written directly via `update_option()` (bypassing Settings API) are safe — the frontend handles any malformed data by falling back to defaults.

## No Addon Code Changes Required

The addon is fully compatible with externally-written option values. This is a demo data packaging task only.
