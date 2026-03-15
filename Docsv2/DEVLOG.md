# Development Log

Living document tracking development sessions, decisions, and iterations.

---

## 2026-03-15 — Hotfix: Dot Theme Kit Size Override

**Problem:** Kit size controls (`--cmsmasters-cursor-dot-size`, `--cmsmasters-cursor-dot-hover-size`) had no effect on dot theme. Slider moved, value saved, but dot stayed 10px / 20px hover.

**Root cause:** `body.cmsmasters-cursor-theme-dot` in `custom-cursor.css` hardcoded `--cmsmasters-cursor-dot-size:10px` and `--cmsmasters-cursor-dot-hover-size:20px`. Body-level selector beats `:root` Kit vars by specificity — Kit values were dead on arrival.

**Fix:** Deleted the 4-line block. Dot theme now inherits size vars from `:root` (Kit-configured values). Ring hide and hover rules untouched.

**Behaviour change:** Users who never configured Kit dot sizes will see `:root` defaults (8px / 40px) instead of the old forced 10px / 20px. This is correct — Kit controls should be the authority.

**Iterations:** 0 — machete fix, single block deletion. Identified via CSS specificity analysis.

---

## 2026-03-15 — Hotfix: Kit Smoothness Not Updating Live in Editor

**Problem:** Changing smoothness in Kit (Site Settings) or Page Settings didn't update cursor follow speed live in editor preview. Required save + reload to take effect.

**Root cause:** `custom-cursor.js` reads `window.cmsmCursorSmooth` once at init into cached `L` and `dotL` (lerp factors for ring and dot). The RAF render loop uses these cached values. The postMessage pipeline already delivered smoothness correctly to `cursor-editor-sync.js`, which updated `window.cmsmCursorSmooth` — but `custom-cursor.js` never re-read it.

**Fix:** Added `cmsmasters:cursor:smoothness-update` custom event, following the existing blend-mode pattern (`cmsmasters:cursor:page-blend-update`):
- `dispatchSmoothnessUpdate()` helper in `cursor-editor-sync.js` normalizes value (undefined → 'normal') and dispatches
- Called from both `applyPageCursorSettings()` and `applyKitBaseline()`
- Listener in `custom-cursor.js` updates `L` and `dotL` from `smoothMap`

**Key insight:** Same pattern as blend — init-only cached values need a custom event bridge for live editor preview. The dispatcher normalizes before dispatch so the listener can trust valid enum input.

---

## 2026-03-15 — WP-022: Kit Size CSS Vars to :root

**Problem:** In the Elementor editor, changing Kit cursor size/hover-size in Site Settings had no live effect. The slider moved, `cursor-editor-sync.js` applied the new value via `documentElement.style.setProperty()`, but the cursor didn't resize until iframe reload.

**Root cause:** PHP output size CSS vars on `body.cmsmasters-cursor-enabled[class], body.cmsmasters-cursor-widget-only[class]` — specificity (0,2,0). The JS inline override on `:root` (documentElement) loses because CSS custom property declarations on a more-specific selector win, regardless of inline style. The `[class]` specificity hack was inherited from when vars needed to beat theme defaults.

**Fix (Phase 1):** Moved size vars to `:root` in `frontend.php`. Now PHP declares at (0,1,0) and JS inline on same element wins. Also fixed `!empty()` zero-value guard — `!empty(0)` is `true` in PHP, which would filter out a valid `0px` dot size. Changed to `'' !== (string) $val && is_numeric($val)`.

**Phase 2:** Documentation — DEC-010, TRAP-012.

**Key insight:** CSS custom properties don't inherit like normal properties when set on different elements. A declaration on `body[class]` (0,2,0) beats an inline style on `:root` (0,1,0 + inline) because they target different elements — the body declaration wins in the cascade for body's subtree.

---

## 2026-03-15 — Live Kit Settings Sync in Editor Preview

**Problem:** Kit (global) cursor settings had no live preview — changing color, blend, theme etc. in Site Settings panel required iframe reload to take effect. Page-level settings already had live sync, but Kit was missing.

**Solution:** Two-file postMessage bridge with cascade contract `effective = Kit baseline + page overrides`:

- **Sender** (`navigator-indicator.js`): Backbone `change` listener on Kit doc settings model, filtered to `cmsmasters_custom_cursor_*` keys. Builds normalized payload (value remaps mirror PHP: `dot_ring`→`classic`, `disabled`→`''`, wobble→effect). Broadcasts `cmsmasters:cursor:kit-settings` to preview iframe. Eager + lazy attach points for Kit doc availability.

- **Receiver** (`cursor-editor-sync.js`): `applyKitBaseline(p)` — (1) updates `initialCursorState` so page "Default" fallback reads latest Kit, (2) applies Kit to DOM (body classes, CSS vars, window vars), (3) re-applies stored `activePageOverrides` on top. Kit-only fields (visibility, dot_size, dual_mode, trueGlobalBlend) always applied directly.

**Key design choice:** Re-apply full page overrides after Kit change rather than per-field skip logic. Simpler, symmetric with init order, one extra DOM write per Kit change (negligible — Kit changes are rare user actions).

**Log:** `logs/wp-021/phase-6-kit-preview-sync.md`

---

## 2026-03-15 — Quality baseline fix: duplicate CSS selector + innerHTML false positives

**Problem:** `npm run quality` had 2 actionable failures blocking clean runs:
1. `quality:css` — duplicate `.cmsmasters-nav-cursor-indicator` selector (lines 20 & 267 in `editor-navigator.css`)
2. `quality:patterns` — 3 innerHTML false positives (lines 64, 483, 594) plus missed line 1474

**Fix:**
1. **CSS:** Merged line 267 block (dimensions + Elementor overrides) into line 20 block. Legend variant (`.cmsmasters-legend-item .cmsmasters-nav-cursor-indicator`) has higher specificity + `!important` — cascade safe.
2. **JS:** Replaced regex heuristic filter with explicit `SAFE_INNERHTML` whitelist keyed by `file:line`. 4 entries: sanitizer function (line 64), sanitized assignment (line 1474), two static HTML literals (lines 483, 594). Line shifts after refactoring force re-verification — security feature, not bug.

