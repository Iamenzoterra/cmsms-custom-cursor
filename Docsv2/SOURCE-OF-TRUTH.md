# Source of Truth — Functional Map

**Version:** 5.7 | **Last Verified:** March 15, 2026
**Scope:** Every cursor feature end-to-end, from UI control to visual result.

> This document is the single source of truth for cursor feature behavior.
> Update when any option name, data attribute, body class, window var, or resolution logic changes.
> Cross-reference: `DECISIONS.md` for why, `TRAPS.md` for gotchas.

---

## Preamble: Settings Rosetta Stone

### Three Option Namespaces

| Layer | Prefix | Storage | Override Priority |
|---|---|---|---|
| **Kit (Global)** | `cmsmasters_custom_cursor_` | Elementor Kit postmeta `_elementor_page_settings` | Lowest |
| **Page** | `cmsmasters_page_cursor_` | Elementor document postmeta per page/post | Middle |
| **Element** | `cmsmasters_cursor_` | Element `_elementor_data` JSON | Highest |

### Complete Settings Cross-Reference

| Feature | Kit Control Suffix | Page Control | Element Control | Window Var | Body Class | CSS Var | Data Attribute |
|---|---|---|---|---|---|---|---|
| **Visibility/Mode** | `visibility` | `disable` (toggle) | `hide` (toggle) | `cmsmCursorWidgetOnly` | `cmsmasters-cursor-enabled` / `cmsmasters-cursor-widget-only` | -- | `data-cursor-show` / `data-cursor="hide"` |
| **Cursor Theme** | `cursor_style` | `theme` | -- | `cmsmCursorTheme` | `cmsmasters-cursor-theme-{name}` | -- | -- |
| **System Cursor** | `show_system_cursor` | -- | -- | -- | `cmsmasters-cursor-dual` | -- | -- |
| **Cursor Color** | `cursor_color` | `color` | `color` (+ `force_color`) | -- | -- | `--cmsmasters-cursor-color`, `--cmsmasters-cursor-color-dark` | `data-cursor-color` |
| **Adaptive Color** | `adaptive_color` | `adaptive` | -- | `cmsmCursorAdaptive` | `cmsmasters-cursor-on-light` / `cmsmasters-cursor-on-dark` | -- | -- |
| **Blend Mode** | `blend_mode` | `blend_mode` | `blend_mode` (core) / `special_blend` (special) | `cmsmCursorTrueGlobalBlend` | `cmsmasters-cursor-blend` + `cmsmasters-cursor-blend-{intensity}` | -- | `data-cursor-blend` |
| **Cursor Size** | `cursor_size` | -- | -- | -- | -- | `--cmsmasters-cursor-dot-size` (on `:root`, not body) | -- |
| **Hover Size** | `size_on_hover` | -- | -- | -- | -- | `--cmsmasters-cursor-dot-hover-size` (on `:root`, not body) | -- |
| **Smoothness** | `smoothness` | `smoothness` | -- | `cmsmCursorSmooth` | -- | -- | -- |
| **Wobble/Effect** | `wobble_effect` | `effect` | `effect` | `cmsmCursorEffect` (non-wobble), `cmsmCursorWobble` (wobble) | `cmsmasters-cursor-wobble` | -- | `data-cursor-effect` |
| **Editor Preview** | `editor_preview` | -- | -- | -- | -- | -- | -- |
| **Hover Style** | -- | -- | `hover_style` | -- | `cmsmasters-cursor-hover` | -- | `data-cursor` (value: `hover`) |
| **Special Cursor** | -- | -- | `special_active` + `special_type` | -- | -- | -- | `data-cursor-image` / `data-cursor-text` / `data-cursor-icon` |
| **Inherit Parent** | -- | -- | `inherit_parent` | -- | -- | -- | `data-cursor-inherit` + `data-cursor-inherit-blend` + `data-cursor-inherit-effect` |

### Value Mappings (Code-Verified)

**Kit Visibility -> Internal Mode** (`get_cursor_mode()` in frontend.php, module.php):

| Kit `visibility` | Internal `mode` | Meaning |
|---|---|---|
| `show` | `yes` | Full custom cursor sitewide |
| `elements` | `widgets` | Widget-only -- cursor hidden by default |
| `hide` | `''` | Disabled -- no cursor runtime loaded |

**Kit Key -> Kit Suffix Remap** (`get_page_cursor_setting()` in frontend.php):

| Logical Key | Kit Suffix Read |
|---|---|
| `adaptive` | `adaptive_color` |
| `theme` | `cursor_style` |

**Kit Value -> Internal Value Remap** (`get_page_cursor_setting()` in frontend.php):

| Kit Suffix | Kit Value | Runtime Value |
|---|---|---|
| `cursor_style` | `dot_ring` | `classic` |
| `blend_mode` | `disabled` | `''` |

**Blend Legacy** (`add_cursor_body_class()` and `enqueue_custom_cursor()` in frontend.php):

| Stored Value | Normalized Value |
|---|---|
| `yes` | `medium` |

### Dual CSS Variable Output

