# TASK-FIX-FORMS: Form Cursor Detection Fixes

**Priority:** HIGH — user-facing bug on production
**Risk:** LOW — modifying existing detection logic, same pattern
**File:** `assets/lib/custom-cursor/custom-cursor.js`
**Fixes:** 3 bugs in P4 v2 form detection

---

## Bugs

### Bug 1: Flickering between form fields
**Symptom:** Cursor rapidly toggles show/hide when moving between inputs in a form.
**Cause:** Detection checks individual `<input>` and `<select>`, not the `<form>` container. Moving from input → label → input causes hide → show → hide.

### Bug 2: `<textarea>` not detected
**Symptom:** Custom cursor shows over textarea fields.
**Cause:** TEXTAREA was simply not included in the detection list.

### Bug 3: mouseout asymmetry
**Symptom:** Cursor stays hidden after leaving role-based elements (datepicker, dialog).
**Cause:** mouseover hides cursor for both tags AND roles. But mouseout only checks `SELECT` and `INPUT` tags — role-based elements never trigger restore.

---

## Solution

### Strategy: isFormZone() helper

Extract a reusable function that checks if an element is inside a "form zone". Use it symmetrically in all 3 detection blocks.

A "form zone" is:
- The element IS a form field: `SELECT`, `INPUT` (not submit/button), `TEXTAREA`
- The element is INSIDE a `<form>` tag (covers gaps between fields)
- The element matches a role-based widget: `[role="listbox"]`, `[role="combobox"]`, `[role="menu"]`, `[role="dialog"]`, `[aria-modal="true"]`
- The element is INSIDE a datepicker: `.air-datepicker`, `.flatpickr-calendar`, `.daterangepicker`, `.ui-datepicker`

---

## Step 1: Add isFormZone() helper

**WHERE:** After pure effect functions, before render(). Near the other helper functions like `isWobbleEnabled()`.

```javascript
// Form zone detection — used by P4 v2 auto-hide in 3 places.
// Returns true if element is inside a form/popup zone where custom cursor should hide.
function isFormZone(el) {
    if (!el || !el.tagName) return false;

    var tag = el.tagName;

    // Direct form elements
    if (tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (tag === 'INPUT' && el.type !== 'submit' && el.type !== 'button') return true;

    // Inside a <form> container — covers gaps between fields (labels, spacing divs)
    if (el.closest && el.closest('form')) return true;

    // Role-based widgets (dropdowns, dialogs, datepickers)
    if (el.closest && (
        el.closest('[role="listbox"]') ||
        el.closest('[role="combobox"]') ||
        el.closest('[role="menu"]') ||
        el.closest('[role="dialog"]') ||
        el.closest('[aria-modal="true"]') ||
        el.closest('.air-datepicker') ||
        el.closest('.flatpickr-calendar') ||
        el.closest('.daterangepicker') ||
        el.closest('.ui-datepicker')
    )) return true;

    return false;
}
```

---

## Step 2: Refactor detectCursorMode() P4 block

**FIND:** Lines ~1425-1439 (the P4 v2 block in detectCursorMode).

**BEFORE:**
```javascript
// P4 v2: Auto-hide cursor on forms/popups (graceful degradation)
// Forms and popups create stacking contexts that break cursor z-index.
// Instead of fighting CSS, we hide custom cursor and let system cursor work.
if (el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' && el.type !== 'submit' && el.type !== 'button') ||
    (el.closest && (
        el.closest('[role="listbox"]') ||
        el.closest('[role="combobox"]') ||
        el.closest('[role="menu"]') ||
        el.closest('[role="dialog"]') ||
        el.closest('[aria-modal="true"]')
    ))) {
    CursorState.transition({ hidden: true }, 'detectCursorMode:forms');
    return;
}
```

**AFTER:**
```javascript
// P4 v2: Auto-hide cursor on forms/popups (graceful degradation)
if (isFormZone(el)) {
    CursorState.transition({ hidden: true }, 'detectCursorMode:forms');
    return;
}
```

---

## Step 3: Refactor mouseover P4 block

**FIND:** Lines ~2238-2251 (the P4 v2 block in mouseover).