**Result:** `quality:css` 0 errors, `quality:patterns` innerHTML all green. Only remaining failure: `preview:destroyed` in `custom-cursor.js` (deferred — iframe cleanup is handled by browser, no real bugs reported).

---

## 2026-03-15 — WP-021 "Crystal Clear Cursor" (Phases 0-4)

**Problem:** `detectCursorMode()` was a 544-line god function handling element resolution, visibility, special cursors, blend, effects, color, hover, and form detection in one monolithic flow. Impossible to trace which code path set a given value. Debug required reading the entire function.

**Solution:** Decomposed into 5 resolver functions + thin orchestrator (~313 lines):

| Resolver | Lines | Purity | Purpose |
|----------|-------|--------|---------|
| `resolveElement(x, y)` | ~15 | Pure | Which element is cursor over? |
| `resolveVisibility(el)` | ~60 | Impure | Should cursor be visible? (form/video/iframe) |
| `resolveSpecialCandidate(el)` | ~45 | Impure | Which special cursor wins? (image/text/icon) |
| `resolveBlendForElement(el, ctx)` | ~92 | Pure | What blend intensity? (13 code paths) |
| `resolveEffectForElement(el)` | ~20 | Pure | Which effect applies? |

**Phase execution:**
- **Phase 0:** Extracted 5 DOM cascade helpers (`findWithBoundary`, `getWidgetBoundaryEl`, `getHoverTarget`, `findEffectAttr`, `findBlendAttr`) from detectCursorMode to module scope
- **Phase 1A:** Extracted `resolveElement()` + `resolveVisibility()` with preserved `isFormZone()` timing
- **Phase 1B:** Extracted `resolveSpecialCandidate()` (impure, kept deactivate side-effect) + `resolveEffectForElement()` (pure)
- **Phase 1C:** Extracted `resolveBlendForElement()` (pure, 13 blend paths consolidated to single return)
- **Phase 2A:** Partial mouseover unification — form/video checks via `resolveVisibility()` (shared), show-zone/hide-zone stay event-owned
- **Phase 2B:** Documented `formZoneActive` multi-writer pattern (6 writers, same-direction-safe), simplified mouseout handler
- **Phase 3:** Wobble body class -> `window.cmsmCursorWobble`, theme class PHP-only (removed JS re-add), documented blend FOUC prevention
- **Phase 4:** Added CMSM_DEBUG resolver tracing — 26 `debugLog` calls across all resolvers, `window.CMSM_DEBUG = true` for live debugging

**Key decisions (see DECISIONS.md):**
- DEC-001: Blend dual ownership (PHP + JS) for FOUC prevention
- DEC-002: Wobble body class -> window var (JS-only effect)
- DEC-003: Adaptive detection stays inline (66 lines, 5+ state params)
- DEC-004: resolveSpecialCandidate impure (deactivate side-effect kept)
- DEC-005: formZoneActive multi-writer intentional (not single-writer)
- DEC-006: Partial mouseover unification (show-zone stays event-owned)
- DEC-007: Theme class PHP-only (removed redundant JS re-add)
- DEC-009: resolveBlendForElement returns value, caller applies

**Result:** detectCursorMode ~313 lines (was 544). Each resolver independently testable and traceable via `CMSM_DEBUG`. No behavioral regressions.

---

## 2026-03-11 — Fix system cursor hidden on special cursor zones when preview OFF

**Problem (reported by Yulia):** In the Elementor editor with Custom Cursor Preview OFF, elements with special cursor (image/text/icon) show no cursor at all — even the system cursor is hidden.

**Root cause — two unscoped CSS rules:**

1. **`custom-cursor.css`** — Three `cursor:none!important` rules on attribute selectors were completely unscoped:
   ```css
   [data-cursor-image], [data-cursor-image] * { cursor:none!important }
   [data-cursor-text], [data-cursor-text] * { cursor:none!important }
   [data-cursor-icon], [data-cursor-icon] * { cursor:none!important }
   ```
   These applied ALWAYS — regardless of dual mode, cursor-disabled state, or any body class.

2. **`cursor-editor-sync.js`** — Override rules for `cursor-disabled` state had `:not(.cmsmasters-cursor-dual)`, so in dual mode they didn't apply:
   ```css
   body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) * { cursor: inherit !important; }
   ```
   Result: in dual mode + preview OFF, no CSS restored the system cursor on special zones.

**Fix:**

1. **`custom-cursor.css`** — Scoped all three special cursor `cursor:none` rules with `body:not(.cmsmasters-cursor-dual)`. In dual mode, system cursor stays visible on special zones (consistent with dual mode intent).

2. **`cursor-editor-sync.js`** — Added explicit overrides for `[data-cursor-image/text/icon]` attribute selectors with higher specificity (0,3,1 > 0,2,1). All rules keep `:not(.cmsmasters-cursor-dual)` — see regression note below.

