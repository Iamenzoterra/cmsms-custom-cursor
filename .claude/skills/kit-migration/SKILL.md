---
name: cmsmasters-kit-migration
description: >
  Knowledge base for CMSMasters Custom Cursor Kit Settings Migration (WP-020). Covers migration
  of 11 cursor settings from wp_options to Elementor Kit postmeta via Kuzmich theme architecture.
  Use this skill when working on frontend.php get_option() replacement, Utils::get_kit_option() calls,
  get_cursor_mode() value mapping, get_page_cursor_setting() cascade, trueGlobalBlend Kit-only read,
  cursor_color __globals__ resolution, Theme_Config constants, SCSS default vars, Kit control IDs,
  CSS variable override mechanism, or anything involving the transition from wp_options to Kit.
  Also trigger for Kuzmich theme Kit architecture, Section/Toggle registration, get_control_id_prefix,
  Settings_Tab_Base patterns, cmsmasters_kuzmich_default_kits, or two-repo workflow (addon + theme).
  Even for seemingly simple get_option→get_kit_option replacements, ALWAYS consult this skill —
  value mappings, __globals__ traps, and blend_mode 'disabled' truthy issues cause silent breakage.
---

# Kit Settings Migration — Claude Code Skill

## Why This Migration Exists

Custom Cursor stored 12 globals as `wp_options`. This broke CMSMasters architecture where all theme-level globals live in Elementor Kit. Consequences: demo import/export skips cursor settings, light/dark demo switching ignores cursor, one addon can't serve multiple themes with different defaults.

**Decision:** Kit = single source of truth. No backward compatibility needed (no production sites).

---

## Kuzmich Kit Architecture

### Registration hierarchy

```
Module (entry point)
├── Controls_Manager (3 custom controls: choose_text, custom_repeater, selectize)
├── Kit_Globals (8 colors + 16 typographies)
├── Frontend (font enqueue)
└── Kit Document (replaces Elementor Kit)
    └── Settings (tabs/sections/toggles)
        ├── Base_Section (section meta-info)
        └── Settings_Tab_Base (actual controls)
```

### Section → Toggle pattern

```
Section (Base_Section) — UI tab meta-info
  └── Toggle (Settings_Tab_Base) — Elementor controls
```

Our case: section `custom-cursor` → toggle `cursor`.

### Section registration (kits/documents/kit.php)

```php
if ( class_exists( 'Cmsmasters_Elementor_Addon' ) ) {
    $sections = array_merge( $sections, array(
        'custom-cursor',    // ← OUR SECTION
        'lazyload-widget',
        'mode-switcher',
    ) );
}
```

Auto-maps to PHP class: `KuzmichSpace\Kits\Settings\CustomCursor\Section`

### Naming conventions

| What | Format | Example |
|---|---|---|
| Section name | `kebab-case` | `custom-cursor` |
| Toggle name | `snake_case` | `cursor` |
| PHP namespace | `PascalCase` | `CustomCursor` |
| Control ID | `{prefix}_{slug}` | `cmsmasters_custom_cursor_visibility` |
| CSS var | dashes | `--cmsmasters-custom-cursor-cursor-color` |
| Section ID (auto) | `{group}_{section}_{toggle}` | `cmsmasters_theme_custom_cursor_cursor` |

### Default values — two levels

1. **Theme_Config constants** — PHP constants in `theme-config/theme-config.php`
2. **`cmsmasters_kuzmich_default_kits`** — WP option with `[control_id => value]` array

Toggle reads: `$this->get_default_setting($this->get_control_id('slug'))` → option → fallback to Theme_Config constant.

---

## The 11 Kit Controls

