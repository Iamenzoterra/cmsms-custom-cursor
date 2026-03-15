# WP-021 Phase 6 — Live Kit Settings Sync in Editor Preview

**Date:** 2026-03-15
**Type:** Feature — editor-time sync (no PHP, no persistence changes)
**Commit:** 74271a8

---

## Problem

Page-level cursor settings update the editor preview live via JS listener → postMessage → preview sync. Kit (global) cursor settings don't — they rely on PHP body classes / CSS vars / window vars rendered at page load. Changing Kit settings in Site Settings panel has zero effect until full iframe reload.

## Solution

Two-file implementation with a cascade contract: `effective preview = Kit baseline + active page overrides`.

### Sender: `navigator-indicator.js`

| Function | Purpose |
|---|---|
| `buildKitCursorPayload(json)` | Maps raw Kit JSON → normalized payload. Value remaps mirror PHP: `dot_ring`→`classic`, `disabled`→`''`, wobble `yes`→effect `wobble`. Resolves `__globals__` color refs. |
| `broadcastKitCursorChange()` | Reads Kit doc settings model, builds payload, sends `cmsmasters:cursor:kit-settings` postMessage |
| `getKitCursorPayload()` | Same as above but returns payload for init bundle |
| `initKitSettingsListener()` | Backbone `change` listener on Kit settings model. Filters `cmsmasters_custom_cursor_*` keys + `__globals__` cursor keys. Dedup guard: `window.cmsmastersKitCursorListenerAttached` |

Attach points:
- **Eager:** end of `initSettingsListener()` — Kit doc may already be loaded
- **Lazy:** `document:loaded` event — if loaded doc is Kit (`loadedDoc.id == elementor.config.kit_id`)
- **Cleanup:** resets dedup guard on `preview:destroyed`

Init sync: `kitSettings` added to `cmsmasters:cursor:init` payload (before `pageSettings`).

### Receiver: `cursor-editor-sync.js`

| Addition | Purpose |
|---|---|
| `activePageOverrides` var | Stores last page payload for re-application after Kit changes |
| `applyKitBaseline(p)` | 3-step: (1) update `initialCursorState`, (2) apply Kit to DOM, (3) re-apply `activePageOverrides` |
| `activePageOverrides = p` in `applyPageCursorSettings` | One-line addition to store current page payload |
| `kit-settings` message handler | Routes to `applyKitBaseline` |
| Modified `init` handler | Kit baseline applied BEFORE page settings |

### Kit-specific fields (no page equivalent — always applied directly)

- `visibility` → body classes `cmsmasters-cursor-enabled` / `cmsmasters-cursor-widget-only`
- `dot_size` / `dot_hover_size` → CSS vars
- `dual_mode` → body class `cmsmasters-cursor-dual`
- `trueGlobalBlend` → `window.cmsmCursorTrueGlobalBlend`

## Cascade Verification

| Event | What happens |
|---|---|
| **Init** | `applyKitBaseline(kit)` → updates ini → applies Kit to DOM → `applyPageCursorSettings(page)` → stores overrides → overwrites Kit for non-empty fields |
| **Kit change** | `applyKitBaseline(kit)` → updates ini → applies Kit to DOM → re-applies stored `activePageOverrides` → overwrites Kit for non-empty fields |
| **Page change** | `applyPageCursorSettings(page)` → stores overrides → reads ini (now = latest Kit) for empty fields → applies |
| **Page clear** | `applyPageCursorSettings({field: ''})` → restores from ini (= latest Kit) → correct |

## Design Decisions

- **Re-apply page overrides instead of per-field skip:** Simpler, symmetric with init order, zero tracking logic. Cost: one extra DOM write per Kit change — negligible since Kit changes are rare user actions.
- **`editor_preview` toggle excluded:** Explicit non-goal. Controls whether sync script loads at all — must reload by design.
- **No PHP changes:** Pure JS editor-time sync. Kit settings still rendered by PHP on page load for frontend.

## Files Changed

| File | Lines added |
|---|---|
| `assets/js/navigator-indicator.js` | +154 |
| `assets/js/cursor-editor-sync.js` | +161 |
| (minified variants rebuilt) | — |

## Verification Scenarios

Pending manual testing:

1. Kit color change, no page override → preview updates live
2. Kit color change, WITH page color override → preview does NOT change (page wins)
3. Clear page override after Kit change → preview falls to NEW Kit color
4. Kit blend/theme/visibility/smoothness/adaptive/wobble/size/dual → all live
5. Reload → state matches live result exactly
