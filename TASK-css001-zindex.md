# TASK: CSS-001 — Z-Index Consolidation

**Type:** Bug fix (CSS + minor JS constant update)
**Target files:** `assets/lib/custom-cursor/custom-cursor.css`, `assets/lib/custom-cursor/custom-cursor.js`
**Priority:** HIGH — visible to end users
**Risk:** LOW-MEDIUM — CSS only, but z-index changes can have surprising cascading effects
**Estimated scope:** ~15 lines CSS changed, 1 JS constant updated

---

## ⚠️ History — What NOT To Do

**P4 v1 was a failed attempt** that tried to solve z-index by dynamically moving the cursor container via `appendChild()` to different DOM parents based on stacking context detection. It caused:
- Visual jumps during DOM relocation mid-animation
- CSS inheritance breaks (cursor inherited wrong styles from new parent)
- Unpredictable side effects across the entire page

**P4 v1 was fully removed.** Do NOT re-introduce any DOM relocation strategy.

The current `moveCursorToPopup()` / `moveCursorToBody()` is the ONLY acceptable DOM move — it's triggered by MutationObserver on popup open/close (not hover), and it's well-tested. Leave it untouched.

---

## Problem

Three conflicting z-index values with no clear strategy:

```css
/* DEFAULT — max int, fights with everything */
#cmsm-cursor-container {
    z-index: 2147483647;
}

/* BLEND — drops to 9999 for mix-blend-mode to work */
body.cmsm-cursor-blend-soft #cmsm-cursor-container,
body.cmsm-cursor-blend-medium #cmsm-cursor-container,
body.cmsm-cursor-blend-strong #cmsm-cursor-container {
    z-index: 9999;
}

/* POPUP — when cursor is inside popup DOM */
.elementor-popup-modal #cmsm-cursor-container {
    z-index: 999999 !important;
}
```

### Why this is broken

1. **2147483647 conflicts** with browser extensions, WP admin overlays, and other plugins that also use max-int
2. **The jump from 2B → 9999** when blend activates is extreme — content layers between 10000-2B suddenly appear above cursor
3. **The !important on popup** is a code smell — needed because 2B default is so high nothing else can compete
4. **No CSS custom property** — users can't override z-index without editing source

### Why blend mode NEEDS lower z-index

This is not a bug — it's a CSS requirement:

```css
body.cmsm-cursor-blend-medium {
    isolation: isolate;  /* Creates stacking context on body */
}
body.cmsm-cursor-blend-medium #cmsm-cursor-container {
    mix-blend-mode: difference;  /* Only works within same stacking context */
    z-index: 9999;  /* Must be reasonable, not max-int */
}
```

`mix-blend-mode` only blends with content in the same stacking context. If cursor has max z-index, it creates an isolated layer and blend has nothing to blend with. The lower z-index is intentional and correct.

---

## Solution

### Strategy: CSS Custom Property + Consistent Values

Replace the three hardcoded values with a single CSS custom property that adjusts per context.

### Phase 1: CSS Changes (`custom-cursor.css`)

**Step 1 — Add custom property to container base styles:**

```css
/* BEFORE */
#cmsm-cursor-container {
    z-index: 2147483647;
}

/* AFTER */
#cmsm-cursor-container {
    --cmsm-cursor-z-default: 999999;
    --cmsm-cursor-z-blend: 9999;
    z-index: var(--cmsm-cursor-z-default);
}
```

**Step 2 — Update blend mode rules:**

```css
/* BEFORE */
body.cmsm-cursor-blend-soft #cmsm-cursor-container,
body.cmsm-cursor-blend-medium #cmsm-cursor-container,
body.cmsm-cursor-blend-strong #cmsm-cursor-container {
    z-index: 9999;
}

/* AFTER */
body.cmsm-cursor-blend-soft #cmsm-cursor-container,
body.cmsm-cursor-blend-medium #cmsm-cursor-container,
body.cmsm-cursor-blend-strong #cmsm-cursor-container {
    z-index: var(--cmsm-cursor-z-blend);
}
```

**Step 3 — Update popup rule (remove !important):**

```css
/* BEFORE */
.elementor-popup-modal #cmsm-cursor-container {
    z-index: 999999 !important;
}

/* AFTER — no !important needed, 999999 > 9999 naturally */
.elementor-popup-modal #cmsm-cursor-container {
    z-index: var(--cmsm-cursor-z-default);
}
```

### Phase 2: JS Constant Update (`custom-cursor.js`)

Update the existing `CURSOR_Z_INDEX` constant (added in Phase 1 refactor):

```javascript
/* BEFORE */
var CURSOR_Z_INDEX = 2147483647;

/* AFTER */
var CURSOR_Z_INDEX = 999999;
```

Search for any other references to `2147483647` in the JS file and replace with `CURSOR_Z_INDEX`.

### Phase 3: Add user override documentation

Users can now override via custom CSS:

```css
/* Lower cursor z-index if it conflicts with a specific plugin */
#cmsm-cursor-container {
    --cmsm-cursor-z-default: 99999;
}
```

---

## Why 999999?

| z-index | Who uses it |
|---|---|
| 100-999 | Page content (sticky headers, dropdowns) |
| 1000-9999 | Overlays, tooltips, mega menus |
| 10000-99999 | Modals, popups, Elementor popups |
| 99999 | WordPress admin bar |
| **999999** | **← Cursor default (above everything, below browser chrome)** |
| 2147483647 | Browser extensions, some poorly written plugins |

