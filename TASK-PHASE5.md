# TASK-PHASE5: Debug Mode + Console Cleanup

**Priority:** MEDIUM — developer tooling for future debug & feature work
**Risk:** LOW — all debug code behind conditional guard, zero production impact
**Files:** `assets/lib/custom-cursor/custom-cursor.js`, `assets/js/cursor-editor-sync.js`, `assets/js/navigator-indicator.js`
**Fixes:** CODE-002 (console.log in production), CODE-003 (empty catch blocks)

---

## Problem

1. **No debug tooling** — when something breaks, the only option is manually adding `console.log` statements, testing, then removing them. This wastes hours.

2. **CODE-002** — stray `console.log` statements in production code. Noise in DevTools console.

3. **CODE-003** — empty `catch` blocks silently swallow errors. Failures become invisible.

There's already a `window.CMSM_DEBUG = true` pattern in the codebase (SEC test checklist uses it), but it's not formalized.

---

## Solution

### Part A: Debug Logger Utility
A lightweight `debugLog()` function that only outputs when debug mode is active.

### Part B: Debug Overlay
A small DOM panel showing live cursor state. Toggled via API or data attribute.

### Part C: Console Cleanup
Replace stray `console.log` with `debugLog()`. Add error logging to empty catch blocks.

---

## Part A: Debug Logger

### Step A1: Add debug flag and logger function

**WHERE:** After constants section, before CursorState (around line ~260).

```javascript
// === DEBUG MODE ===
// Enable via: window.cmsmastersCursor.debug(true)
// Or via: <body data-cursor-debug="true">
// Or via: window.CMSM_DEBUG = true (legacy)
var debugMode = false;

function debugLog(category, message, data) {
    if (!debugMode) return;
    var prefix = '[Cursor:' + category + ']';
    if (data !== undefined) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }
}

function debugWarn(category, message, data) {
    if (!debugMode) return;
    var prefix = '[Cursor:' + category + ']';
    if (data !== undefined) {
        console.warn(prefix, message, data);
    } else {
        console.warn(prefix, message);
    }
}

function debugError(category, message, data) {
    // Errors ALWAYS log, even without debug mode
    var prefix = '[Cursor:' + category + ']';
    if (data !== undefined) {
        console.error(prefix, message, data);
    } else {
        console.error(prefix, message);
    }
}
```

**Categories to use:**
- `init` — initialization, singleton, settings load
- `mode` — adaptive mode detection (dark/light switching)
- `special` — SpecialCursorManager lifecycle
- `effect` — effect activation/deactivation
- `event` — mouse/touch/visibility events
- `render` — render loop state (USE SPARINGLY — 60fps!)
- `sync` — editor ↔ preview sync
- `error` — caught errors (always logs)

### Step A2: Add debug() to public API

**FIND:** The `window.cmsmastersCursor` export object (near end of IIFE).

**ADD:**

```javascript
debug: function(enable) {
    debugMode = !!enable;
    if (debugMode) {
        console.log('[Cursor:init] Debug mode ENABLED');
        console.log('[Cursor:init] State:', {
            mode: CursorState.mode,
            specialCursor: SpecialCursorManager.getActive(),
            paused: isPaused(),
            wobbleEnabled: isWobbleEnabled()
        });
    }
    return debugMode;
}
```

### Step A3: Check for debug flag on init

**FIND:** Initialization code (near singleton guard, ~line 152).

**ADD** after successful init:

```javascript
// Check for debug mode activation
if (window.CMSM_DEBUG || document.body.getAttribute('data-cursor-debug') === 'true') {
    debugMode = true;
    console.log('[Cursor:init] Debug mode auto-enabled');
}
```

---

## Part B: Debug Overlay

### Step B1: Create overlay element

**WHERE:** Inside the debug() public API method, when enabling.

```javascript
debug: function(enable) {
    debugMode = !!enable;
    if (debugMode) {
        createDebugOverlay();
        console.log('[Cursor:init] Debug mode ENABLED');
    } else {
        removeDebugOverlay();
    }
    return debugMode;
}
```

### Step B2: Add overlay functions

**WHERE:** After debugError function, before CursorState.

