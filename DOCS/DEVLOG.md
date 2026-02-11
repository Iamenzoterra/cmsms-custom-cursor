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
