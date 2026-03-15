# WP-023 Phase 0: Recon Results

**Task:** Replace element-level SWITCHER `cmsmasters_cursor_hide` with SELECT `cmsmasters_cursor_element_mode` (`default`|`customize`|`hide`).

**Date:** 2026-03-15

---

## Findings

### 1. Control Registration

| Item | Value |
|---|---|
| File | `modules/cursor-controls/module.php` |
| Method | `register_controls()` (line 69-878) |
| Control ID | `cmsmasters_cursor_hide` |
| Registration | Lines 121-131 |
| Type | `Controls_Manager::SWITCHER` |
| Default | `''` (empty string) |
| Labels | Off="Hide", On="Show" |

### 2. Toggle Condition Base

**Line 135:** `$toggle_condition = array( 'cmsmasters_cursor_hide' => 'yes' );`

All ~25 sub-controls use this as the base condition via `array_merge($toggle_condition, ...)`.

### 3. Sub-Controls Conditioned on Toggle

| Control | Line | Condition Pattern |
|---|---|---|
| `cmsmasters_cursor_inherit_parent` | 138-150 | `$toggle_condition` alone |
| `cmsmasters_cursor_inherit_blend` | 153-170 | `+ inherit_parent => 'yes'` |
| `cmsmasters_cursor_inherit_effect` | 173-191 | `+ inherit_parent => 'yes'` |
| `cmsmasters_cursor_special_active` | 194-216 | `+ inherit_parent => ''` |
| `cmsmasters_cursor_core_heading` | 219-230 | `+ inherit_parent => '', special_active => ''` |
| `cmsmasters_cursor_hover_style` | 232-248 | `+ inherit_parent => '', special_active => ''` |
| `cmsmasters_cursor_force_color` | 250-264 | `+ inherit_parent => '', special_active => ''` |
| `cmsmasters_cursor_color` | 266-278 | `+ force_color => 'yes'` |
| `cmsmasters_cursor_core_effects_heading` | 280-291 | `+ inherit_parent => '', special_active => ''` |
| `cmsmasters_cursor_blend_mode` | 293-314 | `+ inherit_parent => '', special_active => ''` |
| `cmsmasters_cursor_special_type` | 317-342 | `+ special_active => 'yes'` |
| All image/text/icon controls | 345-817 | Various nested conditions |
| `cmsmasters_cursor_special_effects_heading` | 819-830 | `+ special_active => 'yes'` |
| `cmsmasters_cursor_special_blend` | 832-852 | `+ special_active => 'yes'` |
| `cmsmasters_cursor_effect` | 855-874 | `+ inherit_parent => ''` |

### 4. SELECT Condition Pattern (Template for Phase 1)

Existing SELECT examples in same file use:
```php
'condition' => array_merge( $toggle_condition, array(
    'other_control' => 'value',
) )
```
E.g. line 157: `'condition' => array_merge( $toggle_condition, array( 'cmsmasters_cursor_inherit_parent' => 'yes' ) )`

### 5. `apply_cursor_attributes()` -- Full Structure

**Lines 1409-1488.** Complete branching:

```
apply_cursor_attributes($element)           [1409]
+-- $toggle = settings['cmsmasters_cursor_hide']  [1411]
+-- $is_show_render = is_show_render_mode()       [1413]
|
+-- IF is_show_render (SHOW MODE)                 [1415]
|  +-- toggle != 'yes' -> return                   [1417-1418]
|  +-- toggle == 'yes' -> data-cursor-show="yes"   [1421]
|
+-- ELSE (FULL MODE)                              [1422]
|  +-- toggle != 'yes' (HIDE branch)              [1424]
|  |  +-- Check $has_config from raw DB data       [1429-1432]
|  |  +-- has_config=true -> data-cursor="hide"     [1434-1435]
|  |  +-- has_config=false -> return (no attrs)     [1438]
|  +-- toggle == 'yes' -> fall through              [1441]
|
+-- DISPATCHER (shared)                           [1444-1487]
   +-- inherit_parent='yes' -> inherit attrs        [1450-1466]
   +-- special_active='yes' -> image/text/icon      [1469-1483]
   +-- else -> apply_core_cursor_attributes()       [1486-1487]
```

