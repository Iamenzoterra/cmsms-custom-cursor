# Execution Log: WP-025 Phase 1 — Replace Page Control + Update Downstream
> Executed: 2026-03-16T14:00:00Z
> Duration: ~15 minutes
> Status: ✅ COMPLETE

## Step A: Contract Findings

### Contract table verified
- CHOOSE_TEXT format uses `array('title' => esc_html__(...))` — confirmed from element-level pattern at module.php:129-148
- `$is_show_mode` = `'widgets' === $mode` (line 973) — widget-only mode
- `isShowMode` in JS = `cursorMode === 'widgets'` (line 27) — matches PHP
- Old control refs: module.php (5), frontend.php (1), navigator-indicator.js (2) = 8 total — all converted or legacy-bridged

### isShowMode confirmed
`$is_show_mode` is true when Kit cursor_visibility = 'widgets' (widget-only mode). In this mode, cursor is hidden by default and pages opt-in via "Show" (= customize).

### Minified strategy
`npm run build` runs terser for JS, clean-css for CSS. Minified output verified to contain `cmsmasters_page_cursor_mode`.

## What Was Implemented

Replaced the boolean SWITCHER control (`cmsmasters_page_cursor_disable`) with a 3-state CHOOSE_TEXT control (`cmsmasters_page_cursor_mode`) with values `default` | `customize` | `disable`. In widget-only mode, only 2 options are shown (Show/Hide) with `default` as the Hide value, preserving the `enabled:null` state. All downstream consumers (frontend.php, navigator-indicator.js) updated with legacy fallback bridges that map old `_disable='yes'` to the correct tri-state value per mode. The semantic flip is now confined to legacy bridge code only — the canonical path uses direct mapping.

## Key Decisions
| Decision | Chosen | Why |
|----------|--------|-----|
| Widget-only Hide value | `default` | Preserves enabled:null / cursor-widget-only state — `disable` would kill runtime |
| Widget-only options | Show (customize) + Hide (default) | Only 2 meaningful states in widget-only mode |
| Sitewide options | Use global / Customize / Disable | 3 states: inherit, override with customization, or turn off |
| Legacy read bridge | Yes, in all 3 files | Old docs with `_disable='yes'` keep working without data migration |
| Legacy bridge is mode-aware | Yes | Old 'yes' means opposite per mode — last place semantic flip lives |
| should_enable_custom_cursor | Unchanged | Widget-only disable is new behavior, deferred to later phase |
| window.cmsmCursorWidgetOnly | Removed | Zero JS consumers confirmed via grep |
| cursor-editor-sync.js | No changes initially | Consumes normalized payload from navigator-indicator.js |

## Files Changed
| File | Change | Description |
|------|--------|-------------|
| modules/cursor-controls/module.php | modified | Duplicate guard → new ID, SWITCHER → CHOOSE_TEXT, toggle condition unified, is_page_promoted() + legacy fallback |
| includes/frontend.php | modified | get_document_cursor_state() rewritten with direct mapping + legacy bridge, removed dead cmsmCursorWidgetOnly |
| assets/js/navigator-indicator.js | modified | buildPageCursorPayload() reads new control + legacy fallback, reset sends 'default', JSDoc updated |
| assets/js/navigator-indicator.min.js | rebuilt | Minified output of navigator-indicator.js |

## Legacy Bridge Locations
| File | Function/Block | What it reads |
|---|---|---|
| frontend.php | get_document_cursor_state() | `_disable` fallback with mode-aware mapping (yes → customize in widgets, yes → disable in sitewide) |
| module.php | is_page_promoted() | `_disable` fallback (yes → customize in widget-only) |
| navigator-indicator.js | buildPageCursorPayload() | `json._disable` fallback with same mode-aware mapping |

## Issues & Workarounds

### Editor preview bugs (found during manual testing, fixed in follow-up commits)

1. **Stale visual overrides** — switching "Customize" → "Use global" kept stale theme/blend/etc because Elementor hides sub-controls via condition but keeps values in Backbone model. Fix: `isCustomize` gate in `buildPageCursorPayload()` zeroes visual settings when `pageMode !== 'customize'`. (`ad72cf7`)

2. **No visibility class promotion** — widget-only "Show" sent `enabled:true` but nothing added `cmsmasters-cursor-enabled` body class in preview. Fix: visibility class promotion/demotion block in `applyPageCursorSettings()`. (`ad72cf7`)

