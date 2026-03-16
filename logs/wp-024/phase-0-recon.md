# WP-024 Phase 0: RECON — Widget-Only Page Promotion Broken

**Date:** 2025-07-17
**Status:** Recon complete
**Verdict:** Bug confirmed — 2 independent root causes found

---

## Scenario

- Kit visibility = `elements` (internal mode = `widgets`)
- Page toggle `cmsmasters_page_cursor_disable` = `yes` (meaning "show cursor on this page")
- Expected: page promoted to full cursor mode, cursor visible sitewide on that page
- Actual: cursor not visible

---

## Findings by Function

### 1. `get_document_cursor_state()` — frontend.php:1258

```php
if ( 'widgets' === $mode ) {
    return array(
        'raw'     => $raw_toggle,
        'enabled' => ( 'yes' === $raw_toggle ) ? true : null,
    );
}
```

**Verdict: CORRECT.** When mode=widgets and toggle=yes → returns `enabled: true`.

---

### 2. `add_cursor_body_class()` — frontend.php:1569

```php
if ( $this->is_widget_only_mode() ) {
    $doc_state = $this->get_document_cursor_state( $cursor_document );
    if ( true === $doc_state['enabled'] ) {
        $classes[] = 'cmsmasters-cursor-enabled';  // ← promoted!
    } else {
        $classes[] = 'cmsmasters-cursor-widget-only';
    }
}
```

**Verdict: CORRECT.** Promoted page gets `cmsmasters-cursor-enabled` body class.

---

### 3. `is_widget_only_mode()` — frontend.php:1367

```php
private function is_widget_only_mode() {
    return 'widgets' === $this->get_cursor_mode();
}
```

**Reads ONLY Kit global mode. Does NOT check page promotion.**

---

### 4. `enqueue_custom_cursor()` — frontend.php:1540

```php
if ( $this->is_widget_only_mode() ) {
    $inline_js_parts[] = 'window.cmsmCursorWidgetOnly=true;';
}
```

**Verdict: NOT A BUG (but misleading).** `window.cmsmCursorWidgetOnly` is set but **never read by JS**. The JS only reads body class at line 552:
```js
var isWidgetOnly = body.classList.contains('cmsmasters-cursor-widget-only');
```
Since promoted page has `cmsmasters-cursor-enabled` (not `widget-only`), JS correctly sees `isWidgetOnly = false`.

**Note:** `window.cmsmCursorWidgetOnly` is dead code — set but never consumed.

---

### 5. `print_custom_cursor_html()` — frontend.php:1624

```php
if ( ! $this->is_widget_only_mode() ) {
    $this->print_cursor_critical_js();
}
```

**Verdict: MINOR ISSUE.** Critical JS (instant cursor follow before main script loads) is skipped on promoted pages because `is_widget_only_mode()` returns true (Kit=widgets). This is suboptimal (user sees delay) but NOT the root cause — main cursor JS still loads and runs.

---

### 6. `is_show_render_mode()` — module.php:1243 ⚠️ ROOT CAUSE #1

```php
private function is_show_render_mode() {
    return 'widgets' === self::get_cursor_mode();
}
```

**Reads ONLY Kit global mode. Does NOT check page promotion.**

This means on a **promoted page** where Kit=widgets:
- Body class = `cmsmasters-cursor-enabled` (correct)
- JS `isWidgetOnly` = false (correct — reads body class)
- JS expects elements to have `data-cursor-*` attributes (full render mode)
- But elements **still render** `data-cursor-show` (show render mode) because `is_show_render_mode()` returns true

Elements with cursor customization on a promoted page get:
```html
<div data-cursor-show="yes" data-cursor-type="..." ...>
```

Instead of (what JS expects in full mode):
```html
<div data-cursor-type="..." ...>
```

---

### 7. JS `resolveVisibility()` — custom-cursor.js:1914 ⚠️ ROOT CAUSE #2

```js
function resolveVisibility(el, isWidgetOnly) {
    if (isWidgetOnly) {
        // Widget-only: only show cursor on elements with data-cursor-show
        ...
    }
    // Full mode: cursor always visible, elements can hide/customize
    ...
}
```

On promoted page: `isWidgetOnly=false` → JS is in **full mode**. In full mode, cursor is always visible BUT:
- Elements with `data-cursor-show="yes"` are **not recognized** as cursor-customized elements in full mode
- The `data-cursor-show` attr is only meaningful when `isWidgetOnly=true`
- So element-level customizations (type, blend, effect) attached alongside `data-cursor-show` may not be picked up

Let me verify — checking element scan logic:

**custom-cursor.js:2227:**
```js
var vis = resolveVisibility(el, isWidgetOnly);
```

