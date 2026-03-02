# CMSMasters Elementor Addon — Claude Code Instructions

WordPress plugin that extends Elementor with ~57 feature modules (widgets, effects, integrations).

---

## Repo Structure

```
cmsmasters-elementor-addon/
├── cmsmasters-elementor-addon.php   ← Main plugin file (constants, bootstrap)
├── includes/
│   ├── plugin.php                   ← Plugin singleton, init
│   ├── frontend.php                 ← Frontend hooks (scripts/styles/body_class)
│   ├── editor.php                   ← Elementor editor hooks
│   ├── admin.php                    ← WP admin hooks
│   ├── utils.php                    ← Static helpers (get_kit_option, get_active_kit…)
│   ├── autoloader.php               ← PSR-4: CmsmastersElementor\ → includes/
│   ├── base/
│   │   ├── base-app.php             ← Abstract: get_name(), init_actions(), init_filters()
│   │   ├── base-module.php          ← Abstract base for all modules
│   │   ├── base-widget.php          ← Abstract base for all widgets
│   │   └── base-document.php        ← Abstract base for Elementor documents
│   └── managers/
│       ├── modules.php              ← Registers all modules by name
│       ├── controls.php             ← Registers custom Elementor controls
│       └── tags.php                 ← Registers dynamic tags
├── modules/                         ← ~57 feature modules
│   └── {name}/
│       └── module.php               ← Module class (CmsmastersElementor\Modules\{Name}\Module)
├── assets/
│   ├── js/                          ← Source JS (*.js) — edit these
│   ├── css/                         ← Source CSS (*.css) — edit these
│   └── lib/                         ← Vendor libs
└── languages/                       ← i18n pot/po/mo
```

---

## Build System

**Stack:** Grunt (via CMSMasters framework)

```
Source:    assets/**/*.js, assets/**/*.css
Minified:  assets/**/*.min.js, assets/**/*.min.css
Build:     npm run build   (= grunt build)
Watch:     npm run watch
```

**Rules:**
1. ALWAYS edit source files (`*.js`, `*.css`) — NEVER edit `*.min.*` directly
2. Server reads ONLY minified files
3. Remind user: `npm run build` after any code change

---

## Architecture Patterns

### Plugin Bootstrap

```php
// cmsmasters-elementor-addon.php
define('CMSMASTERS_ELEMENTOR_VERSION', '1.x.x');
CmsmastersElementor\Plugin::instance(); // singleton
```

### Module Pattern

Every feature is a module. Module class must:
1. Extend `Base_Module`
2. Have `get_name()` returning snake_case name
3. Be registered in `includes/managers/modules.php`
4. Live at: `modules/{name}/module.php` → class `CmsmastersElementor\Modules\{CamelCase}\Module`

```php
namespace CmsmastersElementor\Modules\MyFeature;
use CmsmastersElementor\Base\Base_Module;

class Module extends Base_Module {
    public function get_name() { return 'my-feature'; }
    protected function init_actions() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
    }
}
```

### Widget Pattern

All widgets extend `Base_Widget`:
```php
namespace CmsmastersElementor\Modules\MyFeature\Widgets;
use CmsmastersElementor\Base\Base_Widget;

class My_Widget extends Base_Widget {
    public function get_name() { return 'cmsmasters-my-widget'; }
    public function get_title() { return __('My Widget', 'cmsmasters-elementor'); }
    protected function register_controls() { /* Elementor controls */ }
    protected function render() { /* HTML output */ }
}
```

### Utils API

```php
use CmsmastersElementor\Utils;

// Kit settings (Elementor Site Settings)
Utils::get_kit_option('key', $default);        // reads active kit meta
Utils::get_kit_options();                       // returns full kit options array
Utils::get_active_kit();                        // returns active kit post ID

// Generic helpers
Utils::get_if_isset($array, 'key', $default);  // safe array access
```

### Frontend.php Extension Points

`Frontend` class handles:
- `wp_enqueue_scripts` → scripts + styles
- `body_class` filter → custom body classes
- `wp_footer` → cursor HTML, inline scripts

