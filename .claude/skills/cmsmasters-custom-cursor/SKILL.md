---
name: cmsmasters-custom-cursor
description: >
  Development skill for CMSMasters Custom Cursor Elementor addon — a WordPress plugin that replaces
  the system cursor with an animated custom cursor (dot + ring via RAF loop), supporting special
  cursors (image/text/icon), effects (wobble/pulse/shake/buzz), adaptive light/dark mode, blend modes,
  and per-element overrides. Use this skill for ANY work on custom-cursor.js, custom-cursor.css,
  cursor-editor-sync.js, navigator-indicator.js, module.php, frontend.php, editor.php, or
  settings-page.php. Also trigger when the user mentions cursor controls, Elementor cursor addon,
  cursor settings, cursor effects, cursor body classes, data-cursor attributes, CursorState,
  detectCursorMode, findWithBoundary, SpecialCursorManager, cursor blend mode, adaptive cursor,
  widget-only mode, show sitewide mode, cursor toggle, or navigator indicators. Even for seemingly
  simple cursor bug fixes, ALWAYS consult this skill — the addon has non-obvious interaction patterns
  (semantic flip, blend cascade, widget boundaries) that cause regressions without full context.
---

# CMSMasters Custom Cursor — Claude Code Skill

## Architecture

```
FRONTEND (custom-cursor.js ~2100 lines + custom-cursor.css ~370 lines)
├── Cursor rendering: dot + ring via requestAnimationFrame loop
├── Special cursors: image, text, icon (SpecialCursorManager)
├── Effects: wobble, pulse, shake, buzz
├── Adaptive mode: light/dark detection via background luminance
├── Form/video/iframe auto-hide (graceful degradation)
└── Security: sanitizeSvgHtml() XSS prevention

EDITOR (navigator-indicator.js + cursor-editor-sync.js)
├── Navigator panel indicators (colored dots per cursor type)
├── Real-time preview sync via postMessage
└── Elementor controls integration

PHP (module.php + frontend.php + editor.php + settings-page.php)
├── Elementor Kit/Page/Element controls registration
├── Settings resolution waterfall (Kit → Page → Element)
├── Body classes, CSS vars, window vars output
└── data-cursor-* attribute stamping on elements
```

## File Map

| File | Purpose | ~Lines |
|---|---|---|
| `assets/lib/custom-cursor/custom-cursor.js` | Main cursor runtime | 2100 |
| `assets/lib/custom-cursor/custom-cursor.css` | Cursor styles | 370 |
| `assets/js/cursor-editor-sync.js` | Preview ↔ Editor sync | — |
| `assets/js/navigator-indicator.js` | Navigator panel indicators | — |
| `modules/cursor-controls/module.php` | Elementor controls + attribute stamping | — |
| `includes/frontend.php` | WordPress frontend hooks, settings bridge | — |
| `includes/editor.php` | Elementor editor integration | — |
| `modules/settings/settings-page.php` | WP admin settings page | — |

## Settings Rosetta Stone (CRITICAL)

Three option namespaces with override priority:

| Layer | Prefix | Storage | Priority |
|---|---|---|---|
| **Kit (Global)** | `cmsmasters_custom_cursor_` | Elementor Kit postmeta `_elementor_page_settings` | Lowest |
| **Page** | `cmsmasters_page_cursor_` | Elementor document postmeta per page/post | Middle |
| **Element** | `cmsmasters_cursor_` | Element `_elementor_data` JSON | Highest |

### Kit key remaps (frontend.php)

| Logical Key | Kit Suffix Actually Read |
|---|---|
| `adaptive` | `adaptive_color` |
| `theme` | `cursor_style` |

### Kit value remaps (frontend.php)

| Kit Value | Runtime Value |
|---|---|
| `dot_ring` | `classic` |
| `disabled` | `''` |
| `yes` (blend legacy) | `medium` |

### Visibility modes

