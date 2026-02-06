# Test Plan: Form Cursor Detection Fix

**Version:** 5.6
**Date:** February 6, 2026
**File:** `assets/lib/custom-cursor/custom-cursor.js`
**Fix:** isFormZone() helper + 3 P4 block refactors

---

## Fix Summary

### What Changed

1. **Added `isFormZone()` helper** (line ~897)
   - Centralized form zone detection logic
   - Symmetric hide/restore behavior
   - Returns `true` if element should hide custom cursor

2. **Refactored 3 P4 blocks** to use `isFormZone()`:
   - `detectCursorMode()` (line ~1467)
   - `mouseover` event handler (line ~2270)
   - `mouseout` event handler (line ~2301)

3. **Bug fixes included:**
   - TEXTAREA detection (was missing)
   - Form container detection via `closest('form')` (prevents flickering)
   - Submit/button exception (custom cursor stays on action buttons)
   - Datepicker class detection (air-datepicker, flatpickr, etc.)
   - **mouseout asymmetry** — now checks ALL form zones, not just SELECT/INPUT

---

## Test Environment

### Prerequisites
- [ ] Fresh browser cache (Ctrl+Shift+Del)
- [ ] `npm run build` completed successfully
- [ ] DevTools Console open (watch for errors)
- [ ] Debug mode enabled: `window.CMSM_DEBUG = true;`
- [ ] Test page has cursor enabled with visible dot/ring

### Test Pages
1. Page with Forminator/CF7 contact form
2. Page with WooCommerce product (date picker)
3. Page with isolated form elements (no `<form>` wrapper)
4. Page with modal/dialog containing forms

---

## Core Scenarios

### 1. Input Field Hiding

| # | Test | Expected | Pass |
|---|------|----------|------|
| 1.1 | Hover over `<input type="text">` | Custom cursor hides, system I-beam shows | [ ] |
| 1.2 | Hover over `<input type="email">` | Custom cursor hides | [ ] |
| 1.3 | Hover over `<input type="tel">` | Custom cursor hides | [ ] |
| 1.4 | Hover over `<input type="password">` | Custom cursor hides | [ ] |
| 1.5 | Hover over `<input type="number">` | Custom cursor hides | [ ] |
| 1.6 | Hover over `<input type="date">` | Custom cursor hides | [ ] |
| 1.7 | Hover over `<input type="time">` | Custom cursor hides | [ ] |
| 1.8 | Hover over `<input type="search">` | Custom cursor hides | [ ] |

### 2. Select & Textarea Hiding

| # | Test | Expected | Pass |
|---|------|----------|------|
| 2.1 | Hover over `<select>` dropdown | Custom cursor hides | [ ] |
| 2.2 | Hover over `<textarea>` | Custom cursor hides (FIX: was showing before) | [ ] |
| 2.3 | Hover over multi-line `<textarea>` | Custom cursor hides | [ ] |

### 3. Submit/Button Exception

| # | Test | Expected | Pass |
|---|------|----------|------|
| 3.1 | Hover over `<input type="submit">` | Custom cursor STAYS visible | [ ] |
| 3.2 | Hover over `<input type="button">` | Custom cursor STAYS visible | [ ] |
| 3.3 | Hover over `<button>` element | Custom cursor STAYS visible | [ ] |
| 3.4 | Submit button INSIDE `<form>` | Custom cursor STAYS visible (edge case) | [ ] |

---

## Form Container Behavior

### 4. Inside `<form>` Tag (Anti-Flicker)

| # | Test | Expected | Pass |
|---|------|----------|------|
| 4.1 | Hover over `<label>` inside `<form>` | Custom cursor hides (FIX: was flickering) | [ ] |
| 4.2 | Move from input → label → input | Cursor stays hidden (no flicker) | [ ] |
| 4.3 | Hover over `<div>` spacing between fields | Custom cursor stays hidden | [ ] |
| 4.4 | Hover over helper text `<span>` in form | Custom cursor stays hidden | [ ] |
| 4.5 | Move outside `<form>` boundary | Custom cursor restores | [ ] |

### 5. Isolated Inputs (No Form Wrapper)

| # | Test | Expected | Pass |
|---|------|----------|------|
| 5.1 | Single `<input>` without `<form>` | Cursor hides on hover | [ ] |
| 5.2 | Move away from isolated input | Cursor restores immediately | [ ] |
| 5.3 | Multiple isolated inputs (no form) | Each hides/restores independently | [ ] |

---

## Datepicker/Dialog Detection

### 6. Datepicker Widgets

