# BUG: Image/Icon Cursor — Normal Size Ignored on Frontend

**Status:** RESOLVED
**Reported by:** Yulia (original: "Special Cursor -> Image -> Hover Size only on backend")
**Actual symptom:** Normal Size value is ignored on frontend; falls back to 32px
**Fix commit:** `3aa71ef` Fix image/icon cursor size: use get_data() for raw element JSON
**File:** `modules/cursor-controls/module.php` — `apply_image_cursor_attributes()`, `apply_icon_cursor_attributes()`

---

## Problem

In Elementor editor, user sets Special Cursor → Image → Size (Normal tab) = 80.
On frontend, `data-cursor-image-size="32"` (the fallback default).
Hover size works correctly: `data-cursor-image-size-hover="100"`.

## Root Cause

**Two layers of caching/filtering were hiding the values:**

### Layer 1: Elementor settings filtering
The Size slider `cmsmasters_cursor_size_normal` has a condition:

```php
'condition' => array_merge( $toggle_condition, array(
    'cmsmasters_cursor_image_state'    => 'normal',   // ← tab state condition
) ),
```

Both `get_settings_for_display()` AND `get_settings()` filter out values for controls whose conditions aren't met. When `image_state = 'hover'`, the Normal size slider value is stripped.

**Solution:** Use `$element->get_data()['settings']` — reads raw `_elementor_data` JSON from database without any Elementor processing.

### Layer 2: Elementor rendering cache
Elementor caches rendered HTML in postmeta. After deploying PHP changes, the cached HTML is served without re-executing PHP. This caused all debug attributes to be invisible despite the file being correct on disk.

**Solution:** Elementor → Tools → Regenerate Files & Data after any PHP render change.

## Final Fix

```php
// In apply_image_cursor_attributes():
$saved = $element->get_data()['settings'] ?? array();

$element->add_render_attribute( '_wrapper', 'data-cursor-image-size',
    $saved['cmsmasters_cursor_size_normal']['size'] ?? 32 );
$element->add_render_attribute( '_wrapper', 'data-cursor-image-size-hover',
    $saved['cmsmasters_cursor_size_hover']['size'] ?? 48 );
$element->add_render_attribute( '_wrapper', 'data-cursor-image-rotate',
    $saved['cmsmasters_cursor_rotate_normal']['size'] ?? 0 );
$element->add_render_attribute( '_wrapper', 'data-cursor-image-rotate-hover',
    $saved['cmsmasters_cursor_rotate_hover']['size'] ?? 0 );
```

Same pattern in `apply_icon_cursor_attributes()`.

## What Was Tried (chronologically)

1. **`$settings` from `get_settings_for_display()`** — original code, filters by conditions → FAIL
2. **`$element->get_settings()`** (`$raw_settings`) — also filters conditioned sliders → FAIL
3. **`$element->get_data()['settings']`** — raw DB JSON, no filtering → WORKS
4. **Elementor Regenerate Files & Data** — needed to flush rendering cache after PHP changes

### Red herrings during debugging
- Browser cache / query string busting — not the issue
- PHP opcache / FPM restart — not the issue (`validate_timestamps=true`, `revalidate_freq=2`)
- Cloudflare edge cache — not the issue (site not behind CF proxy)
- Deploy path / file location — confirmed correct via `find` + `grep` on server

## Key Lessons

1. **`get_settings()` is NOT raw** — it merges defaults and filters conditions, same as `get_settings_for_display()` but without dynamic tag parsing
2. **`get_data()['settings']` is truly raw** — direct from `_elementor_data` postmeta JSON
3. **Elementor caches rendered HTML** — PHP changes to `before_render` hooks require "Regenerate Files & Data" to take effect
4. **Tab-state conditions** (`image_state => 'normal'`) affect ALL Elementor settings methods except raw data access

## Same Pattern Affects

- `apply_icon_cursor_attributes()` — icon size/rotate Normal/Hover sliders (also fixed)
- Potentially any future slider with tab-state conditions
