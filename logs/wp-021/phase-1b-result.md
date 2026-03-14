# Execution Log: WP-021 Phase 1B — Extract resolveSpecialCandidate + resolveEffectForElement
> Epic: WP-021 Crystal Clear Cursor
> Executed: 2026-03-14
> Status: COMPLETE

## What Was Implemented

Extracted two resolver functions from `detectCursorMode()`: `resolveSpecialCandidate(el)` handles the 6x findWithBoundary + depth-sort + core-vs-special winner selection (~75 lines), and `resolveEffectForElement(el)` handles the effect cascade + inherit override (~23 lines). The orchestrator now calls these resolvers and uses their return values for the application branches. Split was NOT clean — `resolveSpecialCandidate` calls `SpecialCursorManager.deactivate()` when core wins, documented as impure. `detectCursorMode` reduced from ~484 to ~407 lines (-77).

## Special Cursor Split Assessment

- Determination/application split clean: **NO** (impure)
- Coupling: `SpecialCursorManager.deactivate()` in core-wins branch is a side effect. Preserved per M1 — the "redundant deactivate" argument is untested so we keep it verbatim.
- Module-scope vars `resolveSpecialCandidate` reads: `findWithBoundary` (helper fn), `getDepthTo` (helper fn)
- Module-scope vars `resolveSpecialCandidate` writes: `SpecialCursorManager.deactivate()` only

### Split Audit Answers (Step A — completed before extraction)

**Q1: Special cursor determination boundaries (pre-extraction)**
- First line: 1920 (`var imageEl = findWithBoundary(el, 'data-cursor-image', null);`)
- Last line: 1980 (`specialType = null;`)

**Q2: Where "determine which" ends and "activate it" begins**
- Determination ends at line 1980 (`specialType = null;` inside core-wins branch)
- Activation begins at line 1982 (`if (specialType === 'image')`)

**Q3: Does determination read `currentSpecial`, `isRingHidden`, `hoverStyle`?**
- No. Pure DOM reads via `findWithBoundary` + `getDepthTo` only.
- One impurity: `SpecialCursorManager.deactivate()` in core-wins branch (preserved per M1).

**Q4: Effect block boundaries (pre-extraction)**
- First line: 2289 (`var coreEffectElForValue = findWithBoundary(el, 'data-cursor-effect', null);`)
- Last line: 2311 (`perElementWobble = (coreEffect === 'wobble') ? true : null;`)

**Q5: Module-scope vars — reads vs writes**
- Reads: `findWithBoundary` (helper), `getDepthTo` (helper), `findClosestInheritEl` (helper)
- Writes: `SpecialCursorManager.deactivate()` only (resolveSpecialCandidate)
- `resolveEffectForElement` writes NOTHING — fully pure

---

## Source Label Continuity (CursorState.transition)

Neither extracted block contained ANY `CursorState.transition` calls. All transition source strings in `detectCursorMode` are in untouched code:

| Location | Source label | Touched? |
|---|---|---|
| Visibility handling (line 2026) | `'detectCursorMode:' + vis.reason` | NO — unchanged |
| Visibility restore (line 2028) | `'detectCursorMode:' + vis.reason` | NO — unchanged |
| Adaptive reset (line 2412) | `'detectCursorMode:reset'` | NO — unchanged |

Special cursor branches have NO CursorState.transition calls — they use `SpecialCursorManager.activate/deactivate` which is a separate system. The only CursorState-adjacent change is in `resolveSpecialCandidate` which calls `SpecialCursorManager.deactivate()` (not CursorState).

---

## Resolver Roster (all 4 + orchestrator)

| Resolver | Line | Purity | Returns |
|---|---|---|---|
| `resolveElement(x, y)` | 1809 | Pure | `Element\|null` |
| `resolveVisibility(el, isWidgetOnly)` | 1861 | Impure (formZoneActive) | `{action,reason,terminal}\|null` |
| `resolveSpecialCandidate(el)` | **1908** | **Impure** (SpecialCursorManager.deactivate) | `{type,el,depth}\|null` |
| `resolveEffectForElement(el)` | **1984** | **Pure** | `{coreEffect,perElementWobble}` |
| `detectCursorMode(x, y)` | 2013 | Orchestrator | void |

---

## Effect Extraction Notes

| Function | Line | Purpose | Called from |
|---|---|---|---|
| `resolveEffect(cursorEffect, globalWobble)` | 983 | Small utility: picks active effect for render loop (combines per-element + global wobble) | `render()` |
| `resolveEffectForElement(el)` | 1984 | Detection-time: finds which effect attribute applies to element via DOM cascade + inherit override | `detectCursorMode()` |

