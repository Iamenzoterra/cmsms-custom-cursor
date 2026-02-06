# TASK-PHASE3: Special Cursor Lifecycle Manager

**Priority:** MEDIUM
**Risk:** MEDIUM — touches detectCursorMode() heavily, render() UNTOUCHED
**File:** `assets/lib/custom-cursor/custom-cursor.js`
**Fixes:** MEM-004 (special cursor element accumulation)

---

## Problem

6 separate create/remove functions with no coordination:
- `createImageCursor()` / `removeImageCursor()`
- `createTextCursor()` / `removeTextCursor()`
- `createIconCursor()` / `removeIconCursor()`

In `detectCursorMode()`, every special cursor block manually removes the other two types before creating its own. 4 blocks × 3 remove calls = massive duplication.

**MEM-004:** Rapid hover transitions can cause DOM element accumulation because there's no guard against creating a cursor of the same type that's already active.

---

## Solution

Add `SpecialCursorManager` object that wraps existing create/remove functions.
Then simplify detectCursorMode() to use Manager calls instead of manual cross-removal.

**Key constraint:** render() is NOT touched. It keeps reading the same closure-level variables (`imageCursorEl`, `textCursorEl`, `iconCursorEl`, etc.). Manager writes to those same variables via the existing create/remove functions.

---

## Step 1: Add SpecialCursorManager Object

**WHERE:** After CursorState object (after line ~399), before the `isWobbleEnabled()` function.

**INSERT:**

```javascript
// === SPECIAL CURSOR LIFECYCLE MANAGER (Phase 3 — MEM-004 fix) ===
// Coordinates create/remove of image/text/icon cursors.
// Prevents accumulation by deduplication and atomic cleanup.
// render() continues reading closure-level vars directly.
var SpecialCursorManager = {
    _type: null,
    _key: null,

    activate: function(type, config) {
        var key = this._makeKey(type, config);
        if (this._type === type && this._key === key) {
            return;
        }
        if (this._type) {
            this._removeCurrentType();
        }
        switch (type) {
            case 'image':
                createImageCursor(config.src);
                imageCursorSize = config.size || 64;
                imageCursorSizeHover = config.sizeHover || config.size || 64;
                imageCursorRotate = config.rotate || 0;
                imageCursorRotateHover = config.rotateHover || 0;
                isImageCursorHover = false;
                imageCursorEffect = config.effect || '';
                imageEffectTime = 0;
                break;
            case 'text':
                createTextCursor(config.content, config.styles);
                textCursorContent = config.content;
                textCursorStyles = config.styles;
                textCursorEffect = config.effect || '';
                textEffectTime = 0;
                break;
            case 'icon':
                createIconCursor(config.content, config.styles);
                iconCursorContent = config.content;
                iconCursorStyles = config.styles;
                isIconCursorHover = false;
                iconCursorEffect = config.effect || '';
                iconEffectTime = 0;
                iconCurrentSize = config.styles.size || 32;
                iconCurrentRotate = config.styles.rotate || 0;
                iconSizeVelocity = 0;
                iconRotateVelocity = 0;
                break;
        }
        hideDefaultCursor();
        this._type = type;
        this._key = key;
    },

    deactivate: function() {
        if (!this._type) {
            return;
        }
        this._removeCurrentType();
        showDefaultCursor();
        this._type = null;
        this._key = null;
    },

    getActive: function() {
        return this._type;
    },

    isActive: function() {
        return this._type !== null;
    },

    _removeCurrentType: function() {
        switch (this._type) {
            case 'image': removeImageCursor(); break;
            case 'text': removeTextCursor(); break;
            case 'icon': removeIconCursor(); break;
        }
    },

    _makeKey: function(type, config) {
        switch (type) {
            case 'image': return config.src;
            case 'text': return config.content;
            case 'icon': return config.content;
            default: return '';
        }
    }
};
```

---

## Step 2: Refactor detectCursorMode() — IMAGE Block

**FIND the IMAGE CURSOR block** (grep for the comment near line ~1224).

**BEFORE** (approximate — CC MUST grep to find exact boundaries):

```javascript
// IMAGE CURSOR
// ... 60+ lines that:
// 1. removeTextCursor()
// 2. removeIconCursor()
// 3. Extract src, size, sizeHover, rotate, rotateHover, effect from data attributes
// 4. Check if imageCursorSrc !== src (dedup)
// 5. createImageCursor(src)
// 6. Set imageCursorSize, imageCursorSizeHover, etc.
// 7. hideDefaultCursor()
// 8. setBlendIntensity(...)
```

**AFTER:**

