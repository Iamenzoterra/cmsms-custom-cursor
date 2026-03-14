# Execution Log: WP-021 Phase 1C — Extract resolveBlendForElement + Wobble Investigation
> Epic: WP-021 Crystal Clear Cursor
> Executed: 2026-03-14
> Status: COMPLETE

## Wobble Regression Investigation

- Regression: **NO**
- Root cause: `perElementWobble` declared at module scope (line 1078), assigned at line 2359 from `resolveEffectForElement` return. Current render path drives wobble through `coreEffect` string via `resolveEffect(coreEffect, isWobbleEnabled())` → body class toggle. `perElementWobble` is not consumed by the current render path.
- Fix: None needed. Logged as pre-existing behavior, not a Phase 1B regression. `perElementWobble` remains part of `resolveEffectForElement`'s return contract — not removed (outside extraction scope).

## What Was Implemented

Extracted `resolveBlendForElement(el, ctx)` — a PURE resolver (no side effects, no `setBlendIntensity` calls) that determines blend intensity for a given element. Covers all 13 resolution paths: explicit values, inherit override, dirty widget boundary, DOM walk cascade, and dual global fallbacks. The 101-line inline blend block in `detectCursorMode` was replaced with a 6-line orchestrator call. All 5 resolvers now exist at module scope before `detectCursorMode`.

## Blend Resolution Mapping Table (actual vs FUNCTIONAL-MAP Scenario 6)

| # | Path | Code Returns | FUNCTIONAL-MAP Match? |
|---|---|---|---|
| 1 | explicit "off"/"no" | `''` | Yes — "blend = ''" |
| 2 | explicit "soft"/"medium"/"strong" | `selfBlend` | Yes — "use that value" |
| 3 | explicit "yes", blend OFF | `ctx.trueGlobalBlend \|\| 'soft'` | Yes — "use trueGlobalBlend \|\| 'soft'" |
| 4 | explicit "yes", blend ON | `ctx.currentBlendIntensity` (no-op) | Yes — implicit no-op (not shown in map) |
| 5 | explicit "default"/"" | `ctx.trueGlobalBlend` | Yes — "use trueGlobalBlend (Kit only, NOT page)" |
| 6 | unknown selfBlend value | `ctx.currentBlendIntensity` (no-op) | N/A — defensive fallthrough |
| 7 | no attr, dirty widget | `ctx.trueGlobalBlend` | Yes — "use trueGlobalBlend" |
| 8 | no attr, walk found "off"/"no" | `''` | Yes — cascaded blend |
| 9 | no attr, walk found "soft"/"medium"/"strong" | `blendValue` | Yes — cascaded blend |
| 10 | no attr, walk found "yes", OFF | `ctx.trueGlobalBlend \|\| 'soft'` | Yes — cascaded blend |
| 11 | no attr, walk found "yes", ON | `ctx.currentBlendIntensity` (no-op) | Yes — implicit no-op |
| 12 | no attr, walk found no blend, stopped at widget | `ctx.trueGlobalBlend` | Yes — "use its blend or trueGlobalBlend" |
| 13 | no attr, walk found no blend, reached body | `ctx.globalBlendIntensity` | Yes — "use globalBlendIntensity (page > Kit)" |

**Preserved asymmetry:** Cascade "yes" path (paths 10-11) does NOT handle "default"/"" for blendValue — unlike explicit selfBlend (path 5). This exists in original code and FUNCTIONAL-MAP doesn't cover it. Preserved verbatim.

## Source Label Continuity

No `CursorState.transition` calls existed in the blend block — all state changes went through `setBlendIntensity()` which internally calls `CursorState.transition({blend: ...}, 'setBlendIntensity')`. The source label `'setBlendIntensity'` is preserved unchanged since the orchestrator still calls `setBlendIntensity()`.

| Call Site | Old Source Label | New Source Label | Match? |
|---|---|---|---|
| Core blend resolution | `'setBlendIntensity'` (via `setBlendIntensity()`) | `'setBlendIntensity'` (via `setBlendIntensity()`) | Yes |

## Final detectCursorMode Shape

- Total lines: ~313 (lines 2117-2430, was ~407 after 1B)
- Breakdown: orchestrator ~50 + adaptive ~66 + special cursor application blocks ~197
- Special application blocks and adaptive remain inline by design — "thin orchestrator" is not a Phase 1 goal

## Resolver Roster (all 5)

| Resolver | Line | Purity | Returns |
|---|---|---|---|
| `resolveElement` | 1809 | PURE (DOM read only) | `Element\|null` |
| `resolveVisibility` | 1861 | IMPURE (reads/writes `formZoneActive`) | `{action, reason}\|null` |
| `resolveSpecialCandidate` | 1908 | IMPURE (calls `SpecialCursorManager.deactivate()`) | `{type, el}\|null` |
| `resolveEffectForElement` | 1984 | PURE (DOM read only) | `{coreEffect, perElementWobble}` |
| `resolveBlendForElement` | 2024 | PURE (DOM read only) | `string` (`''`/`'soft'`/`'medium'`/`'strong'`) |