| Variable Family | Produced By | Example | Used by Cursor CSS? |
|---|---|---|---|
| `--cmsmasters-custom-cursor-*` | Elementor Kit selector output | `--cmsmasters-custom-cursor-cursor-color` | **No** (dead weight) |
| `--cmsmasters-cursor-*` | `enqueue_custom_cursor()` inline CSS | `--cmsmasters-cursor-color` | **Yes** |

The Kit CSS variables exist because Elementor auto-generates them for all Kit controls with selectors. They are never consumed. Our inline CSS writes the variables that `custom-cursor.css` actually reads.

---

## Resolver Architecture (WP-021)

5 resolver functions at module scope determine cursor behavior. `detectCursorMode()` is an orchestrator that calls resolvers and applies results.

### Resolver Table

| Resolver | Purity | Returns | Purpose |
|---|---|---|---|
| `resolveElement(x, y)` | Pure | `Element\|null` | Which element is cursor over? Filters cursor container, popups via `elementsFromPoint` |
| `resolveVisibility(el, isWidgetOnly)` | Impure (`formZoneActive`) | `{action, reason, terminal}\|null` | Should cursor be visible? Show zones, hide zones, forms, video/iframe |
| `resolveSpecialCandidate(el)` | Impure (`SpecialCursorManager.deactivate()`) | `{type, el, depth}\|null` | Which special cursor wins? Image/text/icon via `findWithBoundary`, depth comparison |
| `resolveBlendForElement(el, ctx)` | Pure | `string` (`''`/`'soft'`/`'medium'`/`'strong'`) | Blend intensity: explicit value, widget boundary, DOM walk, global fallback (13 paths) |
| `resolveEffectForElement(el)` | Pure | `{coreEffect, perElementWobble}` | Which effect applies? Cascade via `findWithBoundary` + inherit override |

### Detection Flow

```
mousemove (throttled) -> detectCursorMode(x, y)
  -> resolveElement(x, y)         -> el or null (stop if null)
  -> resolveVisibility(el)        -> action or null (apply if action, continue if null)
  -> resolveSpecialCandidate(el)  -> activate/deactivate special cursor
  -> updateForcedColor(el)        -> per-element color via .closest()
  -> resolveBlendForElement(el)   -> setBlendIntensity(result)
  -> resolveEffectForElement(el)  -> apply effect to render loop
  -> adaptive detection (inline)  -> applyMode() if luminance changed
```

### Event Handler Integration

| Handler | Uses resolvers? | Visibility path |
|---|---|---|
| `mousemove` (throttled) | Full pipeline above | Via `resolveVisibility()` |
| `mouseover` | Partial | Form/video via `resolveVisibility()` (shared). Show-zone-enter and hide-zone-enter stay event-owned (local) |
| `mouseout` | No | Local `relatedTarget` logic. Inverse of resolveVisibility semantics but event-owned |

**Why partial mouseover:** Show-zone-enter must manage cursor visibility state directly (transition `hidden:false`), which resolveVisibility doesn't do -- it only returns an action descriptor. See DEC-006.

### Debug Tracing (WP-021 Phase 4)

Enable: `window.CMSM_DEBUG = true` in browser console (live toggle, no reload needed).

26 `debugLog` calls across all 5 resolvers + `CursorState.transition`. Zero cost when off (outer boolean guard prevents allocation).

Example output:
```
[Cursor:resolve] element: DIV.elementor-widget-wrap
[Cursor:resolve] visibility: null (continue)
[Cursor:resolve] special: null
[Cursor:resolve] blend: "soft" (walk: value) {from: "DIV"}
[Cursor:resolve] effect: {coreEffect: "wobble", perElementWobble: true, inherited: false}
[Cursor:state] transition {change: {blend: "soft"}, source: "setBlendIntensity", prev: {blend: null}}
```

Blend source tracking: every return path logs a source string, e.g. `(explicit value)`, `(walk: value)`, `(dirty widget)`, `(trueGlobalBlend)`.

---

## Part 1: Scenarios

### Scenario 1: Enable "Show Sitewide"

**What the user does:** Sets Kit -> Custom Cursor -> Visibility to "Show Sitewide"

**Chain:**
1. Kit stores `cmsmasters_custom_cursor_visibility` = `show`
2. `get_cursor_mode()` maps `show` -> `yes`
3. `should_enable_custom_cursor()` returns true
4. `enqueue_custom_cursor()` loads CSS + JS + inline vars
5. `add_cursor_body_class()` adds `cmsmasters-cursor-enabled`
6. Also adds: theme class, dual class, blend classes, wobble class
7. `print_custom_cursor_html()` outputs container + dot + ring HTML
8. Also outputs `print_cursor_critical_js()` -- lightweight inline script for instant response
9. Main JS loads -> singleton guard -> checks `body.classList.contains('cmsmasters-cursor-enabled')`
10. Init: CursorState, blend sync, smoothness, adaptive, theme
11. RAF loop starts -> cursor follows mouse

**What can break:**
- Missing body class = JS won't init
- Body class added but HTML not printed = JS inits but no elements to animate
- Critical JS loaded but main JS fails = cursor stuck in basic follow mode

