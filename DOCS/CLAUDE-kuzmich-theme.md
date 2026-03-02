# Kuzmich Theme — Claude Code Instructions

WordPress theme based on CMSMasters framework. Provides Elementor Kit controls for the **Custom Cursor** addon and other theme-specific features.

---

## Repo Structure (expected)

```
kuzmich-theme/
├── style.css                        ← Theme header (Name, Version, Text Domain)
├── functions.php                    ← Theme init — enqueues, hooks, addon loading
├── theme-config/
│   ├── assets/
│   │   ├── dev/scss/
│   │   │   └── default-vars/general/  ← Theme CSS custom property defaults (SCSS)
│   │   └── js/
│   └── inc/
│       └── kit/                     ← Kit tab registrations (Site Settings)
│           └── cursor.php           ← ★ Custom Cursor Kit controls (11 controls)
├── demo/                            ← Demo import packages (XML + Kit JSON)
│   ├── light/
│   │   └── kit.json                 ← Light demo cursor settings
│   └── dark/
│       └── kit.json                 ← Dark demo cursor settings
└── cmsmasters-elementor-addon/      ← Addon plugin (READ-ONLY reference)
```

---

## Custom Cursor — Kit Controls

The cursor addon reads all global settings from Elementor Kit via:
```php
Utils::get_kit_option('cmsmasters_custom_cursor_{suffix}', $default)
```

These controls must be registered in the Kit (Site Settings) for users to configure the cursor. They are registered by THIS theme, not by the cursor addon plugin.

### Control Registration Pattern

```php
// In Kit tab registration (e.g., theme-config/inc/kit/cursor.php)
// Hooked to: elementor/element/kit/{section_id}/after_section_end
// Or via dedicated Kit tab: elementor/documents/register

$element->add_control(
    'cmsmasters_custom_cursor_visibility',
    [
        'label'   => __('Custom Cursor', 'kuzmich'),
        'type'    => Controls_Manager::SELECT,
        'default' => 'elements',
        'options' => [
            'hide'     => __('Disabled', 'kuzmich'),
            'elements' => __('Widgets Only', 'kuzmich'),
            'show'     => __('Enabled', 'kuzmich'),
        ],
    ]
);
```

### Complete Kit Controls Reference (11 controls)

All control IDs use prefix `cmsmasters_custom_cursor_`:

| Control ID (suffix) | Type | Default | Options / Notes |
|---|---|---|---|
| `visibility` | SELECT | `'elements'` | `'hide'`/`'elements'`/`'widgets'` → maps to `''`/`'widgets'`/`'yes'` internally |
| `editor_preview` | SELECT | `''` | `''`=Disabled, `'yes'`=Enabled |
| `show_system_cursor` | SELECT | `'yes'` | `'yes'`=show, `''`=hide system cursor |
| `cursor_color` | COLOR | `''` | Supports `__globals__` (kit color links) |
| `adaptive_color` | SELECT | `''` | `''`=Disabled, `'yes'`=Enabled |
| `cursor_style` | SELECT | `'dot_ring'` | `'dot_ring'`=Classic (dot+ring), `'dot'`=Dot Only |
| `cursor_size` | NUMBER | `8` | Dot diameter in px |
| `size_on_hover` | NUMBER | `40` | Hover diameter in px |
| `smoothness` | SELECT | `'normal'` | `'precise'`/`'snappy'`/`'normal'`/`'smooth'`/`'fluid'` |
| `blend_mode` | SELECT | `'soft'` | `'disabled'`/`'soft'`/`'medium'`/`'strong'` → `'disabled'` maps to `''` |
| `wobble_effect` | SELECT | `'yes'` | `''`=Disabled, `'yes'`=Enabled |

### Value Mapping (Kit → Internal)

The cursor addon maps Kit values to internal values in `frontend.php::get_page_cursor_setting()`:

```
Kit visibility: 'show'     → internal 'yes'    (cursor everywhere)
Kit visibility: 'elements' → internal 'widgets' (cursor on tagged elements only)
Kit visibility: 'hide'     → internal ''        (cursor disabled)

Kit cursor_style: 'dot_ring' → internal 'classic'
Kit blend_mode: 'disabled'   → internal ''
```

**Important:** Use Kit values in the controls (`'dot_ring'`, not `'classic'`). The addon handles the mapping.

---

## Demo Import — Cursor Settings

When creating/updating demo packages, include cursor settings in the Kit JSON export.

### Critical settings that MUST be in demo Kit

