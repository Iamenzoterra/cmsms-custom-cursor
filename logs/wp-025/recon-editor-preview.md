# Recon: Editor Preview Page Settings Path [WP-025]
> Date: 2026-03-16
> Goal: Map how page setting changes propagate in editor preview vs PHP frontend

---

## Architecture: Two Paths

### Path 1: PHP (frontend page load)
```
get_document_cursor_state() → should_enable_custom_cursor() → add_cursor_body_class() → print_custom_cursor_html()
```
- Body class: `cmsmasters-cursor-enabled` or `cmsmasters-cursor-widget-only` (frontend.php:1603-1613)
- Page disable: `should_enable_custom_cursor()` returns false → no enqueue, no HTML (frontend.php:1442/1468)
- Page promotion: widget-only + `enabled:true` → `cmsmasters-cursor-enabled` class (frontend.php:1606-1607)

### Path 2: Editor Preview (postMessage → JS)
```
document model.on('change') → broadcastPageCursorChange() → buildPageCursorPayload()
    → postMessage('cmsmasters:cursor:page-settings') → applyPageCursorSettings()
```
- Listener: navigator-indicator.js:1420-1436 — fires on any `cmsmasters_page_cursor*` key change
- Payload: `buildPageCursorPayload()` (navigator-indicator.js:866-916)
- Receiver: cursor-editor-sync.js:376-381 → `applyPageCursorSettings()` (cursor-editor-sync.js:850-961)

---

## `applyPageCursorSettings()` Analysis (cursor-editor-sync.js:850-961)

### What it handles:
| Setting | Mechanism | Revert to global | Works? |
|---------|-----------|-----------------|--------|
| enabled:false | Adds `cmsmasters-cursor-disabled` class, returns early (line 857-860) | Yes | YES |
| enabled:true | Removes disabled class if `cursorEnabled` flag is true (line 863-864) | N/A | YES |
| theme | Body class swap (line 870-878) | Restores `ini.themeClasses` | YES |
| color | CSS custom property (line 883-889) | removeProperty reveals PHP value | YES |
| smoothness | Window vars (line 892-898) | Restores `ini.smooth` | YES |
| blend_mode | Body class + CustomEvent (line 902-931) | Restores `ini.blendClasses` | YES |
| effect | Body class + window vars (line 934-948) | Restores `ini.hasWobble` + `ini.effect` | YES |
| adaptive | Window vars (line 951-958) | Restores `ini.adaptive` | YES |

### What it does NOT handle:
| Capability | PHP does it | Editor JS does it | Gap? |
|-----------|------------|-------------------|------|
| Visibility class promotion (widget-only → enabled) | frontend.php:1603-1613 | **NOWHERE** | **YES** |
| Visibility class demotion (enabled → widget-only) | Implicit (PHP renders per state) | **NOWHERE** | **YES** |
| Clear stale sub-control values when mode != customize | Elementor condition hides controls, PHP reads per condition | **NOT DONE** | **YES** |
| Don't enqueue when disabled | should_enable returns false | Not applicable (already loaded) | N/A (by design) |

---

## Bug Analysis: 3 Scenarios

### Scenario 1: Sitewide "Disable"
**Expected:** Cursor disappears in editor preview.
**Code path:**
1. User changes `cmsmasters_page_cursor_mode` from `default` → `disable`
2. Listener fires (navigator-indicator.js:1423 — matches `cmsmasters_page_cursor*`)
3. `buildPageCursorPayload()`: pageMode='disable', enabled=false, hasOverride=true → payload returned
4. `applyPageCursorSettings({enabled: false, ...})` → line 857-860: adds `cmsmasters-cursor-disabled`, returns early
5. Injected CSS (cursor-editor-sync.js:85-113) hides cursor elements