---

### Scenario 2: Enable "Show on Individual Elements"

**What the user does:** Sets Kit -> Visibility to "Show on Individual Elements"

**Chain:**
1. Kit stores `cmsmasters_custom_cursor_visibility` = `elements`
2. `get_cursor_mode()` maps `elements` -> `widgets`
3. `should_enable_custom_cursor()` returns true (widgets mode keeps runtime available)
4. `add_cursor_body_class()` adds `cmsmasters-cursor-widget-only` (unless page promotes -- see Scenario 3)
5. `print_custom_cursor_html()` outputs container but **skips** critical JS (cursor starts hidden)
6. `enqueue_custom_cursor()` sets `window.cmsmCursorWidgetOnly = true`
7. JS checks `body.classList.contains('cmsmasters-cursor-widget-only')` -> `isWidgetOnly = true`
8. `CursorState.transition({ hidden: true })` on init -- cursor invisible
9. Only `[data-cursor-show]` zones trigger cursor visibility via `resolveVisibility()`

**What can break:**
- Page promotion changes body class unexpectedly
- Element without `data-cursor-show` = cursor stays hidden
- Missing `cmsmCursorWidgetOnly` window var = JS doesn't know it's widget-only (but body class is backup)

---

### Scenario 3: Toggle Semantic Flip

**What the user does:** Toggles `cmsmasters_cursor_hide` on an element

**The same control has DIFFERENT semantics in each mode:**

| Mode | Toggle = `yes` | Toggle = `''` (off) |
|---|---|---|
| **Widget-only** (show render) | `data-cursor-show="yes"` stamped -> this is a reveal zone | Nothing stamped -> element ignored |
| **Full** (normal render) | Cursor config rendered (hover, special, core attrs) | If element had saved config -> `data-cursor="hide"`; if never configured -> nothing stamped |

**Code paths** (`apply_cursor_attributes()` in module.php):
- `is_show_render_mode()` determines which branch
- Full mode "hide" detection: checks `$element->get_data()['settings']` for saved cursor config

---

### Scenario 4: Activate Special Cursor on Widget

**What the user does:** Enable toggle -> Special Cursor = Yes -> Type = Image -> uploads image

**Chain:**
1. Element stores: `cmsmasters_cursor_hide` = `yes`, `cmsmasters_cursor_special_active` = `yes`, `cmsmasters_cursor_special_type` = `image`
2. `apply_cursor_attributes()` -> dispatches to `apply_image_cursor_attributes()`
3. PHP stamps: `data-cursor-image="URL"`, size/rotate/effect/blend attributes
4. JS `resolveSpecialCandidate(el)`: `findWithBoundary(el, 'data-cursor-image', null)`
5. Closest special wins if multiple types nested (depth comparison)
6. Core cursor settings checked -- if closer core exists, it wins over farther special
7. `SpecialCursorManager.activate('image', ...)` creates/updates image cursor element
8. Dot + ring hidden (`isRingHidden = true`, `visibility: hidden`)
9. Image cursor follows mouse with spring physics for size/rotate transitions

**Data attributes for each special type:**

| Type | Primary Attr | Size | Size Hover | Rotate | Rotate Hover | Effect | Blend |
|---|---|---|---|---|---|---|---|
| Image | `data-cursor-image` | `data-cursor-image-size` | `data-cursor-image-size-hover` | `data-cursor-image-rotate` | `data-cursor-image-rotate-hover` | `data-cursor-image-effect` | `data-cursor-blend` |
| Text | `data-cursor-text` | -- | -- | -- | -- | `data-cursor-text-effect` | `data-cursor-blend` |
| Icon | `data-cursor-icon` | `data-cursor-icon-size` | `data-cursor-icon-size-hover` | `data-cursor-icon-rotate` | `data-cursor-icon-rotate-hover` | `data-cursor-icon-effect` | `data-cursor-blend` |

---

### Scenario 5: Enable Blend Mode Globally

**What the user does:** Sets Kit -> Blend Mode to "Soft"

**Chain:**
1. Kit stores `cmsmasters_custom_cursor_blend_mode` = `soft`
2. `get_page_cursor_setting('blend_mode', 'blend_mode', 'disabled')` -- page empty -> falls back to Kit -> `soft`
3. `add_cursor_body_class()` adds `cmsmasters-cursor-blend` + `cmsmasters-cursor-blend-soft`
4. JS reads body classes -> `globalBlendIntensity = 'soft'`
5. Sync: `CursorState._state.blend = globalBlendIntensity` -- prevents no-op transition bug (TRAP-001)
6. `cmsmCursorTrueGlobalBlend` (frontend.php): Kit-only blend, NOT page > global
7. JS: `trueGlobalBlend = window.cmsmCursorTrueGlobalBlend || ''`

**Two "global" blend values exist simultaneously:**

| Variable | Source | Contains | Used For |
|---|---|---|---|
| `globalBlendIntensity` | Body classes (page > Kit) | Page override or Kit fallback | Body-level fallback when no widget boundary |
| `trueGlobalBlend` | Window var (Kit only) | Kit-only value | Widget "Default" fallback, dirty widget boundary fallback |

