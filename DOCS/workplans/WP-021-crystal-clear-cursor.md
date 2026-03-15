# WP-021: Crystal Clear Cursor

> Decompose the 544-line god function `detectCursorMode()` into focused, testable resolver functions — so every cursor behavior is traceable to ONE place.

**Status:** DONE
**Priority:** P1 — Important
**Prerequisites:** None (CursorState + Constants refactor already shipped)
**Milestone/Wave:** Pre-production structural cleanup
**Estimated effort:** 8-14 hours across 6 phases
**Created:** 2026-03-13
**Completed:** 2026-03-15

---

## Problem Statement

Every bug fix in cursor detection becomes "open heart surgery" — touching one concern (blend, effect, visibility) risks breaking unrelated concerns (special cursors, adaptive mode) because they all live in a single 544-line function with shared mutable state.

The `mouseover`/`mouseout` event handlers duplicate ~half of `detectCursorMode`'s logic (hide zones, form zones, show zones, video/iframe detection). Fixing a bug in one location requires remembering to fix the copy in the other. This is where "fix one thing, break another" comes from — it's structural, not bad luck.

The goal: **if there's a bug → open FUNCTIONAL-MAP.md → find which resolver function handles it → read ONE focused function → understand why.**

---

## Solution Overview

### Architecture

```
BEFORE (current):

  mousemove (throttled) → detectCursorMode(x, y)   [544 lines, does EVERYTHING]
  mouseover             → duplicates half the logic  [94 lines, partial copy]
  mouseout              → duplicates half the logic  [78 lines, partial copy]
  render()              → reads shared mutable vars  [235 lines, RAF loop]


AFTER (target):

  ┌─────────────────────────────────────────────────┐
  │            PURE RESOLVER LAYER                    │
  │                                                   │
  │  resolveElement(x, y)        → el                 │
  │  resolveVisibility(el)       → hide/show/continue │
  │  resolveSpecialCandidate(el) → type + config      │
  │  resolveBlendForElement(el)  → intensity string   │
  │  resolveEffectForElement(el) → effect + wobble    │
  │                                                   │
  │  + 5 DOM cascade helpers at module scope           │
  └──────────────┬────────────────────────────────────┘
                 │ returns results (no side effects)
  ┌──────────────▼────────────────────────────────────┐
  │         ORCHESTRATOR + APPLICATOR                   │
  │                                                     │
  │  detectCursorMode(x, y)  [~80 lines]                │
  │    calls resolvers → applies results                 │
  │                                                     │
  │  mouseover handler                                   │
  │    calls resolveVisibility() — no duplication         │
  │                                                     │
  │  mouseout handler                                    │
  │    calls resolveVisibility() — no duplication         │
  └──────────────┬────────────────────────────────────┘
                 │ writes shared vars
  ┌──────────────▼────────────────────────────────────┐
  │         STATE + RENDER LAYER (unchanged)            │
  │                                                     │
  │  CursorState.transition()                            │
  │  SpecialCursorManager.activate()                     │
  │  setBlendIntensity()                                 │
  │  render() — reads vars, never writes detection state │
  └─────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Chosen | Why | Alternatives considered |
|----------|--------|-----|----------------------|
| Where to extract helpers | Module scope (same file) | No build system change, same IIFE closure | Separate file (rejected — adds script dep) |
| Adaptive detection extraction | Keep inline in detectCursorMode | 66 lines, 5+ hysteresis state params would overcomptlicate API | Extract with state object (rejected — too much ceremony for 66 lines) |
| Blend dual ownership (PHP+JS) | Keep as-is, add JSDoc | FOUC risk if PHP stops adding blend classes (100-200ms unstyled) | JS-only (rejected — visible flash on page load) |
| Wobble body class | Move to window var | CSS doesn't use `cmsmasters-cursor-wobble` in selectors — confirmed by grep | Keep body class (rejected — unnecessary dual ownership) |
| Theme class duplication | Remove JS re-add | PHP already adds it; JS re-adds same class = waste | Keep both (rejected — confusing, no benefit) |

---

## What This Changes

### New Files

```
(none — all changes are within existing files)
```

### Modified Files

```
assets/lib/custom-cursor/custom-cursor.js   — Phase 0-4: extract helpers, create resolvers,
                                               unify handlers, add debug logging