999999 is high enough to be above all normal page content and most modals, but low enough to not fight with browser extensions and other max-int users.

---

## Z-Index Strategy Summary

| Context | z-index | Why |
|---|---|---|
| **Default** | `999999` via `--cmsm-cursor-z-default` | Above all page content |
| **Blend mode** | `9999` via `--cmsm-cursor-z-blend` | Must participate in body's stacking context for mix-blend-mode |
| **Inside popup** | `999999` via `--cmsm-cursor-z-default` | Cursor is physically inside popup DOM (moveCursorToPopup), so 999999 is relative to popup's stacking context |

The key insight: when cursor is inside popup (via `moveCursorToPopup()`), the z-index is relative to the popup's stacking context, not the page. So `999999` puts it above popup content without conflicting with page layers.

---

## What NOT to change

| Item | Why leave it |
|---|---|
| `moveCursorToPopup()` / `moveCursorToBody()` | Working popup handling, well-tested |
| `isolation: isolate` on blend body | Required for mix-blend-mode |
| Blend z-index value (9999) | Required for mix-blend-mode to work |
| `pointer-events: none` on cursor | Already correct, allows click-through |
| MutationObserver for popup detection | Working, handles Elementor popups |

---

## Implementation Steps

### Step 1: Create backup
```bash
cp assets/lib/custom-cursor/custom-cursor.css assets/lib/custom-cursor/custom-cursor.css.pre-zindex
```

### Step 2: CSS changes
Edit `assets/lib/custom-cursor/custom-cursor.css`:
1. Add CSS custom properties to `#cmsm-cursor-container`
2. Replace hardcoded z-index values with `var(--cmsm-cursor-z-*)`
3. Remove `!important` from popup rule

### Step 3: JS constant
Edit `assets/lib/custom-cursor/custom-cursor.js`:
1. Update `CURSOR_Z_INDEX` constant to `999999`
2. Search for any remaining `2147483647` references

### Step 4: Verify
```bash
# Should return ZERO for 2147483647
grep -rn '2147483647' assets/lib/custom-cursor/

# Should show only the custom property declarations and var() usages
grep -n 'z-index' assets/lib/custom-cursor/custom-cursor.css
```

### Step 5: Build
```
npm run build
```

---

## Agent Invocation Plan

| Order | Agent | Why |
|---|---|---|
| 1 | 🎨 **css-compat** | Verify z-index strategy, custom properties fallback, no blend mode regression |
| 2 | 🔒 **security-sentinel** | Quick scan — CSS-only change shouldn't affect security, but verify |
| 3 | 📖 **doc-keeper** | Update 06-API-CSS.md z-index table, 04-KNOWN-ISSUES.md mark CSS-001 resolved, 02-CHANGELOG |

---

## Acceptance Criteria

### Functional
- [ ] Cursor visible above all normal page content
- [ ] Cursor NOT visible above browser's address bar / extensions
- [ ] Cursor visible inside Elementor popups (moveCursorToPopup works)
- [ ] Blend mode: cursor blends with page content correctly
- [ ] Blend mode: cursor below elements with z-index > 9999 (expected behavior, documented)
- [ ] WP admin bar: cursor below admin bar when admin bar visible
- [ ] Sticky headers: test with typical z-index (999-99999)

### Structural
- [ ] Zero hardcoded z-index values in CSS (all via custom properties)
- [ ] Zero `!important` on z-index rules
- [ ] `CURSOR_Z_INDEX` constant matches CSS default
- [ ] Users can override via `--cmsm-cursor-z-default` custom property

### Regression
- [ ] All effects still work (wobble, pulse, shake, buzz)
- [ ] Adaptive mode still works
- [ ] Special cursors still work
- [ ] Forms/video/iframe still hide cursor
- [ ] Editor sync still works

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Some plugin has z-index > 999999 | LOW | Users can override via CSS custom property |
| Blend mode breaks with new default | NONE | Blend value (9999) unchanged |
| Popup cursor disappears | LOW | moveCursorToPopup unchanged, z-index relative to popup context |
| Sticky header covers cursor | MEDIUM | Expected — cursor shouldn't block UI. Test with common themes |

---

## Test Scenarios

### Scenario 1: Normal page
1. Load page with cursor enabled
2. Move mouse around — cursor should be above all content
3. Hover links, buttons — interactions work through cursor (pointer-events: none)

### Scenario 2: Sticky header
1. Page with sticky header (z-index typically 999-99999)
2. Scroll down — cursor should appear above header
3. If header has z-index > 999999, cursor goes behind — acceptable trade-off

### Scenario 3: Modal/popup
1. Open Elementor popup
2. Cursor should appear inside popup (moveCursorToPopup)
3. Close popup — cursor returns to body (moveCursorToBody)

### Scenario 4: Blend mode
1. Enable blend mode (soft/medium/strong)
2. Cursor should blend with page content
3. Move over different colored areas — blend effect visible
4. Elements with z-index 10000+ may appear above cursor — acceptable

### Scenario 5: WP Admin bar
1. Log in as admin (admin bar visible)
2. Cursor should NOT appear above admin bar
3. Admin bar clickable normally

### Scenario 6: User override
1. Add custom CSS: `#cmsm-cursor-container { --cmsm-cursor-z-default: 99; }`
2. Cursor should appear behind most elements
3. Confirms custom property override works
