# Development Log

Living document tracking development sessions, decisions, and iterations.

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
