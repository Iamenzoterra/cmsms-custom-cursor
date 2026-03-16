# WP-026 Phase 0: Recon — Global Blend Removal Dependency Map

> Date: 2026-03-16
> Status: COMPLETE
> Goal: Map every place Kit-level blend touches so we know exactly what to cut.

---

## 1. Complete Blend Dependency Map

### 1.1 Kit → PHP → CSS → JS → Render Pipeline

```
Kit Settings (Kuzmich theme)
  └─ cmsmasters_custom_cursor_blend_mode (values: disabled|soft|medium|strong|yes)
       │
       ├─── frontend.php:1560 → AddonUtils::get_kit_option()
       │     └─ Stored in: window.cmsmCursorTrueGlobalBlend (inline JS)
       │        Only emitted when value ≠ disabled/empty
       │        Legacy: 'yes' → 'medium'
       │
       ├─── frontend.php:1631 → get_page_cursor_setting('blend_mode', 'blend_mode', 'disabled')
       │     └─ Page > Kit cascade. Kit value map: 'disabled' → ''
       │        Result → body classes:
       │          cmsmasters-cursor-blend
       │          cmsmasters-cursor-blend-{soft|medium|strong}
       │
       └─── (Kit control itself registered in Kuzmich theme, NOT in our plugin)
```

### 1.2 Page-Level Blend

```
Page Settings (Elementor Document)
  └─ cmsmasters_page_cursor_blend_mode (module.php:1056)
       Values: '' (Default/Global) | off | soft | medium | strong
       │
       └─── get_page_cursor_setting() checks page first
            If page has value → use it (overrides Kit)
            If page empty ('') → falls back to Kit
            Result → same body classes as Kit
```

### 1.3 Element-Level Blend

```
Element Controls (module.php)
  ├─ cmsmasters_cursor_blend_mode (line 315) — core cursor blend
  │    Values: '' (Default) | off | soft | medium | strong
  │    Renders: data-cursor-blend="..." on element wrapper
  │
  ├─ cmsmasters_cursor_special_blend (line 854) — special cursor blend
  │    Default: 'off'
  │    Renders: data-cursor-blend="..." on element wrapper
  │
  └─ data-cursor-inherit-blend — inherit override (module.php:1515)
       Overrides blend for children of an inherit-parent element
```

### 1.4 CSS Rules (custom-cursor.css)

```css
/* COLOR OVERRIDE — the core problem */
body.cmsmasters-cursor-blend-medium,
body.cmsmasters-cursor-blend-soft,
body.cmsmasters-cursor-blend-strong {
    --cmsmasters-cursor-color: #fff;        /* line 185 — KILLS user color */
}

/* Z-INDEX ELEVATION */
body.cmsmasters-cursor-blend-* #cmsmasters-cursor-container {
    z-index: var(--cmsmasters-cursor-z-blend);  /* line 191 */
}

/* MIX-BLEND-MODE — on #cmsmasters-cursor-container (NOT body, NOT dot) */
body.cmsmasters-cursor-blend-soft #cmsmasters-cursor-container {
    mix-blend-mode: exclusion;               /* line 195 */
}
body.cmsmasters-cursor-blend-medium #cmsmasters-cursor-container {
    mix-blend-mode: difference;              /* line 199 */
}
body.cmsmasters-cursor-blend-strong #cmsmasters-cursor-container {
    mix-blend-mode: difference;              /* line 203 */
    filter: contrast(1.5);
}

/* SPECIAL CURSOR FILTER RESET */
body.cmsmasters-cursor-blend-* .cmsmasters-cursor-image   { filter: none; }  /* line 310 */
body.cmsmasters-cursor-blend-* .cmsmasters-cursor-text-el { filter: none; }  /* line 352 */
body.cmsmasters-cursor-blend-* .cmsmasters-cursor-icon-el { filter: none; }  /* line 400 */
```

### 1.5 JS Variables

| Variable | Source | Purpose | Kit Dependent? |
|---|---|---|---|
| `globalBlendIntensity` (line 693) | Read from body classes on init | Page > Kit resolved blend. Used as fallback for inner content without explicit blend. | YES — body classes come from page > Kit |
| `currentBlendIntensity` (line 701) | Tracks what's currently active | Used for change detection (skip no-ops) | Indirect |
| `trueGlobalBlend` (line 724) | `window.cmsmCursorTrueGlobalBlend` | Kit-ONLY blend. Used for widget "Default" fallback. Ignores page override. | **YES — directly Kit** |
| `CursorState._state.blend` (line 719) | Synced from body classes on init | Owns body class transitions after init (TRAP-001) | Indirect (via body classes) |