| Kit `visibility` | Internal `mode` | Meaning |
|---|---|---|
| `show` | `yes` | Full custom cursor sitewide |
| `elements` | `widgets` | Widget-only — cursor hidden by default |
| `hide` | `''` | Disabled — no runtime loaded |

## Mandatory Code Patterns

### 1. Singleton Guard (REQUIRED for any initialization)

```javascript
if (window.cmsmCursorInstanceActive) return;
window.cmsmCursorInstanceActive = true;
```

### 2. postMessage Origin Validation (REQUIRED)

```javascript
var TRUSTED_ORIGIN = window.location.origin;
window.addEventListener('message', function(e) {
    if (e.origin !== TRUSTED_ORIGIN) return;
    // handle message
});
```

### 3. SVG Sanitization (REQUIRED for any innerHTML with user content)

```javascript
container.innerHTML = sanitizeSvgHtml(userProvidedSvg);
```

### 4. Sticky Mode (prevents adaptive mode flicker)

```javascript
var STICKY_MODE_DURATION = 500;
if (Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) return;
```

### 5. PHP Settings Read — Three Different Methods

```php
// Raw saved data — ONLY explicitly set values (no defaults)
// USE THIS to check if user ever configured cursor settings
$saved = $element->get_data()['settings'];

// All settings including defaults, no condition filtering
$all = $element->get_settings();

// Filtered by conditions — values hidden in UI are excluded
$display = $element->get_settings_for_display();
```

**Rule:** Use `get_data()['settings']` to distinguish "configured then hidden" from "never touched".

### 6. skipClear Parameter in applySettings()

- `skipClear = true` → initial page load (preserve PHP-rendered attrs)
- `skipClear = false` → user changed a setting in editor
- Hide branch ONLY stamps `data-cursor="hide"` on user changes, not on init

## Toggle Semantic Flip (CRITICAL — source of most bugs)

`cmsmasters_cursor_hide` toggle means DIFFERENT things per mode:

| Mode | toggle = `yes` | toggle = `''` (off) |
|---|---|---|
| **Widget-only** | `data-cursor-show="yes"` → reveal zone | Nothing stamped → ignored |
| **Full (Sitewide)** | Cursor config rendered | If had saved config → `data-cursor="hide"`; if never configured → nothing |

**Key insight:** Elementor retains conditioned control values. When toggle changes from `yes` to `''`, the control is hidden in UI but its value stays in the Backbone model AND in saved element data.

## findWithBoundary() Cascade Logic

DOM traversal for attribute resolution (JS):

1. Walk UP from hovered element
2. Ancestor has searched attribute → return it
3. Ancestor has cursor TYPE settings (data-cursor, data-cursor-image/text/icon) but NOT the searched attr → **STOP** (boundary) → return null
4. `data-cursor-inherit` elements are **transparent** in type boundary checks
5. Modifiers (color, effect, blend) do NOT create boundaries

## Blend Resolution

Two "global" blend values coexist:

| Variable | Source | Used For |
|---|---|---|
| `globalBlendIntensity` | Body classes (page > Kit) | Body-level fallback |
| `trueGlobalBlend` | Window var (Kit only) | Widget "Default" fallback |

Resolution order for an element:
1. Explicit `data-cursor-blend` → use value (`off`/`no` → disabled; `default`/`''` → trueGlobalBlend)
2. Dirty widget (has data-id + cursor settings) with no blend → trueGlobalBlend
3. Walk up DOM → dirty widget boundary → STOP → use its blend or trueGlobalBlend
4. Reached body → globalBlendIntensity (page > Kit)

**Page blend does NOT cascade into widgets** — dirty widgets always fall to Kit-only trueGlobalBlend.

## Effect Resolution

```javascript
function resolveEffect(cursorEffect, globalWobble) {
    if (cursorEffect === 'none') return '';
    if (!cursorEffect || cursorEffect === 'default') {
        if (window.cmsmCursorEffect) return window.cmsmCursorEffect; // page non-wobble
        return globalWobble ? 'wobble' : '';
    }
    return cursorEffect;
}
```

