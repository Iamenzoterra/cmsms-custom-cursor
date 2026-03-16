# Execution Log: WP-025 Phase 0 — Recon
> Executed: 2026-03-16T14:30:00Z
> Duration: ~25 minutes
> Status: COMPLETE

## Page Toggle Registration
- File: `modules/cursor-controls/module.php`
- Method: `register_page_cursor_controls()` (line 909)
- Hook: `elementor/element/after_section_end` (line 36)
- Current type: `Controls_Manager::SWITCHER` (line 995)
- Control ID: `cmsmasters_page_cursor_disable` (line 988)
- Page condition variable: `$page_toggle_condition` (line 1010-1012)
  - Show mode: `array( 'cmsmasters_page_cursor_disable' => 'yes' )` — opt-in
  - Full mode: `array( 'cmsmasters_page_cursor_disable' => '' )` — opt-out

## Page Sub-Control Conditions

All page sub-controls use `$page_toggle_condition`:

| Control | Line | Condition |
|---|---|---|
| `cmsmasters_page_cursor_theme` | 1015 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_smoothness` | 1030 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_blend_mode` | 1048 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_effect` | 1065 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_adaptive` | 1083 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_reset` | 1098 | `$page_toggle_condition` |
| `cmsmasters_page_cursor_color` | 1110 | `$page_toggle_condition` |

## get_document_cursor_state()
- File: `includes/frontend.php`
- Line range: 1258-1286
- Reads: `$document->get_settings( 'cmsmasters_page_cursor_disable' )` (line 1265)
- Logic:
  - mode='' (disabled): returns `enabled: false`
  - mode='widgets': `raw='yes'` → `enabled: true` (promoted); else `enabled: null`
  - mode='yes' (full): `raw='yes'` → `enabled: false` (disabled on page); else `enabled: true`

### Complete caller list (4 calls, all in frontend.php):

| Line | Method | Purpose |
|---|---|---|
| 1258 | Definition | — |
| 1386 | `should_enable_custom_cursor()` | Decides whether to enqueue scripts at all |
| 1578 | `add_cursor_body_class()` | Decides `cursor-enabled` vs `cursor-widget-only` body class |
| 1646 | `print_custom_cursor_html()` | Decides whether to print critical JS for promoted pages |

**Zero callers in modules/** — all consumption is in frontend.php.

## is_page_promoted() (WP-024)
- File: `modules/cursor-controls/module.php` line 1250-1271
- Reads: `$document->get_settings( 'cmsmasters_page_cursor_disable' )` (line 1264)
- Logic: returns `true` only when mode='widgets' AND toggle='yes'
- Cache: `$this->page_promoted_cache[$doc_id]` — per-request array cache (line 21), no invalidation needed (PHP dies per request)
- Used by: `is_show_render_mode($document)` (line 1288) — if promoted, treats as full render mode

## add_cursor_body_class() — page state handling
- Line 1569-1617
- Gates on `should_enable_custom_cursor()` first (line 1570)
- Widget-only mode:
  - `enabled: true` (promoted) → `cmsmasters-cursor-enabled`
  - `enabled: null` (not promoted) → `cmsmasters-cursor-widget-only`
- Full mode: always `cmsmasters-cursor-enabled`
- Then adds theme, dual, blend classes regardless of mode

## TBD RESOLVED: disable in sitewide

### Current behavior when page disabled in full mode (mode='yes', toggle='yes'):

1. `should_enable_custom_cursor()` checks `document_state['enabled']` (line 1436)
2. In full mode, toggle='yes' → `enabled: false`
3. `should_enable_custom_cursor()` returns `false` (line 1437)
4. **Consequence: `enqueue_custom_cursor()` returns early (line 1450-1451)**
5. **No CSS, no JS, no body class, no cursor HTML — complete disable**
6. `add_cursor_body_class()` also returns early (line 1570-1571)

### Evidence:
```php
// Line 1436-1438 in should_enable_custom_cursor():
if ( 'yes' === $mode && false === $document_state['enabled'] ) {
    return false;
}
```

### Recommendation for new 'disable' value:
The new `cmsmasters_page_cursor_mode = 'disable'` must produce `enabled: false` from `get_document_cursor_state()`. This makes `should_enable_custom_cursor()` return false in full mode, preventing all enqueue. Same behavior as current `toggle='yes'` in full mode. **No body class needed — nothing loads.**

In widgets mode, 'disable' should also return `enabled: false` to prevent cursor on that page entirely (unlike current behavior where widgets mode has no "disable" — only opt-in or null). This is a **new behavior**.

## Editor JS

### cursor-editor-sync.js
- Does NOT directly read `cmsmasters_page_cursor_disable` — zero references
- Receives pre-processed payload via `applyPageCursorSettings(p)` (line 850)
- Payload already has `enabled: true/false/null` computed by navigator-indicator.js
- **No changes needed here** — it consumes the normalized payload

### navigator-indicator.js
- `buildPageCursorPayload()` (line 866) reads `json.cmsmasters_page_cursor_disable` (line 869)
- Computes enabled state: `isShowMode ? (toggle === 'yes' ? true : null) : toggle !== 'yes'` (line 871)
- Reset button (line 1431) resets `cmsmasters_page_cursor_disable: ''`
- **Must update**: Change control ID from `cmsmasters_page_cursor_disable` to `cmsmasters_page_cursor_mode` and update value mapping logic

### Broadcast format
- `broadcastPageCursorChange()` (line 1104) calls `getPageCursorPayload()` which calls `buildPageCursorPayload(json)` — reads raw document settings JSON and normalizes
- NOT a blind pass-through — specific keys are extracted and mapped
- **Update needed in `buildPageCursorPayload()`**: read new control ID, map new values

## Dead Code

### window.cmsmCursorWidgetOnly
- Set in PHP: `frontend.php:1541` — `window.cmsmCursorWidgetOnly=true;`
- JS consumers in source files: **ZERO** (confirmed via grep)
  - custom-cursor.js: 0
  - cursor-editor-sync.js: 0
  - navigator-indicator.js: 0
- **Safe to remove** — was likely for a feature path that was superseded by body class detection

### window.cmsmCursorShowMode
- Set in PHP: `editor.php:222` — `window.cmsmCursorShowMode=true;`
- Read in: `cursor-editor-sync.js:13` — `var isShowMode = window.cmsmCursorShowMode || false;`
- **NOT dead** — still consumed by cursor-editor-sync.js for mode detection in preview iframe

## Complete Old Control ID References

### Source files (excluding .min.js and commit-backup/):

| File | Line | Context |
|---|---|---|
| `modules/cursor-controls/module.php` | 946 | Duplicate registration guard |
| `modules/cursor-controls/module.php` | 988 | Control registration (`add_control`) |
| `modules/cursor-controls/module.php` | 1011 | `$page_toggle_condition` (show mode) |
| `modules/cursor-controls/module.php` | 1012 | `$page_toggle_condition` (full mode) |
| `modules/cursor-controls/module.php` | 1264 | `is_page_promoted()` reads toggle |
| `includes/frontend.php` | 1265 | `get_document_cursor_state()` reads toggle |
| `assets/js/navigator-indicator.js` | 869 | `buildPageCursorPayload()` reads toggle |
| `assets/js/navigator-indicator.js` | 1431 | Reset button clears toggle |

**Total: 8 references across 3 source files**

## Surprises / Scope Impact

1. **Widget-only + disable is NEW behavior**: Currently widget-only mode has no page-level "disable" — only opt-in (toggle=yes) or default (null). The new 3-state adds a true disable that prevents cursor entirely on that page even in widget-only mode. `should_enable_custom_cursor()` currently only checks `false === $document_state['enabled']` for mode='yes'. Need to add same check for mode='widgets'.

2. **`is_page_promoted()` needs 3-state logic**: Currently checks `toggle === 'yes'`. New control: `mode === 'customize'` means promoted. `mode === 'disable'` means disabled. `mode === 'default'` means not promoted.

3. **Element-level CHOOSE_TEXT (WP-023) is a good pattern reference**: Lines 130-147 show existing CHOOSE_TEXT with mode-dependent options. Page control should follow same pattern but with `default`/`customize`/`disable` values.

4. **Navigator indicator reset button**: Line 1431 must update from `cmsmasters_page_cursor_disable: ''` to `cmsmasters_page_cursor_mode: 'default'`.

5. **`cmsmCursorWidgetOnly` is dead code** — can be cleaned up in this WP or separately.

## Contract Decisions (pre-code gate)

### disable in sitewide body class: NO BODY CLASS NEEDED
- Evidence: `should_enable_custom_cursor()` returns false → nothing enqueues → no classes, no JS, no HTML
- Decision: `get_document_cursor_state()` returns `enabled: false` for `mode='disable'` in both full and widgets modes

### Editor JS update needed? YES — scoped to navigator-indicator.js
- `buildPageCursorPayload()`: read `cmsmasters_page_cursor_mode` instead of `_disable`, map `'customize'→true, 'disable'→false, 'default'→null` (widgets) or `'customize'→true, 'disable'→false, 'default'→true` (full)
- Reset button: change key from `cmsmasters_page_cursor_disable: ''` to `cmsmasters_page_cursor_mode: 'default'`
- cursor-editor-sync.js: NO changes needed (consumes normalized payload)

### Cache invalidation needed? NO
- `page_promoted_cache` is per-PHP-request only (array property, no persistent cache)
- Editor uses postMessage (no PHP involved)

### New value mapping for get_document_cursor_state():

| Mode | New value | enabled |
|---|---|---|
| '' (disabled) | any | `false` |
| 'widgets' | 'default' | `null` (widget-only) |
| 'widgets' | 'customize' | `true` (promoted) |
| 'widgets' | 'disable' | `false` (no cursor at all) |
| 'yes' (full) | 'default' | `true` (cursor active) |
| 'yes' (full) | 'customize' | `true` (cursor active + overrides) |
| 'yes' (full) | 'disable' | `false` (no cursor) |

### Backward compatibility:
- Existing pages have `cmsmasters_page_cursor_disable = ''` or `'yes'`
- New control `cmsmasters_page_cursor_mode` won't exist → `get_settings()` returns `''`
- Must treat `''` (empty/missing) same as `'default'` for BC
- Old `'yes'` value from `_disable` will NOT be read anymore — but Elementor stores settings per-document, so old documents still have `_disable='yes'`. Need migration or fallback read.

### CRITICAL: Migration concern
- Old documents saved with `cmsmasters_page_cursor_disable = 'yes'` will NOT have `cmsmasters_page_cursor_mode` set
- Options:
  1. **Fallback read**: If new control is empty/default, check old control as fallback
  2. **Migration script**: Batch update postmeta — risky, heavy
  3. **Dual read in get_document_cursor_state()**: Read new first, fall back to old with value mapping

**Recommendation**: Option 3 (dual read) — zero migration needed, BC is automatic. Old `_disable='yes'` maps to `'customize'` in widgets mode, `'disable'` in full mode (preserving current semantic flip behavior during transition).
