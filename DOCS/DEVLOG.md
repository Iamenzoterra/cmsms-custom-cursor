# Development Log

Living document tracking development sessions, decisions, and iterations.

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