`window.cmsmCursorEffect` is set ONLY for `pulse`, `shake`, `buzz` — NOT for empty, `none`, or `wobble`.

## CursorState Properties

| Property | Type | Init | Body Class | Reset on resetHover()? |
|---|---|---|---|---|
| `hover` | bool | `false` | `cmsmasters-cursor-hover` | Yes |
| `down` | bool | `false` | `cmsmasters-cursor-down` | No |
| `hidden` | bool | `false` | `cmsmasters-cursor-hidden` | Yes |
| `text` | bool | `false` | `cmsmasters-cursor-text` | Yes |
| `mode` | null/string | `null` | `cmsmasters-cursor-{on-light,on-dark}` | No |
| `size` | null/string | `null` | `cmsmasters-cursor-size-{sm,md,lg}` | Yes |
| `blend` | null/string | synced | `cmsmasters-cursor-blend-{intensity}` | No |

**Blend sync rule:** PHP pre-renders blend body class. CursorState.blend inits as null. Without sync (line ~705), `transition({blend: null})` is a no-op → stale classes persist. ANY future CursorState property that PHP pre-renders MUST be synced from body classes on init.

## Window Variables (set by frontend.php via wp_add_inline_script)

| Variable | Condition | Type | Purpose |
|---|---|---|---|
| `cmsmCursorAdaptive` | adaptive = 'yes' | bool | Enable luminance detection |
| `cmsmCursorTheme` | theme != 'classic' | string | Cursor theme |
| `cmsmCursorSmooth` | smoothness != 'normal' | string | Lerp factor |
| `cmsmCursorEffect` | page effect = pulse/shake/buzz | string | Page non-wobble effect |
| `cmsmCursorTrueGlobalBlend` | Kit blend != 'disabled' | string | Kit-only blend fallback |
| `cmsmCursorWidgetOnly` | mode = 'widgets' | bool | Redundant (body class is primary) |

## CSS Variables (consumed by custom-cursor.css)

```css
--cmsmasters-cursor-color       /* Current cursor color */
--cmsmasters-cursor-color-dark  /* Dark mode color */
--cmsmasters-cursor-dot-size    /* Dot diameter */
--cmsmasters-cursor-dot-hover-size  /* Hover dot diameter */
--cmsmasters-cursor-ring-offset /* Ring offset from dot */
```

**Dead weight:** Kit auto-generates `--cmsmasters-custom-cursor-*` vars — they are NEVER consumed. Our inline CSS writes the vars that custom-cursor.css actually reads.

## Body Classes

| Class | Source | Notes |
|---|---|---|
| `cmsmasters-cursor-enabled` | PHP | Always when cursor enabled |
| `cmsmasters-cursor-widget-only` | PHP | Widget-only mode |
| `cmsmasters-cursor-theme-{name}` | PHP + JS | classic, dot |
| `cmsmasters-cursor-dual` | PHP | System + custom cursor |
| `cmsmasters-cursor-blend` | PHP + CursorState | Blend parent class |
| `cmsmasters-cursor-blend-{soft,medium,strong}` | PHP + CursorState | Mutually exclusive |
| `cmsmasters-cursor-wobble` | PHP | Wobble effect |
| `cmsmasters-cursor-hover` | CursorState | Over hoverable element |
| `cmsmasters-cursor-down` | CursorState | Mouse pressed |
| `cmsmasters-cursor-hidden` | CursorState | Cursor hidden |
| `cmsmasters-cursor-on-{light,dark}` | CursorState | Adaptive mode, mutually exclusive |

## Known Interaction Pitfalls