---

### Scenario 6: Blend Resolution for Widgets

**What the user does:** Widget A has blend = "Default", nested inside Section B with blend = "Strong"

**Resolution logic** (`resolveBlendForElement(el, ctx)` in custom-cursor.js):

```
1. Element has explicit data-cursor-blend?
   -> "off"/"no" -> blend = ''
   -> "soft"/"medium"/"strong" -> use that value
   -> "yes" -> use trueGlobalBlend || 'soft'
   -> "default"/"" -> use trueGlobalBlend (Kit only, NOT page)

2. Element has NO blend attribute?
   -> Is it a dirty widget (data-id + has cursor settings)?
     -> Yes -> use trueGlobalBlend
   -> Is it inner content (no data-id)?
     -> Walk up to find blend:
       -> Hit dirty widget boundary -> STOP -> use its blend or trueGlobalBlend
       -> Hit clean element with blend -> use that blend
       -> Hit body -> use globalBlendIntensity (page > Kit)
```

**13 resolution paths verified** (see DEC-009 for pure extraction design).

---

### Scenario 7: Enable Adaptive Color

**What the user does:** Kit -> Adaptive Color = "Enabled" (or page override)

**Chain:**
1. `get_page_cursor_setting('adaptive', 'adaptive', 'yes')` -- maps key `adaptive` -> Kit suffix `adaptive_color`
2. If `yes`: `window.cmsmCursorAdaptive = true`
3. JS: `adaptive = window.cmsmCursorAdaptive || false`
4. In `detectCursorMode()` (inline, not extracted -- see DEC-003): walk up DOM checking `getComputedStyle().backgroundColor`
5. Compute relative luminance -> compare to threshold
6. Hysteresis: `pendingMode` must match for 3 consecutive frames before change
7. Sticky mode: `lastModeChangeTime` + `STICKY_MODE_DURATION` (500ms) prevents rapid flip-flop
8. `CursorState.transition({ mode: 'on-light' })` or `{ mode: 'on-dark' }`
9. Body class `cmsmasters-cursor-on-light` or `cmsmasters-cursor-on-dark` toggles CSS color vars

**What can break:**
- Semi-transparent overlays confuse luminance (popup fix: skip `.elementor-popup-modal`)
- Widget-only: adaptive skipped outside show zones
- Sticky mode too aggressive -> delayed color change at sharp boundary

---

### Scenario 8: Apply Effect

**What the user does:** Various combinations of Kit wobble, page effect, element effect

**Effect resolution** (`resolveEffectForElement(el)` for per-element, `resolveEffect()` for global):

```
Per-element: findWithBoundary(el, 'data-cursor-effect') -> cascade up to widget boundary
  -> found "none" -> no effect
  -> found explicit effect -> use it
  -> found "default"/"" or not found -> fall through to global

Global: resolveEffect(cursorEffect, globalWobble)
  -> cursorEffect = 'none' -> return '' (no effect)
  -> cursorEffect empty or 'default':
     -> window.cmsmCursorEffect set? -> return page non-wobble effect
     -> isWobbleEnabled()? -> return 'wobble'
     -> return '' (no effect)
  -> explicit effect name -> return as-is
```

**PHP wobble class logic** (`add_cursor_body_class()` in frontend.php):

| Page Effect Value | Body Class Result |
|---|---|
| `wobble` | `cmsmasters-cursor-wobble` added |
| `none`, `pulse`, `shake`, `buzz` | Wobble class **suppressed** (even if Kit wobble = yes) |
| `''` (empty/inherit) | Fall back to Kit: if `wobble_effect` = `yes` -> add wobble class |

**PHP window var** (`enqueue_custom_cursor()` in frontend.php): `window.cmsmCursorEffect` is set ONLY when page effect is non-empty, non-`none`, AND non-`wobble`. Wobble is handled via window var `cmsmCursorWobble` + body class instead.

---

### Scenario 9: Hide Cursor on Element (Full Mode)

**What the user does:** Element had cursor configured -> user turns toggle off

**Chain:**
1. `apply_cursor_attributes()` -> full mode branch
2. `toggle !== 'yes'` -> check if element had saved config
3. `$saved = $element->get_data()['settings']` -- reads raw `_elementor_data` JSON
4. `has_config` check: `cmsmasters_cursor_hover_style` OR `cmsmasters_cursor_special_active=yes` OR `cmsmasters_cursor_inherit_parent=yes`
5. If `has_config` true -> `data-cursor="hide"` stamped
6. JS `resolveVisibility(el)`: `el.closest('[data-cursor="hide"],[data-cursor="none"]')` -> terminal action
7. If found -> return immediately -- skips ALL detection (color, blend, effect, adaptive)
8. System cursor shown on that element

**If element was NEVER configured:** nothing stamped -> global cursor applies normally.

---

### Scenario 10: Page-Level Override Waterfall

**What the user does:** Sets page-level cursor theme, blend, effect, color overrides

**`get_page_cursor_setting($page_key, $global_key, $default)`** (frontend.php):

