# Development Log

Living document tracking development sessions, decisions, and iterations.

---

## 2026-03-11 — Fix system cursor hidden on special cursor zones when preview OFF

**Problem (reported by Yulia):** In the Elementor editor with Custom Cursor Preview OFF, elements with special cursor (image/text/icon) show no cursor at all — even the system cursor is hidden.

**Root cause — two unscoped CSS rules:**

1. **`custom-cursor.css`** — Three `cursor:none!important` rules on attribute selectors were completely unscoped:
   ```css
   [data-cursor-image], [data-cursor-image] * { cursor:none!important }
   [data-cursor-text], [data-cursor-text] * { cursor:none!important }
   [data-cursor-icon], [data-cursor-icon] * { cursor:none!important }
   ```
   These applied ALWAYS — regardless of dual mode, cursor-disabled state, or any body class.

2. **`cursor-editor-sync.js`** — Override rules for `cursor-disabled` state had `:not(.cmsmasters-cursor-dual)`, so in dual mode they didn't apply:
   ```css
   body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) * { cursor: inherit !important; }
   ```
   Result: in dual mode + preview OFF, no CSS restored the system cursor on special zones.

**Fix:**

1. **`custom-cursor.css`** — Scoped all three special cursor `cursor:none` rules with `body:not(.cmsmasters-cursor-dual)`. In dual mode, system cursor stays visible on special zones (consistent with dual mode intent).

2. **`cursor-editor-sync.js`** — Added explicit overrides for `[data-cursor-image/text/icon]` attribute selectors with higher specificity (0,3,1 > 0,2,1). All rules keep `:not(.cmsmasters-cursor-dual)` — see regression note below.

