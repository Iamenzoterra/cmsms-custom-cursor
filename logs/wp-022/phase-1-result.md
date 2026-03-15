# Execution Log: WP-022 Phase 1 — Move Kit Size Vars to :root

> Epic: WP-022 Kit Size Real-Time Preview Fix
> Executed: 2026-03-15
> Status: ✅ COMPLETE (pending manual editor + frontend tests)

## What Was Implemented

Moved Kit cursor size CSS custom properties (`--cmsmasters-cursor-dot-size`, `--cmsmasters-cursor-dot-hover-size`) from `body.cmsmasters-cursor-enabled[class]` selector to `:root` in `includes/frontend.php`. This eliminates the specificity conflict where PHP's body rule beat editor JS inline overrides on `document.documentElement`. Also fixed `empty()` guards to `'' !== (string)` to accept numeric zero. Color block left completely untouched.

## PHP Inline CSS After Change

```css
/* :root block 1 (color — if cursor_color set): */
:root { --cmsmasters-cursor-color: <color>; --cmsmasters-cursor-color-dark: <color>; }

/* :root block 2 (sizes — always, unless Kit returns empty string): */
:root { --cmsmasters-cursor-dot-size: 8px; --cmsmasters-cursor-dot-hover-size: 40px; }

/* body block: REMOVED — was empty after size vars moved out */
```

Two `:root {}` blocks is valid CSS — browsers merge declarations from matching selectors.

## Emission Condition

- Condition that guards CSS printing: `! empty( $inline_css_parts )` → calls `wp_add_inline_style()` (line 1486-1488)
- **Confirmed: selector changed, condition unchanged** — same `$inline_css_parts[]` array push pattern, same final guard

## Key Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Body rule after size removal | **removed** | Was empty — size vars were the only declarations in it |
| custom-cursor.css | **NOT modified** | Fallback defaults intact (8px/40px), no computed conflict |
| Emission condition | **unchanged** | Only selector string changed inside the `$inline_css_parts[]` push |
| Guard condition | `'' !== (string)` | PHP `empty(0) === true` — would silently skip size=0 |
| Color block | **NOT touched** | M2 cut — zero diff on line 1467, avoids unnecessary risk |

## Files Changed

| File | Change | Description |
|------|--------|-------------|
| `includes/frontend.php` | modified | 4 lines: comment, 2x guard fix, selector from body→:root |
| `logs/wp-022/phase-1-result.md` | created | This log |

## Issues & Workarounds

None.

## Verification Results

| Check | Result |
|-------|--------|
| Size vars on `:root` | ✅ lines 1476, 1479 inside `:root { ... }` block (line 1483) |
| Size vars NOT on body | ✅ `grep 'cmsmasters-cursor-enabled[class]'` → no matches |
| Body rule clean (no empty rule) | ✅ Body rule removed entirely — was size-only |
| Color still on `:root` | ✅ line 1467 unchanged |
| `custom-cursor.css` zero diff | ✅ `git diff --name-only` → empty |
| Emission condition unchanged | ✅ `! empty( $inline_css_parts )` guard intact at line 1486 |
| Build (`npm run build`) | ✅ terser + cleancss completed |
| AC met | ⏳ pending manual editor + frontend tests |