3. **Null payload on Disable→Use global** — return gate filtered out the "reset" payload (`enabled:true`, no overrides) so `cmsmasters-cursor-disabled` class stayed. Fix: `hasExplicitMode` flag — new tri-state control always sends payload. (`9a7a250`)

## Verification Results
| Check | Result |
|-------|--------|
| Old ID: zero writes | ✅ Only in legacy read fallbacks + comment |
| Old ID: only legacy reads | ✅ frontend.php:1271, module.php:1266, navigator.js:871 |
| New control registered | ✅ module.php:988 with CHOOSE_TEXT |
| Widget-only Hide = default | ✅ 2 options: customize (Show), default (Hide) |
| Toggle condition unified | ✅ `'cmsmasters_page_cursor_mode' => 'customize'` — same both modes |
| get_document_cursor_state canonical no inversion | ✅ Direct if/else on page_mode values |
| Legacy bridge correct | ✅ All 3 files consistent: yes→customize (widgets), yes→disable (sitewide) |
| Legacy bridge no drift | ✅ module.php only in widgets context, frontend+navigator mode-aware |
| is_page_promoted updated | ✅ Reads new control, falls back to _disable |
| should_enable unchanged | ✅ No modifications — safe because widget-only can never produce 'disable' |
| Widget-only no-disable contract | ✅ Options: customize+default only, reset→default, legacy→customize |
| Dead code removed | ✅ cmsmCursorWidgetOnly gone from frontend.php |
| Navigator updated | ✅ New control in payload builder + reset |
| Minified resolved | ✅ navigator-indicator.min.js contains new ID |
| Scenario 1 (sitewide) | ✅ Toggle ON→Disable→Use global: all transitions work |
| Scenario 2 (widget-only) | ✅ Show→Hide→Show works, cursor follows toggle state |
| Scenario 3 (legacy) | ⏳ Manual — requires old doc with _disable='yes' |

## Phase 2 — Editor Preview Fixes (2026-03-16)

### 4. Widget-only Show/Hide toggle not working in editor preview
**Root cause:** `isWidgetOnly` closure var in `custom-cursor.js` captured once at init. Body class swaps by `cursor-editor-sync.js` didn't update the runtime flag. The mouseover handler checked the stale `isWidgetOnly = true` and re-hid the cursor on every mouse move.

**Failed attempt (d5d1f42, reverted):** Dispatched event that only toggled `hidden` state without updating `isWidgetOnly`. Next mousemove re-hid cursor.

**Fix:** Added `cmsmasters:cursor:page-visibility-update` event (same pattern as `page-blend-update` / `smoothness-update`):
- `cursor-editor-sync.js` dispatches after body class swap with `{ promoted: true/false }`
- `custom-cursor.js` listener updates `isWidgetOnly` flag AND transitions hidden state
- Commit: `837c9ba`

### 5. Reset to Defaults flipping Show→Hide
**Root cause:** Reset button in `navigator-indicator.js` included `cmsmasters_page_cursor_mode: 'default'` in `settingsToReset`. In Show mode, `default` = Hide.

**Fix:** Removed `cmsmasters_page_cursor_mode` from reset list — only visual overrides are reset (theme, smoothness, blend, effect, adaptive). Show/Hide state is preserved.
- Commit: `25f8ed9`

### 6. Cursor flashing at stale position on toggle
**Root cause:** When user toggles Show while mouse is on editor panel (outside preview iframe), `hidden: false` transition made cursor appear at last known coordinates (often top-left corner).

**Fix:** Gate unhide with `document.documentElement.matches(':hover')`. If mouse isn't in the iframe, skip unhide — the existing `mouseenter` handler shows cursor at correct position when pointer returns.
- Commit: `e90834e`

## Git
- `d9c788b` — `replace page toggle with 3-state choose_text + legacy bridge [WP-025 phase 1]`
- `9427a22` — `docs: fix WP-025 phase 1 log — status PARTIAL, add contract checks, record sha`
- `269915b` — `recon: editor preview page settings path [WP-025]`
- `ad72cf7` — `fix: editor preview page settings — stale overrides + visibility promotion [WP-025]`
- `9a7a250` — `fix: null payload on Disable→Use global transition — send reset payload [WP-025]`
- `837c9ba` — `fix: update isWidgetOnly at runtime on Show/Hide toggle [WP-025]`
- `25f8ed9` — `fix: Reset to Defaults no longer changes Show/Hide state [WP-025]`
- `e90834e` — `fix: don't flash cursor at stale position when toggling from editor panel [WP-025]`
