# Traps — Things That Will Bite You

> grep-friendly: TRAP-001, TRAP-002, ...
> Each trap: what triggers it, what breaks, how to fix it.

---

## TRAP-001: CursorState Blend Sync

**Trigger:** Adding a new CursorState property that PHP pre-renders as a body class.
**Breaks:** `CursorState.transition({prop: null})` is a no-op because `_state.prop` is already `null` (code default). The PHP-rendered body class persists — stale visual state.
**Fix:** Sync `_state.prop` from existing body classes on init, BEFORE any transitions fire.
**Example:** `blend` was missed — `_state.blend = null` but body had `cmsmasters-cursor-blend-soft`. Transitioning to `null` did nothing. Fixed by syncing `_state.blend = globalBlendIntensity` after reading body classes.
**Rule:** ANY future CursorState property that PHP pre-renders MUST be synced from body classes on init.
**WP-026 note:** Kit blend removed — sync only needed when page sets blend. Pattern still applies to any future CursorState property.
**See:** SOURCE-OF-TRUTH.md Matrix D, DECISIONS.md DEC-001

---

## TRAP-002: Toggle Semantic Flip — RESOLVED

**Status:** Resolved (WP-023 elements, WP-025 pages).
**Was:** `cmsmasters_cursor_hide` and `cmsmasters_page_cursor_disable` boolean toggles had mode-dependent meaning. Same value `'yes'` meant opposite things in sitewide vs widget-only.
**Now:** Replaced with explicit CHOOSE_TEXT controls (`element_mode`, `page_cursor_mode`) with canonical values (`default`/`customize`/`hide`/`disable`). No mode-dependent inversion. Legacy read bridges in 3 files map old `'yes'` to canonical values per mode — last place the semantic flip lives.
**See:** SOURCE-OF-TRUTH.md Scenario 3/3b, DEC-011, DEC-012

---

## TRAP-003: "Default" Blend != "Default" Effect

**Trigger:** Assuming "default" resolves the same way for blend and effect.
**Breaks:** Widget "Default" blend -> no blend (Kit blend removed, WP-026). Widget "Default" effect -> `window.cmsmCursorEffect` (page > Kit resolution). These resolve differently **by design**.
**WP-026 update:** Blend "Default" is now "Off" — resolves to `''` (no blend, no global to inherit). Effect "Default" still falls through to page/Kit effect. The asymmetry remains by design but is simpler: blend has no fallback, effect does.
**Fix:** Don't "fix" the inconsistency. It's intentional.
**See:** SOURCE-OF-TRUTH.md Scenario 6, DECISIONS.md DEC-003 note

---

## TRAP-004: Page Blend Does NOT Cascade to Dirty Widgets

**Trigger:** Expecting a page-level blend override to apply inside widgets that have ANY cursor settings.
**Breaks:** Dirty widgets (those with `data-id` + any cursor setting) form a "floor". Unset blend within them falls to `trueGlobalBlend` (now always `''`, WP-026), NOT the page blend override (`globalBlendIntensity`).
**Code:** `var fallbackBlend = stoppedAtWidget ? trueGlobalBlend : globalBlendIntensity;`
**WP-026 update:** `trueGlobalBlend` is always `''` — dirty widget fallback = no blend. Page blend still reaches clean elements via `globalBlendIntensity`. Boundary logic unchanged.
**Fix:** By design. Widget boundary prevents page overrides from bleeding into configured widgets.
**See:** SOURCE-OF-TRUTH.md Scenario 6, `resolveBlendForElement()` in custom-cursor.js

---

## TRAP-005: formZoneActive Multi-Writer

**Trigger:** Adding a new writer to the `formZoneActive` flag without understanding the timing model.
**Breaks:** Stuck hidden or visible cursor states. The flag has 6 writers across 3 code paths (detection, mouseover, mouseout), all documented in JSDoc at the declaration.
**Timing:** mouseout=immediate, mouseover=immediate, detectCursorMode=throttled. All same-direction writes (only set true when entering form, only set false when leaving).
**Fix:** Read the JSDoc at `formZoneActive` declaration before adding writers. All false-writes are idempotent. New writers must maintain same-direction safety.
**See:** DECISIONS.md DEC-005, Phase 2B log

---

## TRAP-006: Wobble Uses Window Var, Not Body Class

**Trigger:** Looking for `cmsmasters-cursor-wobble` body class to determine wobble state in JS.
**Breaks:** The body class still exists (PHP adds it for potential CSS use), but WP-021 Phase 3 moved JS wobble detection to `window.cmsmCursorWobble`. The `isWobbleEnabled()` function checks the window var first, with body class as fallback.
**Fix:** Use `isWobbleEnabled()` — don't check body class directly from JS.
**See:** DECISIONS.md DEC-002