```json
{
  "cmsmasters_custom_cursor_visibility": "show",
  "cmsmasters_custom_cursor_editor_preview": "yes",
  "cmsmasters_custom_cursor_cursor_color": "#222222",
  "cmsmasters_custom_cursor_cursor_style": "dot_ring",
  "cmsmasters_custom_cursor_cursor_size": 8,
  "cmsmasters_custom_cursor_size_on_hover": 40,
  "cmsmasters_custom_cursor_smoothness": "smooth",
  "cmsmasters_custom_cursor_blend_mode": "soft",
  "cmsmasters_custom_cursor_wobble_effect": "yes",
  "cmsmasters_custom_cursor_adaptive_color": "yes",
  "cmsmasters_custom_cursor_show_system_cursor": ""
}
```

**Why this matters:** `visibility` defaults to `'elements'` and `editor_preview` defaults to `''` in code. Without these in the demo Kit, the cursor is NOT enabled on fresh demo import.

---

## CSS Custom Properties — Cursor Integration

The cursor addon reads colors via PHP inline CSS bridge. The bridge outputs:
```css
:root {
    --cmsmasters-cursor-color: {resolved_color};
    --cmsmasters-cursor-color-dark: {resolved_color};
}
```

Where `resolved_color` comes from either:
1. The custom color set in the Kit (`cmsmasters_custom_cursor_cursor_color`)
2. A Kit system color if `__globals__` reference used

### Theme Default Vars

If the theme defines default CSS custom properties (e.g., `--cmsmasters-text-color`), the cursor's `:root` defaults in `custom-cursor.css` should reference them:

```css
/* custom-cursor.css — currently hardcoded, should reference theme vars */
:root {
    --cmsmasters-cursor-color: var(--cmsmasters-text-color, #222);
    --cmsmasters-cursor-color-light: var(--cmsmasters-bg-color, #fff);
    --cmsmasters-cursor-color-dark: var(--cmsmasters-text-color, #222);
}
```

This is a **known architecture gap** (AUDIT-ARCHITECTURE.md). Check if these SCSS vars are compiled to CSS custom properties in `theme-config/assets/dev/scss/default-vars/general/`.

---

## Architecture Invariants

### What theme MUST provide

1. **Kit control registration** — 11 cursor controls (see table above)
2. **Demo Kit JSON** — cursor settings in every demo package
3. **No wp_options for cursor** — settings live in Kit, not `get_option()`

### What theme MUST NOT do

1. Register cursor controls with wrong prefixes → addon won't find them
2. Change Kit option keys after deployment → breaks existing saved settings
3. Set `visibility` default to `'hide'` → cursor disabled on fresh install

---

## Cursor Addon Integration Points

The cursor addon (plugin) connects to this theme via:

1. **Kit reads** — `Utils::get_kit_option('cmsmasters_custom_cursor_*')` in:
   - `includes/frontend.php` — body classes, scripts, CSS vars
   - `includes/editor.php` — preview iframe scripts
   - `modules/cursor-controls/module.php` — widget control registration

2. **Filter hook** — theme can override cursor theme:
   ```php
   add_filter('cmsmasters_custom_cursor_theme', function($theme) {
       return 'dot'; // override for this theme
   });
   ```

3. **Body classes** — PHP renders these on `<body>` tag:
   - `cmsmasters-cursor-enabled` / `cmsmasters-cursor-widget-only`
   - `cmsmasters-cursor-theme-{classic|dot}`
   - `cmsmasters-cursor-blend` + `cmsmasters-cursor-blend-{soft|medium|strong}`
   - `cmsmasters-cursor-wobble`
   - `cmsmasters-cursor-dual`

---

## Workflow When Modifying Cursor Kit Controls

1. Edit Kit control registration file (e.g., `theme-config/inc/kit/cursor.php`)
2. If adding a NEW control: add corresponding `Utils::get_kit_option()` read in cursor addon's `frontend.php`
3. If changing option VALUES: update value mapping in cursor addon's `get_page_cursor_setting()`
4. Update demo Kit JSON packages
5. Test: check body classes in DevTools, check cursor appears in frontend + editor preview

---

## Related Repos

| Repo | Purpose | Connection |
|---|---|---|
| `cmsmasters-elementor-addon` | Base plugin (57 modules) | Theme extends this plugin's `Frontend` and `Editor` classes |
| `custom-cursor` (addon) | Cursor feature code | Reads Kit controls from THIS theme; adds cursor methods to plugin files |

---

## Key Files in Cursor Addon (cross-reference)

| File | What it reads from Kit | Notes |
|---|---|---|
| `includes/frontend.php` | `visibility`, `editor_preview`, `cursor_color`, `adaptive_color`, `cursor_style`, `cursor_size`, `size_on_hover`, `smoothness`, `blend_mode`, `wobble_effect`, `show_system_cursor` | Main PHP logic |
| `includes/editor.php` | `visibility`, `editor_preview` | Preview iframe scripts |
| `modules/cursor-controls/module.php` | `visibility` | Control registration guards |