### 1.6 JS Functions

| Function | Location | Kit Blend Usage |
|---|---|---|
| `resolveBlendForElement()` | line 2118 | Uses `ctx.trueGlobalBlend` (6 paths), `ctx.globalBlendIntensity` (1 path) |
| `setBlendIntensity()` | line 1246 | Pure setter — delegates to CursorState.transition() |
| `CursorState._applyToDOM()` | line 532 | Adds/removes `cmsmasters-cursor-blend` + `cmsmasters-cursor-blend-{intensity}` on body |
| `page-blend-update` listener | line 727 | Updates `globalBlendIntensity` from editor events |

---

## 2. Annotated resolveBlendForElement() — All Resolution Paths

13 distinct return paths. Marked with Kit dependency:

### Phase A: Inherit Override (lines 2123-2145)
If element has no explicit blend AND has a `data-cursor-inherit-blend` ancestor → uses inherited value as `selfBlend`.

### Phase B: Explicit blend on element (lines 2147-2168)

| Path | Condition | Returns | Uses Kit? |
|---|---|---|---|
| B1 | `selfBlend = 'off'/'no'` | `''` (no blend) | NO |
| B2 | `selfBlend = 'soft'/'medium'/'strong'` | selfBlend value | NO |
| B3 | `selfBlend = 'yes'` | `currentBlendIntensity` or `trueGlobalBlend` or `'soft'` | **YES** — fallback to trueGlobalBlend |
| B4 | `selfBlend = 'default'/''` | `trueGlobalBlend` | **YES** — directly |
| B5 | unknown value | `currentBlendIntensity` | Indirect |

### Phase C: No blend attribute — widget check (lines 2171-2179)

| Path | Condition | Returns | Uses Kit? |
|---|---|---|---|
| C1 | Widget with cursor settings, no blend | `trueGlobalBlend` | **YES** — directly |

### Phase D: Walk up DOM tree (lines 2182-2226)

| Path | Condition | Returns | Uses Kit? |
|---|---|---|---|
| D1 | Found ancestor with `off`/`no` | `''` | NO |
| D2 | Found ancestor with `soft`/`medium`/`strong` | ancestor value | NO |
| D3 | Found ancestor with `yes` | `currentBlendIntensity` or `trueGlobalBlend` or `'soft'` | **YES** — fallback |
| D4 | Found ancestor with unknown | `currentBlendIntensity` | Indirect |

### Phase E: No blend found at all (lines 2229-2232)

| Path | Condition | Returns | Uses Kit? |
|---|---|---|---|
| E1 | Stopped at dirty widget | `trueGlobalBlend` | **YES** — directly |
| E2 | Reached body (no widget stop) | `globalBlendIntensity` | YES — page > Kit |

### Summary: 6 of 13 paths directly use `trueGlobalBlend`. 1 path uses `globalBlendIntensity` (page > Kit). Without Kit blend → all 7 return `''`.

---

## 3. Special Cursor Blend (Image/Text/Icon)

Lines 2290-2451: Each special cursor type has its own blend handling block (NOT via resolveBlendForElement). Pattern is identical for all three:

```
1. Check explicit blend on special element (data-cursor-blend)
2. Check inherit override (data-cursor-inherit-blend)
3. If explicit: use value directly, 'default' → trueGlobalBlend
4. If no explicit: use trueGlobalBlend
```

**All three special cursor types fall back to `trueGlobalBlend`** when element has no explicit blend or uses "Default". Without Kit blend → special cursors with "Default" or no blend → no blend active.

---

## 4. Editor Sync (cursor-editor-sync.js)

### Page Settings → applyPageCursorSettings() (line 850)
- Line 921: Handles `p.blend_mode` — adds/removes body classes
- Line 931: Empty string → restores `ini.blendClasses` (initial state from PHP)
- Line 948: Dispatches `cmsmasters:cursor:page-blend-update` event → updates `globalBlendIntensity` in custom-cursor.js

### Kit Settings → applyKitBaseline() (line 995)
- Line 1010: Updates `ini.blendClasses` and `ini.blendIntensity`
- Line 1071: Applies blend body classes from updated ini
- Line 1077: Dispatches `cmsmasters:cursor:page-blend-update` with Kit blend
- Line 1082: Updates `window.cmsmCursorTrueGlobalBlend`