### 6. "Had Config" Detection Block

**Lines 1429-1432.** Reads raw element data from DB (not processed settings):
```php
$saved = $element->get_data()['settings'] ?? array();
$has_config = ! empty( $saved['cmsmasters_cursor_hover_style'] )
    || ( isset( $saved['cmsmasters_cursor_special_active'] ) && 'yes' === $saved['cmsmasters_cursor_special_active'] )
    || ( isset( $saved['cmsmasters_cursor_inherit_parent'] ) && 'yes' === $saved['cmsmasters_cursor_inherit_parent'] );
```

**Purpose:** Distinguishes "never touched" elements from "user configured then toggled to Hide". Only the latter get `data-cursor="hide"`.

### 7. `is_show_render_mode()`

**Lines 1233-1235.** Single caller at line 1413.
```php
private function is_show_render_mode() {
    return 'widgets' === self::get_cursor_mode();
}
```
Also passed as `$is_show_render` to `apply_core_cursor_attributes()` at line 1487 but **dead code** -- that method accepts but never uses the parameter.

### 8. Cross-File References for `cmsmasters_cursor_hide`

| File | Line | Usage |
|---|---|---|
| `modules/cursor-controls/module.php` | 81, 122, 135, 1411 | Registration, condition, render |
| `assets/js/cursor-editor-sync.js` | 686 | `settings.cmsmasters_cursor_hide` -- mirrors PHP toggle logic for live editor preview |
| `assets/js/navigator-indicator.js` | 355 | `settings.get('cmsmasters_cursor_hide')` -- determines navigator indicator type |
| `assets/js/cursor-editor-sync.min.js` | 1 | Minified copy |
| `assets/js/navigator-indicator.min.js` | 1 | Minified copy |

### 9. JS References in custom-cursor.js

**ZERO matches confirmed.** Frontend runtime JS does not reference this control -- it reads `data-cursor*` attributes only.

### 10. Page-Level Toggle (Context Only)

`cmsmasters_page_cursor_disable` -- similar SWITCHER pattern at page level:
- `modules/cursor-controls/module.php`: lines 929, 944, 971, 994-995
- `includes/frontend.php`: line 1265

Not in scope for WP-023 but same pattern.

### 11. Semantic Flip Summary

The same `cmsmasters_cursor_hide = 'yes'` value means:
- **SHOW MODE** (Kit visibility = "widgets"): "Show cursor on this element" (opt-in)
- **FULL MODE** (Kit visibility = "sitewide"): "Show cursor on this element" (skip hide logic)

The new SELECT eliminates this by using explicit `default`|`customize`|`hide` values that mean the same thing regardless of Kit mode.

---

## Surprises / Scope Impact

1. **JS files ARE in scope.** Two editor-side JS files read `cmsmasters_cursor_hide`:
   - `cursor-editor-sync.js:686` -- live preview toggle logic
   - `navigator-indicator.js:355` -- indicator dot detection

   Both must be updated to read the new `cmsmasters_cursor_element_mode` control ID.

2. **Dead parameter.** `$is_show_render` is passed to `apply_core_cursor_attributes()` (line 1487) but never used inside that method. Cleanup candidate.

3. **"Had config" block becomes unnecessary.** With the new SELECT, `hide` is an explicit choice -- no need to sniff raw DB data to distinguish "never touched" from "explicitly hidden".

---

## Files to Modify in Phase 1

| File | Changes |
|---|---|
| `modules/cursor-controls/module.php` | Replace SWITCHER->SELECT, update `$toggle_condition`, rewrite `apply_cursor_attributes()` branches, clean up `$has_config` block |
| `assets/js/cursor-editor-sync.js` | Line 686: read new control ID, update toggle logic |
| `assets/js/navigator-indicator.js` | Line 355: read new control ID, update detection logic |