**Regression caught:** Initial fix removed `:not(.cmsmasters-cursor-dual)` from `cursor-disabled` rules, breaking the pointer cursor fix from 2026-03-10 (6 iterations). `cursor:inherit!important` on `*` without dual mode exclusion overrides `cursor:pointer` on links/buttons. Restored `:not(.cmsmasters-cursor-dual)` — in dual mode, the CSS fix (#1) already prevents `cursor:none` on special zones, so no editor-sync override is needed.

**Key insight:** In dual mode, the solution is to NOT APPLY `cursor:none` at all (via CSS scoping), rather than applying it and then overriding back. The `:not(.cmsmasters-cursor-dual)` pattern on both the hiding AND restoring rules means dual mode sees neither — browser defaults apply naturally, preserving pointer/text/etc. cursors.

---

## 2026-03-11 — Fix image cursor hover size: fallbacks, editor live-update, cache docs

**Problem (reported by Yulia):** Two issues with image cursor hover:
1. **Editor:** When editing hover size, cursor appears very small regardless of value set. Normal after re-save and refresh.
2. **Frontend:** Normal=80, Hover=50 configured, but cursor GROWS on hover instead of shrinking.

**Diagnosis:** Inspected live appointment page via Chrome — rendered attributes:
```
data-cursor-image-size="32"        (expected: 80)
data-cursor-image-size-hover="100" (expected: 50)
```
This explains growth: 32->100 on hover. Three separate root causes identified:

### Fix 1: Fallback values mismatch with control defaults

**Root cause:** PHP and JS fallback values (32/48) didn't match Elementor control defaults (80/100). When user never explicitly moves a slider (displays default 80), Elementor doesn't store the value. Raw `get_data()['settings']` returns null -> fallback kicks in -> wrong size.

| Control | Elementor default | Old fallback | Fixed |
|---------|-------------------|-------------|-------|
| `size_normal` | 80px | 32px | 80px |
| `size_hover` | 100px | 48px | 100px |

Note: Icon cursor fallbacks (32/48) already matched their control defaults — no change needed.

### Fix 2: Editor doesn't live-update cursor on slider change

**Root cause:** `cursor-editor-sync.js` updates data-attributes on the DOM element, but `custom-cursor.js` reads attributes once (on mouse enter) and stores them in closure variables. Changing a slider in editor has no effect until mouse leaves and re-enters the zone.

**Solution:** Direct API call pattern (not custom events — avoids event coupling):
1. Added `_zoneEl` property to `SpecialCursorManager` — stores reference to the DOM element with cursor data-attributes
2. Added `refreshFromDOM(el)` method — re-reads all data-attributes from zone element and updates closure vars via `_updateProps()`. Handles image, icon, and text cursor types.
3. Exposed `window.cmsmastersCursor.refreshZone(el)` — public API for editor-sync
4. `cursor-editor-sync.js` calls `refreshZone(element)` after `applySettings()` updates attributes

Flow: slider change -> broadcastCursorChange -> postMessage -> applySettings (sets attrs) -> refreshZone (updates closure vars) -> next RAF frame renders new size.

### Fix 3: Elementor rendering cache in deployment docs

**Root cause of "works after re-save":** Elementor caches rendered element HTML in postmeta. PHP code changes don't take effect until cache is flushed via Elementor -> Tools -> Regenerate Files & Data. This was already discovered in the 2026-03-10 session but not documented in deployment workflow.

**Added to `DOCS/merge-rules.md`:**
- New critical rule #4: "Regenerate after PHP changes"
- Expanded troubleshooting: "Changes not visible" now lists Elementor rendering cache as first check

**Key insight:** The appointment page still showed old fallback values (32/100) from before the 2026-03-10 fix because Regenerate was never run for that page. The `get_data()['settings']` fix was correct but invisible due to cache.

---

## 2026-03-10 — Update cursor control defaults, ranges and size_units

**Change:** Updated Elementor control parameters in `modules/cursor-controls/module.php` per design spec.

**Image cursor:** `cursor_size_normal` / `cursor_size_hover` — range widened from 16-128 to 10-200 px; defaults changed to 80/100 (were 96/80).

**Icon cursor:** `icon_border_radius` and `icon_padding` defaults changed from 8 to 10. `icon_padding` size_units expanded from `[px]` to `[px, em, rem, %, vw]`.

**Text cursor:** `text_border_radius` default changed from 150 to 10. `text_padding` size_units expanded from `[px, em]` to `[px, em, rem, %, vw]`.

No changes needed for icon_size (32/48), circle_spacing (10), or text_border_radius units (px/%) — already matched spec.

---

## 2026-03-10 — Fix image/icon cursor Normal size ignored on frontend (4 iterations)

**Problem:** User sets Special Cursor -> Image -> Size (Normal tab) = 80 in editor. Frontend renders `data-cursor-image-size="32"` (fallback). Hover size works correctly (`100`).

**Root cause — two layers:**

1. **Elementor settings filtering:** Both `get_settings_for_display()` AND `get_settings()` filter out slider values whose conditions aren't met. The Normal size slider has `condition: image_state => 'normal'`. When user's last-saved tab was Hover (`image_state = 'hover'`), both methods strip the Normal value.

2. **Elementor rendering cache:** Elementor caches rendered element HTML in postmeta. After deploying PHP changes, the cached HTML is served without re-executing PHP. This made ALL debug attempts invisible — code was correct on disk but old HTML kept being served.

**Iteration history:**

1. **`$element->get_settings()`** — assumed it returns raw values without condition filtering. Still returned fallback `32`. FAIL — `get_settings()` also filters conditioned controls.

2. **Pass `$raw_settings` from parent scope** — `apply_cursor_attributes()` already calls `get_settings()` at line 1437. Passed it to `apply_image_cursor_attributes()` as parameter. Same result — `32`. FAIL — same filtered data.

3. **`$element->get_data()['settings']`** — reads raw `_elementor_data` JSON from database with zero Elementor processing. Code deployed, rsync confirmed, PHP-FPM restarted — still `32`. Spent hours debugging "cache" (query strings, Cloudflare, opcache, FPM restart). All red herrings.

4. **Elementor -> Tools -> Regenerate Files & Data** — flushed Elementor's rendering cache. `data-cursor-image-size="80"` appeared immediately. The `get_data()` fix from iteration 3 was correct all along.

**Final fix:**
```php
// In apply_image_cursor_attributes() and apply_icon_cursor_attributes():
$saved = $element->get_data()['settings'] ?? array();
$element->add_render_attribute( '_wrapper', 'data-cursor-image-size',
    $saved['cmsmasters_cursor_size_normal']['size'] ?? 32 );
```

**Key insights:**
- `get_settings_for_display()` -> filters conditions + parses dynamic tags
- `get_settings()` -> filters conditions + merges defaults (NOT raw!)
- `get_data()['settings']` -> truly raw DB JSON, no filtering whatsoever
- **Elementor caches rendered HTML** — PHP render changes require "Regenerate Files & Data" to take effect. This is separate from opcache, browser cache, or page cache.

---

## 2026-03-10 — Fix navigator indicators after toggle unification

**Problem:** After toggle semantics unification (commit `4576aea`, 'yes' always means Show), navigator indicators showed wrong types:
- Core cursor -> indicated as Hidden (grey)
- Inherit cursor -> indicated as Special (green)
- Only Special showed correctly

**Root cause — two bugs:**

1. **Core->Hidden:** In Full mode branch, `toggle === 'yes'` returned `{ type: 'hidden' }` at Priority 3. After unification, `'yes'` means Show, not Hide.

2. **Inherit->Special:** Special was checked before Inherit (Priority 1 > 2). But `special_active` retains stale `'yes'` when Inherit is enabled — Elementor hides the Special controls UI but doesn't clear saved values.

**Fix:** Unified Full/Show mode logic (both use same toggle semantics now). Changed priority: Inherit -> Special -> Core. Removed Hidden from legend (no longer applicable after toggle unification).

---

## 2026-03-10 — Fix pointer cursor missing in dual mode (6 iterations)

**Problem:** With dual mode enabled (system cursor + custom cursor visible simultaneously), the system cursor stayed as arrow on links, buttons, and interactive elements. Three areas affected:
1. WordPress admin bar on frontend — links/buttons show arrow instead of pointer
2. Frontend nav links and buttons inside `[data-cursor-show]` zones
3. Elementor editor handles (overlay buttons: edit, duplicate, delete, add-section)

Site runs in **widget-only + dual mode** (`cmsmasters-cursor-widget-only` + `cmsmasters-cursor-dual` on body).

**Root cause:** Multiple CSS rules with `cursor:none!important` or `cursor:default!important` applied globally, with no dual mode exception. In `cursor-editor-sync.js`, injected `cursor:inherit!important` on `*` also overrode Elementor's `cursor:pointer` on editor handles.

**Iteration history:**

1. **`cursor:auto` override approach** — Changed admin bar `cursor:default` -> `cursor:auto`, added editor overlay rules. FAILED: site uses `cmsmasters-cursor-widget-only` not `cmsmasters-cursor-enabled`, so selectors didn't match.

2. **Widget-only dual override** — Added `.cmsmasters-cursor-widget-only.cmsmasters-cursor-dual [data-cursor-show] * { cursor:auto!important }`. FAILED: `cursor:auto!important` on div/span/button resolves to default arrow, NOT pointer. `auto` only gives pointer on `<a>` tags natively.

3. **`:not(.cmsmasters-cursor-dual)` on cursor:none rules** — Instead of hiding then overriding back, simply don't apply `cursor:none` when dual. Partially worked, but `body.cmsmasters-cursor-hidden * { cursor:default!important }` still forced arrow.

4. **cursor-hidden fix** — Added `:not(.cmsmasters-cursor-dual)` to cursor-hidden rule. Frontend nav links showed `cursor:pointer`. Admin bar confirmed working.

5. **Admin bar scoping** — Scoped admin bar `cursor:auto` rule to non-dual only (unnecessary in dual mode). Cleaned up leftover editor overlay rules.

6. **cursor-editor-sync.js fix** — Found that `cursor-editor-sync.js` injects `body.cmsmasters-cursor-disabled * { cursor:inherit!important }` into preview iframe, overriding Elementor's `cursor:pointer` on editor handles. Added `:not(.cmsmasters-cursor-dual)` to all injected CSS rules. Editor handles now show pointer.

**Final approach — `:not(.cmsmasters-cursor-dual)` pattern:**

In `custom-cursor.css`:
```css
/* Don't hide system cursor in dual mode */
.cmsmasters-cursor-enabled:not(.cmsmasters-cursor-dual),
.cmsmasters-cursor-enabled:not(.cmsmasters-cursor-dual) * { cursor:none!important }

.cmsmasters-cursor-widget-only:not(.cmsmasters-cursor-dual) [data-cursor-show],
.cmsmasters-cursor-widget-only:not(.cmsmasters-cursor-dual) [data-cursor-show] * { cursor:none!important }

body.cmsmasters-cursor-hidden:not(.cmsmasters-cursor-dual),
body.cmsmasters-cursor-hidden:not(.cmsmasters-cursor-dual) * { cursor:default!important }
```

In `cursor-editor-sync.js` (injected CSS):
```css
body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) { cursor: auto !important; }
body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) * { cursor: inherit !important; }
```

**Key insights:**
- `cursor:auto!important` does NOT equal "restore original" — on non-`<a>` elements (div, span, button), `auto` resolves to arrow, overriding any `cursor:pointer` from other stylesheets
- The correct approach: don't apply cursor-hiding rules at all in dual mode, using `:not(.cmsmasters-cursor-dual)`, so ALL original CSS cursor values from WordPress/Elementor are preserved untouched
- Three independent sources of cursor override exist: (1) `custom-cursor.css`, (2) `body.cmsmasters-cursor-hidden` rule, (3) `cursor-editor-sync.js` injected styles — ALL three need the dual mode exclusion

---

## 2026-03-10 — Fix page cursor settings ignored on frontend

**Problem:** Page-level cursor settings (color, theme, blend, show/hide) work in Elementor editor but are silently ignored on the frontend.

**Root cause:** All three page-setting read sites used `$document->get_settings_for_display()`, which only returns values for **registered** controls. Page cursor controls register via `elementor/element/after_section_end` — an editor-only hook. On the frontend, these controls aren't in Elementor's control registry, so `get_settings_for_display()` returns null for all of them.

**Fix:** Switched to `$document->get_settings()` which reads raw `_elementor_page_settings` meta regardless of registered controls. Three call sites changed:
1. `get_document_cursor_state()` — page show/hide toggle
2. `get_page_cursor_setting()` — theme, blend, etc.
3. `get_cursor_color()` — page color override. Additionally handles `__globals__` for globe-picked global colors, mirroring the Kit-level pattern already in place.

**Key insight:** `get_settings_for_display()` depends on control registration; `get_settings()` reads raw post meta. For controls registered only in editor context, always use `get_settings()` on frontend.

---

## 2026-03-10 — Session: 8 fixes/changes

### 1. Remove Custom Cursor from template Page Settings
**Problem:** Custom Cursor section appeared in Page Settings for templates (Header, Footer, Archive, Single, etc.) where it doesn't belong.
**Fix:** Added `is_template_document()` check in `register_page_cursor_controls()` to skip registration for all template document types. Only `wp-page` and `wp-post` retain page-level cursor settings.

### 2. Fix system cursor non-interactive in dual mode
**Problem:** When "Show System Cursor" (dual mode) was enabled, the system cursor stayed as arrow on all elements — never changed to pointer on links, text cursor on inputs, etc.
**Root cause:** `custom-cursor.css` line 59: `.cmsmasters-cursor-enabled.cmsmasters-cursor-dual * { cursor:default!important }` — `default` forces arrow, overriding browser defaults.
**Fix:** Changed `cursor:default!important` -> `cursor:auto!important`. `auto` lets the browser decide cursor per element type.

### 3. Fix icon cursor rotate/shape not syncing in editor preview
**Problem:** Yulia reported icon cursor Rotate control had no effect. Investigation confirmed it worked on frontend (PHP rendered attrs) but NOT in editor live preview.
**Root cause:** `cursor-editor-sync.js` was missing `setAttribute` calls for 5 icon cursor attributes: `data-cursor-icon-rotate`, `data-cursor-icon-rotate-hover`, `data-cursor-icon-circle-spacing`, `data-cursor-icon-radius`, `data-cursor-icon-padding`. Image cursor had all these, icon was incomplete.
**Fix:** Added missing setAttribute calls in `applyIconSettings()`, mirroring the text cursor pattern (circle spacing, radius, padding).

### 4. Update element cursor toggle labels
**Change:** Unified toggle labels per Yulia's request:
- Label: "Custom Cursor"
- Options: "Show" / "Hide" (no more mode-dependent branching)
- Help text: "When Hide is chosen, system cursor will be shown on this element."

### 5. Unify toggle semantics: 'yes' always means Show
**Problem:** Yulia reported that switching global mode from "Show on Individual Elements" to "Show Sitewide" caused widgets with configured cursors to HIDE the cursor. The same toggle value `'yes'` meant "show" in one mode and "hide" in another.
**Root cause:** `cmsmasters_cursor_hide` toggle had inverted semantics per mode:
- Show mode: `'yes'` = show cursor (opt-in)
- Full mode: `'yes'` = hide cursor (opt-out)
Switching mode inverted the meaning of saved per-element values.
**Fix:**
- `module.php`: Removed full-mode hide block in `apply_core_cursor_attributes()`. Unified toggle condition to `'yes'` = Show.
- `cursor-editor-sync.js`: Removed full-mode `data-cursor="hide"` on toggle='yes'. Per-element hide remains via `data-cursor="hide"` HTML attribute.

### 6. Fix page-level cursor color ignored on frontend
**Problem:** Yulia set orange Cursor Color in Page Settings, but frontend showed global green color.
**Root cause:** `get_cursor_context_document()` in `frontend.php` returned `template_document` (header/footer) instead of the actual page document. Since templates no longer have cursor controls (fix #1), template document returned empty color -> fallback to global.
**Fix:** Removed `template_document` priority from `get_cursor_context_document()` — now always reads page document for cursor settings. Affects all page-level settings (color, theme, smoothness, blend, effect, adaptive).

### 7. Fix editor sync: full mode always apply per-element settings
**Problem:** Previous toggle unification (fix #5) made `cursor-editor-sync.js` return early for full mode + toggle='', breaking editor preview for elements configured in old toggle semantic.
**Fix:** Full mode now always falls through to apply special/core settings in editor sync, matching PHP render behavior.

### 8. Remove separator border before Reset button
**Change:** Removed `'separator' => 'before'` from `cmsmasters_page_cursor_reset` control in page cursor settings per Yulia's request.

### Key insight: template_document leak pattern
The `template_document` property in `frontend.php` persists through wp_footer after header/footer rendering. Multiple bugs stem from this: editor cursor missing (2026-03-02), page color ignored (this session). The fix pattern is consistent: for cursor settings, always prefer page document over template document.

---

## 2026-03-10 — Hide page cursor controls on all template types

**Problem:** Page-level cursor controls (Page Settings tab) still appeared on Section, Entry, Product, Product Archive, Product Entry, Event Singular, Event Entry, and Events Archive template documents. Only wp-page and wp-post should show them.

**Fix:** Extended `is_template_document()` in `module.php` with 9 new document types:
- Elementor core: `section`, `container`
- CMSMasters: `cmsmasters_entry`
- WooCommerce: `cmsmasters_product_singular`, `cmsmasters_product_entry`, `cmsmasters_product_archive`
- Tribe Events: `cmsmasters_tribe_events_singular`, `cmsmasters_tribe_events_entry`, `cmsmasters_tribe_events_archive`

Document names found via `get_name()` methods in the addon's document classes under `modules/*/documents/`.

---

## 2026-03-02 — Fix editor cursor missing (template_document leak)

**Problem:** Cursor DOM elements (`#cmsmasters-cursor-container`, `.cmsmasters-cursor-dot`, `.cmsmasters-cursor-ring`) were not output in the Elementor editor preview iframe. Scripts, CSS, and body classes all loaded correctly — only the HTML from `print_custom_cursor_html()` was missing.

**Diagnosis iterations:**
1. Added diagnostic `error_log` to `should_enable_custom_cursor()` and `enqueue_preview_scripts()` — confirmed Gate 1 (editor_preview) passes, scripts load
2. Chrome browser inspection: toggle panel visible, body classes correct, scripts loaded — but cursor container missing from DOM
3. JavaScript DOM inspection in preview iframe confirmed: `document.getElementById('cmsmasters-cursor-container')` -> null

**Root cause:** `get_cursor_context_document()` checked `$this->template_document` before the preview document. During page rendering, Elementor calls `set_template_document()` for header/footer templates. This `template_document` is never cleared, so it leaks into `wp_footer` time. Result: `print_custom_cursor_html()` (wp_footer, priority 5) got a different document than `enqueue_custom_cursor()` (wp_enqueue_scripts), causing `should_enable_custom_cursor()` to return false at HTML output time.

**Why enqueue worked but HTML didn't:** `wp_enqueue_scripts` fires before Elementor renders templates -> `template_document` is null -> falls through to preview document -> cursor enabled. `wp_footer` fires after rendering -> `template_document` is set to last header/footer -> returns template document -> wrong cursor state -> cursor disabled.

**Fix:** Swapped priority in `get_cursor_context_document()` — preview document (from `$_GET['elementor-preview']`) now checked first. On frontend (non-editor), `get_preview_document()` returns null so fallback to `template_document` still works.

**Also:** Removed temporary `CURSOR-DIAG` error_log lines from frontend.php and editor.php.

---

## 2026-03-02 — REVERTED: Kit reads bypass registered control defaults

**Attempted fix:** Replaced `AddonUtils::get_kit_option()` with `$kit->get_settings_for_display()` to respect registered Elementor control defaults. Added `get_kit_cursor_setting()` helper to Frontend and Editor classes. Replaced 10 call sites.

**Why it broke the cursor:** `get_kit_option()` has a 3-level fallback chain:
```
1. Raw post_meta (_elementor_page_settings)
2. default_kits wp_option (CMSMASTERS_OPTIONS_PREFIX . 'default_kits')  <- MISSED THIS
3. PHP $default argument
```

The Kuzmich theme stores cursor defaults in the `default_kits` wp_option via the CMSMasters framework. This provides theme-level defaults (e.g., `visibility = 'show'`, `editor_preview = 'yes'`) that override control-level defaults (`'elements'`, `''`). The new `get_settings_for_display()` code only knew about registered control defaults (level 1 + Elementor defaults), completely bypassing the theme's `default_kits` layer.

**Result:** `visibility` dropped from `'show'` -> `'elements'` (cursor went from "everywhere" to "widgets only"). `editor_preview` dropped from `'yes'` -> `''` (cursor-editor-sync.js no longer loaded in preview iframe).

**Lesson:** `AddonUtils::get_kit_option()` is NOT broken — its 3-level fallback chain (raw meta -> `default_kits` -> PHP default) is intentional CMSMasters framework architecture. The `default_kits` layer provides demo-quality settings without requiring explicit Kit saves. Never replace it with Elementor's `get_settings_for_display()` alone.

**Action:** Reverted all changes. Restored `AddonUtils::get_kit_option()` / `Utils::get_kit_option()` in all 10 call sites.

---

## 2026-02-24 — WP-020 Phase 2: Read Migration — wp_options -> Kit

**Problem:** All global cursor settings were read via `get_option('elementor_custom_cursor_*')`. Phase 1 registered 11 Kit controls in the Kuzmich theme with prefix `cmsmasters_custom_cursor_`. Need to migrate all reads to Kit.

**Key discovery:** CSS var names MISMATCH — Kit selectors output `--cmsmasters-custom-cursor-cursor-color` but `custom-cursor.css` expects `--cmsmasters-cursor-color`. Decision: keep PHP inline CSS bridge that reads Kit values and outputs old var names. No CSS/JS file changes needed.

**Changes across 3 files:**

- **frontend.php** (8 call sites):
  - Added `use CmsmastersElementor\Utils as AddonUtils` (avoids conflict with `Elementor\Utils`)
  - `get_page_cursor_setting()` — Kit read with key mapping (`adaptive->adaptive_color`, `theme->cursor_style`) and value mapping (`dot_ring->classic`, `disabled->''`)
  - `get_cursor_mode()` — `visibility` Kit control with `show->yes`, `elements->widgets`, `hide->''` mapping. Removed BC `widget_override` fallback
  - `should_enable_custom_cursor()` — `editor_preview` Kit read
  - `get_cursor_color()` — Simplified: `$kit->get_settings_for_display()` resolves `__globals__` automatically. Removed `color_source` + `system_colors` iteration
  - `enqueue_custom_cursor()` — dot sizes (`cursor_size`, `size_on_hover`), blend mode Kit reads. Added `disabled->''` mapping for blend
  - `add_cursor_body_class()` — `show_system_cursor` and `wobble_effect` Kit reads

- **editor.php** (2 call sites):
  - `get_cursor_mode()` — same Kit read as frontend
  - `enqueue_preview_scripts()` — `editor_preview` Kit read

- **module.php** (1 call site + 2 notice updates):
  - Added `use CmsmastersElementor\Utils`
  - `get_cursor_mode()` — same Kit read (static version)
  - Disabled notices: replaced `<a href>` to admin settings with plain text "Site Settings -> Custom Cursor"

**Verification:** Zero `get_option('elementor_custom_cursor_*')` remaining in `includes/` and `modules/cursor-controls/`. Only `settings-page.php` retains them (Phase 3 scope).

---

## 2026-02-19 — Fix: CursorState/DOM desync — widget blend ignored on initial load

**Problem:** In Widgets Only mode, widget-level blend override (`data-cursor-blend="off"`) is ignored on initial page load. The cursor shows the global blend (e.g. "soft") instead of disabled. Affects both frontend and editor. Changing any setting in the editor fixes it.

**Root cause:** `CursorState._state.blend` initializes as `null` (line 413), but PHP already renders body with `cmsmasters-cursor-blend-soft` class. The JS variable `currentBlendIntensity` is correctly synced to 'soft' (from body class), but the state machine is not. When `detectCursorMode` finds `data-cursor-blend="off"` and calls `setBlendIntensity('')` -> `CursorState.transition({blend: null})` — this is a NO-OP because `_state.blend` is already `null`. The body retains the PHP-rendered blend classes.

Why editor settings change fixes it: changing blend to 'soft' first sets `_state.blend = 'soft'`, then changing to 'off' sets `_state.blend = null` — the transition detects the change and removes classes.

**Fix:** After computing `globalBlendIntensity` from body classes, sync `CursorState._state.blend = globalBlendIntensity`. Now `_state.blend` starts as 'soft', so transitioning to `null` correctly removes the classes.

**Iteration history:**
1. skipClear in editor sync init — wrong target (JS timing, not attribute presence)
2. detectCursorMode before show cursor — correct optimization but didn't fix root cause
3. CursorState sync — **this was the fix** (state/DOM desync)

**Key insight:** When state machines shadow external DOM, ALWAYS sync initial state from existing DOM classes, not just from code defaults. Compare: `hidden` was properly synced (line 604 init:widget-only), but `blend` was missed.

---

## 2026-02-19 — Fix: Widget settings (blend/color/effect) not applied on show zone entry

**Problem:** In Widgets Only mode, when the cursor enters a show zone, it appears with the GLOBAL blend/color/effect instead of the widget's override. The widget settings only apply after the user moves the mouse further (triggering `detectCursorMode` via throttled `mousemove`). This affects both frontend and editor preview.

**Root cause:** `mouseover:show-zone` handler called `CursorState.transition({ hidden: false })` to show the cursor, but did NOT call `detectCursorMode()` first. The cursor appeared with stale `currentBlendIntensity` (global). `detectCursorMode` only ran on the next `mousemove` (throttled 100ms + 5px movement).

**Fix:** Call `detectCursorMode(e.clientX, e.clientY)` BEFORE `{ hidden: false }` transition in the show zone mouseover handler. This detects blend/color/effect/hover style before the cursor becomes visible, so it appears with the correct state from the first frame.

---

## 2026-02-19 — Fix: Widget blend mode not applied on editor initial load

**Problem:** In Widgets Only mode, when opening a page in the Elementor editor, a widget with blend mode set to "Disabled" showed the global blend (e.g. Soft) instead. Changing any widget setting fixed it. The saved setting didn't load on first open.

**Root cause:** `cursor-editor-sync.js` handles `cmsmasters:cursor:init` by calling `clearAttributes()` (removes all PHP-rendered data attributes) then re-applying from the editor model via `applyCoreSettings()`. But on initial load, Elementor's `settingsModel.toJSON()` may not include all settings yet (model not fully populated). So `cmsmasters_cursor_blend_mode` could be `undefined` -> the truthiness check fails -> `data-cursor-blend="off"` is not re-added -> JS falls back to global blend.

**Fix:** Added `skipClear` parameter to `applySettings()`. During `cmsmasters:cursor:init`, skip `clearAttributes()` — overlay editor settings on top of PHP-rendered attributes.

---

## 2026-02-19 — Fix: Native cursor disappears in editor preview (Widgets Only, preview OFF)

**Problem:** In Widgets Only mode, when Custom Cursor Preview is OFF in the Elementor editor, hovering over a show zone widget makes the native (system) cursor disappear. No cursor at all is visible.

**Root cause:** CSS specificity conflict. `custom-cursor.css` has `.cmsmasters-cursor-widget-only [data-cursor-show] *` at specificity (0,2,0) with `cursor:none!important`. The editor sync's override `body.cmsmasters-cursor-disabled *` only has (0,1,1) — lower specificity.

**Fix:** Added explicit override in `cursor-editor-sync.js` injected styles with higher specificity (0,3,1).

---

## 2026-02-19 — Fix: Dot/hover sizes ignored in Widgets Only mode

**Problem:** In "Widgets Only" mode, global dot diameter and hover diameter from Addon Settings were not applied. Cursor used hardcoded CSS defaults (8px dot, 40px hover) instead of user-configured values.

**Root cause:** `frontend.php` generated inline CSS with selector `body.cmsmasters-cursor-enabled[class]`, but in Widgets Only mode the body class is `cmsmasters-cursor-widget-only` — selector didn't match.

**Fix:** Added `body.cmsmasters-cursor-widget-only[class]` to the CSS selector so size custom properties apply in both modes.

---

## 2026-02-19 — UX: Show disabled notice in Page Settings when cursor is globally disabled

**Problem:** Widget-level cursor controls already show an info notice when the global cursor mode is disabled. Page Settings controls lacked this check.

**Solution:** Added the same disabled-mode pattern to `register_page_cursor_controls()` in `module.php`:
- After the duplicate-registration guard, check `self::get_cursor_mode()`
- If disabled: open section, show RAW_HTML info notice, close section, early return

---

## 2026-02-18 — Fix: Blend Mode Cursor Invisible on Some Themes (3 iterations)

**Problem:** On Pixel Craft theme (and similar themes with stacked Elementor containers), enabling any global blend mode made the custom cursor completely invisible.

**Iteration 1 — Z-index too low:**
`--cmsmasters-cursor-z-blend` was `9999`. Many Elementor theme elements have z-index above 9999. Raised to `999999`.

**Iteration 2 — Black cursor + exclusion = invisible:**
The default cursor color is `#222` (near-black). The `mix-blend-mode: exclusion` formula with `blend = 0` (black) collapses to `result = base` — mathematically invisible. Added `--cmsmasters-cursor-color: #fff` to all three blend-mode body rules.

**Iteration 3 — `isolation: isolate` trapped the blend:**
The blend-mode body rules included `isolation: isolate`. This creates a stacking context, confining `mix-blend-mode` to compositing within that context. In gap zones between Elementor containers, cursor blended against blank stacking context boundary. Removed `isolation: isolate`.

**Key insight:** Two independent gotchas compound: (1) black is the identity element for inversion blend modes; (2) `isolation: isolate` on a parent blocks `mix-blend-mode` from reaching the page backdrop.

---

## 2026-02-18 — Research: Demo Content Settings Transfer

**Problem:** When a customer installs a CMSMasters demo, the custom cursor doesn't appear. 12 global `wp_options` values do NOT transfer via standard WXR import.

**Deliverable:** `DOCS/DEMO-SETTINGS-TRANSFER.md` — option reference for the theme team with all 12 option keys.

**Key insight:** This is a coordination task, not a code task. The addon already handles externally-written option values safely.

---

## 2026-02-18 — Fix: Navigator indicator type 'show' replaced with 'core' + mode-conditional legend

**Problem:** In Widgets Only mode, elements with cursor enabled but no special cursor received a green "show" dot not present in the legend.

**Fix:**
- S1: Changed `{ type: 'show' }` to `{ type: 'core' }` in show mode fallback
- S2: Mode-conditional legend — Widgets Only shows 3 items (no Hidden), Enabled Globally shows 4 items

---

## 2026-02-17 — Merge Widget Override into 3-option Enable/Disable control

**Problem:** Two separate settings (Enable Custom Cursor + Widget Override) combined into 3 effective states but required confusing interaction logic.

**Solution:** Replaced with single 3-option select: Disabled / Widgets Only / Enabled. One-time migration in `settings-page.php` constructor.

---

## 2026-02-17 — Fix: Ring proportional sizing + rename Radius->Diameter

**Problem:** In "Dot + Ring" theme, ring was hardcoded at 40px. When admin set dot size to 40+, dot covered the ring.

**Solution:** Introduced `--cmsmasters-cursor-ring-offset: 32px` so ring = dot + offset.

---

## 2026-02-14 — Feat: Conditional settings controls (grey out invalid combos)

**Problem:** Settings page has 3 linked controls with no visual dependency.

**Solution:** CSS class + `pointer-events: none` to grey out controls in invalid states.

---

## 2026-02-14 — Fix: Widget-only mode — contextual Hide/Show toggle (v2)

**Problem:** Commit f5c3915 replaced control key, breaking normal full-mode.

**Solution:** Same control key (`cmsmasters_cursor_hide`) for both modes, but contextual label, conditions, and output based on 3 states.

---

## 2026-02-13 — Production repo build: EBUSY phantom lock on build\archive

**Problem:** `npm run build` in production repo fails at Grunt `clean:main` step with EBUSY on Windows.

**Solution:** `npx grunt build --force`

---

## 2026-02-13 — Fix: 504 Gateway Timeout on Merlin Wizard Content Import

**Problem:** First-time Merlin wizard run hits 504 on `step=content`. CSS regen triggers control stack building for ALL element types.

**Solution:** Added `should_register_controls()` with `$_REQUEST['action'] === 'elementor'` check.

---

## 2026-02-13 — Fix: Special Cursor Color Reset + Settings Page Restructure

**Problem 1:** `forcedColor` leaks across zones when special cursor branches return early.
**Solution:** Extracted `updateForcedColor(targetEl)` helper.

**Problem 2:** Settings page — all settings in one flat section.
**Solution:** Split into `custom_cursor_settings` + `custom_cursor_color`.

---

## 2026-02-13 — Fix: Page Blend Mode Leaks Into Widget Cursors

**Problem:** Page Settings blend mode applied to ALL cursors on the page, including widgets with their own settings.

**Solution:** Separate "true global" from "page > global":
- PHP outputs `window.cmsmCursorTrueGlobalBlend`
- Widget fallback uses `trueGlobalBlend` (Kit-only), body uses `globalBlendIntensity` (page > Kit)

---

## 2026-02-13 — Fix: Reset Button — Use Color Control's Built-in Clear

**Problem:** "Reset to System Default" button couldn't clear `__globals__`.

**Solution (iteration 5):** Use color control view API (`setValue('')` + `triggerMethod('value:type:change')` + `applySavedValue()`).

---

## 2026-02-12 — Page Cursor: Global Colors, Color Reset, Reset Button

Three issues with page-level cursor settings fixed: global Kit colors, color clear, reset all 7 settings.

---

## 2026-02-12 — Page-Level Cursor Settings (Page Settings -> Advanced tab)

Added 7 cursor controls to Page Settings. Override chain: Element > Page > Global.

---

## 2026-02-12 — Fix Page-Level Cursor Settings (3 Issues)

Editor disable, real-time sync, and global Kit colors fixed across frontend.php, navigator-indicator.js, cursor-editor-sync.js.

---

## 2026-02-12 — PR #144 Code Review (11 items, 6 phases)

CMSArchitect review: DEFAULT_CURSOR_COLOR constant, Pickr local copy, inline CSS/JS extraction, CSS comments, global rename cmsm->cmsmasters (~385 replacements).

---

## 2026-02-11 — Default Placeholder Image for Image Cursor Type

One-line change: set Media control default to `\Elementor\Utils::get_placeholder_image_src()`.

---

## 2026-02-11 — Ring Trail Fix (5 iterations) + Page Navigation Fix

**Ring trail:** `opacity: 0` is NOT invisible under GPU compositing + `mix-blend-mode`. Fix: `visibility: hidden` + `isRingHidden` boolean flag + skip transform in render loop.

**Page navigation:** Added `hideCursorOnNav()` on `beforeunload` + `pagehide`.

---

## 2026-02-11 — Icon Cursor SVG Color Fix (Uploaded Icons)

**Problem:** Editor uses `<img>` (mask works), frontend uses inline `<svg>` (explicit fill overrides).
**Fix:** Strip explicit `fill`/`stroke` attributes from inline SVG children, preserving special values.

---

## 2026-02-11 — Form Zone Auto-Hide Fix (Solo + Dual Mode)

5 iterations. Final: popup detection BEFORE button check, CSS fallback for solo mode, instant opacity restore.

---

## 2026-02-11 — Native `<select>` Dropdown Cursor Leak

Check `document.activeElement.tagName === 'SELECT'` before restoring cursor.

---

## 2026-02-11 — Custom Select Widget Detection

Added widget-specific class selectors + `role="option"` ARIA detection for 9 custom select libraries.

---

## 2026-02-11 — Entry + Popup Template Panel Hiding

4-layer solution: PHP guard, JS early guard, PostMessage from init, document:loaded event listener.

---

## 2026-02-10 — Responsive Mode Detection in Editor

5 iterations. Final: editor body CLASS `elementor-device-*` via MutationObserver + Backbone Radio + postMessage to preview.

---

## 2026-02-10 — Theme Builder Template Cursor Preview

`should_enable_custom_cursor()` detects document type via `strpos()` for `cmsmasters_` prefix.

---

## 2026-02-09 — frontend.php Clean Rewrite

Clean rewrite — only cursor-related methods. Lesson: NEVER modify original addon script dependencies.

---

## 2026-02-08 — CSS Strip Tags Bug

`wp_strip_all_tags()` strips CSS `>` child selectors. Removed from CSS output.

---

*Last updated: 2026-03-15 | Migrated to Docsv2*