includes/frontend.php                        — Phase 3: wobble body class → window var
DOCS/FUNCTIONAL-MAP.md                       — Phase 5: update function structure
DOCS/FUNCTIONAL-MAP-CODEX.md                 — Phase 5: update source pointers
DOCS/DEVLOG.md                               — Phase 5: session entry
```

### Database Changes

```
(none)
```

---

## Implementation Phases

### Phase 0: Extract DOM Cascade Helpers (1-2h)

**Goal:** 5 pure helper functions are at module scope and reusable by any function — not trapped inside detectCursorMode.

**Tasks:**

0.1. **Move `hasCursorSettings(el)`** — currently lines 1731-1740 inside detectCursorMode
- Checks if element has ANY `data-cursor-*` attribute
- Zero side effects, pure function

0.2. **Move `hasCursorTypeSettings(el)`** — currently lines 1746-1753
- Checks TYPE attrs only (data-cursor, data-cursor-image/text/icon), NOT modifiers
- Returns false for inherit elements (transparent in cascade)

0.3. **Move `findClosestInheritEl(el)`** — currently lines 1756-1765
- Walks up DOM to find `data-cursor-inherit="yes"` ancestor

0.4. **Move `findWithBoundary(el, attr, excludes)`** — currently lines 1771-1804
- THE smart cascade engine: walks up, stops at type boundaries, modifiers don't block
- This is the most important helper — used by blend, effect, special cursor, and core resolution

0.5. **Move `getDepthTo(el, ancestor)`** — currently lines 1814-1822
- Counts DOM depth for "inner wins" resolution (closest special cursor wins)

**Target location:** ~line 1160 area (after setBlendIntensity/updateForcedColor, before detectCursorMode)

**Verification:**
- Grep `function hasCursorSettings` — must be at module scope, not inside detectCursorMode
- `npm run build` → all cursor behavior identical (hover, blend, effects, special cursors)

---

### Phase 1: Extract Resolver Functions (3-5h)

**Goal:** detectCursorMode is an ~80-line orchestrator that calls focused resolver functions. Each resolver is readable in isolation.

**Tasks:**

1.1. **`resolveElement(x, y)` → Element | null** — extracts lines 1672-1692
- `elementsFromPoint` traversal, cursor container skip, popup overlay skip
- Pure: takes coordinates, returns filtered element

1.2. **`resolveVisibility(el, isWidgetOnly)` → object | null** — extracts lines 1694-1727
- Returns `{ action: 'hide'|'show'|'skip', reason: string }` or `null` (= continue)
- Handles: show zone enforcement, hide zone detection, form zone, video/iframe
- **This is the function Phase 2 will share with mouseover/mouseout**
- Includes formZoneActive state management (read/write)

1.3. **`resolveSpecialCandidate(el)` → object | null** — extracts lines 1806-1880
- Returns `{ type: 'image'|'text'|'icon', el: Element, depth: number }` or `null`
- Finds image/text/icon candidates via findWithBoundary, picks closest by depth
- Checks if core cursor is closer than special (core wins if so)
- Pure: no SpecialCursorManager calls — just determines WHICH should activate

1.4. **`resolveBlendForElement(el, selfBlend, context)` → string** — extracts lines 2086-2187
- context: `{ trueGlobalBlend, globalBlendIntensity, currentBlendIntensity }`
- Returns: `''` | `'soft'` | `'medium'` | `'strong'`
- Handles: explicit blend, "default" → trueGlobalBlend, widget boundary walk, dirty/clean widget logic, inherit override
- **Most critical extraction** — this is where most "fix one, break another" happens

1.5. **`resolveEffectForElement(el)` → object** — extracts lines 2189-2211
- Returns: `{ coreEffect: string, perElementWobble: boolean|null }`
- Uses findWithBoundary + findClosestInheritEl for cascade
- Nearly pure already (only writes local-scope vars)

1.6. **Keep adaptive detection inline** — lines 2213-2279 stay in detectCursorMode
- Mark with `// --- ADAPTIVE DETECTION ---` section comment
- 66 lines with 5+ hysteresis state variables — extracting would require passing too many params

1.7. **Rewrite detectCursorMode as orchestrator** — calls resolvers, applies side effects
- ~80 lines total: sticky guard → resolveElement → resolveVisibility → resolveSpecial → blend → effect → adaptive

**Verification:**
- Grep `function resolve` — should find 5 new functions
- Test every scenario from FUNCTIONAL-MAP.md scenarios 1-10
- Blend: global, per-element, widget boundary fallback, "default" resolution
- Special cursors: nested image inside text zone → inner wins

---

### Phase 2: Unify Event Handler Logic (2-3h)

**Goal:** mouseover/mouseout handlers use `resolveVisibility()` instead of duplicating detection logic. Fix once → works everywhere.

**Tasks:**

2.1. **Replace duplicated visibility checks in mouseover** — currently lines 2621-2662
- Before: 4 separate if/else blocks for show zone, hide zone, form zone, video
- After: `var vis = resolveVisibility(t, isWidgetOnly)` → act on result
- Keep special cursor zone entry detection as-is (intentionally different — bypasses throttle)
- Keep hover detection as-is (not part of visibility)