| # | Test | Expected | Pass |
|---|------|----------|------|
| 6.1 | Click date input → Air Datepicker opens | Custom cursor hides on picker | [ ] |
| 6.2 | Hover over datepicker cells | Custom cursor stays hidden | [ ] |
| 6.3 | Close datepicker, move away | Custom cursor restores (FIX: was stuck hidden) | [ ] |
| 6.4 | Flatpickr calendar | Custom cursor hides on calendar | [ ] |
| 6.5 | jQuery UI datepicker | Custom cursor hides on picker | [ ] |
| 6.6 | Daterangepicker | Custom cursor hides on picker | [ ] |

### 7. Role-Based Widgets

| # | Test | Expected | Pass |
|---|------|----------|------|
| 7.1 | Hover over `[role="listbox"]` | Custom cursor hides | [ ] |
| 7.2 | Hover over `[role="combobox"]` | Custom cursor hides | [ ] |
| 7.3 | Hover over `[role="menu"]` | Custom cursor hides | [ ] |
| 7.4 | Hover over `[role="dialog"]` | Custom cursor hides | [ ] |
| 7.5 | Hover over `[aria-modal="true"]` | Custom cursor hides | [ ] |
| 7.6 | Leave dialog/modal | Custom cursor restores (FIX: was stuck) | [ ] |

---

## Edge Cases for Mouseout Restoration

### 8. Mouseout Symmetry (Critical Fix)

| # | Test | Expected | Pass |
|---|------|----------|------|
| 8.1 | Enter SELECT, leave SELECT | Cursor hides → restores | [ ] |
| 8.2 | Enter TEXTAREA, leave TEXTAREA | Cursor hides → restores (FIX: was stuck before) | [ ] |
| 8.3 | Enter `[role="dialog"]`, leave dialog | Cursor hides → restores (FIX: was stuck before) | [ ] |
| 8.4 | Enter datepicker, leave datepicker | Cursor hides → restores (FIX: was stuck before) | [ ] |
| 8.5 | Move from input to label (same form) | Cursor stays hidden (relatedTarget check) | [ ] |
| 8.6 | Move from input to submit button | Cursor transitions correctly | [ ] |
| 8.7 | Move from form label to outside form | Cursor restores | [ ] |

### 9. Nested Elements

| # | Test | Expected | Pass |
|---|------|----------|------|
| 9.1 | Form inside dialog | Both hide zones work | [ ] |
| 9.2 | Input inside `<label>` | Cursor hides | [ ] |
| 9.3 | Span inside button inside form | Custom cursor STAYS (button exception) | [ ] |
| 9.4 | Nested form fields | Cursor stays hidden while inside any field | [ ] |

---

## Regression Tests

### 10. Existing Functionality Preserved

| # | Test | Expected | Pass |
|---|------|----------|------|
| 10.1 | Hover over regular link | Cursor scales up (hover state) | [ ] |
| 10.2 | Hover over button with `data-cursor="hover"` | Cursor scales up | [ ] |
| 10.3 | `data-cursor="hide"` on container | Cursor hides (separate from P4) | [ ] |
| 10.4 | Hover over `<video>` element | Cursor hides (P5 detection) | [ ] |
| 10.5 | Hover over `<iframe>` element | Cursor hides (P5 detection) | [ ] |
| 10.6 | Adaptive mode light/dark | Color changes correctly | [ ] |
| 10.7 | Special cursor (image/text/icon) | Works on non-form elements | [ ] |

---

## Debug Console Checks

### 11. Debug Mode Verification

Enable debug mode: `window.CMSM_DEBUG = true;`

| # | Test | Expected Console Output | Pass |
|---|------|------------------------|------|
| 11.1 | Hover over `<input type="text">` | `Form zone hit: INPUT[text]` | [ ] |
| 11.2 | Hover over `<select>` | `Form zone hit: SELECT` | [ ] |
| 11.3 | Hover over `<textarea>` | `Form zone hit: TEXTAREA` | [ ] |
| 11.4 | Hover over `<label>` in form | `Form zone hit: inside <form>` | [ ] |
| 11.5 | Hover over datepicker | `Form zone hit: role/datepicker` | [ ] |
| 11.6 | Hover over `[role="dialog"]` | `Form zone hit: role/datepicker` | [ ] |
| 11.7 | Hover over submit button | No "Form zone hit" log | [ ] |

---

## Performance & Stability

### 12. No Side Effects

| # | Test | Expected | Pass |
|---|------|----------|------|
| 12.1 | No console errors during test | Console clean | [ ] |
| 12.2 | Rapid hover on/off form fields | No lag or errors | [ ] |
| 12.3 | Move mouse continuously across form | Smooth hide/show transitions | [ ] |
| 12.4 | CPU usage during form interaction | No spike (< 20%) | [ ] |
| 12.5 | Memory stable during 5-min test | No memory leaks | [ ] |

---

## Real-World Test Scenarios

### Scenario A: Contact Form

