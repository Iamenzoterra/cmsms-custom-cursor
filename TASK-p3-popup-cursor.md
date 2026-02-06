# TASK: P3 — Popup Cursor Fix

**Type:** Bug fix (JS only)
**Target file:** `assets/lib/custom-cursor/custom-cursor.js`
**Priority:** MEDIUM — cursor doesn't work in Elementor popups
**Risk:** LOW — small conditional change in detection logic
**Estimated scope:** ~5 lines added

---

## Problem

Custom cursor shows SYSTEM cursor inside Elementor popups.

### Root Cause

Two systems conflict:

1. **`moveCursorToPopup(el)`** — MutationObserver detects popup open → physically moves `#cmsm-cursor-container` inside popup DOM. This makes cursor visible in popup's stacking context. ✅ Works correctly.

2. **P4 v2 detection** — `detectCursorMode()` and `mouseover` handler see `role="dialog"` or `aria-modal="true"` on the popup → hide cursor. ❌ Defeats the purpose of step 1.

P4 v2 hides the cursor that `moveCursorToPopup()` just made visible.

### Detection flow (current)

```
User opens popup
  → MutationObserver fires
  → moveCursorToPopup() moves container into popup ✅
  → User moves mouse inside popup
  → detectCursorMode() runs
  → Finds role="dialog" on popup element
  → CursorState.transition({ hidden: true }) ← THIS IS THE BUG
  → Cursor hidden, user sees system cursor
```

---

## Solution

**When cursor container is already inside a popup, skip `role="dialog"` and `aria-modal="true"` detection.**

The cursor container's `parentNode` tells us if we're in a popup:
- `container.parentNode === document.body` → normal page, P4 v2 applies fully
- `container.parentNode !== document.body` → inside popup, skip dialog/modal hide

### What to add

A helper variable to check popup context:

```javascript
var isInsidePopup = container.parentNode !== document.body;
```

This check should be added in **two places**:

### Place 1: `detectCursorMode()` — P4 v2 detection block

Find the P4 v2 forms/popups detection (currently around line ~678-689). It checks for `role="dialog"` and `aria-modal="true"`.

```javascript
// BEFORE — always hides on dialog/modal
if (el.matches('[role="dialog"]') || el.matches('[aria-modal="true"]')) {
    CursorState.transition({ hidden: true }, 'form-detect');
    return;
}

// AFTER — skip dialog/modal check when cursor is already inside popup
var isInsidePopup = container.parentNode !== document.body;
if (!isInsidePopup && (el.matches('[role="dialog"]') || el.matches('[aria-modal="true"]'))) {
    CursorState.transition({ hidden: true }, 'form-detect');
    return;
}
```

Keep ALL other P4 v2 checks unchanged:
- `<select>` → still hide (even in popup)
- `<input>` → still hide (even in popup)
- `role="listbox/combobox/menu"` → still hide (these are dropdowns, not the popup itself)

### Place 2: `mouseover` handler — P4 v2 instant detection

Find the mouseover handler that also checks for dialog/modal elements (currently around line ~1973-1995). Apply the same guard:

```javascript
// BEFORE
if (t.matches('[role="dialog"]') || t.closest('[aria-modal="true"]')) {
    CursorState.transition({ hidden: true }, 'mouseover-form');
}

// AFTER
var isInsidePopup = container.parentNode !== document.body;
if (!isInsidePopup && (t.matches('[role="dialog"]') || t.closest('[aria-modal="true"]'))) {
    CursorState.transition({ hidden: true }, 'mouseover-form');
}
```

---

## Why This Is Safe

1. **Forms inside popup still hide** — `<select>`, `<input>`, `role="listbox"` checks are untouched
2. **`moveCursorToPopup()` already handles the stacking** — cursor is physically inside popup DOM
3. **`moveCursorToBody()` reverses on close** — when popup closes, container returns to body, `isInsidePopup` becomes false, P4 v2 resumes fully
4. **No new variables or state** — `container` and `document.body` already exist in scope
5. **CursorState handles class cleanup** — when popup closes and cursor returns to body, state resets naturally

---

## What NOT to change

| Item | Why leave it |
|---|---|
| `moveCursorToPopup()` / `moveCursorToBody()` | Working correctly |
| MutationObserver for popup detection | Working correctly |
| `<select>` / `<input>` hide logic | Forms should still hide in popup |
| `role="listbox/combobox/menu"` hide | Dropdowns should still hide in popup |
| `<video>` / `<iframe>` hide (P5) | Still correct inside popups |

---

## Implementation Steps

### Step 1: Read current detection code
```bash
# Find P4 v2 detection in detectCursorMode
grep -n 'role="dialog"\|aria-modal' assets/lib/custom-cursor/custom-cursor.js
```

### Step 2: Add popup context check
Add `var isInsidePopup = container.parentNode !== document.body;` guard before dialog/modal checks in both locations.

### Step 3: Verify
```bash
# Should show exactly 2 places with isInsidePopup check
grep -n 'isInsidePopup' assets/lib/custom-cursor/custom-cursor.js
```

### Step 4: Build
```
npm run build
```

---

## Agent Invocation Plan

| Order | Agent | Why |
|---|---|---|
| 1 | 🔒 **security-sentinel** | Verify no new security paths |
| 2 | 🎨 **css-compat** | Verify CursorState transitions still correct |
| 3 | 📖 **doc-keeper** | Update 03-BACKLOG (P3 resolved), 04-KNOWN-ISSUES, 02-CHANGELOG |

---

## Acceptance Criteria

### Functional
- [ ] Open Elementor popup → custom cursor visible and working inside popup
- [ ] Hover links/buttons inside popup → cursor hover state works
- [ ] Click inside popup → cursor down state works
- [ ] Form input inside popup → cursor hides (system cursor for forms)
- [ ] Close popup → cursor returns to normal page behavior
- [ ] Non-popup dialog elements on page → cursor still hides (P4 v2 intact)
- [ ] Video/iframe inside popup → cursor hides (P5 intact)

### Structural
- [ ] Only `role="dialog"` and `aria-modal` checks modified
- [ ] All other P4 v2 checks (`<select>`, `<input>`, `role="listbox"` etc.) unchanged
- [ ] No new state variables in CursorState
- [ ] `moveCursorToPopup()` and `moveCursorToBody()` untouched

---

## Test Scenarios

### Scenario 1: Elementor popup basic
1. Page with Elementor popup trigger button
2. Click button → popup opens
3. Move mouse inside popup → custom cursor should work
4. Hover links/buttons → hover state
5. Close popup → cursor back to normal

### Scenario 2: Form inside popup
1. Open popup that contains a contact form
2. Move over text content → custom cursor works
3. Move over `<input>` → cursor hides (system cursor)
4. Move back to text → custom cursor returns
5. Move over `<select>` → cursor hides

### Scenario 3: Regular dialog on page (not popup)
1. Page with `role="dialog"` element (NOT Elementor popup)
2. Container should be in body (not inside dialog)
3. Hover dialog → cursor should hide (P4 v2 works normally)

### Scenario 4: Popup with video
1. Open popup with embedded video
2. Move over text → custom cursor
3. Move over video/iframe → cursor hides (P5)
4. Move back → custom cursor returns