```javascript
var debugOverlayEl = null;
var debugOverlayInterval = null;

function createDebugOverlay() {
    if (debugOverlayEl) return;

    debugOverlayEl = document.createElement('div');
    debugOverlayEl.id = 'cmsm-cursor-debug';
    debugOverlayEl.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:2147483647;' +
        'background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;' +
        'padding:8px 12px;border-radius:4px;pointer-events:none;' +
        'max-width:320px;white-space:pre;';
    document.body.appendChild(debugOverlayEl);

    debugOverlayInterval = setInterval(updateDebugOverlay, 200);
}

function removeDebugOverlay() {
    if (debugOverlayInterval) {
        clearInterval(debugOverlayInterval);
        debugOverlayInterval = null;
    }
    if (debugOverlayEl) {
        debugOverlayEl.remove();
        debugOverlayEl = null;
    }
}

function updateDebugOverlay() {
    if (!debugOverlayEl) return;

    var lines = [];
    lines.push('=== CURSOR DEBUG ===');
    lines.push('Mode: ' + CursorState.mode + (CursorState.isAdaptive ? ' (adaptive)' : ' (fixed)'));
    lines.push('Blend: ' + CursorState.blend);
    lines.push('Style: ' + CursorState.hoverStyle);

    var active = SpecialCursorManager.getActive();
    if (active) {
        lines.push('Special: ' + active);
        // Show relevant effect
        switch (active) {
            case 'image': lines.push('Effect: ' + (imageCursorEffect || 'none')); break;
            case 'text': lines.push('Effect: ' + (textCursorEffect || 'none')); break;
            case 'icon': lines.push('Effect: ' + (iconCursorEffect || 'none')); break;
        }
    } else {
        lines.push('Special: none');
        lines.push('Effect: ' + (CursorState.effect || 'none'));
    }

    lines.push('Wobble: ' + (isWobbleEnabled() ? 'ON' : 'OFF'));
    lines.push('Paused: ' + (isPaused() ? 'YES' : 'NO'));

    debugOverlayEl.textContent = lines.join('\n');
}
```

**⚠️ NOTE:** Overlay updates at 200ms interval (5fps), NOT in render(). Zero performance impact on 60fps loop.

### Step B3: Cleanup overlay on destroy

**FIND:** The destroy/cleanup handler (preview:destroyed or equivalent).

**ADD:**
```javascript
removeDebugOverlay();
```

---

## Part C: Console Cleanup

### Step C1: Find and replace stray console.log

**CC MUST RUN:**
```bash
grep -n "console\.log\|console\.warn\|console\.error" assets/lib/custom-cursor/custom-cursor.js
grep -n "console\.log\|console\.warn\|console\.error" assets/js/cursor-editor-sync.js
grep -n "console\.log\|console\.warn\|console\.error" assets/js/navigator-indicator.js
```

**For each found console.log:**
- If it's useful debug info → replace with `debugLog(category, message, data)`
- If it's noise/leftover → remove
- If it's an error → replace with `debugError(category, message, data)`

**Example transformations:**

```javascript
// BEFORE:
console.log('cursor mode changed');

// AFTER:
debugLog('mode', 'Mode changed to ' + CursorState.mode);
```

```javascript
// BEFORE:
console.log('special cursor created', type);

// AFTER:
debugLog('special', 'Activated: ' + type);
```

### Step C2: Fix empty catch blocks

**CC MUST RUN:**
```bash
grep -n -A 2 "catch" assets/lib/custom-cursor/custom-cursor.js
grep -n -A 2 "catch" assets/js/cursor-editor-sync.js
grep -n -A 2 "catch" assets/js/navigator-indicator.js
```

**For each empty catch:**

```javascript
// BEFORE:
try {
    // something
} catch (e) {
    // empty
}

// AFTER:
try {
    // something
} catch (e) {
    debugError('category', 'Description of what failed', e);
}
```

**⚠️ CRITICAL:** `debugError` always logs, even without debug mode. This is intentional — errors should never be silently swallowed.

---

## What NOT to Change

| Area | Why |
|------|-----|
| render() internals | No debug logging in 60fps hot path |
| Effect pure functions | No side effects allowed |
| Sanitizer | Security code, don't add logging |
| postMessage handlers | Security boundary, don't weaken |

---

## Verification

### Before coding:

