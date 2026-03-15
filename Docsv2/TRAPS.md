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
**See:** SOURCE-OF-TRUTH.md Matrix D, DECISIONS.md DEC-001

---

## TRAP-002: Toggle Semantic Flip

**Trigger:** Reading `cmsmasters_cursor_hide` value without checking which mode is active.
**Breaks:** The same value `'yes'` means "render cursor attributes" in both modes, but:
- **Full mode**, toggle off + had config -> `data-cursor="hide"` (hides cursor)
- **Widget-only**, toggle off -> element simply skipped (no attrs)

The *UI label* also flips between "Show" and "Hide". Code that assumes a fixed meaning will produce wrong output.
**Fix:** Always call `is_show_render_mode()` first to determine which branch applies.
**See:** SOURCE-OF-TRUTH.md Scenario 3

---

## TRAP-003: "Default" Blend != "Default" Effect

**Trigger:** Assuming "default" resolves the same way for blend and effect.
**Breaks:** Widget "Default" blend -> `trueGlobalBlend` (Kit only, ignores page override). Widget "Default" effect -> `window.cmsmCursorEffect` (page > Kit resolution). These resolve differently **by design**.
**Why:** Widgets with "Default" blend should be consistent across pages (Kit = brand). Effects are more contextual (page can override).
**Fix:** Don't "fix" the inconsistency. It's intentional.
**See:** SOURCE-OF-TRUTH.md Scenario 6, DECISIONS.md DEC-003 note

---

## TRAP-004: Page Blend Does NOT Cascade to Dirty Widgets

**Trigger:** Expecting a page-level blend override to apply inside widgets that have ANY cursor settings.
**Breaks:** Dirty widgets (those with `data-id` + any cursor setting) form a "floor". Unset blend within them falls to Kit-only `trueGlobalBlend`, NOT the page blend override (`globalBlendIntensity`).
**Code:** `var fallbackBlend = stoppedAtWidget ? trueGlobalBlend : globalBlendIntensity;`
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

## TRAP-008: Widget-Only Page Promotion

**Trigger:** Setting `cmsmasters_page_cursor_disable = yes` in widget-only mode.
**Breaks:** In widget-only mode, this promotes the page to full cursor mode silently. `get_document_cursor_state()` returns `enabled: true`, and `add_cursor_body_class()` uses `cmsmasters-cursor-enabled` instead of `cmsmasters-cursor-widget-only`.
**Fix:** Known behavior. Document for users that page-level "enable" in widget-only mode = full cursor on that page.
**See:** SOURCE-OF-TRUTH.md Appendix pitfall #6

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

*Last updated: 2026-03-15 | WP-021 Phase 5*