**BEFORE:**
```javascript
// P4 v2: Auto-hide cursor on forms/popups (immediate response)
// This provides instant feedback when entering form elements
if (t.tagName === 'SELECT' ||
    (t.tagName === 'INPUT' && t.type !== 'submit' && t.type !== 'button') ||
    (t.closest && (
        t.closest('[role="listbox"]') ||
        t.closest('[role="combobox"]') ||
        t.closest('[role="menu"]') ||
        t.closest('[role="dialog"]') ||
        t.closest('[aria-modal="true"]')
    ))) {
    CursorState.transition({ hidden: true }, 'mouseover:forms');
    return;
}
```

**AFTER:**
```javascript
// P4 v2: Auto-hide cursor on forms/popups (immediate response)
if (isFormZone(t)) {
    CursorState.transition({ hidden: true }, 'mouseover:forms');
    return;
}
```

---

## Step 4: Fix mouseout P4 block (THE CRITICAL FIX)

**FIND:** Lines ~2277-2291 (the P4 v2 block in mouseout).

**BEFORE:**
```javascript
// P4 v2: Restore cursor when leaving form elements
// Only restore if moving to non-form element
if (t.tagName === 'SELECT' || t.tagName === 'INPUT') {
    var related = e.relatedTarget;
    if (!related || (related.tagName !== 'SELECT' && related.tagName !== 'INPUT' &&
        (!related.closest || (
            !related.closest('[role="listbox"]') &&
            !related.closest('[role="combobox"]') &&
            !related.closest('[role="menu"]') &&
            !related.closest('[role="dialog"]') &&
            !related.closest('[aria-modal="true"]')
        )))) {
        CursorState.transition({ hidden: false }, 'mouseout:forms');
    }
}
```

**AFTER:**
```javascript
// P4 v2: Restore cursor when leaving form zone
// Only restore if moving to a non-form element
if (isFormZone(t)) {
    var related = e.relatedTarget;
    if (!related || !isFormZone(related)) {
        CursorState.transition({ hidden: false }, 'mouseout:forms');
    }
}
```

This fixes all 3 bugs:
1. **mouseout now triggers for ALL form zone elements** — not just SELECT/INPUT (fixes asymmetry)
2. **relatedTarget check uses same isFormZone()** — moving from input to label inside same form stays hidden (fixes flickering)
3. **TEXTAREA is included** via isFormZone()

---

## Step 5: Add debugLog calls

```javascript
function isFormZone(el) {
    if (!el || !el.tagName) return false;
    // ... detection logic ...
    // At end, before each return true:
    debugLog('event', 'Form zone: ' + el.tagName + (el.closest && el.closest('form') ? ' (inside form)' : ''));
    return true;
}
```

**Actually, better pattern — single log point:**

```javascript
function isFormZone(el) {
    if (!el || !el.tagName) return false;

    var tag = el.tagName;
    var reason = '';

    if (tag === 'SELECT' || tag === 'TEXTAREA') {
        reason = tag;
    } else if (tag === 'INPUT' && el.type !== 'submit' && el.type !== 'button') {
        reason = 'INPUT[' + el.type + ']';
    } else if (el.closest && el.closest('form')) {
        reason = 'inside <form>';
    } else if (el.closest && (
        el.closest('[role="listbox"]') ||
        el.closest('[role="combobox"]') ||
        el.closest('[role="menu"]') ||
        el.closest('[role="dialog"]') ||
        el.closest('[aria-modal="true"]') ||
        el.closest('.air-datepicker') ||
        el.closest('.flatpickr-calendar') ||
        el.closest('.daterangepicker') ||
        el.closest('.ui-datepicker')
    )) {
        reason = 'role/datepicker';
    }

    if (reason) {
        debugLog('event', 'Form zone hit: ' + reason);
        return true;
    }
    return false;
}
```

---

## What NOT to Change

| Area | Why |
|------|-----|
| P5 video/iframe detection | Different mechanism, working fine |
| CSS datepicker exclusions | Keep as-is — CSS and JS complement each other |
| detectCursorMode() structure | Only replacing the P4 block content |
| render() | No touch |
| data-cursor="hide" detection | Separate from P4, working fine |

---

## Verification

### Before coding:

```bash
# Confirm exact line numbers
grep -n "P4 v2\|isFormZone\|tagName.*SELECT\|tagName.*INPUT\|mouseout:forms\|mouseover:forms" assets/lib/custom-cursor/custom-cursor.js
```

### After coding:

