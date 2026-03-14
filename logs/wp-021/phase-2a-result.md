# Execution Log: WP-021 Phase 2A — Unify mouseover visibility

> Epic: WP-021 Crystal Clear Cursor
> Executed: 2026-03-14
> Status: COMPLETE

## What Was Implemented

Replaced duplicated form-zone and video/iframe visibility checks in the mouseover handler
(11 lines) with a single `resolveVisibility(t, isWidgetOnly)` call (8 lines). Mouseover now
uses the same resolveVisibility orchestration pattern for shared form/video cases only —
show-zone-enter and hide-zone-enter remain event-owned (local) because resolveVisibility
can't drive their orchestration semantics. This is partial replacement, not full symmetry
between mouseover and detectCursorMode.

## Mouseover Visibility Split (event-owned vs shared)

| mouseover block | Semantic | Action taken | Why |
|---|---|---|---|
| Show-zone enter | event-owned | kept local | resolveVisibility returns null for "inside show zone"; mouseover owns unhide + detectCursorMode orchestration |
| Hide-zone enter | event-owned | kept local | resolveVisibility returns 'skip' (no CursorState call); mouseover does the actual `hidden:true` transition |
| Form enter | shared | replaced via resolveVisibility | Same logic as detection path — `isFormZone()` check with `formZoneActive = true` |
| Form exit | shared | replaced via resolveVisibility | New `mouseover:forms-restore` path — intentional addition, was only mouseout/detection before |
| Video/iframe | shared | replaced via resolveVisibility | Same logic as detection — tagName check + `.closest('video, iframe')` |

## Contract Decision

**Partial replacement.** Show-zone-enter and hide-zone-enter stay local because:

1. **Show-zone-enter** calls `detectCursorMode()` before unhiding to pre-detect blend/color/effect,
   then syncs throttle state. `resolveVisibility()` returns null for "inside show zone" (not 'show'),
   so it can't drive this logic.

2. **Hide-zone-enter** does `CursorState.transition({ hidden: true })` + early return.
   `resolveVisibility()` returns `{ action: 'skip' }` for hide zones (no CursorState call),
   so the actual hide must be event-owned.

This is **not pure dedupe** — it's a behavior-preserving improvement. Delegating to
`resolveVisibility()` introduces `mouseover:forms-restore` and `mouseover:form-zone-select-guard`
paths that didn't exist before. Accepted because mouseout/reset writers remain as fallback and
the semantic already existed in detection.

## Source Label Mapping

| Old label | New label | Match? |
|---|---|---|
| `mouseover:forms` | `'mouseover:' + 'forms'` = `mouseover:forms` | Exact match — preserved |
| `mouseover:video` | `'mouseover:' + 'video'` = `mouseover:video` | Exact match — preserved |
| *(none)* | `mouseover:forms-restore` | **Intentional addition** — form exit via mouseover |
| *(none)* | `mouseover:form-zone-select-guard` | **Intentional addition** — skip action, no CursorState call |

Simple `'mouseover:' + vis.reason` concatenation produces exact old labels. No explicit map needed.
New labels are intentional semantic additions, not disguised as "was always there."

## formZoneActive Writers (after 2A)

| Writer | Location | Phase |
|---|---|---|
| `formZoneActive = true` | `resolveVisibility()` line 1874 | Phase 1A (called from detectCursorMode + mouseover) |
| `formZoneActive = false` | `resolveVisibility()` line 1882 | Phase 1A (called from detectCursorMode + mouseover) |
| `formZoneActive = false` | mouseout handler line 2858 | Legacy — leaving form zone |
| `formZoneActive = false` | mouseout handler line 2868 | Legacy — leaving video/iframe (also resets formZoneActive) |
| `formZoneActive = false` | `resetCursorState()` line 2927 | Full reset |

**5 writers, 4 locations.** Lines 1874/1882 are now called from two sites (detectCursorMode
and mouseover). Still **not single-writer** — Phase 2B addresses ownership cleanup.

No conflicting write directions found in code audit: resolveVisibility sets true on enter,
false on exit; mouseout sets false (same direction); reset sets false (clean slate).
Fast-movement race safety between throttled detection and immediate mouseover still relies
on manual verification and Phase 2B ownership cleanup.

## Lines Changed

- Removed from mouseover: 11 lines of duplicated form/video visibility
- Added to mouseover: 8 lines (resolveVisibility call + action dispatch)
- Added to mouseover: 4 lines (event-owned comments on show-zone + hide-zone)
- Net: +1 line

## Key Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Full vs partial replacement | Partial | Show-zone and hide-zone have event-owned semantics that resolveVisibility can't drive |
| Event target filtering | Pass `t` (event.target) directly | Original code used `t` directly for isFormZone and tagName checks — no filtering needed |
| New behavior paths | Accept `forms-restore` + `select-guard` | Intentional improvement; mouseout/reset fallback remains; semantics match detection path |

## Files Changed

| File | Change | Description |
|------|--------|-------------|
| `assets/lib/custom-cursor/custom-cursor.js` | Modified | Replace form/video blocks with resolveVisibility call; add event-owned comments |
| `logs/wp-021/phase-2a-result.md` | Created | This execution log |

## Issues & Workarounds

2A is not pure mechanical dedupe — it has semantic consequences:

- **New `mouseover:forms-restore` path**: form exit can now restore cursor via mouseover
  (was only mouseout/detection before). Accepted because mouseout/reset remain as fallback.
- **New `mouseover:form-zone-select-guard` path**: skip action on active `<select>`, no
  CursorState call. Accepted because it matches detection behavior.
- **resolveVisibility() now has two call sites**: detectCursorMode (throttled) and mouseover
  (immediate). This adds a resolver-driven writer to formZoneActive from the mouseover path.
  Phase 2B will clean writer ownership.

## Open Questions

None.

## Carry-Forward for Phase 2B

- 2A = partial replacement only (form/video shared; show-zone/hide-zone event-owned)
- formZoneActive writers: resolveVisibility (detection + mouseover), mouseout (legacy), reset
- 2B owns: ownership cleanup, relatedTarget-based restore logic, single-writer convergence
- Fast-movement race (throttled detection vs immediate mouseover) is the load-bearing test scenario

## Verification Results

| Check | Result |
|-------|--------|
| resolveVisibility called from mouseover | definition(1861), detectCursorMode(2127), mouseover(2807) |
| Form/video duplication gone from mouseover | isFormZone/VIDEO/IFRAME absent from mouseover handler (only in resolveVisibility, mouseout) |
| Event-owned blocks documented (partial) | Comments at lines 2768-2769 (show-zone) and 2793-2794 (hide-zone) |
| Special cursor zone entry kept | Lines 2733-2748 untouched |
| Hover detection kept | Lines 2817-2826 untouched |
| formZoneActive documented | 5 writers at 4 locations — not single-writer (Phase 2B) |
| Build | `npm run build` succeeds (terser + cleancss) |
| AC met | All acceptance criteria satisfied |

## Git

- Commit: `22869a6` — `unify mouseover form/video visibility via resolveVisibility [WP-021 phase 2A]`