### Navigator (navigator-indicator.js)
- Line 938: Reads `json.cmsmasters_custom_cursor_blend_mode` from Kit settings
- Line 946: Maps `disabled → ''` in payload
- Sends payload to cursor-editor-sync.js for live preview

---

## 5. Answers to Key Questions

### Architecture

**Q1: How does blend apply visually?**
`mix-blend-mode` is on `#cmsmasters-cursor-container` (the wrapper), NOT on body or dot. The selector is `body.cmsmasters-cursor-blend-{intensity} #cmsmasters-cursor-container`. This means blend is architecturally GLOBAL — it requires body classes to activate CSS, regardless of whether blend came from Kit, page, or element.

**Q2: Is `--cmsmasters-cursor-color: #fff` on body or container?**
On `body` (via body class selector). When ANY blend body class is present, the cursor color variable is forced to white on the body element. This is global — kills user's custom color.

**Q3: Can blend work per-element without body classes?**
NO. Currently: JS calls `setBlendIntensity()` → `CursorState.transition({blend})` → `_applyToDOM()` → adds/removes body classes. CSS rules only fire on body classes. Per-element blend ALSO uses body classes — it toggles them dynamically as the cursor enters/leaves the element. There is NO per-element CSS mechanism.

### What "remove Kit blend" means

**Q4: What happens to `trueGlobalBlend`?**
Without Kit blend → `window.cmsmCursorTrueGlobalBlend` is never emitted → `trueGlobalBlend = ''`. Widget "Default" → resolves to `''` → no blend. **CORRECT desired behavior.**

**Q5: What happens to `globalBlendIntensity`?**
Without Kit blend → page blend still works (page can set soft/medium/strong). If no page blend either → `globalBlendIntensity = ''`. **CORRECT — only page blend stamps body classes.**

**Q6: What happens to body classes on init?**
PHP `get_page_cursor_setting('blend_mode', 'blend_mode', 'disabled')` — page first, then Kit. Without Kit blend, if page has no override → Kit returns `'disabled'` → mapped to `''` → no body classes. Only page blend stamps them. TRAP-001 sync still needed for page blend.

**Q7: What happens to `resolveBlendForElement()` fallback paths?**
Paths B3, B4, C1, D3, E1 return `trueGlobalBlend` → all return `''`. Path E2 returns `globalBlendIntensity` → returns `''` unless page has blend. Elements with "Default (Global)" blend get NO blend. **CORRECT — that's the whole point.**

### CSS implications

**Q8: If blend is per-element only, does `#fff` color override still fire?**
YES — because per-element blend ALSO adds body classes (via `setBlendIntensity()` → `CursorState.transition()` → `_applyToDOM()`). The `#fff` override fires whenever ANY blend is active, regardless of source. This is a fundamental architectural constraint.

**Q9: Does per-element blend need its own CSS mechanism?**
For WP-026 (remove Kit blend): NO. Per-element blend still works through body classes — it just means "white cursor while hovering over this element" which is fine because blend mode makes the cursor invert colors. The `#fff` override is actually NEEDED for blend to look correct — without it, a colored cursor under `mix-blend-mode: exclusion` produces wrong colors. The problem is only when blend is ALWAYS ON globally (Kit level) — then cursor color is permanently `#fff`.

### Scope