```bash
# Count existing console.* calls
grep -c "console\." assets/lib/custom-cursor/custom-cursor.js
grep -c "console\." assets/js/cursor-editor-sync.js
grep -c "console\." assets/js/navigator-indicator.js

# Find empty catch blocks
grep -n -B 1 -A 3 "catch.*{" assets/lib/custom-cursor/custom-cursor.js
grep -n -B 1 -A 3 "catch.*{" assets/js/cursor-editor-sync.js
grep -n -B 1 -A 3 "catch.*{" assets/js/navigator-indicator.js

# Find existing CMSM_DEBUG references
grep -rn "CMSM_DEBUG\|debug" assets/lib/custom-cursor/custom-cursor.js
```

### After coding:

```bash
# Verify no raw console.log remains (only inside debugLog/debugWarn/debugError)
grep -n "console\.log\|console\.warn" assets/lib/custom-cursor/custom-cursor.js
# Expected: ONLY inside debugLog() and debugWarn() function definitions

# console.error should only be in debugError definition
grep -n "console\.error" assets/lib/custom-cursor/custom-cursor.js
# Expected: ONLY inside debugError() function definition

# Verify debugLog exists and is used
grep -n "debugLog\|debugWarn\|debugError" assets/lib/custom-cursor/custom-cursor.js

# Verify debug API is exported
grep -n "debug:" assets/lib/custom-cursor/custom-cursor.js

# Verify no empty catch blocks remain
grep -n -A 2 "catch" assets/lib/custom-cursor/custom-cursor.js | grep -B 1 "^.*{$"
# Expected: NONE

# Same for other files
grep -n "console\.log\|console\.warn" assets/js/cursor-editor-sync.js
grep -n "console\.log\|console\.warn" assets/js/navigator-indicator.js

# Build
npm run build
```

---

## Acceptance Criteria

1. ✅ `debugLog()`, `debugWarn()`, `debugError()` functions exist
2. ✅ `debugMode` flag — false by default
3. ✅ 3 activation methods: `window.cmsmastersCursor.debug(true)`, `data-cursor-debug="true"`, `window.CMSM_DEBUG = true`
4. ✅ Debug overlay shows: mode, blend, style, special cursor, effect, wobble state, paused
5. ✅ Overlay updates at 200ms (NOT in render loop)
6. ✅ Overlay removed on debug(false) and on destroy
7. ✅ Zero raw `console.log` / `console.warn` in production code (all through debugLog)
8. ✅ Zero empty catch blocks (all have debugError)
9. ✅ `debugError` always logs (no debug mode check) — errors are never silent
10. ✅ No debug code inside render() hot path
11. ✅ `npm run build` succeeds for all 3 files
12. ✅ No visual or behavioral changes with debugMode = false (default)

---

## Agent Invocation Plan

1. **code-quality** — verify consistent categories, no stray console.*
2. **render-engine** — verify zero debug code in render() hot path
3. **memory-guardian** — verify overlay cleanup on destroy
4. **security-sentinel** — verify no debug info leaks sensitive data
5. **doc-keeper** — update API docs (new debug() method), update known issues (CODE-002, CODE-003)

---

## Testing

```javascript
// In browser console on live site:

// Enable debug mode
window.cmsmastersCursor.debug(true);
// → Overlay appears in bottom-left
// → Console shows state dump

// Move cursor around, hover different elements
// → Overlay updates every 200ms showing current state

// Hover over special cursor zone
// → Console shows: [Cursor:special] Activated: image

// Disable
window.cmsmastersCursor.debug(false);
// → Overlay disappears
// → Console goes silent
```

---

## Notes for CC

- `debugError` is special — it ALWAYS logs, even with debugMode = false. This is the replacement for empty catch blocks. We want errors visible in production.
- Do NOT add `debugLog` calls inside render(). The overlay updates on a separate 200ms interval. If we need render diagnostics in the future, we can add a frame counter to the overlay that reads from a variable render() already updates.
- The overlay uses `pointer-events:none` so it doesn't interfere with cursor behavior.
- For cursor-editor-sync.js and navigator-indicator.js: they're separate IIFEs. Either add their own `debugLog` using the same pattern, or check `window.CMSM_DEBUG` directly. Simpler: just replace their console.log with conditional checks on `window.CMSM_DEBUG`. They don't need the full overlay — that's only for custom-cursor.js.
- Categories are free-form strings, not an enum. Keep them short and consistent.
