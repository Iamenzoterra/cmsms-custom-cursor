# Decisions

> ADR-style. grep-friendly: DEC-001, DEC-002, ...
> Each decision: when, context, choice, why, rejected alternatives.

---

## DEC-001: Blend Dual Ownership (PHP + JS)

**Date:** 2026-03-15 (documented in WP-021 Phase 3)
**Context:** Blend needs body classes for CSS transitions. JS CursorState manages runtime transitions. But PHP also pre-renders blend body classes on page load.
**Choice:** Keep dual ownership. PHP pre-renders blend classes, JS syncs to CursorState on init + manages runtime transitions. Add JSDoc documenting FOUC prevention rationale.
**Why:** Removing PHP pre-rendering causes 100-200ms of unstyled cursor (Flash of Unstyled Cursor) between page load and JS init. PHP gets the blend right from the first paint frame.
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

*Last updated: 2026-03-15 | WP-021 Phase 5*