| # | Old wp_option suffix | New Kit slug | Type | Default | CSS var? |
|---|---|---|---|---|---|
| 1 | `enabled` | `visibility` | SELECT | `elements` | ❌ |
| 2 | `theme` | `cursor_style` | CHOOSE_TEXT | `dot` | ❌ |
| 3 | `dual_mode` | `show_system_cursor` | SWITCHER | `yes` | ❌ |
| 4 | `color`+`color_source` | `cursor_color` | COLOR | (empty) | ✅ |
| 5 | `adaptive` | `adaptive_color` | SWITCHER | `yes` | ❌ |
| 6 | `blend_mode` | `blend_mode` | CHOOSE_TEXT | `soft` | ❌ |
| 7 | `dot_size` | `cursor_size` | NUMBER | `8` | ✅ |
| 8 | `dot_hover_size` | `size_on_hover` | NUMBER | `40` | ✅ |
| 9 | `smoothness` | `smoothness` | SELECT | `smooth` | ❌ |
| 10 | `wobble` | `wobble_effect` | SWITCHER | `yes` | ❌ |
| 11 | `editor_preview` | `editor_preview` | SWITCHER | (off) | ❌ |

**Dropped:** `color_source` (Kit COLOR natively supports `__globals__`), `widget_override` (legacy).

### Verified Kit control IDs (from actual DB payload)

| Slug in cursor.php | Actual Kit key |
|---|---|
| `visibility` | `cmsmasters_custom_cursor_visibility` |
| `cursor_style` | `cmsmasters_custom_cursor_cursor_style` |
| `show_system_cursor` | `cmsmasters_custom_cursor_show_system_cursor` |
| `cursor_color` | `cmsmasters_custom_cursor_cursor_color` |
| `adaptive_color` | `cmsmasters_custom_cursor_adaptive_color` |
| `blend_mode` | `cmsmasters_custom_cursor_blend_mode` |
| `cursor_size` | `cmsmasters_custom_cursor_cursor_size` |
| `size_on_hover` | `cmsmasters_custom_cursor_size_on_hover` |
| `smoothness` | `cmsmasters_custom_cursor_smoothness` |
| `wobble_effect` | `cmsmasters_custom_cursor_wobble_effect` |
| `editor_preview` | `cmsmasters_custom_cursor_editor_preview` |

---

## CSS Variables — Only 3

| CSS var | SCSS fallback | Why var |
|---|---|---|
| `--cmsmasters-custom-cursor-cursor-color` | `var(--cmsmasters-colors-text)` | Visual style |
| `--cmsmasters-custom-cursor-cursor-size` | `8px` | Visual style |
| `--cmsmasters-custom-cursor-size-on-hover` | `40px` | Visual style |

Other 8 are **logic settings** (change DOM/JS behavior/enqueue decisions). Rule: "CSS var where possible and logical. Does not change DOM structure."

### CSS var override mechanism

```
1. SCSS → :root { --cmsmasters-custom-cursor-cursor-color: var(--cmsmasters-colors-text); }
   ↑ ALWAYS PRESENT, never empty

2. Kit save → Elementor writes inline on :root:
   --cmsmasters-custom-cursor-cursor-color: #ff0000;
   ↑ OVERRIDES SCSS default

3. Kit clear → inline disappears → SCSS default restores
   → cursor-color = theme text color again
```

---

## Utils Kit API

```
Utils::get_kit_option($key, $def=false)     ← MAIN ACCESSOR
│
├── get_kit_options()                       ← Returns ALL Kit settings
│   └── get_active_kit()                    ← Kit document ID
│       └── get_option('elementor_active_kit')
│           └── apply_filters('cmsmasters_translated_template_id')  ← WPML
│
└── [fallback] get_default_kit($key, $def)  ← Theme defaults
    └── get_default_kits()
        └── get_option(CMSMASTERS_OPTIONS_PREFIX . 'default_kits')
```

Fallback chain: Kit post_meta → theme default kits option → `$def` parameter.

Performance: `get_kit_options()` calls `get_post_meta()` — WordPress object cache auto-caches after first call. 10 calls = 1 SQL + 9 from cache.

---

## Value Mapping (CRITICAL)

### get_cursor_mode() — visibility mapping

| Kit value | Internal value | Meaning |
|---|---|---|
| `'show'` | `'yes'` | Cursor everywhere |
| `'elements'` | `'widgets'` | Widget-only mode |
| `'hide'` | `''` | Disabled |