**Q10: Kit blend control — hide or remove?**
REMOVE from Kit. The control is registered in Kuzmich theme, not in our plugin. We need to:
1. Stop reading it in `frontend.php` (don't emit `window.cmsmCursorTrueGlobalBlend`)
2. Remove `'blend_mode'` from the Kit value map
3. Stop using it in `get_page_cursor_setting()` fallback chain

The Kit control in Kuzmich theme can be removed separately.

**Q11: Page blend — stays as-is?**
YES. Page blend becomes the "global" for that page. Body classes still stamped by PHP. JS still reads them. No code changes needed in the blend pipeline — just remove Kit fallback.

**Q12: Element blend — stays as-is?**
YES. Element blend continues to work via `data-cursor-blend` → `resolveBlendForElement()` → `setBlendIntensity()` → body classes. The only change: "Default (Global)" now means "no blend" instead of "Kit blend".

---

## 6. CSS Mechanism Analysis

### Where things live:

| CSS Property | Selector | Element | Source |
|---|---|---|---|
| `--cmsmasters-cursor-color: #fff` | `body.cmsmasters-cursor-blend-*` | `<body>` | Body class |
| `mix-blend-mode` | `body.cmsmasters-cursor-blend-* #cmsmasters-cursor-container` | Container | Body class |
| `z-index` elevation | `body.cmsmasters-cursor-blend-* #cmsmasters-cursor-container` | Container | Body class |
| `filter: contrast(1.5)` | `body.cmsmasters-cursor-blend-strong #cmsmasters-cursor-container` | Container | Body class |
| `filter: none` | `body.cmsmasters-cursor-blend-* .cmsmasters-cursor-{image,text,icon}` | Special cursors | Body class |

**Everything is body-class driven.** No per-element CSS mechanism exists.

### Why #fff is needed for blend:
`mix-blend-mode: exclusion/difference` inverts colors. A white cursor (`#fff`) inverts to the background's complement — always visible. A colored cursor (e.g., `#222`) under exclusion produces unpredictable results — sometimes invisible on matching backgrounds.

---

## 7. Recommendation

### What to CUT (PHP changes)

1. **frontend.php:1558-1569** — Remove `window.cmsmCursorTrueGlobalBlend` emission entirely
2. **frontend.php:1631** — Change blend body class stamping: `get_page_cursor_setting('blend_mode', 'blend_mode', 'disabled')` → only read PAGE setting, no Kit fallback for blend. Pass empty string as global_key: `get_page_cursor_setting('blend_mode', '', 'disabled')`
3. **frontend.php:1359** — Remove `'blend_mode' => array('disabled' => '')` from Kit value map (no longer needed)

### What to KEEP (no changes)

1. **CSS** — All blend CSS rules stay. They activate from body classes regardless of source.
2. **CursorState blend sync** (TRAP-001) — Still needed for page blend body classes.
3. **resolveBlendForElement()** — All paths still valid. `trueGlobalBlend` will always be `''`, making "Default" = no blend.
4. **setBlendIntensity()** — Still needed for per-element blend toggling.
5. **Element controls** (core + special blend in module.php) — Stay as-is.
6. **Page blend control** (module.php:1056) — Stays. Label changes from "Default (Global)" to "Default (Off)" or similar.

### What to UPDATE

1. **JS custom-cursor.js:724** — `trueGlobalBlend` will always be `''` since window var is never emitted. Code is harmless but could add comment.
2. **cursor-editor-sync.js:1082-1088** — `applyKitBaseline()` Kit blend handling becomes no-op. Can simplify.
3. **navigator-indicator.js:938** — Kit blend read becomes irrelevant. Can keep (sends empty).
4. **module.php:1056** — Page blend "Default (Global)" label → "Default (Off)" since there's no global to inherit.
5. **module.php:315** — Element blend "Default" label → "Default (Off)" since there's no global.
6. **module.php:854** — Special blend already defaults to 'off' — no change needed.

### What MIGHT need restructuring (future, not WP-026)

Moving blend from body-class to container-level CSS would allow truly scoped per-element blend without affecting global cursor color. But this is a bigger architectural change and NOT needed for WP-026.

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Existing sites with Kit blend lose their setting | MEDIUM | Kit blend was broken (killed cursor color), so removing it is a fix. No migration needed. |
| Page blend still works after removal | LOW | Only Kit fallback removed. Page blend code path unchanged. |
| Element blend "Default" changes meaning | LOW | Was "use Kit blend". Becomes "no blend". Correct behavior. |
| trueGlobalBlend = '' everywhere | NONE | All code handles empty string gracefully. |
| FOUC on pages with page blend | NONE | PHP still stamps body classes for page blend. TRAP-001 sync still works. |
| Editor preview breaks | LOW | applyKitBaseline still dispatches events. Just with empty blend. |

---

## 9. Implementation Checklist (for Phase 1)

- [ ] frontend.php: Remove `window.cmsmCursorTrueGlobalBlend` emission (lines 1558-1569)
- [ ] frontend.php: Change blend body class to page-only (line 1631 — pass `''` as global_key)
- [ ] frontend.php: Remove `blend_mode` from Kit value map (line 1359)
- [ ] module.php: Update page blend "Default (Global)" label → "Off" or "Disabled" (line 1062)
- [ ] module.php: Update element blend "Default" description (line 329)
- [ ] cursor-editor-sync.js: Simplify Kit blend handling in applyKitBaseline()
- [ ] Kuzmich theme: Remove blend_mode control from Kit settings (separate repo)
- [ ] Test: Page blend soft/medium/strong still works
- [ ] Test: Element blend override still works
- [ ] Test: "Default" blend on elements = no blend
- [ ] Test: Editor preview reflects changes live
- [ ] Test: No FOUC on pages with page-level blend