---

## TRAP-007: Color Resolution Has Separate Path

**Trigger:** Assuming `get_cursor_color()` uses `get_page_cursor_setting()` like all other settings.
**Breaks:** Color has its own resolution in `get_cursor_color()` (frontend.php) that manually handles `__globals__` references for both page and Kit levels. Elementor's `get_settings_for_display()` doesn't reliably resolve `__globals__` for non-core controls.
**Fix:** Read `get_cursor_color()` directly. Don't try to unify it with the generic setting helper.
**See:** SOURCE-OF-TRUTH.md Scenario 10

---

## TRAP-008: Widget-Only Page Promotion (Updated WP-025)

**Trigger:** Setting `cmsmasters_page_cursor_mode = 'customize'` in widget-only mode.
**Effect:** Promotion is now explicit: `customize` in widget-only = full cursor on this page. `get_document_cursor_state()` returns `enabled: true`, `add_cursor_body_class()` adds `cmsmasters-cursor-enabled`, `is_page_promoted()` returns true.
**Editor preview:** `applyPageCursorSettings()` handles visibility class swap. Custom event `cmsmasters:cursor:page-visibility-update` updates `isWidgetOnly` flag in custom-cursor.js runtime.
**Element transparency:** Elements with `element_mode = 'default'` (Auto) are transparent on promoted pages — no attrs stamped, cursor works through. Elements with `element_mode = 'hide'` still block cursor locally.
**See:** SOURCE-OF-TRUTH.md Scenario 3/3b, DEC-011

---

## TRAP-009: opacity:0 Is NOT Invisible Under Blend Modes

**Trigger:** Using `opacity: 0` to hide cursor elements when `mix-blend-mode` is active.
**Breaks:** GPU compositing + `mix-blend-mode: exclusion/difference` can produce visual artifacts even at `opacity: 0`. The ring trail bug took 5 iterations to fix because `opacity: 0` elements were still being composited by the GPU.
**Fix:** Use `visibility: hidden` to completely remove from paint. Also skip transform updates in render loop via boolean flag (`isRingHidden`).
**See:** DEVLOG.md "Ring Trail Fix" entry

---

## TRAP-010: Elementor Rendering Cache

**Trigger:** Changing PHP render code (e.g., data attribute output in `module.php`) and expecting immediate effect.
**Breaks:** Elementor caches rendered element HTML in postmeta. PHP code changes are invisible until cache is flushed. Both `get_settings_for_display()` and `get_settings()` return cached values.
**Fix:** After PHP render changes: Elementor -> Tools -> Regenerate Files & Data. This is separate from opcache, browser cache, and page cache.
**See:** DEVLOG.md "Fix image/icon cursor Normal size" entry

---

## TRAP-011: get_settings_for_display() vs get_settings() vs get_data()

**Trigger:** Choosing the wrong Elementor settings read method.
**Breaks:**
- `get_settings_for_display()` -> filters conditions + resolves dynamic tags + resolves `__globals__`. **Requires control registration.** Returns null for controls registered only in editor context when called on frontend.
- `get_settings()` -> filters conditions + merges defaults. **Does NOT require registration.** But still filters conditioned controls (e.g., Normal/Hover tabs).
- `get_data()['settings']` -> truly raw DB JSON. No filtering, no conditions, no defaults.

**Fix:** Frontend reads of editor-only controls -> use `get_settings()`. Raw size values behind condition tabs -> use `get_data()['settings']`.
**See:** DEVLOG.md "Fix page cursor settings ignored on frontend"

---

## TRAP-012: Kit Size CSS Vars — :root Required, Body-Level Overrides Kill Kit

**Trigger:** Moving cursor size CSS vars to a selector with specificity > (0,1,0), e.g. `body.cmsmasters-cursor-enabled[class]`, OR hardcoding size vars in a `body.` theme rule.
**Breaks:** Kit size controls become dead. Two known instances:
1. **Selector specificity (WP-022):** `body[class]` at (0,2,0) beats `:root` inline from JS — editor live preview of Kit sizes stops working.
2. **Hardcoded theme defaults (dot theme hotfix):** `body.cmsmasters-cursor-theme-dot { --dot-size:10px; --dot-hover-size:20px }` overrode `:root` Kit values by specificity — Kit sliders had zero effect on dot theme.
**Fix:** Keep size vars on `:root` only. Theme-specific rules must NOT re-declare size custom properties — they should read them via `var()`, never write them.
**Also:** Don't use `!empty()` to guard numeric CSS values — `!empty(0)` is `true`, filtering out valid `0px`. Use `'' !== (string) $val` instead.
**See:** DEC-010

---

*Last updated: 2026-03-16 | WP-026 Kit blend removal*