2.2. **Simplify mouseout form/video restore** — currently lines 2696-2718
- mouseout logic is structurally different (relatedTarget checks for "leaving zone")
- Share reason strings and isFormZone calls but keep relatedTarget logic local
- formZoneActive state: ensure single writer (resolveVisibility owns it)

2.3. **Verify formZoneActive state consistency** — shared between detectCursorMode and mouseout
- Must not have race conditions between throttled detection and immediate event handlers
- Document the interaction in code comments

**Current duplication map (all eliminated after this phase):**

| Check | detectCursorMode | mouseover | mouseout |
|---|---|---|---|
| Show zone | 1694-1697 | 2621-2640 | 2682-2692 |
| Hide zone | 1699-1703 | 2644-2650 | — |
| Form zone | 1706-1719 | 2652-2656 | 2698-2709 |
| Video/iframe | 1721-1727 | 2658-2662 | 2712-2718 |

**Verification:**
- Grep `isFormZone` in mouseover handler — should be gone (replaced by resolveVisibility)
- Widget-only: enter/leave show zones → cursor appears/disappears
- Form fields: cursor hides on enter, restores on leave
- Video/iframe: cursor hides on enter, restores on leave
- Native `<select>`: dropdown open → cursor stays hidden (activeElement check)

---

### Phase 3: Clean Property Ownership (1h)

**Goal:** Each body class has ONE owner. No more "PHP adds it, JS re-adds it, sync required."

**Tasks:**

3.1. **Wobble: remove body class from PHP, use window var** — `includes/frontend.php` lines 1604-1619
- Replace body class logic with: `$inline_js_parts[] = 'window.cmsmCursorWobble=true;'`
- JS `isWobbleEnabled()` already checks `window.cmsmCursorWobble` OR body class — will work with just window var
- CSS confirmed: `cmsmasters-cursor-wobble` NOT used in any CSS selector in `custom-cursor.css`

3.2. **Theme: remove JS duplication** — `custom-cursor.js` line 620
- Delete: `body.classList.add('cmsmasters-cursor-theme-' + theme);`
- PHP already adds the class at frontend.php:1582 — JS re-adding is pure waste
- Keep `var theme = window.cmsmCursorTheme || 'classic';` — still needed for other logic

3.3. **Blend: keep as-is, add JSDoc** — document WHY dual ownership exists
- PHP MUST add blend classes (FOUC risk: 100-200ms of no blend/mix-blend-mode styling)
- CursorState sync at :705 is correct and essential
- Add JSDoc explaining the pattern and the FOUC reasoning

**Verification:**
- Grep `cmsmasters-cursor-wobble` in frontend.php `body_class` method — should be gone
- Grep `cursor-theme` in custom-cursor.js — should only read, not add
- Wobble effect still works (via window var)
- Theme styling correct on first paint (PHP class) and after JS load

---

### Phase 4: Debug Traceability (1-2h)

**Goal:** `CMSM_DEBUG=true` in console → see exactly why cursor behaves a certain way.

**Tasks:**

4.1. **Add `debugLog` utility** — gated by `window.CMSM_DEBUG`
- Lightweight: `function debugLog(category, data) { if (window.CMSM_DEBUG) console.log('[cursor]', category, data); }`
- Place after CONSTANTS section

4.2. **Add logging to each resolver** — log inputs and return value
- resolveVisibility: `{ action, reason, el.tagName }`
- resolveSpecialCandidate: `{ type, depth }` or `null`
- resolveBlendForElement: `{ resolved, source: 'explicit'|'widget-boundary'|'inherit'|'global' }`
- resolveEffectForElement: `{ coreEffect, perElementWobble }`

4.3. **Enhance CursorState.transition logging** — already has `source` param
- Log: `{ change, source, prev }` when CMSM_DEBUG active
- Existing `source` strings like `'mouseover:forms'` become the trace

**Expected console output:**
```
[cursor] element: { tag: 'DIV', classes: 'elementor-widget-heading' }
[cursor] visibility: null (continue)
[cursor] special: null
[cursor] blend: { resolved: 'soft', source: 'widget-boundary' }
[cursor] effect: { coreEffect: 'wobble', perElementWobble: true }
[cursor] state: { change: {blend:'soft'}, source: 'setBlendIntensity', prev: {blend:null} }
```

