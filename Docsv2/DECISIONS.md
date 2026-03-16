# Decisions

> ADR-style. grep-friendly: DEC-001, DEC-002, ...
> Each decision: when, context, choice, why, rejected alternatives.

---

## DEC-001: Blend Dual Ownership (PHP + JS)

**Date:** 2026-03-15 (documented in WP-021 Phase 3)
**Context:** Blend needs body classes for CSS transitions. JS CursorState manages runtime transitions. But PHP also pre-renders blend body classes on page load.
**Choice:** Keep dual ownership. PHP pre-renders blend classes, JS syncs to CursorState on init + manages runtime transitions. Add JSDoc documenting FOUC prevention rationale.
**Why:** Removing PHP pre-rendering causes 100-200ms of unstyled cursor (Flash of Unstyled Cursor) between page load and JS init. PHP gets the blend right from the first paint frame.
**WP-026 note:** Kit blend removed — dual ownership now applies only when page sets blend. Pattern unchanged.
**Rejected:** JS-only (flash), PHP-only (can't transition at runtime).
**See:** TRAP-001 for the sync requirement this creates.

---

## DEC-002: Wobble Body Class -> Window Var

**Date:** 2026-03-15 (WP-021 Phase 3)
**Context:** PHP added `cmsmasters-cursor-wobble` body class. CSS never consumed it (wobble is purely JS-driven via RAF calculations). The body class existed but served no CSS purpose.
**Choice:** Replace with `window.cmsmCursorWobble` for JS consumption. Keep body class from PHP (harmless, potential future CSS use) but JS reads window var first.
**Why:** Body classes should only exist when CSS needs them. Wobble is a JS-only effect. Window var is the correct delivery mechanism.
**Rejected:** Keep body class as sole mechanism (unnecessary DOM interaction for a JS-only feature).

---

## DEC-003: Adaptive Detection Stays Inline

**Date:** 2026-03-14 (WP-021 Phase 1)
**Context:** Adaptive color detection is 66 lines inside `detectCursorMode()` with 5+ hysteresis state variables (`pendingMode`, `pendingModeCount`, `lastModeChangeTime`, etc.).
**Choice:** Keep inline in `detectCursorMode()` with a section comment. Not extracted as a resolver.
**Why:** Extracting would require passing 5+ state params or creating a state object, adding more ceremony than the extraction saves. The code is self-contained within a clearly commented block.
**Rejected:** Extract with state object parameter (more complexity than benefit, untested restructuring).

---

## DEC-004: resolveSpecialCandidate Is Impure

**Date:** 2026-03-14 (WP-021 Phase 1B)
**Context:** `resolveSpecialCandidate()` determines which special cursor wins (image/text/icon via depth comparison). In the "core wins" branch, it calls `SpecialCursorManager.deactivate()` as a side effect.
**Choice:** Keep as impure resolver. Document the side effect in JSDoc.
**Why:** Splitting the determination from the deactivation call is untested risk. The deactivate must happen at exactly the right point in the resolution flow. Moving it to the orchestrator would require understanding exactly when core-wins applies mid-resolution.
**Rejected:** Pure extraction with deactivate call in orchestrator (uncertain timing, untested).

---

## DEC-005: formZoneActive Multi-Writer (Not Single-Writer)

**Date:** 2026-03-14 (WP-021 Phase 2B)
**Context:** `formZoneActive` flag is written by 6 locations across detection path (throttled), mouseover (immediate), and mouseout (immediate). Investigation showed all writes are same-direction (true when entering form zone, false when leaving).
**Choice:** Document multi-writer as intentional. Add JSDoc to declaration listing all 6 writers with timing.
**Why:** All false-writes are idempotent (setting false when already false = no-op). Single-writer convergence would require restructuring the mouseout handler — complexity exceeds benefit.
**Rejected:** Single-writer convergence (high restructuring cost, no observable bugs from current multi-writer pattern).

---

## DEC-006: Partial mouseover Unification

**Date:** 2026-03-14 (WP-021 Phase 2A)
**Context:** mouseover handler had duplicated form/video checks identical to `resolveVisibility()`. Show-zone-enter and hide-zone-enter also had visibility logic but with different semantics.
**Choice:** Partial replacement. Form/video checks via `resolveVisibility()` (shared). Show-zone-enter and hide-zone-enter stay event-owned (local).
**Why:** Show-zone-enter and hide-zone-enter have different semantics in the event path vs detection path. In widget-only mode, show-zone enter must manage cursor visibility state directly (transition hidden:false), which `resolveVisibility()` doesn't do — it only returns an action descriptor.
**Rejected:** Full replacement (would break widget-only show-zone enter behavior).

---

## DEC-007: Theme Class PHP-Only

**Date:** 2026-03-15 (WP-021 Phase 3)
**Context:** JS re-added the theme body class (`cmsmasters-cursor-theme-{name}`) that PHP already adds at page load. JS read the theme from `window.cmsmCursorTheme` and called `document.body.classList.add()`.
**Choice:** Remove JS re-add. PHP is the sole owner of the theme body class.
**Why:** Pure waste. PHP adds the class before JS runs. JS re-adding it does nothing useful. Removing eliminates confusing dual ownership.
**Rejected:** Keep both (confusing, no benefit).

---

## DEC-008: AddonUtils::get_kit_option() Is Correct (Not Broken)

**Date:** 2026-03-02 (Reverted attempt to replace with get_settings_for_display)
**Context:** Attempted to replace `AddonUtils::get_kit_option()` with Elementor's `$kit->get_settings_for_display()` to "fix" Kit reads. This broke the cursor because `get_kit_option()` has a 3-level fallback chain: raw postmeta -> `default_kits` wp_option (theme defaults) -> PHP default.
**Choice:** Keep `get_kit_option()` for all Kit reads. Never replace with `get_settings_for_display()` alone.
**Why:** The Kuzmich theme stores cursor defaults in `default_kits` wp_option. `get_settings_for_display()` only knows about registered control defaults, completely bypassing theme-level defaults. This caused visibility to drop from 'show' to 'elements' and editor_preview to drop from 'yes' to ''.
**Rejected:** `get_settings_for_display()` replacement (breaks theme default chain).
**See:** DEVLOG.md "REVERTED: Kit reads bypass registered control defaults"

---

## DEC-009: resolveBlendForElement Returns Value, Caller Applies

**Date:** 2026-03-14 (WP-021 Phase 1C)
**Context:** The blend resolution has 13 code paths. The original code called `setBlendIntensity()` inline at each path. Extraction options: return value (pure) or call side effect inside (impure).
**Choice:** Pure resolver returns string value. `detectCursorMode()` orchestrator calls `setBlendIntensity()` once with the result.
**Why:** Single guard in orchestrator replaces 10 scattered `setBlendIntensity()` calls. Easier to test, debug (CMSM_DEBUG shows returned value), and reason about.
**Rejected:** Impure resolver with `setBlendIntensity()` inside (multiple scattered side effects, harder to trace).

---

## DEC-010: Kit Size CSS Vars on :root (Not body)

**Date:** 2026-03-15 (WP-022 Phase 1)
**Context:** Kit cursor size CSS vars (`--cmsmasters-cursor-dot-size`, `--cmsmasters-cursor-dot-hover-size`) were output on `body.cmsmasters-cursor-enabled[class], body.cmsmasters-cursor-widget-only[class]` — specificity (0,2,0). In the Elementor editor, `cursor-editor-sync.js` applies real-time Kit size changes via `element.style.setProperty()` on `document.documentElement` (`:root`). But `:root` has specificity (0,1,0), which loses to the body selector.
**Choice:** Move PHP size vars to `:root` selector. Also fix zero-value guard: `!empty()` treats `0` as empty — changed to `'' !== (string)` so `0px` dot size is valid.
**Why:** `:root` vs `:root` inline style — inline always wins, enabling live Kit preview. The body selector's `[class]` specificity hack was only needed when vars competed with theme defaults; on `:root` they still override CSS defaults (custom properties cascade).
**Rejected:** Higher-specificity JS override (fragile, would need `!important`), `<style>` injection in JS (heavier, needs cleanup).
**See:** TRAP-012

---

## DEC-011: Page Mode — 3-State CHOOSE_TEXT Replaces Boolean Toggle

**Date:** 2026-03-16 (WP-025)
**Context:** Page-level `cmsmasters_page_cursor_disable` SWITCHER had semantic flip — `'yes'` meant "show cursor" in widget-only but "disable cursor" in sitewide. Page promotion was an implicit side-effect. `get_document_cursor_state()` inverted meaning per mode.
**Choice:** Replace with `cmsmasters_page_cursor_mode` CHOOSE_TEXT (`default` | `customize` | `disable`). Direct mapping in `get_document_cursor_state()` — no inversion. Promotion is explicit: `customize` in widget-only = promoted. Legacy read bridge for old documents preserves backward compatibility without migration.
**Why:** Eliminates semantic flip, implicit promotion, and mode-dependent inversion. Same pattern as WP-023 (elements). Widget-only page has only 2 options (Auto/Customize) — Disable not needed because cursor is already off on general zones.
**Rejected:** Migration script (unnecessary for dev phase), dual controls (complexity), keep boolean + relabel (still 2 states for 3 intents).
**See:** TRAP-008 (updated), SOURCE-OF-TRUTH.md Scenario 3

---

## DEC-012: Auto Label + Element Default on Promoted Pages

**Date:** 2026-03-16 (WP-025)
**Context:** Element widget-only default was `'hide'` (stamps `data-cursor="hide"`). On promoted pages, every untouched element blocked cursor — making page-level "Customize" useless. Labels were inconsistent: "Use global" in sitewide, "Show" in widget-only.
**Choice:** Unified label "Auto" on both page and element controls. Element default changed to `'default'` in both modes. `'default'` = transparent (nothing stamped). On promoted pages, cursor passes through. On non-promoted pages, JS widget-only mode hides cursor (no show zone).
**Why:** "Auto" is honest — element inherits from whatever page/global says. No false promise ("Use global" when global says off). Transparency fix is the key functional change: promoted pages work correctly.
**Rejected:** Dynamic label swap via JS DOM manipulation (fragile), proxy controls per page state (Elementor doesn't support cross-level conditions), "Default" label (programmer speak, not user speak).
**See:** DEC-011 (page level), SOURCE-OF-TRUTH.md Scenario 3b

---

## DEC-013: Remove Kit-Level Blend

**Date:** 2026-03-16 (WP-026)
**Context:** Kit `blend_mode` forced `--cmsmasters-cursor-color: #fff` on body globally. Any Kit blend setting killed user's custom cursor color on every page. Blend under `mix-blend-mode: exclusion/difference` requires white for correct inversion math — but this should be a conscious per-page or per-element choice, not a global override.
**Choice:** Remove Kit blend entirely. PHP no longer reads Kit `blend_mode` or emits `window.cmsmCursorTrueGlobalBlend`. Blend available only via page settings or element `data-cursor-blend` attribute. Labels changed from "Default (Global)" to "Off".
**Why:** User's cursor color is a primary design choice. Global blend silently overrides it. Per-page/element blend is a conscious decision where `#fff` trade-off is acceptable.
**Rejected:** Feature flag (unnecessary complexity for dev-phase product), fix `#fff` override (mathematically impossible — exclusion requires white for contrast).
**See:** TRAP-003 (updated), TRAP-004 (updated), SOURCE-OF-TRUTH.md Scenario 5

---

*Last updated: 2026-03-16 | WP-026 Kit blend removal*
