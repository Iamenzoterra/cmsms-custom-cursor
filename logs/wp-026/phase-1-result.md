# WP-026 Phase 1: Remove Kit Blend

> Date: 2026-03-16
> Status: COMPLETE
> Commits: 9c99b08, 1412ec4

---

## Problem

Kit-level blend (`cmsmasters_custom_cursor_blend_mode`) forced `--cmsmasters-cursor-color: #fff` globally via body classes. Any Kit blend setting killed the user's custom cursor color on every page, even when blend was undesirable. Blend should be per-page or per-element only.

## What was done

### frontend.php

1. **Deleted `window.cmsmCursorTrueGlobalBlend` emission** — Kit blend JS var no longer emitted. `trueGlobalBlend` in JS is always `''`, making widget "Default" = no blend.

2. **Body class blend → page-only read** — Replaced `get_page_cursor_setting('blend_mode', 'blend_mode', 'disabled')` (page > Kit cascade) with direct `$cursor_doc->get_settings('cmsmasters_page_cursor_blend_mode')`. No Kit fallback for blend anymore.

3. **Removed `blend_mode` from `kit_value_map`** — `'disabled' → ''` mapping no longer needed since Kit blend is never read.

### module.php

4. **Page blend labels** — `'Default (Global)'` → `'Off'`. Removed redundant `'off' → 'Disabled'` option (was identical to new `''` = Off).

5. **Promoted-page blend labels** — Same changes as page blend (`cmsmasters_cursor_inherit_blend`).

6. **Element blend** — Removed stale `'Default'` option (redundant with Off). `''` = Off is now the only "no blend" option. Updated description: `'Override global blend mode'` → `'Blend mode on this %s'`.

## What was NOT touched

- `custom-cursor.js` — `resolveBlendForElement()`, `trueGlobalBlend`, `setBlendIntensity()`, `CursorState` all untouched. JS handles empty `trueGlobalBlend` automatically (all "Default" paths resolve to `''` = no blend).
- `custom-cursor.css` — All blend CSS rules stay. They activate from body classes regardless of source.
- `cursor-editor-sync.js` — `applyKitBaseline()` Kit blend handling becomes no-op but is harmless.
- `navigator-indicator.js` — Kit blend read still runs, sends empty value. Harmless.
- Kuzmich theme Kit control — separate repo, not in scope. Will show a control that does nothing.

## Iterations

0 — Plan from phase-0 recon was accurate. Direct implementation, no failures.

## Verification

| Check | Expected | Result |
|---|---|---|
| `cmsmCursorTrueGlobalBlend` in frontend.php | 0 | 0 |
| `get_page_cursor_setting.*blend` in frontend.php | 0 | 0 |
| `blend_mode.*disabled` in kit_value_map | 0 | 0 |
| Page-only read (`page_cursor_blend_mode`) | exists | line 1618 |
| `'Off'` labels in module.php | present | lines 181, 321, 1061 |
| PHP lint | clean | clean |
| Build | success | success |

## Manual test results

- Kit blend = Soft → cursor uses custom color, NOT white
- Page blend → Soft → body gets `cmsmasters-cursor-blend-soft`
- Page blend → Off → no blend classes
- Element blend → Strong → blends on hover
- Element blend → Off → no blend
- Editor preview reflects changes live
