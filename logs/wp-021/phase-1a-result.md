# WP-021 Phase 1A — Extract resolveElement + resolveVisibility

**Date:** 2026-03-14
**Status:** COMPLETE
**Lines changed:** ~56 lines extracted from detectCursorMode → 2 resolver functions + 12-line orchestrator

---

## What Was Done

1. Added RESOLVER FUNCTIONS section banner after Phase 0 DOM CASCADE HELPERS (line 1791)
2. Extracted `resolveElement(x, y)` — PURE, no side effects (line 1809)
3. Extracted `resolveVisibility(el, isWidgetOnly)` — IMPURE, reads/writes formZoneActive (line 1861)
4. Replaced 56 lines in `detectCursorMode` with 12-line orchestrator (lines 1903-1915)
5. Build passed — `npm run build` OK

---

## Visibility Mapping Table (source of truth)

| Branch | Resolver return | CursorState call | Flow |
|--------|----------------|-----------------|------|
| Widget-only, outside show zone | `{ action: 'skip', reason: 'outside-show-zone', terminal: true }` | None | STOP |
| Widget-only, inside show zone | `null` | None | continue |
| Full mode, hide zone hit | `{ action: 'skip', reason: 'hide-zone', terminal: true }` | None (hide is event-owned by mouseover) | STOP |
| Full mode, no hide zone | _(continues to form check)_ | None | continue |
| Form zone enter | `{ action: 'hide', reason: 'forms', terminal: true }` | `{hidden:true}, 'detectCursorMode:forms'` | STOP |
| Form zone exit, SELECT guard | `{ action: 'skip', reason: 'form-zone-select-guard', terminal: true }` | None | STOP |
| Form zone exit, ok | `{ action: 'show', reason: 'forms-restore', terminal: false }` | `{hidden:false}, 'detectCursorMode:forms-restore'` | continue |
| Video/iframe | `{ action: 'hide', reason: 'video', terminal: true }` | `{hidden:true}, 'detectCursorMode:video'` | STOP |
| No visibility concern | `null` | None | continue |

---

## Source Label Preservation (M1)

| Branch | Old source label | New source label | Match? |
|--------|-----------------|------------------|--------|
| Form enter | `detectCursorMode:forms` | `'detectCursorMode:' + 'forms'` | YES |
| Form exit | `detectCursorMode:forms-restore` | `'detectCursorMode:' + 'forms-restore'` | YES |
| Video/iframe | `detectCursorMode:video` | `'detectCursorMode:' + 'video'` | YES |
| Skip branches | _(no CursorState call)_ | _(no CursorState call)_ | N/A |

**Zero source label drift.**

---

## formZoneActive Ownership

| Location | Type | Phase |
|----------|------|-------|
| Line 1086: `var formZoneActive = false` | Declaration (module scope) | — |
| resolveVisibility: `formZoneActive = true` (form enter) | Detection write | Phase 1A |
| resolveVisibility: `formZoneActive = false` (form exit) | Detection write | Phase 1A |
| mouseout handler ~2806: `formZoneActive = false` (form exit) | Legacy write | Phase 2 debt |
| mouseout handler ~2816: `formZoneActive = false` (video exit) | Legacy write | Phase 2 debt |
| resetCursorState ~2875: `formZoneActive = false` | Reset write | stays |

---

## Hide Zone Boundary (M4)

- **Detection (resolveVisibility):** returns `action:'skip'` — only skips deeper resolution
- **Event path (mouseover ~line 2747):** `CursorState.transition({hidden:true}, 'mouseover:hide')` — actual hide
- **Event path (mouseout):** restores via hover reset or mouseenter
- This boundary is UNCHANGED by Phase 1A

---

## Post-Extraction Anchors (for Phase 1B)

| Item | Lines | Notes |
|------|-------|-------|
| `resolveElement` | 1809-1831 | PURE |
| `resolveVisibility` | 1861-1893 | IMPURE (formZoneActive) |
| `detectCursorMode` start | 1896 | |
| Sticky mode check | 1897-1901 | stays in orchestrator |
| Orchestrator (resolveElement + resolveVisibility) | 1903-1915 | |
| **Special cursor block** | **1917-2181** | findWithBoundary lookups → depth comparison → image (1982-2040) → text (2042-2110) → icon (2112-2176) → deactivate (2178-2181) |
| Forced color (core) | 2183-2184 | `updateForcedColor(el)` |
| **Blend resolution (core)** | **2186-2287** | selfBlend → inherit override → widget walk → fallback |
| **Effect resolution (core)** | **2289-2311** | findWithBoundary → inherit override → perElementWobble |
| **Adaptive background** | **2313-2379** | luminance walk → hysteresis → applyMode/reset |
| `detectCursorMode` closing `}` | 2380 | exact |

---

## Verification

```
resolveElement:    line 1809 ✓
resolveVisibility: line 1861 ✓
detectCursorMode:  line 1896 ✓
elementsFromPoint: only in resolveElement (1810) ✓ (no duplication)
popup selectors:   popup overlay filtering logic only in resolveElement (1823/1825); same selectors appear in isFormZone (1014) and MutationObserver (1599) for unrelated concerns ✓
formZoneActive:    declaration (1086) + resolver writes (1874/1882) + legacy mouseout (2806/2816/2875) ✓
npm run build:     OK ✓
```