They do NOT call each other. Different layers (render vs detection).

Return mapping for `resolveEffectForElement`:
- `coreEffect` → was local var `coreEffect` written directly in detectCursorMode, now assigned from `effectResult.coreEffect`
- `perElementWobble` → was module-scope var written directly, now assigned from `effectResult.perElementWobble`

---

## M1-M3 Compliance

- **M1:** `SpecialCursorManager.deactivate()` preserved in `resolveSpecialCandidate` core-wins branch (line ~1966 in resolver)
- **M2:** `closestCoreEl` + `closestCoreDepth` tracking fully preserved in resolver
- **M3:** Verification checked exact function bounds (1908-1983 for special, 1984-2012 for effect), NOT "findWithBoundary shouldn't appear in detectCursorMode"

---

## Updated Anchors (for Phase 1C)

| Item | Lines |
|------|-------|
| resolveSpecialCandidate | 1908-1983 |
| resolveEffectForElement | 1984-2012 |
| detectCursorMode start | 2013 |
| Special cursor APPLICATION (orchestrator) | 2035-2240 |
| Forced color (core) | 2242 (`updateForcedColor(el)`) |
| **Blend resolution block** | **2244-2345** |
| Effect APPLICATION (orchestrator) | 2347-2350 |
| Adaptive block | 2352-2418 |
| detectCursorMode end | 2419 |
| `// === RENDER ===` | 2421 |

---

## Line Reduction

| Phase | detectCursorMode lines | Delta |
|---|---|---|
| Pre-Phase 0 | ~540 | — |
| Phase 1A | ~484 | -56 |
| **Phase 1B** | **~407** | **-77** |

---

## Key Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Split clean or impure? | Impure | `SpecialCursorManager.deactivate()` in core-wins is part of determination control flow. Per M1, preserve verbatim. |
| Return null vs empty object? | null for "no special" | Matches plan spec. Orchestrator checks `special && special.type` |
| Alias vars in branches? | Yes (`var imageEl = special.el;` etc.) | Keeps application blocks 100% untouched — zero changes to attribute reads, SpecialCursorManager.activate calls, blend handling |
| `resolveEffectForElement` return style? | Object `{coreEffect, perElementWobble}` | Two values needed, object is clearest |

---

## Variables Moved Out of detectCursorMode

Into `resolveSpecialCandidate`: `imageEl`*, `textEl`*, `iconElSpecial`*, `specialEl`, `specialType`, `specialDepth`, `coreEl`, `coreColorEl`, `coreEffectEl`, `closestCoreEl`, `closestCoreDepth`

*Re-created as aliases from `special.el` at top of each application branch.

Into `resolveEffectForElement`: `coreEffectElForValue`, `inheritElForEffect`, local `inheritEffect`, local `perElementWobble` (returned)

Orchestrator receives: `special` object (or null), `effectResult` object.

---

## Files Changed

| File | Change | Description |
|------|--------|-------------|
| `assets/lib/custom-cursor/custom-cursor.js` | modified | 2 resolvers extracted |
| `assets/lib/custom-cursor/custom-cursor.min.js` | modified | Rebuilt |
| `logs/wp-021/phase-1b-result.md` | created | This log |

## Issues & Workarounds

None.

## Open Questions

None.

## Verification Results

| Check | Result |
|-------|--------|
| All 4 resolvers at module scope, before detectCursorMode | 1809, 1861, 1908, 1984 < 2013 |
| SpecialCursorManager in resolveSpecialCandidate | `SpecialCursorManager.deactivate()` only (documented impure per M1) |
| No CursorState.transition in either resolver | EMPTY |
| No isRingHidden in either resolver | EMPTY |
| resolveEffectForElement pure | EMPTY (no SpecialCursorManager/CursorState/isRingHidden) |
| Blend block untouched (lines 2244-2345) | trueGlobalBlend/globalBlendIntensity/selfBlend present |
| No re-computation in orchestrator | EMPTY (no findWithBoundary for special attrs, no getDepthTo) |
| Each resolver defined exactly once | resolveSpecialCandidate: 1, resolveEffectForElement: 1 |
| resolveSpecialCandidate called in detectCursorMode | Line 2035 |
| resolveEffectForElement called in detectCursorMode | Line 2348 |
| Build | `npm run build` green |
| AC met | YES |