**Verdict: SHOULD WORK** — the disable mechanism via `cmsmasters-cursor-disabled` class is well-established.
Possible edge: if `cursorEnabled` is still false (user hasn't toggled cursor ON), cursor is already hidden, so "Disable" has no visible effect. User may perceive this as "not working" when it's the toggle panel state.

### Scenario 2: Sitewide "Use global" after "Customize"
**Expected:** Page overrides cleared, cursor reverts to Kit defaults.
**Code path:**
1. User had mode='customize' with page overrides (theme, blend, etc.)
2. User changes to mode='default' (Use global)
3. `buildPageCursorPayload()`: pageMode='default', enabled=true
4. **BUG**: Sub-control values (theme, blend, etc.) are still in Backbone model — Elementor hides the controls via condition but doesn't clear values
5. Payload: `{enabled: true, theme: 'ring', blend_mode: 'strong', ...}` — **stale overrides!**
6. `applyPageCursorSettings()` applies them as if they're active page overrides

**Root cause:** `buildPageCursorPayload()` passes visual settings regardless of page mode.
**Fix location:** navigator-indicator.js `buildPageCursorPayload()` — when `pageMode !== 'customize'`, zero out all visual settings to `''`.

### Scenario 3: Widget-only "Show" (promotion)
**Expected:** Cursor appears in preview (promoted from widget-only to full).
**Code path:**
1. Widget-only mode: PHP rendered `cmsmasters-cursor-widget-only` class (NOT `-enabled`)
2. cursor-editor-sync.js loaded (line 14: `isShowMode` flag is true)
3. Line 330: body starts with `cmsmasters-cursor-disabled` (toggle OFF by default)
4. User toggles cursor ON → `cursorEnabled = true`, removes disabled class
5. Cursor visible but in widget-only mode (only in `[data-cursor-show]` zones)
6. User changes page mode to "Show" (= customize): `enabled: true`
7. `applyPageCursorSettings({enabled: true, ...})`
8. Line 863: cursorEnabled is true → removes disabled class (already removed)
9. **BUG**: Body still has `cmsmasters-cursor-widget-only`, NOT `cmsmasters-cursor-enabled`
10. No code adds the promotion class or removes widget-only

**Root cause:** `applyPageCursorSettings()` has no visibility class logic. PHP does promotion at render time (frontend.php:1603-1613), but JS preview path never replicates this.
**Fix location:** cursor-editor-sync.js `applyPageCursorSettings()` — add visibility class handling based on `p.enabled` + mode awareness.

---

## Fix Recommendations

### Fix 1: Stale overrides (Scenario 2) — navigator-indicator.js
In `buildPageCursorPayload()`, after computing `pageMode` and `enabled`:
```js
// When not in customize mode, visual settings are irrelevant (sub-controls hidden)
if (pageMode !== 'customize') {
    payload.theme = '';
    payload.color = '';
    // ... etc for all visual keys
}
```

### Fix 2: Visibility class promotion (Scenario 3) — cursor-editor-sync.js
In `applyPageCursorSettings()`, after the enabled/disabled logic (after line 867):
```js
// Visibility class promotion/demotion for widget-only mode
if (isShowMode) {
    if (p.enabled === true) {
        // Promoted: widget-only → full cursor
        body.classList.add('cmsmasters-cursor-enabled');
        body.classList.remove('cmsmasters-cursor-widget-only');
    } else if (p.enabled === null) {
        // Default: restore widget-only
        body.classList.remove('cmsmasters-cursor-enabled');
        body.classList.add('cmsmasters-cursor-widget-only');
    }
}
```

### Fix 3: Sitewide disable visibility (Scenario 1 edge case) — cursor-editor-sync.js
If sitewide + disable: remove `cmsmasters-cursor-enabled` class entirely (prevents CSS from showing cursor elements even while `cmsmasters-cursor-disabled` is present).

---

## Pre-existing vs WP-025?

| Bug | Pre-existing? | Why |
|-----|--------------|-----|
| Stale visual overrides on mode change | **NEW in WP-025** — old binary toggle had no sub-control visibility issue |
| Widget-only promotion in preview | **LIKELY PRE-EXISTING** — old `_disable='yes'` toggle also lacked JS promotion logic, but WP-025 makes it explicit |
| Sitewide disable in preview | **NOT A BUG** — works correctly via `cmsmasters-cursor-disabled` class |

---

## Scope Decision

**Recommendation:** Fix in WP-025 scope.
- Fix 1 (stale overrides) is a direct consequence of the new tri-state control
- Fix 2 (visibility promotion) is needed for the "Show" chip in widget-only to have any effect
- Both fixes are in files already modified by WP-025
- No changes needed to custom-cursor.js or custom-cursor.css