Mapping happens inside `get_cursor_mode()` — all consumers unchanged.

### cursor_style mapping

| Kit value | Internal value |
|---|---|
| `'dot_ring'` | `'classic'` |
| `'dot'` | `'dot'` (unchanged) |

### blend_mode mapping

| Kit value | Internal value |
|---|---|
| `'disabled'` | `''` (empty) |
| `'soft'`/`'medium'`/`'strong'` | same |

**TRAP:** Old default was `''` (falsy). New Kit default is `'disabled'` (truthy). Code checking `empty($blend)` BREAKS. Need explicit `'disabled' !== $blend` check.

### color — separate path

Old: two fields (`color_source` + `color`). New: single COLOR with `__globals__` support. `color_source` dropped entirely.

### Other settings — no mapping needed

`show_system_cursor`, `adaptive_color`, `smoothness`, `wobble_effect`, `editor_preview` — same values `'yes'`/`''`.

Size: string `'8'` → number `8` (minor, `intval()` handles it).

---

## __globals__ Color Trap (CRITICAL)

When user selects a global color (e.g., Accent), Elementor stores:

```json
{
    "cmsmasters_custom_cursor_cursor_color": "",
    "__globals__": {
        "cmsmasters_custom_cursor_cursor_color": "globals/colors?id=accent"
    }
}
```

**`Utils::get_kit_option()` returns `""` (empty string)** — it reads only the main field, not `__globals__`.

**Solution:** For color, use `$kit->get_settings_for_display()` which auto-resolves `__globals__` → hex value. Or rely on CSS var mechanism (Kit selectors write resolved hex to CSS var on `:root`).

---

## Cascade Implementation

```php
private function get_page_cursor_setting( $page_key, $global_key, $default = '' ) {
    // 1. Page setting
    $document = $this->get_current_page_document();
    if ( $document ) {
        $page_value = $document->get_settings_for_display( 'cmsmasters_page_cursor_' . $page_key );
        if ( ! empty( $page_value ) ) return $page_value;
    }
    if ( empty( $global_key ) ) return $default;

    // 2. Map legacy keys → Kit suffixes
    static $kit_key_map = array(
        'adaptive' => 'adaptive_color',
        'theme'    => 'cursor_style',
    );
    $kit_suffix = isset( $kit_key_map[ $global_key ] ) ? $kit_key_map[ $global_key ] : $global_key;

    // 3. Kit setting
    return Utils::get_kit_option( 'cmsmasters_custom_cursor_' . $kit_suffix, $default );
}
```

### trueGlobalBlend — special case

```php
// Reads ONLY from Kit global, NEVER from page
$global_blend = Utils::get_kit_option( 'cmsmasters_custom_cursor_blend_mode', 'disabled' );
```

Must normalize `'disabled'` → `''` before outputting to `window.cmsmCursorTrueGlobalBlend`.

---

## Complete get_option() → Kit Replacement Map

14 `get_option('elementor_custom_cursor_*')` calls to replace:

| Old key suffix | Location | New Kit key suffix | Notes |
|---|---|---|---|
| `_enabled` | frontend get_cursor_mode() | `_visibility` | Value mapping: show/elements/hide |
| `_widget_override` | frontend BC fallback | **DELETE** | Legacy |
| `_editor_preview` | frontend should_enable | `_editor_preview` | Direct read |
| `_dot_size` | frontend enqueue | `_cursor_size` | CSS var handles it |
| `_dot_hover_size` | frontend enqueue | `_size_on_hover` | CSS var handles it |
| `_blend_mode` | frontend trueGlobalBlend | `_blend_mode` | Default `''` → `'disabled'` |
| `_dual_mode` | frontend body class | `_show_system_cursor` | Same pattern |
| `_wobble` | frontend body class | `_wobble_effect` | Same pattern |
| `_color_source` | frontend get_cursor_color | **DELETE** | Kit COLOR handles globals |
| `_color` | frontend get_cursor_color | `_cursor_color` | Use get_settings_for_display() |
| `_adaptive` | frontend cascade | `_adaptive_color` | Via get_page_cursor_setting() |
| `_theme` | frontend cascade | `_cursor_style` | Via get_page_cursor_setting() |
| `_smoothness` | frontend cascade | `_smoothness` | Via get_page_cursor_setting() |
| `_blend_mode` | frontend cascade | `_blend_mode` | Via get_page_cursor_setting() |

