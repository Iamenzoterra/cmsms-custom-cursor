# Execution Log: WP-023 Phase 1 — Replace Control + Render Logic
> Executed: 2026-03-15T
> Status: COMPLETE (pending manual editor scenarios)

## Step A: Contract Findings

### A1. Minified JS strategy
**build-generated** via Terser + clean-css (`npm run build`).
Server loads ONLY `.min.js` via `get_js_assets_url()` (inherited from `Base_App`, appends `.min` suffix).
Evidence: `editor.php` lines 166-176 and 210-216 — `wp_enqueue_script()` + `$this->get_js_assets_url('navigator-indicator')` and `$this->get_js_assets_url('cursor-editor-sync')`.
No hash, no CDN — direct path with `.min` suffix.

### A2. Contract table

| Contract | Expected | Actual | Status |
|----------|----------|--------|--------|
| `hasCursorConfig` call map | 1 def + 1 call | 1 def (line 673) + 1 call (line 696) | Confirmed, both removed |
| Indicator return payloads | 5 shapes | All 5 preserved (null, hidden, inherit, special+subtype, core) | Confirmed |
| Fresh element `settings.get()` | String default from control | Sitewide: `'default'`, Widget-only: `'hide'` (pending live test) | Pending |
| `apply_core_cursor_attributes` dead param | 1 call site, unused | 1 call (line 1487), `$is_show_render` not read in method body | Confirmed, cleaned |
| cursorMode sources | 2 files, same PHP source | `cursor-editor-sync.js:13` boolean, `navigator-indicator.js:25-28` string | No change needed |

### A3. Indicator precedence (before/after)

**Before:**
1. disabled → null
2. toggle !== 'yes' + has sub-settings (sitewide only) → hidden
3. toggle !== 'yes' → null
4. inherit_parent=yes → inherit
5. special_active=yes → special+subtype
6. else → core

**After (implemented):**
1. disabled → null
2. elementMode=hide + sitewide → hidden
3. elementMode !== customize → null (covers: default, hide-in-widget-only, empty, absent)
4. inherit_parent=yes → inherit
5. special_active=yes → special+subtype
6. else → core

**Core detection predicate:** `elementMode === 'customize'` AND `inherit_parent !== 'yes'` AND `special_active !== 'yes'`.

### A5. apply_core_cursor_attributes call sites
- 1 call site: `module.php:1480` — `$this->apply_core_cursor_attributes( $element, $settings, $raw_settings );` (3 args)
- 1 definition: `module.php:1677` — `private function apply_core_cursor_attributes( $element, $settings, $raw_settings )` (3 params)
- Dead `$is_show_render` 4th param and arg both removed.

### Contract Decisions
- **Empty/absent on fresh widget-only nodes:** Control default is `'hide'` (string). `elementMode !== 'customize'` guard returns null correctly. To be verified in live editor.
- **Core indicator predicate:** `elementMode === 'customize'` + `inherit_parent !== 'yes'` + `special_active !== 'yes'`.
- **.min.js runtime status:** Confirmed build-generated, enqueued via `get_js_assets_url()` — HIGH confidence.
- **cursorMode source of truth:** `cursor-editor-sync.js` uses `window.cmsmCursorShowMode` (boolean from PHP inline script). `navigator-indicator.js` uses `window.cmsmastersNavigatorConfig.cursorMode` (string from PHP inline script). Both derive from same PHP `get_cursor_mode()`. Not shared directly between files.

## What Was Implemented

Replaced `cmsmasters_cursor_hide` SWITCHER (semantic flip: Show/Hide) with `cmsmasters_cursor_element_mode` SELECT (3 explicit states: `default`|`customize`|`hide`). In sitewide mode: "Use global" / "Customize" / "Hide". In widget-only mode: "Show" / "Hide" (no "default" since cursor is off by default). Removed the `hasCursorConfig()` "had config" detection hack from both PHP and JS. Cleaned dead `$is_show_render` parameter from `apply_core_cursor_attributes()`.

## Key Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Widget-only default value | `'hide'` (not `'default'`) | In widget-only mode there's no global cursor to fall back to, so "Use global" is meaningless. Default=hide means fresh elements correctly show no cursor. |
| Widget-only option labels | "Show" / "Hide" (2 options) | Only 2 options needed — "Show" maps to `customize`, "Hide" maps to `hide`. Matches old SWITCHER UX but with explicit values. |
| `empty()` check in PHP entry | `empty($element_mode) \|\| 'default' === $element_mode` | Covers both never-saved elements (empty string) and explicit "Use global" selection. Safe fallthrough. |
| Dispatcher block unchanged | Verbatim from original | Plan mandates: "only entry branching changes". Inherit → Special → Core dispatcher code is identical. |

## Files Changed

| File | Change | Description |
|------|--------|-------------|
| `modules/cursor-controls/module.php` | modified | B1: duplicate guard → new control ID (line 81). B2: SWITCHER→SELECT with mode-dependent options (lines 121-141). B3: toggle condition → `customize` (line 143). C: entry branch rewritten — clean switch on `$element_mode` (lines 1417-1435). Dead arg removed from call site (line 1480). Dead param removed from signature (line 1677). |
| `assets/js/cursor-editor-sync.js` | modified | D1: `hasCursorConfig()` removed (was lines 673-677). D2: toggle logic rewritten to read `cmsmasters_cursor_element_mode` — 3-branch switch with explicit `clearAttributes()` ordering comment (lines 680-695). |
| `assets/js/navigator-indicator.js` | modified | E: `hasNonDefaultCursor()` rewritten — reads `cmsmasters_cursor_element_mode`, `isSitewideMode` alias for readable hide gate, exact 5 return payload shapes preserved (lines 352-391). |
| `assets/js/cursor-editor-sync.min.js` | rebuilt | Via `npm run build` (Terser) |
| `assets/js/navigator-indicator.min.js` | rebuilt | Via `npm run build` (Terser) |
| `logs/wp-023/phase-1-result.md` | created | This file |

## Issues & Workarounds

None. Clean implementation — all edits were surgical replacements at documented line ranges.

## Verification Results

| Check | Result |
|-------|--------|
| Old ID sweep — source (0 live) | OK (0 hits in PHP + JS source) |
| Old ID sweep — .min.js (0 live) | OK (0 hits) |
| New SELECT registered | OK (4 PHP hits: guard, control, condition, render) |
| Toggle condition updated | OK (`'cmsmasters_cursor_element_mode' => 'customize'`) |
| Had-config removed | OK (0 hits for `has_config`; 2 `get_data.*settings` are legitimate image/icon reads) |
| Dispatcher outcome parity (inherit/special/core) | OK (lines 1437-1480 identical to original) |
| Editor JS 3-state | OK (customize/hide/default branches with early returns) |
| Indicator precedence explicit | OK (disabled → hide+sitewide → !customize → inherit → special → core) |
| Core predicate matches original | OK (customize + !inherit + !special = core) |
| cursorMode source consistent across files | OK (both from PHP `get_cursor_mode()`, different transport) |
| Minified resolved | OK (both .min.js contain new ID, no old ID) |
| `is_show_render_mode()` preserved | OK (definition line 1241, used line 1430) |
| Scenario 1 (sitewide) | Pending manual test |
| Scenario 2 (widget-only) | Pending manual test |
| Scenario 3 (dispatch parity) | Pending manual test |
| Wrapper attrs clean on transition | Pending manual test |
| Indicator recompute no refresh | Pending manual test |

## Git
- Commit: pending
- Message: `replace element toggle with 3-state SELECT [WP-023 phase 1]`