```javascript
// IMAGE CURSOR
var imgSrc = cursorImageEl.getAttribute('data-cursor-image');
var imgSize = parseFloat(cursorImageEl.getAttribute('data-cursor-image-size')) || 64;
var imgSizeHover = parseFloat(cursorImageEl.getAttribute('data-cursor-image-size-hover')) || imgSize;
var imgRotate = parseFloat(cursorImageEl.getAttribute('data-cursor-image-rotate')) || 0;
var imgRotateHover = parseFloat(cursorImageEl.getAttribute('data-cursor-image-rotate-hover')) || 0;
var imgEffect = cursorImageEl.getAttribute('data-cursor-image-effect') || '';

SpecialCursorManager.activate('image', {
    src: imgSrc,
    size: imgSize,
    sizeHover: imgSizeHover,
    rotate: imgRotate,
    rotateHover: imgRotateHover,
    effect: imgEffect
});

setBlendIntensity(cursorImageEl.getAttribute('data-cursor-blend') || currentBlend);
```

**⚠️ IMPORTANT:** CC must grep the actual attribute names from the BEFORE code. The names above (`data-cursor-image-size`, etc.) are from docs — verify against actual code. The variable `cursorImageEl` is the element found by `findWithBoundary()` earlier in the function — CC must use the same variable name as existing code.

---

## Step 3: Refactor detectCursorMode() — TEXT Block

**FIND the TEXT CURSOR block** (grep near line ~1288).

**AFTER pattern:**

```javascript
// TEXT CURSOR
var txtContent = cursorTextEl.getAttribute('data-cursor-text');
var txtStyles = {
    // CC: copy the exact style extraction from BEFORE code
    // typography, color, bgColor, fitCircle, circleSpacing, borderRadius, padding
};
var txtEffect = cursorTextEl.getAttribute('data-cursor-text-effect') || '';

SpecialCursorManager.activate('text', {
    content: txtContent,
    styles: txtStyles,
    effect: txtEffect
});

setBlendIntensity(cursorTextEl.getAttribute('data-cursor-blend') || currentBlend);
```

**⚠️ CC:** The style extraction for text is complex (~20 lines for typography, colors, fit-circle). Copy that logic verbatim from the existing block. Only the remove/create/hide calls change.

---

## Step 4: Refactor detectCursorMode() — ICON Block

**FIND the ICON CURSOR block** (grep near line ~1369).

**AFTER pattern:**

```javascript
// ICON CURSOR
var icnContent = cursorIconEl.getAttribute('data-cursor-icon');
var icnStyles = {
    // CC: copy the exact style extraction from BEFORE code
    // color, bgColor, preserveColors, size, sizeHover, rotate, rotateHover, fitCircle, circleSpacing
};
var icnEffect = cursorIconEl.getAttribute('data-cursor-icon-effect') || '';

SpecialCursorManager.activate('icon', {
    content: icnContent,
    styles: icnStyles,
    effect: icnEffect
});

setBlendIntensity(cursorIconEl.getAttribute('data-cursor-blend') || currentBlend);
```

---

## Step 5: Refactor detectCursorMode() — RESTORE Block

**FIND the restore/default block** (grep near line ~1449, after all special blocks, where it removes all three and shows default).

**BEFORE:**
```javascript
removeImageCursor();
removeTextCursor();
removeIconCursor();
showDefaultCursor();
```

**AFTER:**
```javascript
SpecialCursorManager.deactivate();
```

---

## Step 6: Update mouseover handler — hover state

**FIND in mouseover handler** (~line 1793+) where `isImageCursorHover` and `isIconCursorHover` are set to true.

These hover flags are read by render() for spring animation targets. They should remain as-is — Manager doesn't manage hover toggling, only lifecycle.

**NO CHANGES needed here.** Just verify the flags still work after refactor.

---

## Step 7: Update mouseout handler — hover state reset

**FIND in mouseout handler** (~line 1858+) where hover flags are reset.

**NO CHANGES needed.** Same reasoning as Step 6.

---

## What NOT to Change

| Area | Why |
|------|-----|
| `render()` function | Reads same closure vars, no interface change |
| `createImageCursor()` function body | Manager wraps it, doesn't replace it |
| `createTextCursor()` function body | Same |
| `createIconCursor()` function body | Same |
| `removeImageCursor()` function body | Same |
| `removeTextCursor()` function body | Same |
| `removeIconCursor()` function body | Same |
| `showDefaultCursor()` / `hideDefaultCursor()` | Called by Manager internally |
| Wobble/spring variables declarations | Still closure-level vars |
| mouseover/mouseout handlers | Hover flags managed separately |

---

## Verification (CC Must Do)

### Before coding:

```bash
# Find exact IMAGE block boundaries in detectCursorMode
grep -n "IMAGE CURSOR\|removeTextCursor\|removeIconCursor\|createImageCursor\|hideDefaultCursor" assets/lib/custom-cursor/custom-cursor.js

# Find exact TEXT block boundaries
grep -n "TEXT CURSOR\|removeImageCursor\|createTextCursor" assets/lib/custom-cursor/custom-cursor.js

# Find exact ICON block boundaries
grep -n "ICON CURSOR\|createIconCursor" assets/lib/custom-cursor/custom-cursor.js

# Find restore/default block
grep -n "showDefaultCursor" assets/lib/custom-cursor/custom-cursor.js

# Find data attribute names used in detection
grep -n "data-cursor-image\|data-cursor-text\|data-cursor-icon" assets/lib/custom-cursor/custom-cursor.js

# Find what variable name holds the found element in each block
grep -n "cursorImageEl\|cursorTextEl\|cursorIconEl\|imageFoundEl\|textFoundEl\|iconFoundEl\|closestImage\|closestText\|closestIcon" assets/lib/custom-cursor/custom-cursor.js
```

### After coding:

```bash
# Verify no orphan remove calls remain in detectCursorMode
grep -n "removeImageCursor\|removeTextCursor\|removeIconCursor" assets/lib/custom-cursor/custom-cursor.js
# Expected: only inside SpecialCursorManager._removeCurrentType() and inside the original remove* function bodies

# Verify Manager is used
grep -n "SpecialCursorManager" assets/lib/custom-cursor/custom-cursor.js
# Expected: object definition + 4-5 calls in detectCursorMode

# Verify no stale hideDefaultCursor calls in detection blocks
grep -n "hideDefaultCursor" assets/lib/custom-cursor/custom-cursor.js
# Expected: function definition + inside SpecialCursorManager.activate() only

# Verify render() is untouched — check for imageCursorEl/textCursorEl/iconCursorEl reads
grep -n "imageCursorEl\|textCursorEl\|iconCursorEl" assets/lib/custom-cursor/custom-cursor.js
# Expected: same count as before

# Build
npm run build
```

---

## Acceptance Criteria

1. ✅ `SpecialCursorManager` object exists after CursorState
2. ✅ detectCursorMode() uses `SpecialCursorManager.activate()` / `.deactivate()` instead of manual remove/create chains
3. ✅ No duplicate DOM elements when rapidly hovering between different special cursor zones
4. ✅ Same cursor type + same key = no DOM recreation (dedup)
5. ✅ Switching image→text→icon works correctly
6. ✅ Returning to default (no special) works correctly
7. ✅ All 4 effects (wobble, pulse, shake, buzz) still work on all 3 special cursor types
8. ✅ Spring animation on icon cursor works (size/rotate transitions)
9. ✅ Image cursor size/rotate hover works
10. ✅ `npm run build` succeeds

---

## Agent Invocation Plan

1. **code-quality** — verify Manager pattern consistency
2. **memory-guardian** — verify MEM-004 is fixed (no element accumulation)
3. **render-engine** — verify render() reads are unaffected
4. **doc-keeper** — update DOCS after implementation

---

## Risk Mitigation

If anything breaks in render():
1. Check that create* functions still assign to the same closure vars
2. Check that Manager doesn't reset vars that render() needs mid-frame
3. Spring velocity reset on type switch is intentional — prevents momentum carryover

If dedup is too aggressive (cursor doesn't update when attributes change on same element):
1. Expand `_makeKey()` to include more config fields
2. Or add `force` parameter: `SpecialCursorManager.activate(type, config, true)`

---

## Notes for CC

- Line numbers in this TASK are from docs, which drift after edits. Always grep to find actual locations.
- The variable assignments inside `activate()` (e.g., `imageCursorSize = config.size`) mirror what the current detectCursorMode() blocks do AFTER calling create*. These MUST match exactly.
- `createImageCursor(src)` only creates the DOM element. The size/rotate/effect vars are set separately in the detection block. Manager consolidates both.
- `_makeKey` uses content-based dedup. If user changes size but not src on an image cursor, the key matches and DOM isn't recreated — BUT the size vars ARE updated because `activate()` always sets them. Only the DOM creation is skipped.

Wait — that's wrong. If key matches, `activate()` returns early and vars DON'T update. Fix:

**CORRECTION to activate():**

```javascript
activate: function(type, config) {
    var key = this._makeKey(type, config);
    if (this._type === type && this._key === key) {
        // Same cursor identity — just update mutable props without DOM recreation
        this._updateProps(type, config);
        return;
    }
    // ... rest of activate
},

_updateProps: function(type, config) {
    switch (type) {
        case 'image':
            imageCursorSize = config.size || 64;
            imageCursorSizeHover = config.sizeHover || config.size || 64;
            imageCursorRotate = config.rotate || 0;
            imageCursorRotateHover = config.rotateHover || 0;
            imageCursorEffect = config.effect || '';
            break;
        case 'text':
            textCursorEffect = config.effect || '';
            break;
        case 'icon':
            iconCursorStyles = config.styles;
            iconCursorEffect = config.effect || '';
            break;
    }
}
```

This way: same src → no DOM rebuild, but size/rotate/effect CAN change.
