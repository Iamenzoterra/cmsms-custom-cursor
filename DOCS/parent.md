# Use Parent Cursor — How It Works

## Overview

The "Use Parent Cursor" switcher (`cmsmasters_cursor_inherit_parent`) makes an Elementor element **transparent** for cursor type cascade. It does not define its own cursor type — instead it inherits from the nearest ancestor that has one. Optionally overrides **blend mode** and **animation effect** only.

---

## Controls (module.php)

| Control ID | Type | Purpose |
|---|---|---|
| `cmsmasters_cursor_inherit_parent` | Switcher | Enable inherit mode |
| `cmsmasters_cursor_inherit_blend` | Select | Override blend: `""` (Global), `off`, `soft`, `medium`, `strong` |
| `cmsmasters_cursor_inherit_effect` | Select | Override effect: `""` (Global), `none`, `wobble`, `pulse`, `shake`, `buzz` |

Both override controls are visible only when the switcher is ON.

### PHP output (apply_cursor_attributes)

When inherit is enabled, PHP outputs minimal attributes and does **early return** — no other cursor attributes are rendered:

```html
<div data-cursor-inherit="yes"
     data-cursor-inherit-blend="soft"
     data-cursor-inherit-effect="shake">
```

If blend or effect are empty (Default/Global), the corresponding attribute is **not rendered**.

---

## JavaScript Logic (custom-cursor.js)

### Two-phase detection

1. **Find cursor TYPE** — walks up from hovered element, skipping inherit elements (they're transparent)
2. **Find override VALUES** — `findClosestInheritEl(el)` returns the nearest inherit element for blend/effect overrides

### Key functions

**`hasCursorTypeSettings(el)`** — returns `false` for inherit elements. They don't participate in type cascade.

**`findClosestInheritEl(startEl)`** — walks UP from `startEl` (inclusive), returns the first element with `data-cursor-inherit`. Used to read override values.

**`findWithBoundary(startEl, attrName, ...)`** — walks UP looking for cursor type attributes. Since `hasCursorTypeSettings` returns false for inherit elements, the search passes through them transparently.

### Detection flow (inside `detectCursorMode`)

```
el = elementsFromPoint(x, y)  // deepest real element under cursor
    |
    v
iconElSpecial = findWithBoundary(el, 'data-cursor-icon', null)
    // skips inherit elements → finds ancestor with actual icon cursor
    |
    v
inheritEl = findClosestInheritEl(el)
    // finds nearest inherit element from hovered el upward
    |
    v
if (inheritEl) {
    effect = inheritEl.getAttribute('data-cursor-inherit-effect')
    blend  = inheritEl.getAttribute('data-cursor-inherit-blend')
}
```

### Override application

Effect is passed into `SpecialCursorManager.activate()` via the styles config. If the icon content (key) hasn't changed, `_updateProps` updates the JS variable without DOM recreation.

Blend is resolved directly in `detectCursorMode` after the `activate` call — always re-evaluated per frame.

---

## Editor Sync (cursor-editor-sync.js)

When inherit is ON, `applySettings` sets the three data attributes and does **early return** — no other cursor settings are applied to the preview element.

`clearAttributes` removes all cursor-related attributes (including inherit ones) before re-applying, preventing stale state.

---

## Critical: DOM Structure vs Visual Boundaries

### The problem

`findClosestInheritEl` walks up the **DOM tree**, not visual boundaries. In Elementor, a widget's wrapper element (`elementor-element`) typically spans the **full width/height** of its parent container, regardless of the widget's visual content size.

### Example: Container > Container > Image

```
┌──────────────────── Grandparent Container ────────────────────┐
│  data-cursor-icon="star"                                       │
│                                                                │
│  ┌──────────────── Parent Container (inherit, buzz) ────────┐ │
│  │  10px padding                                             │ │
│  │  ┌─────── Image Widget wrapper (inherit, shake) ───────┐ │ │
│  │  │                                                      │ │ │
│  │  │   ┌──────────────────────────┐                       │ │ │
│  │  │   │                          │  ← visual image       │ │ │
│  │  │   │    [purple image.jpg]    │     (centered)        │ │ │
│  │  │   │                          │                       │ │ │
│  │  │   └──────────────────────────┘                       │ │ │
│  │  │                                                      │ │ │
│  │  │  ← this area LOOKS like "parent zone" but is        │ │ │
│  │  │    actually INSIDE the Image widget wrapper          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  10px padding ← only THIS is the real "parent zone"      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**User expectation:** The area around the visible image is "parent zone" with buzz effect.
**Reality:** The Image widget wrapper fills the entire parent container. Only the 10px padding strip is the actual parent zone.

### Verified behavior (live debug, 2026-02-13)

| Hover position | `el` from `elementsFromPoint` | `findClosestInheritEl` | Effect | Blend |
|---|---|---|---|---|
| Grandparent area (outside parent) | sibling container | `null` | wobble (from icon) | global |
| Parent 10px padding | `2e2fde8` (parent) | parent | **buzz** (correct) | null (correct) |
| Anywhere over image area | `IMG` or `db1ff0f` (child) | child | **shake** (child's) | soft (child's) |

### How to test properly

To get three clearly distinct cursor zones, use **three nested Containers** with explicit dimensions (not Container > Container > Image):

```
Container (width: 100%, icon cursor + wobble)
  └── Container (width: 80%, inherit + buzz)
        └── Container (width: 60%, inherit + shake + soft blend)
              └── [any content]
```

Each container boundary creates a real DOM zone where `findClosestInheritEl` correctly resolves.

---

## Cascade rules

1. **Inherit elements are transparent for type** — cursor type search skips them entirely
2. **Inherit overrides are local** — `findClosestInheritEl` returns the NEAREST inherit element; parent's overrides don't cascade to child
3. **No override = global default** — if inherit element doesn't set effect/blend, the value falls through to global settings (not to parent inherit's override)
4. **Only blend and effect** can be overridden — not color, size, rotation, or other properties

### Example cascade

```
Section (data-cursor-icon="star", data-cursor-icon-effect="wobble")
  ├── Container A (data-cursor-inherit="yes", data-cursor-inherit-effect="pulse")
  │     → icon: star, effect: pulse, blend: global
  │
  │     └── Container B (data-cursor-inherit="yes", data-cursor-inherit-effect="shake", data-cursor-inherit-blend="soft")
  │           → icon: star, effect: shake, blend: soft
  │           (pulse from Container A does NOT cascade here)
  │
  └── Container C (data-cursor-inherit="yes")
        → icon: star, effect: global default, blend: global
        (no override set = falls through to global, not to Section's wobble)
```

---

## Limitations

- Only blend and effect can be overridden (not color, size, rotation)
- When inherit is ON, all other cursor controls are hidden via Elementor conditions
- Inherit works on **DOM boundaries**, not visual boundaries — widget wrappers are larger than their visible content
- Parent inherit overrides do NOT cascade to child inherit elements — each level is independent