```
1. Read page setting: cmsmasters_page_cursor_{$page_key}
   -> Non-empty? Return it.

2. Map global key to Kit suffix (adaptive->adaptive_color, theme->cursor_style)

3. Read Kit setting: cmsmasters_custom_cursor_{$kit_suffix}

4. Map Kit values to internal (dot_ring->classic, disabled->'')

5. Return Kit value or $default
```

**Color resolution is special** -- `get_cursor_color()` (frontend.php):
1. Page `__globals__` reference -> resolve via Kit system/custom colors
2. Page direct hex value
3. Kit `__globals__` reference -> resolve
4. Kit direct hex value
5. Empty string (use CSS default)

See TRAP-007 for why color doesn't use `get_page_cursor_setting()`.

---

## Part 2: Technical Detail Matrices

### Matrix A: Complete Settings Resolution

#### Kit Controls (11 controls, registered in Kit -> Theme Settings -> Custom Cursor)

| # | Kit Suffix | Type | Default | Values | frontend.php Usage |
|---|---|---|---|---|---|
| 1 | `visibility` | SELECT | `elements` | `show` / `elements` / `hide` | `get_cursor_mode()` |
| 2 | `cursor_style` | SELECT | `dot_ring` | `dot_ring` / `dot` | `get_page_cursor_setting('theme','theme')` |
| 3 | `show_system_cursor` | SWITCHER | `yes` | `yes` / `''` | `add_cursor_body_class()` |
| 4 | `cursor_color` | COLOR | `''` | hex | `get_cursor_color()` |
| 5 | `adaptive_color` | SELECT | `yes` | `yes` / `no` | `get_page_cursor_setting('adaptive','adaptive')` |
| 6 | `blend_mode` | SELECT | `disabled` | `disabled` / `soft` / `medium` / `strong` | `get_page_cursor_setting()` + `enqueue_custom_cursor()` |
| 7 | `cursor_size` | SLIDER | `8` | 4-20 px | `enqueue_custom_cursor()` |
| 8 | `size_on_hover` | SLIDER | `40` | 20-80 px | `enqueue_custom_cursor()` |
| 9 | `smoothness` | SELECT | `smooth` | `precise` / `snappy` / `normal` / `smooth` / `fluid` | `get_page_cursor_setting('smoothness','smoothness')` |
| 10 | `wobble_effect` | SWITCHER | `yes` | `yes` / `''` | `add_cursor_body_class()` |
| 11 | `editor_preview` | SWITCHER | `''` | `yes` / `''` | `should_enable_custom_cursor()` |

#### Page Controls (8 controls, registered in Page Settings -> Advanced -> Custom Cursor)

| # | Page Control ID | Type | Default | Values | Condition |
|---|---|---|---|---|---|
| 1 | `cmsmasters_page_cursor_disable` | SWITCHER | `''` | `yes` / `''` | Always visible (label flips per mode) |
| 2 | `cmsmasters_page_cursor_theme` | SELECT | `''` | `''` / `classic` / `dot` | Toggle-dependent |
| 3 | `cmsmasters_page_cursor_smoothness` | SELECT | `''` | `''` / `precise` / `snappy` / `normal` / `smooth` / `fluid` | Toggle-dependent |
| 4 | `cmsmasters_page_cursor_blend_mode` | SELECT | `''` | `''` / `off` / `soft` / `medium` / `strong` | Toggle-dependent |
| 5 | `cmsmasters_page_cursor_effect` | SELECT | `''` | `''` / `none` / `wobble` / `pulse` / `shake` / `buzz` | Toggle-dependent |
| 6 | `cmsmasters_page_cursor_adaptive` | SELECT | `''` | `''` / `yes` / `no` | Toggle-dependent |
| 7 | `cmsmasters_page_cursor_color` | COLOR | `''` | hex / global ref | Toggle-dependent |
| 8 | `cmsmasters_page_cursor_reset` | RAW_HTML | -- | Button | Toggle-dependent |

**Page toggle semantics:**
- Widget-only mode: controls visible when `cmsmasters_page_cursor_disable` = `yes` (opt-in)
- Full mode: controls visible when `cmsmasters_page_cursor_disable` = `''` (opt-out)

#### Element Controls (key controls, registered on widgets/sections/containers -> Advanced -> Custom Cursor)

| # | Element Control ID | Type | Default | Role |
|---|---|---|---|---|
| 1 | `cmsmasters_cursor_hide` | SWITCHER | `''` | Master toggle (semantic flip per mode) |
| 2 | `cmsmasters_cursor_inherit_parent` | SWITCHER | `''` | Transparent cursor boundary |
| 3 | `cmsmasters_cursor_inherit_blend` | SELECT | `''` | Blend override in inherit mode |
| 4 | `cmsmasters_cursor_inherit_effect` | SELECT | `''` | Effect override in inherit mode |
| 5 | `cmsmasters_cursor_special_active` | SWITCHER | `''` | Enable special cursor |
| 6 | `cmsmasters_cursor_special_type` | SELECT | `image` | `image` / `text` / `icon` |
| 7 | `cmsmasters_cursor_hover_style` | SELECT | `''` | Core hover style (`''` / `hover`) |
| 8 | `cmsmasters_cursor_force_color` | SWITCHER | `''` | Enable per-element color |
| 9 | `cmsmasters_cursor_color` | COLOR | `''` | Per-element color value |
| 10 | `cmsmasters_cursor_blend_mode` | SELECT | `''` | Core blend mode |
| 11 | `cmsmasters_cursor_special_blend` | CHOOSE_TEXT | `off` | Special blend mode |
| 12 | `cmsmasters_cursor_effect` | SELECT | `''` | Animation effect |