**Regression caught:** Initial fix removed `:not(.cmsmasters-cursor-dual)` from `cursor-disabled` rules, breaking the pointer cursor fix from 2026-03-10 (6 iterations). `cursor:inherit!important` on `*` without dual mode exclusion overrides `cursor:pointer` on links/buttons. Restored `:not(.cmsmasters-cursor-dual)` — in dual mode, the CSS fix (#1) already prevents `cursor:none` on special zones, so no editor-sync override is needed.

**Key insight:** In dual mode, the solution is to NOT APPLY `cursor:none` at all (via CSS scoping), rather than applying it and then overriding back. The `:not(.cmsmasters-cursor-dual)` pattern on both the hiding AND restoring rules means dual mode sees neither — browser defaults apply naturally, preserving pointer/text/etc. cursors.

---

## 2026-03-11 — Fix image cursor hover size: fallbacks, editor live-update, cache docs

**Problem (reported by Yulia):** Two issues with image cursor hover:
1. **Editor:** When editing hover size, cursor appears very small regardless of value set. Normal after re-save and refresh.
2. **Frontend:** Normal=80, Hover=50 configured, but cursor GROWS on hover instead of shrinking.

**Diagnosis:** Inspected live appointment page via Chrome — rendered attributes:
```
data-cursor-image-size="32"        (expected: 80)
data-cursor-image-size-hover="100" (expected: 50)
```
This explains growth: 32→100 on hover. Three separate root causes identified:

### Fix 1: Fallback values mismatch with control defaults

**Root cause:** PHP and JS fallback values (32/48) didn't match Elementor control defaults (80/100). When user never explicitly moves a slider (displays default 80), Elementor doesn't store the value. Raw `get_data()['settings']` returns null → fallback kicks in → wrong size.

| Control | Elementor default | Old fallback | Fixed |
|---------|-------------------|-------------|-------|
| `size_normal` | 80px | 32px | 80px |
| `size_hover` | 100px | 48px | 100px |

Note: Icon cursor fallbacks (32/48) already matched their control defaults — no change needed.

**Changed in 3 files:**
- `module.php:1522-1523` — PHP render fallbacks
- `cursor-editor-sync.js:695-696` — editor sync fallbacks
- `custom-cursor.js:1818` — frontend JS fallback

### Fix 2: Editor doesn't live-update cursor on slider change

**Root cause:** `cursor-editor-sync.js` updates data-attributes on the DOM element, but `custom-cursor.js` reads attributes once (on mouse enter) and stores them in closure variables. Changing a slider in editor has no effect until mouse leaves and re-enters the zone.

**Solution:** Direct API call pattern (not custom events — avoids event coupling):
1. Added `_zoneEl` property to `SpecialCursorManager` — stores reference to the DOM element with cursor data-attributes
2. Added `refreshFromDOM(el)` method — re-reads all data-attributes from zone element and updates closure vars via `_updateProps()`. Handles image, icon, and text cursor types.
3. Exposed `window.cmsmastersCursor.refreshZone(el)` — public API for editor-sync
4. `cursor-editor-sync.js` calls `refreshZone(element)` after `applySettings()` updates attributes

Flow: slider change → broadcastCursorChange → postMessage → applySettings (sets attrs) → refreshZone (updates closure vars) → next RAF frame renders new size.

### Fix 3: Elementor rendering cache in deployment docs

**Root cause of "works after re-save":** Elementor caches rendered element HTML in postmeta. PHP code changes don't take effect until cache is flushed via Elementor → Tools → Regenerate Files & Data. This was already discovered in the 2026-03-10 session but not documented in deployment workflow.

**Added to `DOCS/merge-rules.md`:**
- New critical rule #4: "Regenerate after PHP changes"
- Expanded troubleshooting: "Changes not visible" now lists Elementor rendering cache as first check

**Key insight:** The appointment page still showed old fallback values (32/100) from before the 2026-03-10 fix because Regenerate was never run for that page. The `get_data()['settings']` fix was correct but invisible due to cache.

---

## 2026-03-10 — Update cursor control defaults, ranges and size_units

**Change:** Updated Elementor control parameters in `modules/cursor-controls/module.php` per design spec.

**Image cursor:** `cursor_size_normal` / `cursor_size_hover` — range widened from 16-128 to 10-200 px; defaults changed to 80/100 (were 96/80).

**Icon cursor:** `icon_border_radius` and `icon_padding` defaults changed from 8 to 10. `icon_padding` size_units expanded from `[px]` to `[px, em, rem, %, vw]`.

**Text cursor:** `text_border_radius` default changed from 150 to 10. `text_padding` size_units expanded from `[px, em]` to `[px, em, rem, %, vw]`.

No changes needed for icon_size (32/48), circle_spacing (10), or text_border_radius units (px/%) — already matched spec.

---

## 2026-03-10 — Fix image/icon cursor Normal size ignored on frontend (4 iterations)

**Problem:** User sets Special Cursor → Image → Size (Normal tab) = 80 in editor. Frontend renders `data-cursor-image-size="32"` (fallback). Hover size works correctly (`100`).

**Root cause — two layers:**

1. **Elementor settings filtering:** Both `get_settings_for_display()` AND `get_settings()` filter out slider values whose conditions aren't met. The Normal size slider has `condition: image_state => 'normal'`. When user's last-saved tab was Hover (`image_state = 'hover'`), both methods strip the Normal value.

2. **Elementor rendering cache:** Elementor caches rendered element HTML in postmeta. After deploying PHP changes, the cached HTML is served without re-executing PHP. This made ALL debug attempts invisible — code was correct on disk but old HTML kept being served.

**Iteration history:**

1. **`$element->get_settings()`** — assumed it returns raw values without condition filtering. Still returned fallback `32`. FAIL — `get_settings()` also filters conditioned controls.

2. **Pass `$raw_settings` from parent scope** — `apply_cursor_attributes()` already calls `get_settings()` at line 1437. Passed it to `apply_image_cursor_attributes()` as parameter. Same result — `32`. FAIL — same filtered data.

3. **`$element->get_data()['settings']`** — reads raw `_elementor_data` JSON from database with zero Elementor processing. Code deployed, rsync confirmed, PHP-FPM restarted — still `32`. Spent hours debugging "cache" (query strings, Cloudflare, opcache, FPM restart). All red herrings.

4. **Elementor → Tools → Regenerate Files & Data** — flushed Elementor's rendering cache. `data-cursor-image-size="80"` appeared immediately. The `get_data()` fix from iteration 3 was correct all along.

**Final fix (commit `3aa71ef`):**
```php
// In apply_image_cursor_attributes() and apply_icon_cursor_attributes():
$saved = $element->get_data()['settings'] ?? array();
$element->add_render_attribute( '_wrapper', 'data-cursor-image-size',
    $saved['cmsmasters_cursor_size_normal']['size'] ?? 32 );
```

**Key insights:**
- `get_settings_for_display()` → filters conditions + parses dynamic tags
- `get_settings()` → filters conditions + merges defaults (NOT raw!)
- `get_data()['settings']` → truly raw DB JSON, no filtering whatsoever
- **Elementor caches rendered HTML** — PHP render changes require "Regenerate Files & Data" to take effect. This is separate from opcache, browser cache, or page cache.
- Confirmed via debug data attribute: `image_state: "hover"`, but both `size_normal: {size: 80}` and `size_hover: {size: 100}` present in raw data — Elementor DOES save all values regardless of conditions, it just filters them on read.

**Commits:** `1ef02cd`, `6f03430`, `3aa71ef` (fix), `861d3fe` (cleanup)

---

## 2026-03-10 — Fix navigator indicators after toggle unification

**Problem:** After toggle semantics unification (commit `4576aea`, 'yes' always means Show), navigator indicators showed wrong types:
- Core cursor → indicated as Hidden (grey)
- Inherit cursor → indicated as Special (green)
- Only Special showed correctly

**Root cause — two bugs:**

1. **Core→Hidden:** In Full mode branch, `toggle === 'yes'` returned `{ type: 'hidden' }` at Priority 3. After unification, `'yes'` means Show, not Hide.

2. **Inherit→Special:** Special was checked before Inherit (Priority 1 > 2). But `special_active` retains stale `'yes'` when Inherit is enabled — Elementor hides the Special controls UI but doesn't clear saved values.

**Fix:** Unified Full/Show mode logic (both use same toggle semantics now). Changed priority: Inherit → Special → Core. Removed Hidden from legend (no longer applicable after toggle unification).

**Commit:** `cdbcbae`

---

## 2026-03-10 — Fix pointer cursor missing in dual mode (6 iterations)

**Problem:** With dual mode enabled (system cursor + custom cursor visible simultaneously), the system cursor stayed as arrow on links, buttons, and interactive elements. Three areas affected:
1. WordPress admin bar on frontend — links/buttons show arrow instead of pointer
2. Frontend nav links and buttons inside `[data-cursor-show]` zones
3. Elementor editor handles (overlay buttons: edit, duplicate, delete, add-section)

Site runs in **widget-only + dual mode** (`cmsmasters-cursor-widget-only` + `cmsmasters-cursor-dual` on body).

**Root cause:** Multiple CSS rules with `cursor:none!important` or `cursor:default!important` applied globally, with no dual mode exception. In `cursor-editor-sync.js`, injected `cursor:inherit!important` on `*` also overrode Elementor's `cursor:pointer` on editor handles.

**Iteration history:**

1. **`cursor:auto` override approach** — Changed admin bar `cursor:default` → `cursor:auto`, added editor overlay rules. FAILED: site uses `cmsmasters-cursor-widget-only` not `cmsmasters-cursor-enabled`, so selectors didn't match.

2. **Widget-only dual override** — Added `.cmsmasters-cursor-widget-only.cmsmasters-cursor-dual [data-cursor-show] * { cursor:auto!important }`. FAILED: `cursor:auto!important` on div/span/button resolves to default arrow, NOT pointer. `auto` only gives pointer on `<a>` tags natively.

3. **`:not(.cmsmasters-cursor-dual)` on cursor:none rules** — Instead of hiding then overriding back, simply don't apply `cursor:none` when dual. Partially worked, but `body.cmsmasters-cursor-hidden * { cursor:default!important }` still forced arrow.

4. **cursor-hidden fix** — Added `:not(.cmsmasters-cursor-dual)` to cursor-hidden rule. Frontend nav links showed `cursor:pointer` ✅. Admin bar confirmed working ✅.

5. **Admin bar scoping** — Scoped admin bar `cursor:auto` rule to non-dual only (unnecessary in dual mode). Cleaned up leftover editor overlay rules.

6. **cursor-editor-sync.js fix** — Found that `cursor-editor-sync.js` injects `body.cmsmasters-cursor-disabled * { cursor:inherit!important }` into preview iframe, overriding Elementor's `cursor:pointer` on editor handles. Added `:not(.cmsmasters-cursor-dual)` to all injected CSS rules. Editor handles now show pointer ✅.

**Final approach — `:not(.cmsmasters-cursor-dual)` pattern:**

In `custom-cursor.css`:
```css
/* Don't hide system cursor in dual mode */
.cmsmasters-cursor-enabled:not(.cmsmasters-cursor-dual),
.cmsmasters-cursor-enabled:not(.cmsmasters-cursor-dual) * { cursor:none!important }

.cmsmasters-cursor-widget-only:not(.cmsmasters-cursor-dual) [data-cursor-show],
.cmsmasters-cursor-widget-only:not(.cmsmasters-cursor-dual) [data-cursor-show] * { cursor:none!important }

body.cmsmasters-cursor-hidden:not(.cmsmasters-cursor-dual),
body.cmsmasters-cursor-hidden:not(.cmsmasters-cursor-dual) * { cursor:default!important }
```

In `cursor-editor-sync.js` (injected CSS):
```css
body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) { cursor: auto !important; }
body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) * { cursor: inherit !important; }
```

**Key insights:**
- `cursor:auto!important` does NOT equal "restore original" — on non-`<a>` elements (div, span, button), `auto` resolves to arrow, overriding any `cursor:pointer` from other stylesheets
- The correct approach: don't apply cursor-hiding rules at all in dual mode, using `:not(.cmsmasters-cursor-dual)`, so ALL original CSS cursor values from WordPress/Elementor are preserved untouched
- Three independent sources of cursor override exist: (1) `custom-cursor.css`, (2) `body.cmsmasters-cursor-hidden` rule, (3) `cursor-editor-sync.js` injected styles — ALL three need the dual mode exclusion
- Browser caching: CSS `?ver=` param doesn't change between deploys → need Ctrl+Shift+R to verify

**Commits:** `3f26436`, `e72628e`, `9cafff6`, `e8a5288`, `52a55e9`, `323b25b`

---

## 2026-03-10 — Fix page cursor settings ignored on frontend

**Problem:** Page-level cursor settings (color, theme, blend, show/hide) work in Elementor editor but are silently ignored on the frontend.

**Root cause:** All three page-setting read sites used `$document->get_settings_for_display()`, which only returns values for **registered** controls. Page cursor controls register via `elementor/element/after_section_end` — an editor-only hook. On the frontend, these controls aren't in Elementor's control registry, so `get_settings_for_display()` returns null for all of them.

**Fix:** Switched to `$document->get_settings()` which reads raw `_elementor_page_settings` meta regardless of registered controls. Three call sites changed:
1. `get_document_cursor_state()` (line 1265) — page show/hide toggle
2. `get_page_cursor_setting()` (line 1305) — theme, blend, etc.
3. `get_cursor_color()` (lines 1747-1771) — page color override. Additionally handles `__globals__` for globe-picked global colors, mirroring the Kit-level pattern already in place.

**Key insight:** `get_settings_for_display()` depends on control registration; `get_settings()` reads raw post meta. For controls registered only in editor context, always use `get_settings()` on frontend.

---

## 2026-03-10 — Session: 8 fixes/changes

### 1. Remove Custom Cursor from template Page Settings
**Commit:** `2937b97`
**Problem:** Custom Cursor section appeared in Page Settings for templates (Header, Footer, Archive, Single, etc.) where it doesn't belong.
**Fix:** Added `is_template_document()` check in `register_page_cursor_controls()` to skip registration for all template document types. Only `wp-page` and `wp-post` retain page-level cursor settings.

### 2. Fix system cursor non-interactive in dual mode
**Commit:** `a3c63f1`
**Problem:** When "Show System Cursor" (dual mode) was enabled, the system cursor stayed as arrow on all elements — never changed to pointer on links, text cursor on inputs, etc.
**Root cause:** `custom-cursor.css` line 59: `.cmsmasters-cursor-enabled.cmsmasters-cursor-dual * { cursor:default!important }` — `default` forces arrow, overriding browser defaults.
**Fix:** Changed `cursor:default!important` → `cursor:auto!important`. `auto` lets the browser decide cursor per element type.

### 3. Fix icon cursor rotate/shape not syncing in editor preview
**Commit:** `10ed778`
**Problem:** Yulia reported icon cursor Rotate control had no effect. Investigation confirmed it worked on frontend (PHP rendered attrs) but NOT in editor live preview.
**Root cause:** `cursor-editor-sync.js` was missing `setAttribute` calls for 5 icon cursor attributes: `data-cursor-icon-rotate`, `data-cursor-icon-rotate-hover`, `data-cursor-icon-circle-spacing`, `data-cursor-icon-radius`, `data-cursor-icon-padding`. Image cursor had all these, icon was incomplete.
**Fix:** Added missing setAttribute calls in `applyIconSettings()`, mirroring the text cursor pattern (circle spacing, radius, padding).

### 4. Update element cursor toggle labels
**Commit:** `f95aae8`
**Change:** Unified toggle labels per Yulia's request:
- Label: "Custom Cursor"
- Options: "Show" / "Hide" (no more mode-dependent branching)
- Help text: "When Hide is chosen, system cursor will be shown on this element."

### 5. Unify toggle semantics: 'yes' always means Show
**Commit:** `4576aea`
**Problem:** Yulia reported that switching global mode from "Show on Individual Elements" to "Show Sitewide" caused widgets with configured cursors to HIDE the cursor. The same toggle value `'yes'` meant "show" in one mode and "hide" in another.
**Root cause:** `cmsmasters_cursor_hide` toggle had inverted semantics per mode:
- Show mode: `'yes'` = show cursor (opt-in)
- Full mode: `'yes'` = hide cursor (opt-out)
Switching mode inverted the meaning of saved per-element values.
**Fix:**
- `module.php`: Removed full-mode hide block in `apply_core_cursor_attributes()` (no more `data-cursor="hide"` from toggle). Unified toggle condition to `'yes'` = Show.
- `cursor-editor-sync.js`: Removed full-mode `data-cursor="hide"` on toggle='yes'. Per-element hide remains via `data-cursor="hide"` HTML attribute.

### 6. Fix page-level cursor color ignored on frontend
**Commit:** `df713a4`
**Problem:** Yulia set orange Cursor Color in Page Settings, but frontend showed global green color.
**Root cause:** `get_cursor_context_document()` in `frontend.php` returned `template_document` (header/footer) instead of the actual page document. Since templates no longer have cursor controls (fix #1), template document returned empty color → fallback to global.
**Fix:** Removed `template_document` priority from `get_cursor_context_document()` — now always reads page document for cursor settings. Affects all page-level settings (color, theme, smoothness, blend, effect, adaptive).

### 7. Fix editor sync: full mode always apply per-element settings
**Commit:** `8060400`
**Problem:** Previous toggle unification (fix #5) made `cursor-editor-sync.js` return early for full mode + toggle='', breaking editor preview for elements configured in old toggle semantic.
**Fix:** Full mode now always falls through to apply special/core settings in editor sync, matching PHP render behavior.

### 8. Remove separator border before Reset button
**Commit:** `384d8a1`
**Change:** Removed `'separator' => 'before'` from `cmsmasters_page_cursor_reset` control in page cursor settings per Yulia's request.

### Key insight: template_document leak pattern
The `template_document` property in `frontend.php` persists through wp_footer after header/footer rendering. Multiple bugs stem from this: editor cursor missing (2026-03-02), page color ignored (this session). The fix pattern is consistent: for cursor settings, always prefer page document over template document.

---

## 2026-03-10 — Hide page cursor controls on all template types

**Problem:** Page-level cursor controls (Page Settings tab) still appeared on Section, Entry, Product, Product Archive, Product Entry, Event Singular, Event Entry, and Events Archive template documents. Only wp-page and wp-post should show them.

**Fix:** Extended `is_template_document()` in `module.php` with 9 new document types:
- Elementor core: `section`, `container`
- CMSMasters: `cmsmasters_entry`
- WooCommerce: `cmsmasters_product_singular`, `cmsmasters_product_entry`, `cmsmasters_product_archive`
- Tribe Events: `cmsmasters_tribe_events_singular`, `cmsmasters_tribe_events_entry`, `cmsmasters_tribe_events_archive`

Document names found via `get_name()` methods in the addon's document classes under `modules/*/documents/`.

---

## 2026-03-02 — Fix editor cursor missing (template_document leak)

**Problem:** Cursor DOM elements (`#cmsmasters-cursor-container`, `.cmsmasters-cursor-dot`, `.cmsmasters-cursor-ring`) were not output in the Elementor editor preview iframe. Scripts, CSS, and body classes all loaded correctly — only the HTML from `print_custom_cursor_html()` was missing.

**Diagnosis iterations:**
1. Added diagnostic `error_log` to `should_enable_custom_cursor()` and `enqueue_preview_scripts()` — confirmed Gate 1 (editor_preview) passes, scripts load
2. Chrome browser inspection: toggle panel visible, body classes correct, scripts loaded — but cursor container missing from DOM
3. JavaScript DOM inspection in preview iframe confirmed: `document.getElementById('cmsmasters-cursor-container')` → null

**Root cause:** `get_cursor_context_document()` checked `$this->template_document` before the preview document. During page rendering, Elementor calls `set_template_document()` for header/footer templates. This `template_document` is never cleared, so it leaks into `wp_footer` time. Result: `print_custom_cursor_html()` (wp_footer, priority 5) got a different document than `enqueue_custom_cursor()` (wp_enqueue_scripts), causing `should_enable_custom_cursor()` to return false at HTML output time.

**Why enqueue worked but HTML didn't:** `wp_enqueue_scripts` fires before Elementor renders templates → `template_document` is null → falls through to preview document → cursor enabled. `wp_footer` fires after rendering → `template_document` is set to last header/footer → returns template document → wrong cursor state → cursor disabled.

**Fix:** Swapped priority in `get_cursor_context_document()` — preview document (from `$_GET['elementor-preview']`) now checked first. On frontend (non-editor), `get_preview_document()` returns null so fallback to `template_document` still works.

**Also:** Removed temporary `CURSOR-DIAG` error_log lines from frontend.php and editor.php.

---

## 2026-03-02 — REVERTED: Kit reads bypass registered control defaults

**Attempted fix:** Replaced `AddonUtils::get_kit_option()` with `$kit->get_settings_for_display()` to respect registered Elementor control defaults. Added `get_kit_cursor_setting()` helper to Frontend and Editor classes. Replaced 10 call sites.

**Why it broke the cursor:** `get_kit_option()` has a 3-level fallback chain:
```
1. Raw post_meta (_elementor_page_settings)
2. default_kits wp_option (CMSMASTERS_OPTIONS_PREFIX . 'default_kits')  ← MISSED THIS
3. PHP $default argument
```

The Kuzmich theme stores cursor defaults in the `default_kits` wp_option via the CMSMasters framework. This provides theme-level defaults (e.g., `visibility = 'show'`, `editor_preview = 'yes'`) that override control-level defaults (`'elements'`, `''`). The new `get_settings_for_display()` code only knew about registered control defaults (level 1 + Elementor defaults), completely bypassing the theme's `default_kits` layer.

**Result:** `visibility` dropped from `'show'` → `'elements'` (cursor went from "everywhere" to "widgets only"). `editor_preview` dropped from `'yes'` → `''` (cursor-editor-sync.js no longer loaded in preview iframe).

**Lesson:** `AddonUtils::get_kit_option()` is NOT broken — its 3-level fallback chain (raw meta → `default_kits` → PHP default) is intentional CMSMasters framework architecture. The `default_kits` layer provides demo-quality settings without requiring explicit Kit saves. Never replace it with Elementor's `get_settings_for_display()` alone.

**Action:** Reverted all changes. Restored `AddonUtils::get_kit_option()` / `Utils::get_kit_option()` in all 10 call sites.

---

## 2026-02-24 — WP-020 Phase 2: Read Migration — wp_options → Kit

**Problem:** All global cursor settings were read via `get_option('elementor_custom_cursor_*')`. Phase 1 registered 11 Kit controls in the Kuzmich theme with prefix `cmsmasters_custom_cursor_`. Need to migrate all reads to Kit.

**Key discovery:** CSS var names MISMATCH — Kit selectors output `--cmsmasters-custom-cursor-cursor-color` but `custom-cursor.css` expects `--cmsmasters-cursor-color`. Decision: keep PHP inline CSS bridge that reads Kit values and outputs old var names. No CSS/JS file changes needed.

**Changes across 3 files:**

- **frontend.php** (8 call sites):
  - Added `use CmsmastersElementor\Utils as AddonUtils` (avoids conflict with `Elementor\Utils`)
  - `get_page_cursor_setting()` — Kit read with key mapping (`adaptive→adaptive_color`, `theme→cursor_style`) and value mapping (`dot_ring→classic`, `disabled→''`)
  - `get_cursor_mode()` — `visibility` Kit control with `show→yes`, `elements→widgets`, `hide→''` mapping. Removed BC `widget_override` fallback
  - `should_enable_custom_cursor()` — `editor_preview` Kit read
  - `get_cursor_color()` — Simplified: `$kit->get_settings_for_display()` resolves `__globals__` automatically. Removed `color_source` + `system_colors` iteration
  - `enqueue_custom_cursor()` — dot sizes (`cursor_size`, `size_on_hover`), blend mode Kit reads. Added `disabled→''` mapping for blend
  - `add_cursor_body_class()` — `show_system_cursor` and `wobble_effect` Kit reads

- **editor.php** (2 call sites):
  - `get_cursor_mode()` — same Kit read as frontend
  - `enqueue_preview_scripts()` — `editor_preview` Kit read

- **module.php** (1 call site + 2 notice updates):
  - Added `use CmsmastersElementor\Utils`
  - `get_cursor_mode()` — same Kit read (static version)
  - Disabled notices: replaced `<a href>` to admin settings with plain text "Site Settings → Custom Cursor"

**Verification:** Zero `get_option('elementor_custom_cursor_*')` remaining in `includes/` and `modules/cursor-controls/`. Only `settings-page.php` retains them (Phase 3 scope).

---

## 2026-02-19 — Fix: CursorState/DOM desync — widget blend ignored on initial load

**Problem:** In Widgets Only mode, widget-level blend override (`data-cursor-blend="off"`) is ignored on initial page load. The cursor shows the global blend (e.g. "soft") instead of disabled. Affects both frontend and editor. Changing any setting in the editor fixes it.

**Root cause:** `CursorState._state.blend` initializes as `null` (line 413), but PHP already renders body with `cmsmasters-cursor-blend-soft` class. The JS variable `currentBlendIntensity` is correctly synced to 'soft' (from body class), but the state machine is not. When `detectCursorMode` finds `data-cursor-blend="off"` and calls `setBlendIntensity('')` → `CursorState.transition({blend: null})` — this is a NO-OP because `_state.blend` is already `null`. The body retains the PHP-rendered blend classes.

Why editor settings change fixes it: changing blend to 'soft' first sets `_state.blend = 'soft'`, then changing to 'off' sets `_state.blend = null` — the transition detects the change and removes classes.

**Fix:** After computing `globalBlendIntensity` from body classes (line 699), sync `CursorState._state.blend = globalBlendIntensity`. Now `_state.blend` starts as 'soft', so transitioning to `null` correctly removes the classes.

**Iteration history:**
1. skipClear in editor sync init — wrong target (JS timing, not attribute presence)
2. detectCursorMode before show cursor — correct optimization but didn't fix root cause
3. CursorState sync — **this was the fix** (state/DOM desync)

**Key insight:** When state machines shadow external DOM, ALWAYS sync initial state from existing DOM classes, not just from code defaults. Compare: `hidden` was properly synced at line 604 (`init:widget-only`), but `blend` was missed.

---

## 2026-02-19 — Fix: Widget settings (blend/color/effect) not applied on show zone entry

**Problem:** In Widgets Only mode, when the cursor enters a show zone, it appears with the GLOBAL blend/color/effect instead of the widget's override. The widget settings only apply after the user moves the mouse further (triggering `detectCursorMode` via throttled `mousemove`). This affects both frontend and editor preview.

**Root cause:** `mouseover:show-zone` handler (custom-cursor.js:2547) called `CursorState.transition({ hidden: false })` to show the cursor, but did NOT call `detectCursorMode()` first. The cursor appeared with stale `currentBlendIntensity` (global). `detectCursorMode` only ran on the next `mousemove` (throttled 100ms + 5px movement). For special cursor zones this was already fixed (line 2508-2515 calls `detectCursorMode` on mouseover), but core cursor show zones were missing it.

**Fix:** Call `detectCursorMode(e.clientX, e.clientY)` BEFORE `{ hidden: false }` transition in the show zone mouseover handler. This detects blend/color/effect/hover style before the cursor becomes visible, so it appears with the correct state from the first frame. Also sync throttle state (`lastDetect`, `lastDetectX/Y`) to prevent redundant detection on the next `mousemove`.

**Iteration 1 (failed):** Tried `skipClear` in editor sync `cmsmasters:cursor:init` to preserve PHP-rendered attributes. Didn't help because the issue was in the JS timing, not the attribute presence — attributes were correct in the DOM all along.

---

## 2026-02-19 — Fix: Widget blend mode not applied on editor initial load

**Problem:** In Widgets Only mode, when opening a page in the Elementor editor, a widget with blend mode set to "Disabled" showed the global blend (e.g. Soft) instead. Changing any widget setting fixed it. The saved setting didn't load on first open.

**Root cause:** `cursor-editor-sync.js` handles `cmsmasters:cursor:init` by calling `clearAttributes()` (removes all PHP-rendered data attributes) then re-applying from the editor model via `applyCoreSettings()`. But on initial load, Elementor's `settingsModel.toJSON()` may not include all settings yet (model not fully populated). So `cmsmasters_cursor_blend_mode` could be `undefined` → the truthiness check `if (s.cmsmasters_cursor_blend_mode)` fails → `data-cursor-blend="off"` is not re-added → JS falls back to global blend.

When the user changes ANY setting, Elementor sends `cmsmasters:cursor:update` with the fully loaded model → blend_mode is present → attribute correctly set.

**Fix:** Added `skipClear` parameter to `applySettings()`. During `cmsmasters:cursor:init`, skip `clearAttributes()` — overlay editor settings on top of PHP-rendered attributes. This preserves PHP attributes when the editor model is incomplete. The `cmsmasters:cursor:update` path (explicit user changes) still clears and re-applies normally.

---

## 2026-02-19 — Fix: Native cursor disappears in editor preview (Widgets Only, preview OFF)

**Problem:** In Widgets Only mode, when Custom Cursor Preview is OFF in the Elementor editor, hovering over a show zone widget makes the native (system) cursor disappear. No cursor at all is visible — custom cursor not running (preview OFF) and native cursor hidden by CSS.

**Root cause:** CSS specificity conflict. `custom-cursor.css` has `.cmsmasters-cursor-widget-only [data-cursor-show] *` at specificity (0,2,0) with `cursor:none!important`. The editor sync's override `body.cmsmasters-cursor-disabled *` only has (0,1,1) — lower specificity, so `cursor:none` wins even when disabled.

**Fix:** Added explicit override in `cursor-editor-sync.js` injected styles with higher specificity (0,3,1):
```css
body.cmsmasters-cursor-disabled.cmsmasters-cursor-widget-only [data-cursor-show],
body.cmsmasters-cursor-disabled.cmsmasters-cursor-widget-only [data-cursor-show] * {
  cursor: inherit !important;
}
```

**Key insight:** Other `cursor:none` selectors (`[data-cursor-image] *`, `.cmsmasters-cursor-enabled *`) have specificity (0,1,0) which is already beaten by the existing disabled override at (0,1,1). Only the widget-only show zone selector needed the explicit fix because it combines class + attribute selector = (0,2,0).

---

## 2026-02-19 — Fix: Dot/hover sizes ignored in Widgets Only mode

**Problem:** In "Widgets Only" mode, global dot diameter and hover diameter from Addon Settings were not applied. Cursor used hardcoded CSS defaults (8px dot, 40px hover) instead of user-configured values. All other global settings (theme, color, blend, effects, smoothness, adaptive) worked fine.

**Root cause:** `frontend.php:1379` generated inline CSS with selector `body.cmsmasters-cursor-enabled[class]`, but in Widgets Only mode the body class is `cmsmasters-cursor-widget-only` — selector didn't match. Color worked because it used `:root` (always matches).

**Fix:** Added `body.cmsmasters-cursor-widget-only[class]` to the CSS selector so size custom properties apply in both modes.

---

## 2026-02-19 — UX: Show disabled notice in Page Settings when cursor is globally disabled

**Problem:** Widget-level cursor controls already show an info notice when the global cursor mode is disabled (`get_cursor_mode()` returns `''`). Page Settings controls (`register_page_cursor_controls()`) lacked this check — they always registered the full control set, showing users controls they can't use.

**Solution:** Added the same disabled-mode pattern to `register_page_cursor_controls()` in `module.php`:
- After the duplicate-registration guard, check `self::get_cursor_mode()`
- If disabled: open the "Custom Cursor" section, show a RAW_HTML info notice with a link to Addon Settings, close section, early return
- Also extended the duplicate-registration guard to check for `cmsmasters_page_cursor_disabled_notice` (the notice control ID) to prevent double-registration in disabled mode
- Existing page-level cursor settings in DB are preserved (not deleted) — they reappear when cursor is re-enabled

**Key detail:** The duplicate-registration guard originally only checked for `cmsmasters_page_cursor_disable` (the switcher). Since disabled mode registers a different control (`cmsmasters_page_cursor_disabled_notice`), the guard needed to check both IDs to prevent duplicate section registration when the callback fires multiple times.

---

## 2026-02-18 — Fix: Blend Mode Cursor Invisible on Some Themes (3 iterations)

**Problem:** On Pixel Craft theme (and similar themes with stacked Elementor containers), enabling any global blend mode (soft / medium / strong) made the custom cursor completely invisible — it went behind images, templates, and sidebars.

**Iteration 1 — Z-index too low (a5c567f):**
`--cmsmasters-cursor-z-blend` was `9999`. Many Elementor theme elements have z-index above 9999, so the cursor went behind them. Raised to `999999` to match `--cmsmasters-cursor-z-default`. This fixed layering but cursor remained invisible on light backgrounds.

**Iteration 2 — Black cursor + exclusion = invisible (e3049dc):**
The default cursor color is `#222` (near-black). The `mix-blend-mode: exclusion` formula is `result = base + blend - 2*base*blend`. With `blend = 0` (black), this collapses to `result = base` — the cursor produces zero visible change on any background. It is mathematically invisible. Added `--cmsmasters-cursor-color: #fff` to all three blend-mode body rules. White (`blend = 1`) gives `result = 1 - base`, which inverts correctly on all backgrounds. This fixed the color math but the cursor still vanished in gap areas between Elementor containers (plain body background zones).

**Iteration 3 — `isolation: isolate` trapped the blend (b6a67b2):**
The blend-mode body rules included `isolation: isolate` (added during the PR #144 CSS cleanup phase). This creates a stacking context. When a child uses `mix-blend-mode`, the blend is confined to compositing within that stacking context — it blends against the stacking context boundary, not the page backdrop. In Elementor, sections/containers are painted as stacked blocks; the gutters between them expose the raw body background. In those gap zones, `isolation: isolate` on body caused the cursor to blend against its own stacking context (blank) rather than the visible page, making it invisible. Removed `isolation: isolate` from all three blend-mode body rules. Now `mix-blend-mode` blends against the full viewport backdrop as intended.

**Key insight:** Two independent math-level gotchas compound here: (1) black is the identity element for inversion blend modes — never use a dark cursor with exclusion/difference; (2) `isolation: isolate` on a parent blocks `mix-blend-mode` from reaching the page backdrop — a common antipattern when trying to "contain" blend effects on a child.

**Files changed:**
- `assets/lib/custom-cursor/custom-cursor.css` — `--cmsmasters-cursor-z-blend: 999999`; added `--cmsmasters-cursor-color:#fff` to blend body rules; removed `isolation:isolate` from blend body rules

---

## 2026-02-18 — Research: Demo Content Settings Transfer

**Problem:** When a customer installs a CMSMasters demo, the custom cursor doesn't appear. Global cursor options are stored in `wp_options`, but the standard WXR import only transfers posts/pages. The most critical gap: `elementor_custom_cursor_enabled` defaults to `''` (disabled).

**Research findings:**
- Per-widget controls and page-level overrides transfer automatically via WXR XML
- Elementor Kit colors transfer via `elementor-kit.php` importer
- 12 global `wp_options` values do NOT transfer — cursor is off on fresh demo import
- The original plan listed 9 options; actual count is 12 (3 added since: `editor_preview`, `dual_mode`, `color_source`)

**Architecture review:**
- CMSMasters Merlin wizard (`admin/installer/importer/theme-options.php`) already calls `update_option()` during demo import
- Our cursor options just need to be included in each demo's data package — no addon code changes needed
- Sanitization is safe: `frontend.php` validates all values on read (hex regex, `is_numeric()`, strict `in_array()`)

**Deliverable:** `DOCS/DEMO-SETTINGS-TRANSFER.md` — complete reference for the theme team with all 12 option keys, types, allowed values, defaults, and example config snippets.

**Key insight:** This is a coordination task, not a code task. The addon already handles externally-written option values safely. Only the demo data packaging needs updating.

**Files created:**
- `DOCS/DEMO-SETTINGS-TRANSFER.md` — option reference for theme team

---

## 2026-02-18 — Fix: Navigator indicator type 'show' replaced with 'core' + mode-conditional legend

**Problem:** In Widgets Only mode, elements with cursor enabled (toggle=yes) but no special cursor or inherit setting received a green "show" dot. This dot was not present in the legend and used a type name (`'show'`) that was inconsistent with the rest of the indicator vocabulary.

**S1 — Indicator type fix:**
- `hasNonDefaultCursor()` line 379: `{ type: 'show' }` changed to `{ type: 'core' }` in the Show Mode branch's final fallback
- JSDoc on line 350 updated: return type changed from `'core'|'special'|'hidden'|'show'|'inherit'` to `'core'|'special'|'hidden'|'inherit'`
- Dead `case 'show':` removed from `getTooltip()` switch — `case 'core':` already returns "Custom Cursor" for the widget-only scenario

**S2 — Mode-conditional legend:**
- `addLegend()` now builds `legendItems` conditionally based on `isShowMode`
- Widgets Only (`isShowMode=true`) → 3 legend items: Core / Special / Inherit (no Hidden row)
- Enabled Globally (`isShowMode=false`) → 4 legend items: Core / Special / Hidden / Inherit
- Disabled (`isDisabledMode=true`) → no indicators, no legend (unchanged)

**Key insight:** "Hidden" (cursor disabled on an element via toggle) is not meaningful in Widgets Only mode. In that mode, the toggle controls whether the cursor is *shown*, not *hidden*. So a widget whose toggle is ON gets "core" (cursor is active), and one whose toggle is OFF simply has no indicator (cursor not active on that widget). There is no "hidden" concept.

**Files changed:**
- `assets/js/navigator-indicator.js` — S1: line 379 type, line 350 JSDoc, removed `case 'show':` in getTooltip(); S2: conditional legendItems build in addLegend()
- `DOCS/DEVLOG.md` — this entry

---

## 2026-02-17 — Merge Widget Override into 3-option Enable/Disable control

**Problem:** Two separate settings (Enable Custom Cursor + Widget Override) combined into 3 effective states but required confusing interaction logic — widget override was greyed out when cursor was enabled, and the dual-control UX caused user confusion.

**Solution:** Replaced with single 3-option select: Disabled / Widgets Only / Enabled. Removed widget override control entirely.

**Key decisions:**
- Page-disable in "Enabled" mode now fully disables cursor (no widget-only fallback). This simplifies the mental model: "Widgets Only" is a global mode choice, not a per-page fallback.
- One-time migration in `settings-page.php` constructor: detects old combo (`enabled='' + widget_override='yes'`) and migrates to `enabled='widgets'`.
- BC fallback in all `get_cursor_mode()` helpers: checks legacy `widget_override` option as fallback for first frontend load before admin visit triggers migration.
- PHP helper `get_cursor_mode()` added to frontend.php, editor.php, and module.php (returns 'yes'|'widgets'|'').
- Navigator config simplified from two booleans (`cursorEnabled`, `widgetOverride`) to single `cursorMode` string.

**Files changed (7):**
- `modules/settings/settings-page.php` — 3-option select, migration, removed widget_override control
- `includes/frontend.php` — `get_cursor_mode()`, simplified `is_widget_only_mode()`, updated `should_enable_custom_cursor()`
- `includes/editor.php` — `get_cursor_mode()`, `cursorMode` config, simplified preview scripts
- `modules/cursor-controls/module.php` — `get_cursor_mode()` static, simplified mode detection + notice text
- `assets/js/admin-settings.js` — removed widget override dependency logic
- `assets/js/navigator-indicator.js` — switched from dual booleans to `cursorMode` string
- `DOCS/DEVLOG.md` — this entry

---

## 2026-02-17 — Fix: Ring proportional sizing + rename Radius→Diameter

**Problem:** In "Dot + Ring" theme, ring was hardcoded at 40px. When admin set dot size to 40+, dot covered the ring completely. Hover setting (`--cmsmasters-cursor-dot-hover-size`) was wired only to dot-only theme, never used in classic. Labels said "Radius" but values were used as diameter. CSS `:root` default for hover-size was 8px but PHP default was 40.

**Root cause:** Ring dimensions were hardcoded px values (40/60/30) instead of being derived from dot size.

**Approach:** Introduced `--cmsmasters-cursor-ring-offset: 32px` so ring = dot + offset. This keeps ring always visible regardless of dot size. Used CSS scoped custom properties (`--_ring`, `--_ring-hover`, `--_ring-down`) for clean calc expressions.

**Math verification (default dot=8, hover=40):**
- Normal: 8 + 32 = 40px (was 40px — identical)
- Hover: 40 + 20 = 60px (was 60px — identical)
- Down: 8 + 32×0.7 = 30.4px (was 30px — ~identical)

**Key decisions:**
- Fixed `:root` hover default from 8px → 40px to match PHP default of 40
- Hover ring uses `hover-size + 20px` (not offset-based) — matches current 60px at default
- Down ring uses `dot-size + offset × 0.7` — proportional squeeze
- Renamed "Normal Radius" → "Dot Diameter", "Hover Radius" → "Hover Diameter" in settings

**Files changed:**
- `assets/lib/custom-cursor/custom-cursor.css` — `:root` defaults, ring base/hover/down sizing via calc
- `modules/settings/settings-page.php` — label/description renames

---

## 2026-02-14 — Feat: Conditional settings controls (grey out invalid combos)

**Problem:** Settings page has 3 linked controls (Custom Cursor, Widget Override, Editor Preview) but no visual dependency between them. User can enable "Show in Editor Preview" when cursor is OFF and Widget Override is OFF — a broken state where no scripts load and no preloader appears in editor.

**Approach:** Pure frontend solution — CSS class + `pointer-events: none` to grey out controls in invalid states. No HTML `disabled` attribute (would break form submission and lose saved values). Red italic hint text explains why the field is greyed.

**State table:**
- Cursor OFF + WO OFF → Editor Preview greyed ("Enable Custom Cursor or Widget Override...")
- Cursor OFF + WO ON → Editor Preview active
- Cursor ON + any → Widget Override greyed ("Only available when Custom Cursor is disabled globally"), Editor Preview active

**Key decisions:**
- Used `tabindex="-1"` instead of `disabled` to prevent keyboard access without breaking form submission
- Hint text created/removed dynamically (not just shown/hidden) to keep DOM clean
- Guard clause: all 3 selects must exist before binding — safe on pages that don't have all fields

**Files changed:**
- `assets/js/admin-settings.js` — +38 lines: `updateFieldStates()` with `setRowDisabled()` helper, bound to `change` events
- `assets/css/admin-settings.css` — +4 rules: `cmsmasters-field-disabled` opacity/pointer-events, `cmsmasters-field-hint` styling

---

## 2026-02-14 — Fix: Widget-only mode — contextual Hide/Show toggle (v2)

**Problem:** Commit f5c3915 replaced `cmsmasters_cursor_hide` with `cmsmasters_cursor_show` as the Elementor control key. This broke normal full-mode: existing "Hide" settings lost (different DB key), condition logic inverted, and the toggle label was always "Show" even when global cursor was ON.

**Approach:** Same control key (`cmsmasters_cursor_hide`) for both modes, but contextual label, conditions, and output based on 3 states:
- **Global ON** (full mode): "Hide Custom Cursor" toggle — sub-controls visible when toggle=NO (not hiding)
- **Global OFF + Override ON** (show mode): "Show Custom Cursor" toggle — sub-controls visible when toggle=YES (opting in)
- **Global OFF + Override OFF** (disabled): info notice only, sub-controls NOT registered, DB values persist silently

**Key decisions:**
- `$toggle_condition` PHP variable drives ALL sub-control conditions — show mode: `'cmsmasters_cursor_hide' => 'yes'`, full mode: `'cmsmasters_cursor_hide' => ''`
- `is_show_render_mode()` checks both global OFF + override ON AND global ON + page-level disable + override ON (for page-level widget-only)
- `apply_cursor_attributes()` dispatcher: show mode outputs `data-cursor-show="yes"`, full mode outputs `data-cursor="hide"`
- Editor scripts get mode flags: `window.cmsmCursorShowMode` for sync script, `window.cmsmastersNavigatorConfig.widgetOverride` for navigator
- Navigator indicators: disabled mode returns null (no dots), show mode shows show/special/inherit types, full mode unchanged

**Files changed:**
- `modules/cursor-controls/module.php` — contextual registration, `$toggle_condition`, `is_show_render_mode()`, mode-aware `apply_cursor_attributes()` + `apply_core_cursor_attributes()`
- `includes/editor.php` — load sync script when override ON, pass `cmsmCursorShowMode` + `widgetOverride` flags
- `assets/js/cursor-editor-sync.js` — `isShowMode` flag, mode-aware `applySettings()` dispatcher, reverted to `cmsmasters_cursor_hide`
- `assets/js/navigator-indicator.js` — `isShowMode`/`isDisabledMode` config, 3-mode `hasNonDefaultCursor()`, reverted to `cmsmasters_cursor_hide`

---

## 2026-02-13 — Production repo build: EBUSY phantom lock on build\archive

**Problem:** `npm run build` in production repo (`cmsmasters-repo/cmsmasters-elementor-addon`) fails at Grunt `clean:main` step with `EBUSY: resource busy or locked, rmdir build\archive`. Folder is empty, no visible process holds it, restart doesn't help — Windows phantom lock.

**Attempts:** `rmdir`, `rm -rf`, PowerShell `Remove-Item -Force`, `mv` — all fail with busy/permission error.

**Solution:** `npx grunt build --force` — Grunt skips the failed `clean` and continues. All subsequent tasks (sass, postcss, copy, compress) complete successfully. Output ends with `Done, but with warnings` which is acceptable.

**Files changed:** `DOCS/merge-rules.md` — added troubleshooting entry.

---

## 2026-02-13 — Fix: 504 Gateway Timeout on Merlin Wizard Content Import

**Problem:** First-time Merlin wizard run hits 504 on `step=content`. After `step=plugins` installs/updates plugins, Elementor invalidates CSS cache. Next admin page load triggers CSS regeneration which builds control stacks for ALL element types. Our `register_controls()` fires ~50 controls per type, `register_page_cursor_controls()` fires ~7 per Document. Total: hundreds of registrations → PHP exceeds nginx timeout.

**Why existing guards failed:**
- `WP_IMPORTING` — only defined during XML import, NOT during the page load that triggers CSS regen
- `is_admin()` guard in `init_filters()` — only protects `before_render` hooks, not control registration
- `is_edit_mode()` — returns false during control stack building because Editor property is set AFTER stacks are built (timing issue)

**Solution:** Added `should_register_controls()` private method using `$_REQUEST['action'] === 'elementor'` check. This is the same signal Elementor uses internally but available from PHP startup without timing dependency. Guard added to both `register_controls()` and `register_page_cursor_controls()`.

**Key insight:** Our cursor controls don't generate CSS — they only show UI in the editor panel and add `data-cursor-*` attributes via `before_render`. During CSS regeneration on non-editor admin pages, building our control stack is completely unnecessary.

**Files changed:** `modules/cursor-controls/module.php` — added `should_register_controls()` method, added guard calls in both registration methods.

---

## 2026-02-13 — Fix: Special Cursor Color Reset + Settings Page Restructure

**Problem 1: forcedColor leaks across zones.** Special cursor branches (image/text/icon) in `detectCursorMode()` return early before the core branch's color reset logic. If `forcedColor` was set on a previous element, the `--cmsmasters-cursor-color` inline style stays stuck on body when hovering into a special cursor zone without its own color.

**Solution:** Extracted `updateForcedColor(targetEl)` helper using `closest('[data-cursor-color]')`. Called in all four branches:
- Image branch: `updateForcedColor(imageEl)` before return
- Text branch: `updateForcedColor(textEl)` before return
- Icon branch: `updateForcedColor(iconElSpecial)` before return
- Core branch: replaces the 38-line inline color logic with `updateForcedColor(el)`

The core branch previously used a manual DOM walk with `hasCursorSettings` smart boundary. The new `closest()` approach is simpler and consistent with how special cursors find their elements. Color attributes cascade through `closest()` without the boundary check.

**Problem 2: Settings page structure.** All settings and color fields in one flat section. No way to reset settings without affecting color.

**Solution:** Split `custom_cursor` section into two:
- `custom_cursor_settings` — all behavioral settings (enabled, editor preview, theme, sizes, etc.)
- `custom_cursor_color` — color source and custom color only

Added "Reset to System Defaults" button between sections:
- Resets all Section 1 fields to factory defaults
- Does NOT touch color settings
- Shows confirm dialog before reset
- Visual yellow flash on changed rows

**Problem 3: Pickr button flash.** Pickr was initialized inside the Custom color `<button>`, causing the button to flash when Pickr opened/closed.

**Solution:** Extracted Pickr to a standalone `<div class="cmsmasters-pickr-standalone">` rendered as a sibling after the swatches container, outside all buttons. Button now only has circle + label.

**Files modified:**
- `assets/lib/custom-cursor/custom-cursor.js` — `updateForcedColor()` helper + 4 call sites
- `modules/settings/settings-page.php` — two sections, known limitation comment
- `assets/js/admin-settings.js` — reset button, Pickr extraction
- `assets/css/admin-settings.css` — Pickr standalone styles, reset button styles

---

## 2026-02-13 — Fix: Page Blend Mode Leaks Into Widget Cursors

**Problem:** Page Settings blend mode applied to ALL cursors on the page, including widgets with their own cursor settings or "Default (Global)". Widgets should use the WP Admin global blend, not the page override.

**Root cause:** `globalBlendIntensity` in `custom-cursor.js` is initialized from body classes, which contain the merged page > global value (output by PHP). All widget fallback code used this merged value, so page blend leaked everywhere.

**Solution:** Separate "true global" from "page > global":
- PHP outputs `window.cmsmCursorTrueGlobalBlend` with the raw WP Admin global blend (bypassing page settings)
- JS reads `trueGlobalBlend` from this window property
- All widget fallback locations (image/text/icon/core cursors) now use `trueGlobalBlend` instead of `globalBlendIntensity`
- Inner content walk-up uses `stoppedAtWidget` flag: dirty widget floor → true global, reached body → page > global
- Editor sync dispatches `cmsmasters:cursor:page-blend-update` event to keep `globalBlendIntensity` in sync during live editing

**Priority chain (after fix):**
- Widget with explicit blend → use it (unchanged)
- Widget with "Default (Global)" / no attribute → `trueGlobalBlend` (WP Admin)
- Default cursor (body, not on widget) → `globalBlendIntensity` (page > global)

**Files modified:** `includes/frontend.php`, `assets/lib/custom-cursor/custom-cursor.js`, `assets/js/cursor-editor-sync.js`

---

## 2026-02-13 — Fix: Reset Button — Use Color Control's Built-in Clear

**Problem:** The "Reset to System Default" button couldn't clear `__globals__.cmsmasters_page_cursor_color`. Manual `__globals__` manipulation (direct model.set, silent:true, setTimeout, removing 'global' param) all failed — Elementor's rendering pipeline kept restoring the reference.

**Iteration 1-4 (failed):** Direct `settingsModel.set('__globals__', clean)` after `$e.run` — `_renderChildren()` re-applied it. `{silent: true}` — render pipeline still restored. `setTimeout(100)` — `_renderChildren()` inside timeout restored again. Remove `'global'` param entirely — lost globe icon, didn't actually fix it.

**Solution (iteration 5):** Use Elementor's own color control view API — the same mechanism as the circular arrow reset button in the Color Picker (`onPickerClear`). Find the control view via `pageView.children.each()`, then call `controlView.setValue('')` + `controlView.triggerMethod('value:type:change')` + `controlView.applySavedValue()`. This properly clears both the value and the `__globals__` reference through Elementor's internal pipeline.

**Key insight:** Elementor color controls have built-in `onPickerClear()` that handles global cleanup properly. Fighting the framework by manually manipulating `__globals__` on the settings model will never work because `_renderChildren()` always restores it. Use the control's own API instead.

**Changes:**
- `modules/cursor-controls/module.php`: Restored `'global' => array('default' => '')` (globe icon preserved)
- `assets/js/navigator-indicator.js`: Replaced manual `__globals__` cleanup with color control view's `setValue('')` + `triggerMethod('value:type:change')` + `applySavedValue()`

**Files modified:** `modules/cursor-controls/module.php`, `assets/js/navigator-indicator.js`

---

## 2026-02-12 — Page Cursor: Global Colors, Color Reset, Reset Button

**Problem:** Three issues with page-level cursor settings:
1. Global Kit colors (Primary, Secondary, etc.) couldn't be selected — page color control lacked `'global'` param, and real-time sync skipped non-hex colors.
2. Clearing page color didn't revert cursor to global default — CSS custom properties stayed set.
3. No way to reset all 7 page cursor settings at once.

**Fix 1 — Global colors:** Added `'global' => array( 'default' => '' )` to the page color control in module.php (enables globe icon in color picker). Updated `broadcastPageCursorChange()` and `getPageCursorPayload()` in navigator-indicator.js to resolve `__globals__` references via the existing `resolveGlobalColor()` function instead of skipping them. PHP side already handled by `get_settings_for_display()` from previous commit.

**Fix 2 — Color reset:** In `applyPageCursorSettings()` (cursor-editor-sync.js), when color is empty string, call `removeProperty()` on `--cmsmasters-cursor-color` and `--cmsmasters-cursor-color-dark` CSS vars. This lets the global/default CSS take over.

**Fix 3 — Reset button:** Added `RAW_HTML` control with styled button at the bottom of page cursor section (module.php). Click handler in navigator-indicator.js uses `$e.run('document/elements/settings', ...)` to clear all 7 settings (integrates with Elementor undo/redo). Also clears `__globals__` for color.

**Files modified:** `modules/cursor-controls/module.php`, `assets/js/navigator-indicator.js`, `assets/js/cursor-editor-sync.js`

---

## 2026-02-12 — Page-Level Cursor Settings (Page Settings → Advanced tab)

**Problem:** No middle override layer between Global (WP Admin) and Element (per-widget) cursor settings. Users cannot customize cursor per-page (e.g., disable on a landing page, different theme on a specific page).

**Solution:** Added 7 cursor controls to Elementor Page Settings → Advanced tab. Override chain: Element > Page > Global.

**Files modified:**
- `modules/cursor-controls/module.php` — New `register_page_cursor_controls()` method + hook via `elementor/element/after_section_end`. Pattern copied from `additional-settings/module.php` (section_id check + `get_type() === 'stack'` guard).
- `includes/frontend.php` — Two new helpers: `get_current_page_document()` (static-cached, uses `get_queried_object_id()` to prevent archive→first post bug) and `get_page_cursor_setting()` (page override → global fallback). Modified 4 methods: `should_enable_custom_cursor()` (page disable check), `enqueue_custom_cursor()` (adaptive/theme/smoothness/effect via helper), `add_cursor_body_class()` (theme/blend/wobble via helper), `get_cursor_color()` (page color override).
- `assets/lib/custom-cursor/custom-cursor.js` — 1-line addition in `resolveEffect()`: checks `window.cmsmCursorEffect` for page-level pulse/shake/buzz effects.

**Key decisions:**
1. `get_queried_object_id()` over `get_the_ID()` — prevents wrong document on archive/blog pages.
2. `window.cmsmCursorEffect` naming (not `cmsmastersCursorEffect`) — matches existing `cmsmCursor*` internal config prefix convention.
3. Wobble handled via body class (existing mechanism), non-wobble effects via `window.cmsmCursorEffect` (new mechanism) — avoids breaking existing wobble logic.
4. Empty `$global_key` in helper returns `$default` directly — prevents broken `get_option('elementor_custom_cursor_', '')` call for effect setting which has no global option key.

**Controls:** disable (SWITCHER), theme (SELECT), color (COLOR), smoothness (SELECT), blend_mode (SELECT), effect (SELECT), adaptive (SELECT). All SELECTs have `'' = Default (Global)` as first option.

---

## 2026-02-12 — Fix Page-Level Cursor Settings (3 Issues)

**Problem:** Page-level cursor settings (added earlier today) work on frontend but have three editor issues:
1. **Disable doesn't work in editor preview** — `should_enable_custom_cursor()` returns `true` for editor preview BEFORE the page-level disable check (early return).
2. **No real-time sync** — changing page settings requires reload. Editor sync only handles element-level settings.
3. **Global Kit colors don't apply** — `get_settings()` returns raw global reference strings (`"globals/colors?id=primary"`) which `validate_hex_color()` rejects.

**Fix 1 — frontend.php:** Added page-level disable check inside the `$in_elementor_preview` block, before `return true`. Uses `get_settings_for_display()` consistent with Fix 3.

**Fix 2 — Real-time editor sync (3 files):**
- `navigator-indicator.js`: Added `broadcastPageCursorChange()` function that reads all 7 page cursor keys from document container settings and posts to preview iframe. Added dedup-guarded document settings model listener in `initSettingsListener()`. Included page settings payload in both `sendInitialCursorSettings()` and `sendInitialCursorSettingsWithRetry()`.
- `cursor-editor-sync.js`: Added handler for `cmsmasters:cursor:page-settings` message. New `applyPageCursorSettings()` applies changes via body classes + window props (same path as frontend — no direct DOM manipulation of dot/ring). Dual naming for window props (`cmsmastersCursor*` + `cmsmCursor*`). Also handles `pageSettings` in `cmsmasters:cursor:init` for initial sync.

**Fix 3 — frontend.php:** Changed 3 `get_settings()` calls to `get_settings_for_display()`:
- `get_page_cursor_setting()` — resolves global references for all page settings
- `get_cursor_color()` — resolves global color for page color override
- `should_enable_custom_cursor()` — frontend page disable check (was already changed in Fix 1 for editor path)

**Key decisions:**
1. Page settings sync uses body classes + window props (not direct dot/ring DOM) — same path as frontend, cursor RAF loop reads these each frame.
2. Color global references skipped in real-time sync (only hex sent) — global colors require Kit resolution which lives in PHP. Frontend resolves on save+reload.
3. Dedup guard via `window.cmsmastersPageCursorListenerAttached` — `initSettingsListener()` can be called multiple times (panel restart, hot reload).

**Files modified:** `includes/frontend.php`, `assets/js/navigator-indicator.js`, `assets/js/cursor-editor-sync.js`

---

## 2026-02-12 — PR #144 Code Review (11 пунктів, 6 фаз)

**Контекст:** CMSArchitect залишив 13 коментарів на PR #144. Пункт 12 (var→const/let в main JS) відкладено, пункт 13 (модулі/Class) відхилено. Решта 11 пунктів виконано в 6 фазах.

**Фаза 1 — Критичні фікси:**
- #8: image-accordion перевірено — вже на місці, змін не потрібно
- #11: 9 error_log() в resolve_global_typography() обгорнуто в WP_DEBUG

**Фаза 2 — frontend.php cleanup:**
- #6: Константа DEFAULT_CURSOR_COLOR = '#222222' замінила 7 магічних рядків
- #7: var → const/let в inline IIFE скрипті
- #10: Консолідація inline calls — 2 wp_add_inline_style → 1, 3 wp_add_inline_script → 1

**Фаза 3 — Settings page:**
- #4: Pickr 1.9.1 з jsDelivr CDN → локально assets/lib/pickr/
- #5: ~260 рядків inline CSS/JS → assets/css/admin-settings.css + assets/js/admin-settings.js, PHP-дані через wp_localize_script

**Фаза 4 — CSS коментарі:**
- #2: 12 секційних коментарів в custom-cursor.css

**Фаза 5 — Обговорення:**
- #3: Коментар до Kit Colors fallback (дефолти Elementor Hello theme)

**Фаза 6 — Глобальний rename:**
- #1+#9: cmsm-/cmsms- → cmsmasters- (~385 замін, 8 source файлів + 7 min файлів)

**Bugfix (знайдено під час Фази 6):**
- get_css_assets_url('custom-cursor', ..., false) завантажував non-minified CSS — видалено false

**Файли змінено:** frontend.php, module.php, settings-page.php, custom-cursor.css/js, editor-navigator.css, navigator-indicator.js, cursor-editor-sync.js, admin-settings.css/js
**Файли створено:** assets/lib/pickr/pickr.min.js, assets/lib/pickr/monolith.min.css, assets/css/admin-settings.css, assets/js/admin-settings.js

---

## 2026-02-11 — Default Placeholder Image for Image Cursor Type

**Request:** When selecting Special Cursor → Image type, nothing renders until the user uploads an image. Icon type has default `fas fa-hand-pointer`, Text type has default `"View"`, but Image type had `'url' => ''`.

**Solution:** One-line change in `modules/cursor-controls/module.php` — set the Media control default to `\Elementor\Utils::get_placeholder_image_src()`. This is the standard Elementor pattern used by Image Accordion, Featured Box, and other CMSMasters widgets.

**Key decisions:**
- Used FQCN (`\Elementor\Utils::...`) instead of adding `use` import — zero namespace collision risk
- No JS/CSS changes needed — existing rendering pipeline handles any valid URL
- Only affects **new** widgets or control resets; existing saved widgets are untouched

---

## 2026-02-11 — Ring Trail Fix (5 iterations) + Page Navigation Fix

### Ring trail/ghost when entering special cursor zone horizontally

**Problem:** Cursor in dot+ring mode — when mouse enters a flexbox container with special cursor (icon) horizontally, a visible ring trail/ghost appears. Works fine when entering vertically from top.

**5 failed approaches before finding root cause:**

1. **Snap ring position in `showDefaultCursor()`** — Wrong path: trail appears on ENTRY (hide), not EXIT (show)
2. **Disable CSS transition in `showDefaultCursor()`** — Same wrong path
3. **Disable CSS transition in `hideDefaultCursor()`** — Right function, wrong root cause
4. **Instant detection via `mouseover`** — Correct timing fix, but not the actual cause
5. **All of the above combined** — Still didn't work

**Root cause (two factors):**
1. Render loop (line ~2313) updates `ring.style.transform` **every frame** even when ring is "hidden" (`opacity: 0`). Transform has NO CSS transition → position changes are instant. But opacity fades over 200ms via CSS transition. During the fade, ring is partially visible AND moving → trail. Horizontal movement = larger lerp lag = more visible trail.
2. `mix-blend-mode: difference/exclusion` on `#cmsm-cursor-container` can produce GPU compositor artifacts even at `opacity: 0` due to `will-change: transform, opacity` GPU layer promotion.

**Why horizontal but not vertical:** Ring lerp factor (`L=0.15`) creates constant positional lag. Horizontal movement is typically faster → larger pixel distance between ring and mouse → more visible artifact during the opacity fade. Vertical entry has smaller lag → unnoticeable.

**Final solution (`83e9fd0`):**
1. **`isRingHidden` boolean flag** (line ~596) — clean state tracking
2. **`visibility: hidden`** in `hideDefaultCursor()` — completely removes ring from paint/compositing. Immune to blend mode artifacts. Unlike `opacity: 0`, this truly hides the element.
3. **Skip ring transform in render loop** — `if (!isRingHidden)` guard (line ~2313). Stops GPU from re-compositing hidden ring 60fps.
4. **Snap + visibility restore** in `showDefaultCursor()` — `isRingHidden = false; ring.style.visibility = '';` + existing `rx=mx; ry=my;` snap

**Key insight:** `opacity: 0` is NOT the same as invisible. Under GPU compositing + blend modes, a zero-opacity element can still produce visual artifacts. `visibility: hidden` is the correct way to completely remove an element from rendering without layout reflow.

**Also includes (from earlier in session):**
- Instant `mouseover` detection for special cursor zones (bypasses 100ms throttle)
- Event coordinates (`e.clientX/Y`) used instead of potentially stale `mx/my`

### Page navigation cursor freeze

**Problem:** Clicking a link to navigate — cursor froze at click position while system cursor continued.

**Solution:** Added `hideCursorOnNav()` setting `container.style.visibility = 'hidden'` on `beforeunload` + `pagehide` events.

**Files changed:**
- `assets/lib/custom-cursor/custom-cursor.js`

**Commits:** c0f46fd, d7d4b0f, 2f2d133, ee443f0, 83e9fd0

---

## 2026-02-11 — Icon Cursor SVG Color Fix (Uploaded Icons)

**Problem:** Uploaded SVG icon from media library — color works in Elementor editor but reverts to original SVG colors on frontend.

**Root cause:** Editor creates `<img src="icon.svg">` → JS mask technique works. Frontend uses `Icons_Manager::render_icon()` which renders inline `<svg>` → `querySelector('img')` returns null → mask not applied → child `<path fill="#FF0000">` overrides CSS `fill: currentColor`.

**Fix (`b3d0cab`):** Added inline SVG branch in `createIconCursor()` (lines 1344-1388):
- Strip explicit `fill`/`stroke` attributes via `removeAttribute()` so elements inherit `currentColor` from CSS
- Symmetric stroke handling for line-art SVGs
- Case-insensitive value normalization (handles `URL(#grad)`, `None`, etc.)
- Preserves: `none`, `currentColor`, `transparent`, `url(...)`, `inherit`
- Gated by `!styles.preserveColors`

**Known limitation:** SVGs with internal `<style>` blocks (e.g. `<style>.cls-1{fill:#f00}</style>`) won't recolor — CSS class specificity beats attribute removal.

**Also committed (`7105def`):** Panel centering + viewport clamping for drag.

---

## 2026-02-11 — Form Zone Auto-Hide Fix (Solo + Dual Mode)

**Problem:** When Dual Cursor Mode disabled, no cursor visible on popups/offcanvas/forms. `cursor: none !important` hides system cursor, `isFormZone()` hides custom cursor = zero cursors.

**Iterations:**

| # | Approach | Result | Why failed |
|---|---------|--------|------------|
| 1 | CSS `body.cmsm-cursor-hidden { cursor:default!important }` | Unreliable, flickers | `[role="dialog"]` matches entire popup, constant toggle between custom/system cursor on buttons vs other elements |
| 2 | Remove dialog/modal/menu from `isFormZone()` | Worse | `el.closest('form')` still matches everything inside popup forms |
| 3 | Skip `isFormZone()` entirely when dual off | No cursor at all | Removed auto-hide AND CSS fallback — nothing works |
| 4 | Narrow to direct inputs only + CSS fallback | Custom cursor under popup | Removed popup detection — cursor not hidden on popup but can't render there (z-index) |
| 5 | Popup detection BEFORE button check | System cursor on popup, custom elsewhere | **Correct** |

**Final solution (`b323782`..`3228f92`):**
- Popup/modal detection (`[role="dialog"]`, `[aria-modal]`, `.elementor-popup-modal`) runs FIRST in `isFormZone()` — before button exclusion — so ALL popup elements get system cursor
- CSS fallback `body.cmsm-cursor-hidden { cursor:default!important }` ensures system cursor in both modes
- Instant opacity restore in `_applyToDOM()` prevents 300ms no-cursor gap in solo mode
- `el.closest('form')` restored for regular forms (safe now that popups handled separately)

**Key insight:** The problem had two layers:
1. **Popup z-index** — `moveCursorToPopup()` is unreliable, so custom cursor stays behind popup. Must always use system cursor on popups.
2. **Solo mode** — `cursor:none!important` hides system cursor. CSS fallback needed when custom cursor hides.

---

## 2026-02-11 — Native `<select>` Dropdown Cursor Leak

**Problem:** Custom cursor visible on top of native `<select>` dropdown overlay.

**Root cause:** When native dropdown opens, browser captures mouse events. `elementsFromPoint()` returns page element BEHIND the dropdown (not the `<select>`). `mouseout` fires with `relatedTarget: null`. Both cause `detectCursorMode` to falsely restore cursor.

**Fix (`dc27c2d`):** Check `document.activeElement.tagName === 'SELECT'` before restoring cursor in both `detectCursorMode` and `mouseout` handler.

---

## 2026-02-11 — Custom Select Widget Detection

**Problem:** Custom dropdown widgets (Select2, Chosen, Choices.js, etc.) render option lists as `<div>`/`<li>` elements, often appended to `<body>` outside the `<form>`. `isFormZone()` doesn't detect them.

**Research:** Mapped 9 most popular custom select libraries used in WordPress ecosystem, their CSS classes, and whether they append to body.

**Fix (`2607bac`):** Added widget-specific class selectors + `role="option"` ARIA detection in both JS (`isFormZone()`) and CSS (cursor fallback rules).

---

## 2026-02-11 — Entry + Popup Template Panel Hiding

**Problem:** Cursor preview panel (switcher) shows on Entry and Popup template types in Elementor editor, but cursor doesn't actually render on these templates.

**Why cursor doesn't render:**
- Entry templates are rendered in loop contexts (archive cards) — cursor doesn't apply to card elements
- Popup templates are overlays — cursor preview mechanism doesn't work correctly
- Archive/Singular templates render full pages with normal cursor behavior

**Implementation (4 layers):**

1. **PHP (frontend.php:1164-1180):**
   - `should_enable_custom_cursor()` checks document name
   - Returns `false` if name equals `cmsmasters_popup` OR ends with `_entry`
   - Prevents cursor JS/CSS from loading

2. **JS Early Guard (cursor-editor-sync.js:13-21):**
   - Checks `data-elementor-type` attribute on main document element
   - Returns early if popup or *_entry — no panel created

3. **PostMessage from init() (navigator-indicator.js):**
   - `isHiddenTemplate()` function checks current document via Elementor API + DOM fallback
   - Sends `cmsmasters:cursor:template-check` postMessage

4. **document:loaded Event (navigator-indicator.js:1403-1420):**
   - Fires on soft document switches (user changes template type without reload)
   - Re-checks template type and sends postMessage

**New JS functions:**
- `isCursorExcludedTemplate(type)` — returns true if type is popup or ends with _entry
- `isHiddenTemplate()` — checks current document via 2 methods

**Commits:**
- `4394407` — Initial implementation with cmsmasters_ prefix check
- `63c96f1` — Fix to use DOM check instead of timing-dependent API
- `4e96648` — Fix to check main document only (not header/footer in DOM)
- `bc90915` — Add document:loaded listener for soft document switches
- `473f214` — Narrow to Entry + Popup only (not all cmsmasters_ types)

---

## 2026-02-11 — Icon Cursor SVG Color Fix (Uploaded Icons)

**Problem:** Uploaded SVG icons from media library showed correct icon color in Elementor editor (uses `<img>` with mask technique) but reverted to original SVG colors on frontend (Elementor's `Icons_Manager` renders inline `<svg>`). Child `<path fill="#FF0000">` overrode CSS `fill: currentColor` rule.

**Root cause:** Editor vs frontend rendering difference:
- **Editor:** Elementor renders uploaded SVG as `<img src="library.svg">` → existing mask technique works
- **Frontend:** Elementor renders inline `<svg>` via `Icons_Manager::render_icon()` → explicit fill attributes override CSS

**Fix (lines 1344-1388):** Added `else` branch in `createIconCursor()` for inline SVG case:
- Detects inline `<svg>` element (when `<img>` not found)
- Strips explicit `fill` and `stroke` attributes from all SVG child elements
- Preserves special values: `none`, `currentColor`, `transparent`, `url(...)`, `inherit` (case-insensitive)
- Handles inline `style.fill` / `style.stroke` too
- Sets `svgEl.style.stroke = 'currentColor'` on SVG root for stroke-based icons
- Gated by `!styles.preserveColors` — respects user's multicolor preference

**Known limitation:** SVGs with class-based fills via internal `<style>` blocks won't be recolored. This requires CSS parsing which is not implemented. Example:
```xml
<svg>
  <style>.cls-1{fill:#FF0000}</style>
  <path class="cls-1" d="..."/>
</svg>
```

**Workaround:** Users should upload SVG icons with inline fill attributes (not CSS classes) or enable "Preserve Colors".

**Files changed:** `custom-cursor.js` lines 1344-1388

**Limitation:** Custom/unknown widgets without ARIA roles or known classes won't be detected. Escape hatch: `data-cursor="hide"` on the dropdown container.

---

## 2026-02-10 — Responsive Mode Detection in Editor

**Problem:** Switching to tablet/mobile in Elementor editor toolbar still shows cursor preview panel.

**Iterations:**

| # | Approach | Result | Why failed |
|---|---------|--------|------------|
| 1 | `window.resize` + `innerWidth < 1025` | Doesn't hide | Elementor doesn't resize iframe viewport, only CSS wrapper |
| 2 | `elementor.channels.deviceMode` Backbone Radio | Doesn't hide | API unreliable |
| 3 | `data-elementor-device-mode` on editor body | Doesn't hide | Attribute only exists on preview iframe body |
| 4 | `data-elementor-device-mode` on preview body | Doesn't hide | Viewport doesn't change, attribute doesn't update |
| 5 | Editor body CLASS `elementor-device-*` + CustomEvent + MutationObserver | Works! | |

**Final solution (`017e553`..`76e419d`):**
- `navigator-indicator.js` detects device mode from editor frame body CLASS (`elementor-device-desktop/tablet/mobile`)
- Uses CustomEvent `elementor/device-mode/change` + MutationObserver fallback on editor body class
- Sends postMessage `cmsmasters:cursor:device-mode` to preview iframe
- `cursor-editor-sync.js` receives message, uses CSS classes with `!important` to override panel's `display:flex!important`

**Key insight:** Elementor changes the editor frame body CLASS (not a data attribute). The preview iframe viewport doesn't actually resize.

---

## 2026-02-10 — Theme Builder Template Cursor Preview

**Problem:** Cursor preview UI (preloader + switcher) shows on Theme Builder templates (Entry, Popup, Archive, etc.) where cursor doesn't actually render.

**Fix (`9ded850`):** In `frontend.php::should_enable_custom_cursor()`, detect Elementor document type. All CMSMasters templates have `get_name()` prefixed with `cmsmasters_`. Single `strpos()` check covers all current and future template types.

---

## 2026-02-09 — frontend.php Clean Rewrite

**Problem:** Previous edits broke image-accordion module registration.

**Fix (`03be041`):** Clean rewrite of `frontend.php` — only cursor-related methods, no original addon code modifications.

**Lesson learned:** NEVER modify original addon script dependencies or widget registrations in our frontend.php override. See MEMORY.md.

---

## 2026-02-08 — CSS Strip Tags Bug

**Problem:** `wp_strip_all_tags()` in `print_styles()` was stripping CSS `>` child selectors, breaking styles.

**Fix (`4933f78`):** Removed `wp_strip_all_tags()` from CSS output.

**Lesson learned:** WordPress sanitization functions are designed for HTML content, not CSS. Never use them on CSS output.