```bash
# Verify isFormZone exists
grep -n "function isFormZone" assets/lib/custom-cursor/custom-cursor.js

# Verify all 3 blocks use isFormZone
grep -n "isFormZone" assets/lib/custom-cursor/custom-cursor.js
# Expected: function definition + 4 calls (detectCursorMode, mouseover, mouseout trigger, mouseout relatedTarget)

# Verify no old inline detection remains
grep -n "t\.tagName === .SELECT.\|el\.tagName === .SELECT." assets/lib/custom-cursor/custom-cursor.js
# Expected: NONE (all replaced by isFormZone)

# Verify TEXTAREA is detected
grep -n "TEXTAREA" assets/lib/custom-cursor/custom-cursor.js
# Expected: inside isFormZone

# Verify form container detection
grep -n "closest.*form\|closest('form')" assets/lib/custom-cursor/custom-cursor.js
# Expected: inside isFormZone

# Build
npm run build
```

---

## Acceptance Criteria

1. ✅ `isFormZone()` helper function exists
2. ✅ All 3 P4 blocks (detectCursorMode, mouseover, mouseout) use `isFormZone()`
3. ✅ `<textarea>` hides cursor
4. ✅ Elements inside `<form>` hide cursor (labels, divs between inputs)
5. ✅ No flickering when moving between form fields inside a `<form>`
6. ✅ Cursor restores when leaving a form zone (mouseout symmetry fixed)
7. ✅ Datepicker popups hide cursor (via `.air-datepicker` etc. in isFormZone)
8. ✅ Cursor restores when datepicker closes and mouse moves out
9. ✅ `submit` and `button` inputs still show custom cursor
10. ✅ `npm run build` succeeds

---

## Testing Scenarios

1. **Forminator form:** Move mouse across Name → Email → Phone → Textarea → Submit. Cursor should be consistently hidden inside form, visible on Submit button, visible outside form.

2. **Datepicker:** Click date input → datepicker opens → move mouse to datepicker → cursor stays hidden → close datepicker → move to normal page → cursor restores.

3. **Isolated input (no form tag):** Single `<input>` without `<form>` wrapper → cursor hides on input, restores on leave.

4. **Dialog/modal:** Enter `[role="dialog"]` → cursor hides → leave dialog → cursor restores (was broken before).

5. **Submit button inside form:** Cursor should STAY custom on submit buttons even inside a form zone.

---

## Notes for CC

- `isFormZone()` calls `el.closest()` which traverses DOM upward. This is fine in event handlers (not 60fps). It's already used in the current code.
- The `submit`/`button` exception for INPUT stays in isFormZone — these are action buttons, not text fields. Users expect custom cursor on them.
- Datepicker classes in isFormZone complement the existing CSS exclusions. CSS handles `cursor: pointer !important` on cells. JS handles hiding the custom cursor element. Both are needed.
- The `closest('form')` check means ANY element inside a `<form>` will trigger hide. This is intentional — labels, helper text, spacing divs between fields should all keep the cursor hidden to prevent flickering.

## ⚠️ EDGE CASE: Submit button inside form

`isFormZone()` with `closest('form')` will return true for submit buttons too! But we exclude `INPUT[submit]` and `INPUT[button]` in the tag check.

Problem: a submit `<input>` → isFormZone checks tag → INPUT + type=submit → skips that check → falls through to `closest('form')` → returns true → cursor hidden on submit button!

**Fix:** Add submit/button exclusion BEFORE the form container check:

```javascript
function isFormZone(el) {
    if (!el || !el.tagName) return false;

    var tag = el.tagName;

    // Submit/button inputs and <button> elements — NOT form zones (user expects custom cursor)
    if (tag === 'BUTTON') return false;
    if (tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) return false;

    // Direct form elements
    if (tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') return true;  // remaining input types (text, email, date, etc.)

    // Inside a <form> container — covers gaps between fields
    if (el.closest && el.closest('form')) return true;

    // Role-based widgets
    if (el.closest && (
        el.closest('[role="listbox"]') ||
        el.closest('[role="combobox"]') ||
        el.closest('[role="menu"]') ||
        el.closest('[role="dialog"]') ||
        el.closest('[aria-modal="true"]') ||
        el.closest('.air-datepicker') ||
        el.closest('.flatpickr-calendar') ||
        el.closest('.daterangepicker') ||
        el.closest('.ui-datepicker')
    )) return true;

    return false;
}
```

**USE THIS VERSION** — it handles the submit button edge case correctly.