---

### Matrix B: Data Attribute Catalog

| Attribute | Set By (PHP) | Read By (JS) | Allowed Values | Inheritance |
|---|---|---|---|---|
| `data-cursor-show` | `apply_cursor_attributes()` | `resolveVisibility()` via `SHOW_ZONE_SELECTOR` | `yes` | Direct on element |
| `data-cursor` | `apply_core_cursor_attributes()` / hide logic | `resolveVisibility()` via `.closest()` | `hover` / `hide` / `none` | Cascades up via `findWithBoundary` |
| `data-cursor-color` | `apply_core_cursor_attributes()` | `updateForcedColor()` via `.closest()` | hex color string | Cascades up via `.closest()` |
| `data-cursor-blend` | `apply_core_cursor_attributes()` / special blend | `resolveBlendForElement()` | `''` / `off` / `no` / `soft` / `medium` / `strong` / `default` / `yes` | Cascades up with widget boundary |
| `data-cursor-effect` | `apply_core_cursor_attributes()` / `apply_effect_and_blend()` | `resolveEffectForElement()` via `findWithBoundary` | `''` / `none` / `wobble` / `pulse` / `shake` / `buzz` | Cascades up via `findWithBoundary` |
| `data-cursor-image` | `apply_image_cursor_attributes()` | `resolveSpecialCandidate()` via `findWithBoundary` | URL string | Cascades up via `findWithBoundary` |
| `data-cursor-image-size` | `apply_image_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-image-size-hover` | `apply_image_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-image-rotate` | `apply_image_cursor_attributes()` | `SpecialCursorManager` | number (deg) | Direct on element |
| `data-cursor-image-rotate-hover` | `apply_image_cursor_attributes()` | `SpecialCursorManager` | number (deg) | Direct on element |
| `data-cursor-image-effect` | `apply_image_cursor_attributes()` | `SpecialCursorManager` | effect name | Direct on element |
| `data-cursor-text` | `apply_text_cursor_attributes()` | `resolveSpecialCandidate()` via `findWithBoundary` | text string | Cascades up via `findWithBoundary` |
| `data-cursor-text-typography` | `apply_text_cursor_attributes()` | `SpecialCursorManager` | JSON object | Direct on element |
| `data-cursor-text-color` | `apply_text_cursor_attributes()` | `SpecialCursorManager` | hex color | Direct on element |
| `data-cursor-text-bg` | `apply_text_cursor_attributes()` | `SpecialCursorManager` | hex color | Direct on element |
| `data-cursor-text-circle` | `apply_text_cursor_attributes()` | `SpecialCursorManager` | `yes` | Direct on element |
| `data-cursor-text-circle-spacing` | `apply_text_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-text-radius` | `apply_shape_attributes()` | `SpecialCursorManager` | CSS border-radius | Direct on element |
| `data-cursor-text-padding` | `apply_shape_attributes()` | `SpecialCursorManager` | CSS padding | Direct on element |
| `data-cursor-text-effect` | `apply_effect_and_blend()` | `SpecialCursorManager` | effect name | Direct on element |
| `data-cursor-icon` | `apply_icon_cursor_attributes()` | `resolveSpecialCandidate()` via `findWithBoundary` | HTML string (sanitized) | Cascades up via `findWithBoundary` |
| `data-cursor-icon-color` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | hex color | Direct on element |
| `data-cursor-icon-bg` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | hex color | Direct on element |
| `data-cursor-icon-preserve` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | `yes` | Direct on element |
| `data-cursor-icon-size` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-icon-size-hover` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-icon-rotate` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | number (deg) | Direct on element |
| `data-cursor-icon-rotate-hover` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | number (deg) | Direct on element |
| `data-cursor-icon-circle` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | `yes` | Direct on element |
| `data-cursor-icon-circle-spacing` | `apply_icon_cursor_attributes()` | `SpecialCursorManager` | number (px) | Direct on element |
| `data-cursor-icon-radius` | `apply_shape_attributes()` | `SpecialCursorManager` | CSS border-radius | Direct on element |
| `data-cursor-icon-padding` | `apply_shape_attributes()` | `SpecialCursorManager` | CSS padding | Direct on element |
| `data-cursor-icon-effect` | `apply_effect_and_blend()` | `SpecialCursorManager` | effect name | Direct on element |
| `data-cursor-inherit` | `apply_cursor_attributes()` | `findClosestInheritEl()` + `hasCursorTypeSettings()` | `yes` | Direct on element (transparent in cascade) |
| `data-cursor-inherit-blend` | `apply_cursor_attributes()` | `resolveBlendForElement()` override | blend value | Direct on element |
| `data-cursor-inherit-effect` | `apply_cursor_attributes()` | `resolveEffectForElement()` override | effect value | Direct on element |