All new keys have prefix `cmsmasters_custom_cursor` (Kit) instead of `elementor_custom_cursor` (wp_options).

---

## Two-Repo Infrastructure

```
c:\work\cmsaddon\custom-cursor\
├── github/                    ← Addon dev repo (CC works here)
│   ├── assets/ includes/ modules/
│   └── commit/                ← npm run build → deployment files
│
├── cmsmasters-elementor-addon/ ← Addon production repo
│   → git push → GitHub Actions → rsync → Hetzner (15-30 sec)
│
└── kuzmich/                   ← Theme repo (git clone -b dev)
    ├── kits/                  ← Kit sections live here
    ├── theme-config/          ← Theme_Config + SCSS default vars
    └── build/                 ← grunt build → theme zip (manual upload)
```

**Rule: one CC session = one repo.**

---

## Risks to Watch

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R5 | Cascade breakage after source change | Page overrides broken | Key mapping in get_page_cursor_setting() |
| R6 | trueGlobalBlend reads wrong source | Widget blend leaks page blend | Explicit separate Kit read |
| R7 | `__globals__` color not resolved | cursor_color empty | Use get_settings_for_display() for color |
| R8 | blend_mode `'disabled'` truthy | Blend always on | Add `'disabled' !== $blend` check |
| R9 | Value mismatch Kit↔internal | get_cursor_mode() returns unknown | Mapping array inside function |

---

## What Does NOT Change

| Component | Why unchanged |
|---|---|
| `custom-cursor.js` | Reads from DOM, source-agnostic |
| `custom-cursor.css` | Pure CSS, no settings |
| `cursor-editor-sync.js` | postMessage, source-agnostic |
| `navigator-indicator.js` | Window config, source-agnostic |
| Page controls (8) | Already in Elementor document meta |
| Widget controls (43) | Already in Elementor widget JSON |

---

## Phase Status

| Phase | Repo | Status |
|---|---|---|
| Phase 1: Kit controls in Kuzmich | kuzmich/ | ✅ DONE (commit `06a977b`) |
| Phase 2: Addon frontend.php migration | github/ | ⏳ |
| Phase 3: Remove settings page | github/ | ⏳ |
| Phase 4: Manual testing | — | ⏳ |
| Phase 5: Documentation | github/ | ⏳ |

### Phase 1 key discoveries

- `add_control()` has no explicit prefix — `get_control_id_prefix()` override in our class adds it
- `get_control_id_parameter()` for conditions (different from `get_control_id()`)
- `get_control_name_parameter()` for defaults (may differ from control ID)
- SIZE defaults need array normalization: `Theme_Config::CUSTOM_CURSOR_SIZE_DEFAULT` = `array('size' => '8', 'unit' => 'px')` — NUMBER control needs scalar → extract `['size']`
- Textdomain is `kuzmich` (verified from existing Kit settings files)

---

## Team Decisions

| Decision | Who | Key detail |
|---|---|---|
| Kit = single source of truth | Женя + Сергій | Demo import/export pipeline |
| Settings page UI removed | Женя | Archived in separate branch |
| Kit controls live in theme (Kuzmich) | Сергій | "Kits are in the theme" |
| CSS vars only for styles | Сергій | "Does not change DOM structure" |
| cursor_color fallback on text color | Сергій | `var(--cmsmasters-colors-text)` — always has value |
| Use Utils::get_kit_option() | Сергій | Existing API, don't create new accessor |
| color_source dropped | Brain (Claude) | Kit COLOR handles globals natively |
| get_cursor_mode() preserves old return values | Brain (Claude) | Mapping inside function, consumers unchanged |