1. **CursorState blend sync** — Must sync from PHP body class on init or transition to null is no-op
2. **Toggle semantic flip** — Same control, different meaning per mode. Most regressions start here
3. **"Default" blend vs effect** — Default blend → trueGlobalBlend (Kit only). Default effect → page > Kit. Different by design
4. **Page blend doesn't cascade into widgets** — Dirty widgets form a "floor"
5. **Dual CSS variables** — Kit vars exist but are dead weight. Our inline CSS is what matters
6. **Widget-only page promotion** — Page toggle in widget-only mode silently promotes to full mode
7. **Color resolution separate path** — `get_cursor_color()` does NOT use `get_page_cursor_setting()`, handles `__globals__` references manually
8. **Wobble is CSS, others are JS** — Wobble uses body class + CSS. Pulse/shake/buzz are JS-only effects

## Navigator Indicator Logic (Show Sitewide mode)

| Element state | toggle | Sub-settings | Indicator |
|---|---|---|---|
| Never touched | `''` | all defaults | null (no dot) |
| Configured core | `'yes'` | hover/color/etc | core (purple) |
| Configured special | `'yes'` | special_active='yes' | special (blue) |
| Set inherit | `'yes'` | inherit='yes' | inherit (amber) |
| Configured then hidden | `''` | non-default values retained | hidden (gray) |

## hasCursorConfig() Check (editor + PHP)

Must check ALL these for detecting "user configured cursor":
- `cmsmasters_cursor_hover_style` (non-default)
- `cmsmasters_cursor_special_active` = 'yes'
- `cmsmasters_cursor_inherit_parent` = 'yes'
- `cmsmasters_cursor_force_color` = 'yes'
- `cmsmasters_cursor_blend_mode` (non-empty)
- `cmsmasters_cursor_effect` (non-empty)

Missing any of these → hidden indicator won't show for elements configured with only that setting.

## Form Zone Detection

`isFormZone()` (JS ~lines 918-984) detects native form elements AND 9 custom select libraries:
Select2/SelectWoo, Chosen.js, Choices.js, Nice Select v1/v2, Tom Select, Slim Select, Selectize, jQuery UI Selectmenu, Kendo UI.

CSS fallback for same libraries at custom-cursor.css lines 60-75.

## Workflow Rules

This project uses Brain/Hands separation:
- **Brain** (Opus/planning): RECON → WP → Phase Task → review logs → adapt
- **Hands** (Claude Code): audit → implement → verify → log → commit
- **One phase at a time** — never write all phases upfront
- **RECON before planning** — audit actual codebase, don't trust docs alone
- **Everything logged** — `logs/{epic-slug}/{task-ref-id}.md`
- **Docs updated last** — based on actual logs, not plans

## Pre-Change Checklist

Before modifying ANY cursor file:
1. Check which mode(s) affected (Full vs Widget-only vs Both)
2. Check toggle semantic flip implications
3. Check findWithBoundary cascade — does your change create/break boundaries?
4. Check CursorState sync — if adding PHP body class, does JS need to sync it?
5. Check both editor preview AND frontend behavior
6. Check skipClear parameter handling if touching applySettings()
7. Verify singleton guard still works after changes
8. Test with blend mode ON and OFF
9. Test with adaptive mode ON and OFF
10. Test special cursors (image, text, icon) — they have separate code paths

## Quick Grep Commands for Audit

```bash
# Option prefixes
grep -rn 'cmsmasters_custom_cursor_' --include="*.php"
grep -rn 'cmsmasters_page_cursor_' --include="*.php"
grep -rn 'cmsmasters_cursor_' --include="*.php" --include="*.js"

# Body classes
grep -rn 'cmsmasters-cursor-' --include="*.php" --include="*.js" --include="*.css"

# Window vars
grep -rn 'window\.cmsmCursor' --include="*.php" --include="*.js"

# Data attributes
grep -rn 'data-cursor' --include="*.php" --include="*.js"

# CursorState
grep -rn 'CursorState' --include="*.js"

# findWithBoundary
grep -rn 'findWithBoundary' --include="*.js"
```