**Cascade rule via `findWithBoundary()`** (custom-cursor.js):
- Walk up from hovered element
- If an ancestor has the searched attribute -> return it
- If an ancestor has cursor TYPE settings (data-cursor, data-cursor-image/text/icon) but NOT the searched attr -> STOP (boundary) -> return null
- Inherit elements (`data-cursor-inherit`) are transparent in type boundary checks
- Modifiers (color, effect, blend) do NOT create boundaries

---

### Matrix C: Body Class Lifecycle

| Class | Added By | Managed By | Mutually Exclusive Group | Removed When |
|---|---|---|---|---|
| `cmsmasters-cursor-enabled` | PHP `add_cursor_body_class()` | Static (PHP only) | Mode group | Never (page load only) |
| `cmsmasters-cursor-widget-only` | PHP `add_cursor_body_class()` | Static (PHP only) | Mode group | Never (page load only) |
| `cmsmasters-cursor-theme-{name}` | PHP only (DEC-007) | Static | Theme group | Never |
| `cmsmasters-cursor-dual` | PHP | Static | -- | Never |
| `cmsmasters-cursor-blend` | PHP + `CursorState._applyToDOM()` | `CursorState` blend transitions | -- | When blend transitions to null |
| `cmsmasters-cursor-blend-soft` | PHP + `CursorState` | `CursorState` | Blend intensity group | When blend changes |
| `cmsmasters-cursor-blend-medium` | PHP + `CursorState` | `CursorState` | Blend intensity group | When blend changes |
| `cmsmasters-cursor-blend-strong` | PHP + `CursorState` | `CursorState` | Blend intensity group | When blend changes |
| `cmsmasters-cursor-wobble` | PHP only | Static (PHP only) | -- | Never |
| `cmsmasters-cursor-hover` | `CursorState` | `CursorState` | -- | `resetHover()` or explicit transition |
| `cmsmasters-cursor-down` | `CursorState` | `CursorState` | -- | mouseup transition |
| `cmsmasters-cursor-hidden` | `CursorState` | `CursorState` | -- | Unhide transition |
| `cmsmasters-cursor-text` | `CursorState` | `CursorState` | -- | `resetHover()` |
| `cmsmasters-cursor-on-light` | `CursorState` | `CursorState` | Adaptive mode group | Mode transition |
| `cmsmasters-cursor-on-dark` | `CursorState` | `CursorState` | Adaptive mode group | Mode transition |
| `cmsmasters-cursor-size-sm` | `CursorState` | `CursorState` | Size group | Size transition or `resetHover()` |
| `cmsmasters-cursor-size-md` | `CursorState` | `CursorState` | Size group | Size transition or `resetHover()` |
| `cmsmasters-cursor-size-lg` | `CursorState` | `CursorState` | Size group | Size transition or `resetHover()` |

**Mutually exclusive groups** -- `CursorState._applyToDOM()` removes old value before adding new:
- **Blend intensity**: soft / medium / strong (+ parent `cmsmasters-cursor-blend`)
- **Adaptive mode**: on-light / on-dark
- **Size**: sm / md / lg

---

### Matrix D: CursorState Properties

State machine manages body class transitions. Defined in custom-cursor.js.

| Property | Type | Init Value | Sync Source | Body Class Pattern | Reset on `resetHover()`? |
|---|---|---|---|---|---|
| `hover` | bool | `false` | JS only (mouseover) | `cmsmasters-cursor-hover` | Yes -> false |
| `down` | bool | `false` | JS only (mousedown/up) | `cmsmasters-cursor-down` | No |
| `hidden` | bool | `false` | JS only (init, forms, video) | `cmsmasters-cursor-hidden` | Yes -> false |
| `text` | bool | `false` | JS only (text hover) | `cmsmasters-cursor-text` | Yes -> false |
| `mode` | null/string | `null` | JS only (adaptive detection) | `cmsmasters-cursor-{on-light,on-dark}` | No |
| `size` | null/string | `null` | JS only (element hover) | `cmsmasters-cursor-size-{sm,md,lg}` | Yes -> null |
| `blend` | null/string | `null` **-> synced** | **Synced from PHP body class** (TRAP-001) | `cmsmasters-cursor-blend` + `cmsmasters-cursor-blend-{intensity}` | No |

**Critical sync pattern (blend):**
- PHP pre-renders `cmsmasters-cursor-blend-{soft|medium|strong}` on body
- `CursorState._state.blend` inits as `null`
- Without sync, `transition({blend: null})` to turn off blend is a no-op because `null === null` -> no change -> stale classes persist
- **Rule:** Any future CursorState property that PHP pre-renders MUST be synced from body classes on init

---

### Matrix E: Window Variables Bridge

All set by `enqueue_custom_cursor()` via `wp_add_inline_script()` (frontend.php).

