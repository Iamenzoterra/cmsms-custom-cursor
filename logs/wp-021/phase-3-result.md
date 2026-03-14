# Execution Log: WP-021 Phase 3 — Clean Property Ownership

> Epic: WP-021 Crystal Clear Cursor
> Executed: 2026-03-15
> Status: ✅ COMPLETE

## What Was Implemented

Three property ownership cleanups across `frontend.php` and `custom-cursor.js`.
Wobble signaling moved from body class to window var (CSS never consumed the class).
Theme body class re-add removed from JS (PHP is sole owner). Blend dual ownership
documented with full JSDoc explaining FOUC reasoning.

### Task 3.1: Wobble — body class → window var

**Problem:** Wobble used a body class (`cmsmasters-cursor-wobble`) that CSS doesn't consume.
Body classes should only exist when CSS needs them.

**Change:** Moved wobble signaling from `add_cursor_body_class()` to inline JS assembly
(`wp_add_inline_script 'before'`), outputting `window.cmsmCursorWobble=true` instead.

- Removed wobble body class block (was lines 1604-1619) from `add_cursor_body_class()`
- Added equivalent window var logic before the `$inline_js_parts` flush (after widget-only flag)
- Page > global cascade preserved: page=wobble → true, page=none/pulse/shake/buzz → suppressed,
  page='' (inherit) → falls back to global kit option
- `isWobbleEnabled()` in JS already reads `window.cmsmCursorWobble` first, body class fallback
  kept as dead-code safety net

### Task 3.2: Theme — remove JS duplication

**Problem:** PHP adds `cmsmasters-cursor-theme-{name}` body class at page load. JS redundantly
re-added it on init (`body.classList.add('cmsmasters-cursor-theme-' + theme)`).

**Change:** Deleted the JS `classList.add` line. PHP is sole owner of theme body class.
`var theme` kept — used elsewhere in JS for theme-specific logic.

### Task 3.3: Blend — document dual ownership

**Problem:** Blend has intentional dual ownership (PHP pre-renders for FOUC prevention, JS syncs
to CursorState on init) but the existing 4-line comment didn't explain WHY both are needed.

**Change:** Replaced the 4-line comment with a full JSDoc block documenting:
- Why PHP must pre-render (FOUC: 100-200ms unstyled cursor)
- Why JS must sync (CursorState no-op bug: null === null)
- Cross-references to FUNCTIONAL-MAP.md Appendix Pitfall #1 and DEC-001

## Property Ownership After Phase 3

| Property | PHP | JS | Owner |
|---|---|---|---|
| Wobble | window var (inline JS) | reads window var | PHP sets, JS reads |
| Theme class | body class | reads (no re-add) | PHP only |
| Blend classes | body class | CursorState sync + transitions | Dual (FOUC — documented) |

## Key Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Wobble condition tree | Preserved verbatim — output only changed | Page effect suppression matrix must not change |
| isWobbleEnabled() | Kept body class fallback | Dead code but harmless BC safety net; no behavioral risk |
| perElementWobble cleanup | NOT done | Out of Phase 3 scope — separate concern (Phase 1C finding) |
| $page_effect re-read | Kept separate read in wobble block | Same method, same call — clarity over micro-optimization |

## Files Changed

| File | Change | Description |
|------|--------|-------------|
| `includes/frontend.php` | modified | Wobble: body class → window var |
| `assets/lib/custom-cursor/custom-cursor.js` | modified | Theme: remove re-add; Blend: JSDoc |
| `assets/lib/custom-cursor/custom-cursor.min.js` | modified | Rebuilt |
| `logs/wp-021/phase-3-result.md` | created | This log |

## Issues & Workarounds

`isWobbleEnabled()` preserves a body-class fallback (`body.classList.contains('cmsmasters-cursor-wobble')`)
even though PHP no longer adds that class. Kept intentionally as a BC safety net — harmless dead code,
zero behavioral risk. If a third-party theme or snippet ever adds the class manually, wobble still works.

## Open Questions

None.

## Verification Results

| Check | Result |
|-------|--------|
| Wobble body class gone from PHP | ✅ Empty — no body class add path |
| Wobble window var in PHP | ✅ 2 hits in inline JS assembly (lines 1547, 1552) |
| Theme not re-added by JS | ✅ Empty — classList.add removed |
| Theme var read exists | ✅ Line 619 — `var theme = window.cmsmCursorTheme` |
| Blend JSDoc present | ✅ 3 hits — INTENTIONAL, FOUC, FOUC risk |
| isWobbleEnabled reads window var | ✅ Line 1006 — `window.cmsmCursorWobble \|\| body.classList...` |
| CSS wobble class usage | ✅ None found — `grep 'cursor-wobble' custom-cursor.css` empty |
| Build | ✅ Success |
| AC met | ⚠️ Partial — automated checks pass, manual tests pending |