**Setup:** Forminator contact form with Name, Email, Phone, Message, Submit

**Steps:**
1. Move mouse to Name input
2. Move to Email input
3. Move to label between fields
4. Move to Message textarea
5. Move to Submit button
6. Move outside form

**Expected:**
- Cursor hides on Name → stays hidden on label → stays hidden on Email
- Cursor hides on Message textarea (was showing before fix)
- Cursor SHOWS on Submit button
- Cursor shows outside form

**Pass:** [ ]

---

### Scenario B: WooCommerce Date Picker

**Setup:** Product page with date selection (e.g., booking plugin)

**Steps:**
1. Click date input → datepicker opens
2. Move mouse to datepicker calendar
3. Hover over date cells
4. Click a date → picker closes
5. Move mouse away

**Expected:**
- Cursor hides when hovering datepicker
- Cursor restores after picker closes and mouse moves away (was stuck before)

**Pass:** [ ]

---

### Scenario C: Modal with Form

**Setup:** Popup/modal containing a form (`[role="dialog"]`)

**Steps:**
1. Open modal
2. Hover inside modal (non-form area)
3. Hover over form input inside modal
4. Close modal
5. Move mouse on page

**Expected:**
- Cursor hides inside dialog
- Cursor hides on form input (both zones apply)
- Cursor restores after leaving modal (was stuck before)

**Pass:** [ ]

---

### Scenario D: Isolated Search Box

**Setup:** Single `<input type="search">` in header (no `<form>` wrapper)

**Steps:**
1. Hover over search input
2. Move away from search input
3. Hover again

**Expected:**
- Each hover/leave triggers hide/restore cleanly
- No flickering

**Pass:** [ ]

---

## Browser Compatibility

| Browser | Version | Tests Pass | Notes |
|---------|---------|------------|-------|
| Chrome | 131+ | [ ] | |
| Firefox | 133+ | [ ] | |
| Safari | 17+ | [ ] | Check `el.closest()` support |
| Edge | 131+ | [ ] | |

---

## Code Verification Commands

### Before Testing

```bash
# Verify isFormZone function exists
grep -n "function isFormZone" C:/work/cmsaddon/custom-cursor/github/assets/lib/custom-cursor/custom-cursor.js

# Should show line ~897

# Verify all 3 P4 blocks use isFormZone
grep -n "isFormZone" C:/work/cmsaddon/custom-cursor/github/assets/lib/custom-cursor/custom-cursor.js

# Should show:
# - Function definition (~897)
# - detectCursorMode call (~1467)
# - mouseover call (~2270)
# - mouseout trigger check (~2301)
# - mouseout relatedTarget check (~2303)
# Total: 5 matches

# Verify TEXTAREA detection
grep -n "TEXTAREA" C:/work/cmsaddon/custom-cursor/github/assets/lib/custom-cursor/custom-cursor.js

# Should be inside isFormZone function

# Verify no old inline detection remains
grep -n "t\.tagName === .SELECT.\|el\.tagName === .SELECT." C:/work/cmsaddon/custom-cursor/github/assets/lib/custom-cursor/custom-cursor.js

# Should return NOTHING (all replaced by isFormZone)

# Build check
npm run build
# Should complete without errors
```

---

## Acceptance Criteria

- [ ] All Core Scenarios (1-3) pass: 21/21 tests
- [ ] All Form Container tests (4-5) pass: 8/8 tests
- [ ] All Datepicker/Dialog tests (6-7) pass: 11/11 tests
- [ ] All Mouseout Symmetry tests (8-9) pass: 11/11 tests
- [ ] All Regression tests (10) pass: 7/7 tests
- [ ] All Debug Console checks (11) pass: 7/7 tests
- [ ] All Performance checks (12) pass: 5/5 tests
- [ ] All Real-World Scenarios pass: 4/4 scenarios
- [ ] Browser compatibility verified: 4/4 browsers
- [ ] No console errors during any test
- [ ] `npm run build` succeeds

**Total Tests:** 70 individual checks + 4 scenarios

---

## Known Limitations (Not Bugs)

1. **CSS cursor on form elements:** System cursor will always show on form fields due to browser defaults. CSS sets `cursor: auto !important` on these elements. This is intentional — we hide the custom cursor, not override the system cursor.

2. **Submit button edge case:** If a site uses `<a>` or `<div>` styled as a submit button inside a form, it will hide the cursor (because it's inside `<form>`). Workaround: add `data-cursor="hover"` to the fake button element.

3. **Datepicker classes:** Only detects common datepicker libraries. Custom datepicker implementations may need manual `data-cursor="hide"` on their container.

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | |
| QA | | | |

---

**Test Plan Version:** 1.0
**Last Updated:** February 6, 2026