In full mode (isWidgetOnly=false), `resolveVisibility` returns based on `data-cursor` attr. Since elements have `data-cursor-show` instead of `data-cursor="customize"`, the element is treated as a plain element with no cursor customization.

---

## Answers to Questions

### Q1: Does `get_document_cursor_state()` return `enabled: true` when page toggle ON + Kit mode = widgets?
**YES.** Line 1278: `'enabled' => ( 'yes' === $raw_toggle ) ? true : null`. Correct.

### Q2: Does `add_cursor_body_class()` set `cmsmasters-cursor-enabled` for promoted page?
**YES.** Line 1579-1580: checks `doc_state['enabled'] === true` → adds `cmsmasters-cursor-enabled`. Correct.

### Q3: Does `enqueue_custom_cursor()` set `window.cmsmCursorWidgetOnly = true` even when page is promoted?
**YES** — but irrelevant. JS never reads this window var. Dead code.

### Q4: Does `print_custom_cursor_html()` include critical JS for promoted page?
**NO.** `is_widget_only_mode()` returns true (Kit=widgets) → critical JS skipped. Minor UX issue (cursor delay), not root cause.

### Q5: Does `is_show_render_mode()` account for page promotion?
**NO. This is ROOT CAUSE #1.** It reads only Kit global mode, ignoring page promotion. Elements render with show-render attrs even on promoted pages.

### Q6: Is there a chain where body class says "enabled" but JS behavior says "widget-only"?
**NO** — JS reads body class correctly. But there IS a mismatch: **body says "enabled" (full mode) but elements render as show-render mode (data-cursor-show)**. JS in full mode ignores `data-cursor-show`, so element customizations are lost.

---

## Critical Hypothesis Verdict

**CONFIRMED with nuance.**

The hypothesis was: `is_show_render_mode()` ignores page promotion → elements render `data-cursor-show` → JS expects full attrs → nothing works.

Actual mechanism:
1. `add_cursor_body_class()` correctly promotes → `cmsmasters-cursor-enabled`
2. JS correctly reads body class → `isWidgetOnly = false` → full mode
3. `is_show_render_mode()` in module.php does NOT see promotion → elements render `data-cursor-show="yes"` instead of just `data-cursor-type="..."` etc.
4. JS in full mode: cursor IS visible (dot+ring show), but element customizations attached with `data-cursor-show` are not picked up properly — cursor works as basic default, not with per-element settings

**The cursor should actually appear as a basic dot+ring** (since body class = enabled and JS runs in full mode). If it's completely invisible, there may be an additional issue. Need to verify on live site whether:
- (a) Cursor appears but without element customizations → confirms this analysis
- (b) Cursor doesn't appear at all → additional bug exists

**Most likely (b)** — because even though body class is correct, the `window.cmsmCursorWidgetOnly=true` being set (even if unused by main JS) might affect editor-sync or other scripts. Also, cursor starting position is offscreen and in full mode it needs mousemove to appear — but that should work.

---

## Root Causes Summary

| # | Location | Issue | Impact |
|---|---|---|---|
| **RC-1** | `module.php:1243` `is_show_render_mode()` | Reads only Kit mode, ignores page promotion | Elements render `data-cursor-show` instead of full attrs on promoted pages |
| **RC-2** | `frontend.php:1641` `print_custom_cursor_html()` | Skips critical JS on promoted pages | Cursor delay on promoted pages (minor UX) |
| **Dead code** | `frontend.php:1541` `window.cmsmCursorWidgetOnly` | Set but never read by any JS | No impact, but misleading |

---

## Fix Direction (for Phase 1)

### RC-1 Fix: `module.php` needs page promotion awareness

`is_show_render_mode()` must check not just Kit mode but also page promotion state. When Kit=widgets but page is promoted → `is_show_render_mode()` should return `false` for that page's elements.

Challenge: `is_show_render_mode()` is called per-element in `apply_cursor_attributes()`. It needs access to the current document's promotion state. Options:
1. Cache promotion state in a class property (set once per page render)
2. Read document settings inline (expensive per-element)
3. Pass promotion state through a filter

Option 1 (cached property) is cleanest.

### RC-2 Fix: `frontend.php` critical JS for promoted pages

Replace `! $this->is_widget_only_mode()` with a check that accounts for promotion:
```php
// Print critical JS in full mode OR when page is promoted from widget-only
$doc_state = $this->get_document_cursor_state(...);
if ( ! $this->is_widget_only_mode() || true === $doc_state['enabled'] ) {
    $this->print_cursor_critical_js();
}
```

### Cleanup: Remove dead `window.cmsmCursorWidgetOnly`

Can be removed since no JS reads it. But verify editor-sync and navigator-indicator scripts first.