| Window Variable | Condition | Type | Consumed By (JS) | Purpose |
|---|---|---|---|---|
| `window.cmsmCursorAdaptive` | `adaptive = 'yes'` | `true` (bool) | Init, `detectCursorMode()` adaptive block | Enable luminance-based color mode |
| `window.cmsmCursorTheme` | `theme != 'classic'` | string (`'dot'`) | Init, body class addition | Select cursor theme |
| `window.cmsmCursorSmooth` | `smoothness != 'normal'` | string | Init, smoothMap lookup | Lerp factor for cursor follow |
| `window.cmsmCursorEffect` | `page_effect != '' && != 'none' && != 'wobble'` | string (`'pulse'`, `'shake'`, `'buzz'`) | `resolveEffect()` | Page-level non-wobble effect fallback |
| `window.cmsmCursorWobble` | `wobble = 'yes'` (Kit or page) | `true` (bool) | `isWobbleEnabled()` | Wobble enable flag (DEC-002) |
| `window.cmsmCursorTrueGlobalBlend` | Kit `blend_mode != 'disabled'` | string (`'soft'`, `'medium'`, `'strong'`) | Init, `resolveBlendForElement()` | Kit-only blend for widget "Default" fallback |
| `window.cmsmCursorWidgetOnly` | `mode = 'widgets'` | `true` (bool) | -- (body class is primary) | Redundant flag (body class check is primary) |

**Not set via window vars** (derived from body classes instead):
- Blend intensity -> read from `cmsmasters-cursor-blend-{value}` classes
- Visibility mode -> read from `cmsmasters-cursor-enabled` / `cmsmasters-cursor-widget-only`

---

### Appendix: Known Interaction Pitfalls

See `TRAPS.md` for the full catalog with grep-friendly IDs. Summary:

1. **CursorState Blend Sync** (TRAP-001) -- null===null no-op if not synced from PHP body class
2. **Toggle Semantic Flip** (TRAP-002) -- same control, different meaning per mode
3. **"Default" Blend != "Default" Effect** (TRAP-003) -- different resolution by design
4. **Page Blend Does NOT Cascade to Dirty Widgets** (TRAP-004) -- widget boundary is intentional
5. **Dual CSS Variable Output** -- Kit vars are dead weight, inline CSS vars are real
6. **Widget-Only Page Promotion** (TRAP-008) -- page enable silently promotes to full mode
7. **Color Resolution Has Separate Path** (TRAP-007) -- doesn't use get_page_cursor_setting()
8. **Effect Window Var Exclusions** -- only pulse/shake/buzz get window var, wobble uses separate mechanism

---

## Master Data Flow Pipeline

```
STORAGE                          PHP BRIDGE                      PHP OUTPUT
-----------                      ----------                      ----------
Kit postmeta  ----+
                  +--> get_cursor_mode()     --> should_enable() --> Body Classes
Page postmeta ----+    get_page_cursor_setting()                --> CSS Vars
                       get_cursor_color()                       --> Window Vars
                                                                --> Cursor HTML

Element JSON  -------> apply_cursor_attributes()  ------------> data-cursor-* attributes


PHP OUTPUT                       JS RESOLVERS                    JS ORCHESTRATOR
----------                       ------------                    ---------------
Body Classes  ----+
CSS Vars      ----+--> Init Guards + Setup
Window Vars   ----+         |
Cursor HTML   ----+         v
                      resolveElement(x, y)  ----+
data-cursor-* ------> resolveVisibility(el) ----+
                      resolveSpecialCandidate() +--> detectCursorMode() --> CursorState
                      resolveBlendForElement()  |                      --> SpecialCursorManager
                      resolveEffectForElement() +                      --> RAF render loop
```

---

## Verification Checklist

When re-verifying this map:

1. **Option prefixes** -- grep `cmsmasters_custom_cursor_`, `cmsmasters_page_cursor_`, `cmsmasters_cursor_` across PHP
2. **Body class names** -- grep `cmsmasters-cursor-` in both PHP and JS
3. **Window vars** -- grep `window.cmsmCursor` in frontend.php and custom-cursor.js
4. **Data attributes** -- grep `data-cursor` in module.php and custom-cursor.js
5. **Value mappings** -- check `$mode_map`, `$kit_key_map`, `$kit_value_map` in frontend.php
6. **CursorState properties** -- check `_state` object and `_applyToDOM` method
7. **Blend sync** -- verify `CursorState._state.blend = globalBlendIntensity` still exists
8. **findWithBoundary** -- verify cascade/boundary logic unchanged
9. **Resolver functions** -- grep `function resolve` in custom-cursor.js (expect 5)
10. **Debug logging** -- grep `debugLog` in custom-cursor.js (expect 26+)
11. **formZoneActive writers** -- grep `formZoneActive` (expect 6 writes documented in JSDoc)

---

*This document is the single source of truth for cursor feature behavior. Update when any option name, data attribute, body class, window var, or resolution logic changes.*

*Migrated from DOCS/FUNCTIONAL-MAP.md on 2026-03-15 as part of WP-021 Phase 5. Resolver architecture added from WP-021 Phase 1-4 logs.*