**Verification:**
- Set `window.CMSM_DEBUG=true` in browser console → hover over elements → see resolution log
- Set `window.CMSM_DEBUG=false` (or don't set) → zero console output
- No performance impact when debug off (single boolean check per resolver call)

---

### Phase 5: Documentation Update (1-2h)

**Goal:** All docs reflect the new resolver architecture.

**Tasks:**

5.1. **CC reads all phase logs** — understands what was done, what deviated from plan

5.2. **Update `DOCS/FUNCTIONAL-MAP.md`** — replace detectCursorMode line ranges with resolver function map
- Update Matrix B (data attributes) — "Read By" column now references specific resolvers
- Update "Master Data Flow Pipeline" diagram — show resolver layer
- Update "Verification Checklist" — add resolver function grep checks

5.3. **Update `DOCS/FUNCTIONAL-MAP-CODEX.md`** — update source pointers section
- Replace `detectCursorMode()` reference with resolver list

5.4. **Update `DOCS/DEVLOG.md`** — session entry for Crystal Clear Cursor
- Problem, iterations, decisions, final architecture

5.5. **Update WP status** — mark as DONE

**Files to update:**
- `DOCS/FUNCTIONAL-MAP.md` — resolver architecture, updated line references
- `DOCS/FUNCTIONAL-MAP-CODEX.md` — source pointers
- `DOCS/DEVLOG.md` — session log
- `DOCS/04-KNOWN-ISSUES.md` — if issues discovered during refactor
- `DOCS/workplans/WP-021-crystal-clear-cursor.md` — status → DONE
- `logs/wp-021/phase-*-result.md` — phase evidence

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Resolver extraction changes timing of side effects | Blend/effect applied in different order → visual glitch | Orchestrator calls resolvers in same order as original code |
| formZoneActive shared state race condition | Form zone stuck hidden or stuck visible | Single writer (resolveVisibility) + document the state machine |
| mouseover handler lost edge case during unification | Cursor doesn't hide/show on specific elements | Test every row of duplication map table (Phase 2) |
| Wobble window var not set before JS runs | Wobble missing on first frame | Window var is inline script (`wp_add_inline_script` before main JS) — always available |
| Debug logging left on in production | Console spam for end users | Gated by `window.CMSM_DEBUG` — not set by default, not shipped |
| Line number references in FUNCTIONAL-MAP become stale | Doc points to wrong code | Phase 5 updates all references; each resolver is a named function (grep-able) |

---

## Acceptance Criteria (Definition of Done)

- [ ] `detectCursorMode()` is <=100 lines (orchestrator only)
- [ ] 5 resolver functions exist at module scope, each with JSDoc
- [ ] 5 DOM cascade helpers exist at module scope (not inside any function)
- [ ] Zero duplicated visibility logic between detectCursorMode and mouseover
- [ ] `cmsmasters-cursor-wobble` body class removed from PHP → window var only
- [ ] Theme class added by PHP only, not re-added by JS
- [ ] Blend dual ownership documented with JSDoc explaining FOUC reasoning
- [ ] `CMSM_DEBUG=true` produces readable resolution trace in console
- [ ] All 10 FUNCTIONAL-MAP.md scenarios pass manual testing
- [ ] Zero behavioral change — cursor visually identical before and after
- [ ] All phases logged in `logs/wp-021/`
- [ ] Core docs updated in `DOCS/` (Phase 5)
- [ ] No known blockers for next WP

---

## Dependencies

| Depends on | Status | Blocks |
|------------|--------|--------|
| CursorState refactor (TASK-refactor-state-machine.md Phase 2) | DONE | Resolvers use CursorState.transition() |
| Constants extraction (TASK-refactor-state-machine.md Phase 1) | DONE | Resolvers reference named constants |
| FUNCTIONAL-MAP.md | DONE | Phase 5 updates it |

---

## Notes

### Code-verified analysis backing this plan

Three parallel deep-dive agents confirmed:

1. **detectCursorMode structure:** 8 distinct concerns, 5 pure internal helpers, 14+ CursorState transitions, clear data dependencies between concerns. Blend resolution (100 lines) and special cursor resolution (275 lines) are the highest-value extraction targets.

2. **Property ownership:** Blend MUST stay dual-owned (FOUC risk). Wobble body class is safe to remove (CSS doesn't use it). Theme class duplication is harmless waste. Enabled/dual classes MUST stay PHP-only.

3. **Render loop coupling:** render() and detectCursorMode run on independent clocks (RAF vs mousemove throttle). render() is read-heavy (consumes state), detectCursorMode is write-heavy (produces state). No bidirectional mutation — clean producer/consumer split. Resolvers can safely be pure functions.

### Reference documents

- `DOCS/FUNCTIONAL-MAP.md` — current end-to-end behavior map (update in Phase 5)
- `DOCS/FUNCTIONAL-MAP-CODEX.md` — concise narrative version
- `TASK-refactor-state-machine.md` — completed prerequisites (Phase 1 + 2)
- `DOCS/13-REF-EFFECTS.md` — effect formulas (resolveEffect must preserve)

### Each phase is independently valuable

Can stop after any phase and ship. Phase 0 alone improves reusability. Phase 0+1 alone makes detectCursorMode readable. Full plan eliminates all structural duplication.