**⚠️ CRITICAL:** Never remove existing script dependencies from `cmsmasters-frontend`. Other widgets depend on `anime.js`, `vanilla-tilt`, `basicScroll`, `hc-sticky`, `headroom`.

---

## Cursor Integration

The **Custom Cursor** addon (separate repo) extends this plugin with a cursor feature. Integration points:

### What the cursor addon ADDS to this repo

| Location | What | Purpose |
|---|---|---|
| `includes/frontend.php` | 3 hook registrations + 7 cursor methods | Script/style/class enqueue + HTML output |
| `includes/editor.php` | Preview scripts hook + cursor mode helpers | Cursor in Elementor preview iframe |
| `modules/cursor-controls/module.php` | ~50 Elementor controls | Widget/page cursor settings UI |

### Kit Options Read by Cursor (registered by Kuzmich theme)

All read via `Utils::get_kit_option('cmsmasters_custom_cursor_{suffix}', $default)`:

| Kit Suffix | Default | Values | Purpose |
|---|---|---|---|
| `visibility` | `'elements'` | `'show'`/`'elements'`/`'hide'` | Global cursor on/off/widgets |
| `editor_preview` | `''` | `''`/`'yes'` | Show cursor in preview iframe |
| `show_system_cursor` | `'yes'` | `'yes'`/`''` | Dual mode (show system cursor too) |
| `cursor_color` | — | hex / `__globals__` ref | Cursor color (resolves via kit) |
| `adaptive_color` | `''` | `''`/`'yes'` | Adaptive luminance detection |
| `cursor_style` | `'dot_ring'` | `'dot_ring'`/`'dot'` | Classic vs dot-only theme |
| `cursor_size` | `8` | integer px | Dot diameter |
| `size_on_hover` | `40` | integer px | Hover diameter |
| `smoothness` | `'normal'` | `'precise'`/`'snappy'`/`'normal'`/`'smooth'`/`'fluid'` | Ring lerp speed |
| `blend_mode` | `'soft'` | `''`/`'soft'`/`'medium'`/`'strong'` | mix-blend-mode intensity |
| `wobble_effect` | `'yes'` | `'yes'`/`''` | Wobble animation |

### Cursor Settings Cascade (priority order)

```
Widget data-cursor-* attrs  >  Page Document meta  >  Kit globals  >  Code defaults
```

---

## Key Invariants — NEVER Break

1. **`cmsmasters-frontend` script dependencies** — never remove libs; other widgets depend on them
2. **Base class contracts** — `get_name()` must be unique per module/widget
3. **Namespace PSR-4** — `CmsmastersElementor\Modules\{CamelName}` maps to `modules/{kebab-name}/`
4. **Module registration** — every module needs entry in `includes/managers/modules.php`
5. **Sanitization** — all user input: `sanitize_text_field()`, `esc_attr()`, `esc_url()`, `intval()`
6. **Kit API timing** — `Utils::get_kit_option()` is available at `wp_enqueue_scripts` priority 20+

---

## Adding a New Module — Checklist

1. Create `modules/{name}/module.php` with correct namespace + `get_name()`
2. Register in `includes/managers/modules.php` `get_modules_names()` array
3. If module has widgets: register via `$this->add_component('widgets', new Widgets_Manager())`
4. Follow existing module's `init_actions()` / `init_filters()` pattern
5. Assets: add to Grunt config if new JS/CSS files
6. `npm run build`

---

## Common Pitfalls

| Pitfall | Consequence | Rule |
|---|---|---|
| Removing script deps from `cmsmasters-frontend` | Breaks Swap Button, Image Accordion, other widgets | Never touch dep array |
| Editing `*.min.*` directly | Changes lost on next build | Always edit source |
| Missing `get_name()` uniqueness | Module registration conflict | Check existing names first |
| `wp_strip_all_tags()` on CSS output | Strips `>` child selectors | Never use on CSS |
| Raw `innerHTML` with user data | XSS vector | Always sanitize + use text content |
| Direct `$_GET`/`$_POST` without nonce | CSRF | Use `wp_verify_nonce()` |

---

## Workflow

1. Edit source files in `assets/`, `includes/`, `modules/`
2. `npm run build` (or `npm run watch` during dev)
3. Test in browser
4. Commit source + minified files together
