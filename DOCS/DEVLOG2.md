# Development Log 2

Continuation of DEVLOG.md. Sessions from 2026-03-13 onwards.

---

## 2026-03-13 — Fix Hide/Show switcher in Full (Sitewide) mode

**Problem (reported by Yulia):** In Show Sitewide mode, the per-element Hide/Show toggle doesn't work. When user configures a custom cursor on an element (toggle=Show), then switches toggle to Hide:
- Editor: previously configured cursor still displays
- Frontend: cursor doesn't properly hide
- Navigator Structure panel: no "Hidden" indicator shown

**Root cause — 3 files all ignored the toggle in Full mode:**

1. **`cursor-editor-sync.js` `applySettings()`** — In Full mode, had no check for toggle value. Always fell through to apply saved settings from Backbone model. When user toggled to Hide, `clearAttributes()` ran but saved settings (retained in model even when conditioned controls hidden in UI) were immediately re-applied.

2. **`module.php` `apply_cursor_attributes()`** — In Full mode, always called `get_settings_for_display()` and proceeded to the shared dispatcher regardless of toggle value.

3. **`navigator-indicator.js` `hasNonDefaultCursor()`** — Returned `null` for ANY `toggle !== 'yes'`, making hidden elements completely invisible in Structure panel.

### Failed approaches (3 commits, all reverted)

**Attempt 1 (`b0f404b`):** Assumed toggle='' means "Hide" for ALL elements by default in Full mode. Stamped `data-cursor="hide"` on every element where toggle wasn't 'yes'. **Wrong:** In Show Sitewide mode, default state is Show (cursor visible), not Hide.

**Attempt 2 (`9639805`):** Added generic `elementor/frontend/before_render` hook + JS hide zone detection fixes. Still based on wrong assumption that default=Hide.

**Attempt 3 (`4830eff`):** Added JS fallback to stamp `data-cursor="hide"` on unmarked containers. Same wrong logic.

**User correction:** "коли show sitewide по замовчанню show!" — Default is Show. Only elements where user EXPLICITLY configured cursor then toggled to Hide should be hidden.

**Reverted all 3** (`de9f05f`) and started fresh.

### Correct fix (3 commits)

**Key insight:** The distinction between "never touched" (toggle='') and "explicitly hidden" (toggle='') is whether the element has any saved cursor sub-settings. If user configured cursor (hover_style, special, color, etc.) then toggled to Hide, those settings remain in the model/saved data even though conditioned controls are hidden in UI.

**Commit `2807a74` — Fix Hide toggle in Full (Sitewide) mode:**

*cursor-editor-sync.js:*
- Added `hasCursorConfig(s)` helper — checks `hover_style`, `special_active`, `inherit_parent`
- In `applySettings()`, added `else if (toggle !== 'yes')` branch for Full mode:
  - On user toggle change (`!skipClear`): if element has saved cursor config, stamp `data-cursor="hide"` so JS runtime shows system cursor
  - On initial load (`skipClear=true`): early return without touching PHP-rendered attributes
  - Both cases: don't apply saved cursor settings → prevents configured cursor from leaking through

*module.php:*
- In `apply_cursor_attributes()` Full mode branch, added toggle check before dispatcher
- When `toggle !== 'yes'`: reads raw saved data via `$element->get_data()['settings']`
- If has saved cursor config → stamps `data-cursor="hide"` on element wrapper
- If no saved config (never touched) → returns early, global cursor applies normally

**Commit `8d8ec27` — Add Hidden indicator to navigator legend:**

*navigator-indicator.js:*
- `hasNonDefaultCursor()`: When `toggle !== 'yes'` in Full mode (`!isShowMode`), checks for saved cursor sub-settings instead of returning null. Returns `{ type: 'hidden' }` if configured settings found.
- `addLegend()`: Added "Hidden" (gray dot) legend entry, only shown in Full (Sitewide) mode where hiding elements makes sense.

**Commit `289e11a` — Expand hidden indicator check:**

Initial `hasCursorConfig` check was too narrow (only hover_style, special, inherit). User could configure cursor with only color/blend/effect and the indicator wouldn't show. Expanded to also check:
- `cmsmasters_cursor_force_color === 'yes'`
- `cmsmasters_cursor_blend_mode` (non-empty)
- `cmsmasters_cursor_effect` (non-empty)

### Files changed (net diff from `5c03d59`)

| File | Changes |
|---|---|
| `assets/js/cursor-editor-sync.js` | Added `hasCursorConfig()`, added Full mode Hide branch in `applySettings()` |
| `modules/cursor-controls/module.php` | Added toggle check + `data-cursor="hide"` stamping in Full mode |
| `assets/js/navigator-indicator.js` | `hasNonDefaultCursor()` detects hidden elements, legend shows "Hidden" in Full mode |

### Navigator indicator logic (Show Sitewide mode)

| Element state | toggle | Sub-settings | Indicator |
|---|---|---|---|
| Never touched (default Show) | `''` | all defaults | null (no dot) |
| User toggled Show, configured core | `'yes'` | hover/color/etc. | core (purple) |
| User toggled Show, configured special | `'yes'` | special_active='yes' | special (blue) |
| User toggled Show, set inherit | `'yes'` | inherit='yes' | inherit (amber) |
| User configured, then toggled Hide | `''` | non-default values retained | hidden (gray) |

### Key lessons

1. **Elementor retains conditioned control values.** When a control has `condition => ['toggle' => 'yes']` and toggle changes from 'yes' to '', the control is hidden in UI but its value stays in the Backbone model AND in saved element data. This is how we distinguish "configured then hidden" from "never touched".

2. **`skipClear` parameter is critical.** In `applySettings()`, `skipClear=true` means initial page load (preserve PHP-rendered attrs), `skipClear=false` means user changed a setting. The Hide branch only stamps `data-cursor="hide"` on user changes, not on init — preventing conflicts with PHP-rendered HTML.

3. **`get_data()['settings']` vs `get_settings()` vs `get_settings_for_display()`.** In PHP:
   - `get_data()['settings']` — raw saved data, only contains explicitly set values (not defaults)
   - `get_settings()` — all settings including defaults, no condition filtering
   - `get_settings_for_display()` — filters out values where conditions aren't met
   We use `get_data()['settings']` to check if user ever configured cursor settings, because it only has non-default values.

---
