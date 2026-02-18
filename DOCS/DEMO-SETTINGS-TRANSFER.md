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


 Research: Demo Content Settings Transfer                                                                             │
│                                                                                                                      │
│ Context                                                                                                              │
│                                                                                                                      │
│ When a customer installs a CMSMasters demo, they expect to see the same custom cursor as on the demo site. We need   │
│ to understand what transfers automatically and what doesn't — and find the best way to close the gap.                │
│                                                                                                                      │
│ Findings                                                                                                             │
│                                                                                                                      │
│ What DOES transfer with demo import                                                                                  │
│ Data: Per-widget cursor controls (special cursors, hide/show, colors, effects)                                       │
│ Storage: Elementor JSON in wp_posts                                                                                  │
│ Mechanism: WXR XML importer (posts/pages)                                                                            │
│ Status: Auto                                                                                                         │
│ ────────────────────────────────────────                                                                             │
│ Data: Page-level cursor overrides (theme, smoothness, blend, color)                                                  │
│ Storage: Elementor document settings                                                                                 │
│ Mechanism: WXR XML importer                                                                                          │
│ Status: Auto                                                                                                         │
│ ────────────────────────────────────────                                                                             │
│ Data: Elementor Kit colors/typography                                                                                │
│ Storage: Kit post type                                                                                               │
│ Mechanism: elementor-kit.php importer                                                                                │
│ Status: Auto                                                                                                         │
│ What does NOT transfer — the 9 global options                                                                        │
│ ┌────────────────────────────────────────┬───────────┬──────────────────────────────┐                                │
│ │                 Option                 │  Default  │      Impact if missing       │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_enabled        │ '' (OFF)  │ Cursor completely disabled!  │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_theme          │ 'classic' │ May differ from demo         │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_color          │ #222222   │ Wrong color                  │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_dot_size       │ 8         │ Wrong size                   │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_dot_hover_size │ 40        │ Wrong hover size             │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_smoothness     │ 'normal'  │ May differ                   │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_blend_mode     │ ''        │ No blend even if demo had it │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_adaptive       │ ''        │ No adaptive mode             │                                │
│ ├────────────────────────────────────────┼───────────┼──────────────────────────────┤                                │
│ │ elementor_custom_cursor_wobble         │ ''        │ No wobble effect             │                                │
│ └────────────────────────────────────────┴───────────┴──────────────────────────────┘                                │
│ These are stored in wp_options via WordPress Options API. Standard WXR export does NOT include wp_options.           │
│                                                                                                                      │
│ CMSMasters Merlin Wizard Architecture                                                                                │
│                                                                                                                      │
│ The demo import system is in the CMSMasters Framework plugin:                                                        │
│ admin/installer/                                                                                                     │
│ ├── merlin/                                                                                                          │
│ │   ├── class-merlin.php          # Main wizard                                                                      │
│ │   └── includes/                                                                                                    │
│ │       ├── wxr-importer.php      # WordPress XML parser                                                             │
│ │       └── class-merlin-importer.php                                                                                │
│ └── importer/                                                                                                        │
│     ├── theme-options.php         # Imports theme options → update_option()                                          │
│     ├── elementor-kit.php         # Imports Elementor Kit settings                                                   │
│     ├── elementor-templates.php                                                                                      │
│     ├── acf.php                                                                                                      │
│     └── ...other specialized importers                                                                               │
│                                                                                                                      │
│ Import flow:                                                                                                         │
│ 1. User selects demo in Merlin wizard                                                                                │
│ 2. Download demo data package from CMSMasters API                                                                    │
│ 3. Import content (posts, pages, media) via WXR                                                                      │
│ 4. Import Elementor templates                                                                                        │
│ 5. Import Elementor Kit settings                                                                                     │
│ 6. Import theme options via theme-options.php → update_option()                                                      │
│ 7. Import widgets, customizer, plugin-specific data                                                                  │
│                                                                                                                      │
│ First-time setup (separate from demo import):                                                                        │
│ - On theme activation, reads default-theme-options.json and default-kits.json                                        │
│ - Writes default options via update_option()                                                                         │
│ - Guard: cmsmasters_kuzmich_set_defaults = 'done' prevents re-run                                                    │
│                                                                                                                      │
│ Key Insight                                                                                                          │
│                                                                                                                      │
│ The theme-options.php importer already handles update_option() calls during demo import. Our cursor options just     │
│ need to be included in the demo data package that the importer processes.                                            │
│                                                                                                                      │
│ Options for Solution                                                                                                 │
│                                                                                                                      │
│ Option 1: Include cursor options in demo data (Recommended)                                                          │
│                                                                                                                      │
│ - Add elementor_custom_cursor_* options to the demo package that theme-options.php processes                         │
│ - Each demo can have its own cursor config (different demos = different cursor styles)                               │
│ - Requires: CMSMasters team to include these options when building demo packages                                     │
│ - Our part: Provide the option names + values list; possibly add a hook so the framework knows about our options     │
│ - Effort: Minimal code change, mostly coordination                                                                   │
│                                                                                                                      │
│ Option 2: Add cursor defaults to first-setup JSON                                                                    │
│                                                                                                                      │
│ - Add cursor options to default-theme-options.json                                                                   │
│ - Cursor is pre-configured on fresh theme activation                                                                 │
│ - Limitation: Same defaults for ALL demos (can't vary per demo)                                                      │
│ - Requires: Theme config change                                                                                      │
│                                                                                                                      │
│ Option 3: Hook into Merlin's after_import                                                                            │
│                                                                                                                      │
│ - Register cmsmasters_merlin_after_import hook in our addon                                                          │
│ - After any demo import, write cursor options from a config bundled with the demo                                    │
│ - Requires: Hook availability in Merlin + config format                                                              │
│                                                                                                                      │
│ Option 4: Move to Elementor Kit settings                                                                             │
│                                                                                                                      │
│ - Migrate global options from wp_options to Elementor Kit document                                                   │
│ - elementor-kit.php importer handles them automatically                                                              │
│ - Big architectural change — affects settings page, frontend.php, all option reads                                   │
│ - Most "correct" but highest effort                                                                                  │
│                                                                                                                      │
│ Conclusion                                                                                                           │
│                                                                                                                      │
│ The CMSMasters demo import system already has the infrastructure to import wp_options (theme-options.php importer).  │
│ Our cursor settings just need to be added to the demo data packages. This is primarily a coordination task with the  │
│ CMSMasters theme team, not a code change in the addon.                                                               │
│                                                                                                                      │
│ What we should provide to the theme team:                                                                            │
│ 1. List of all 9 option names with their expected values per demo                                                    │
│ 2. Ensure our settings-page.php sanitization handles imported values correctly (it already does — uses standard      │
│ WordPress Settings API)                                                                                              │
│                                                                                                                      │
│ No code changes needed in the addon unless we want to add:                                                           │
│ - A dedicated importer (Option 3) for more control                                                                   │
│ - Migration to Kit settings (Option 4) for future-proofing                                                           │