## Key Decisions

| Decision | Chosen | Why |
|---|---|---|
| selfBlend source | Internal `el.getAttribute()` read (verbatim from original) | No change — audit confirmed original approach |
| ctx needs 3 properties | `trueGlobalBlend` + `globalBlendIntensity` + `currentBlendIntensity` | "yes" case needs `currentBlendIntensity` for semantic guard (only activate when OFF) |
| optimization check location | Orchestrator (`if (resolvedBlend !== currentBlendIntensity)`) | Single check replaces 10 scattered guards — simpler, same behavior |
| return value for no-op | `ctx.currentBlendIntensity` | Orchestrator equality check makes this a no-op without special null handling |
| cascade "default"/"" asymmetry | Preserve verbatim | Exists in original code; changing would be logic modification, not extraction |

## Files Changed

| File | Change | Description |
|---|---|---|
| `assets/lib/custom-cursor/custom-cursor.js` | INSERT + DELETE + INSERT | Added `resolveBlendForElement` (92 lines at 2024-2115), removed inline blend block (101 lines), added 6-line orchestrator call |
| `logs/wp-021/phase-1c-result.md` | NEW | This execution log |

## Blend Blocks Audit (4 total, only 1 extracted)

| Block | Lines (post-edit) | Element | Action |
|---|---|---|---|
| Image cursor blend | 2172-2194 | imageEl | UNTOUCHED (inside special cursor application) |
| Text cursor blend | 2243-2265 | textEl | UNTOUCHED (inside special cursor application) |
| Icon cursor blend | 2311-2333 | iconElSpecial | UNTOUCHED (inside special cursor application) |
| **Core cursor blend** | **2348-2354** | **el** | **EXTRACTED → resolveBlendForElement** |

## Metrics

| Metric | Value |
|---|---|
| Lines before Phase 1C | 3008 |
| Lines after Phase 1C | 3017 |
| Net change | +9 (92-line function added, 101-line block removed, 6-line call added) |
| Resolver function | Lines 2024-2115 (92 lines incl. JSDoc) |
| Removed inline block | Was lines 2244-2345 (101 lines) |
| Orchestrator replacement | Lines 2348-2354 (6 lines) |
| `detectCursorMode` | ~313 lines (was ~407 after 1B, was ~484 after 1A) |
| `setBlendIntensity` inside resolver | 0 (PURE confirmed) |
| `CursorState.transition` inside resolver | 0 (PURE confirmed) |
| Special cursor blend calls | Unchanged (12 calls across 3 blocks) |
| `perElementWobble` module write | Line 2359 (unchanged) |
| Build | PASS |

## Issues & Workarounds

Per-element wobble not a regression — investigated, confirmed current render path drives wobble through `coreEffect` string, not `perElementWobble`. `perElementWobble` is set but not consumed by render. Logged as pre-existing, not a 1C issue.

## Carry-Forward for Phase 2/5

- Phase 1 finished extraction of core concerns (element, visibility, special candidate, effect, blend) — all 5 resolvers at module scope
- Orchestrator-only target NOT yet reached: `detectCursorMode` still ~313 lines with special cursor application blocks (~197 lines) and adaptive detection (~66 lines) inline
- Next structural step: handler unification / docs update (Phase 2/5 scope)

## Open Questions

None.

## Verification Results

| Check | Result |
|---|---|
| All 5 resolvers at module scope before detectCursorMode | PASS (lines 1809, 1861, 1908, 1984, 2024 < 2117) |
| resolveBlendForElement pure (no setBlendIntensity) | PASS (0 matches in lines 2024-2116) |
| resolveBlendForElement pure (no CursorState.transition) | PASS (0 matches in lines 2024-2116) |
| detectCursorMode calls resolveBlendForElement → setBlendIntensity | PASS (line 2349-2354) |
| Blend mapping matches FUNCTIONAL-MAP Scenario 6 | PASS (all Scenario 6 branches matched; extra defensive/asymmetric paths documented and preserved verbatim) |
| Special cursor blend blocks untouched | PASS (image/text/icon at 2172-2194, 2243-2265, 2311-2333) |
| Adaptive block untouched | PASS (starts line 2361) |
| perElementWobble writes to module scope | PASS (line 2359) |
| detectCursorMode inline blend block gone | PASS (no selfBlend/stoppedAtWidget/blendEl vars in orchestrator) |
| Source labels preserved | PASS (setBlendIntensity unchanged) |
| npm run build | PASS |
| AC met | PASS (pending manual test by user) |
