# Custom Cursor Addon v5.6

WordPress + Elementor addon for custom animated cursors with effects, adaptive mode, and special cursor types.

---

## Repo Structure

```
repo-root/
│
├── assets/                  ← CURSOR SOURCE FILES (edit + deploy)
│   ├── css/
│   │   ├── editor-navigator.css
│   │   └── editor-navigator.min.css
│   ├── js/
│   │   ├── cursor-editor-sync.js      # Preview ↔ Editor sync
│   │   ├── cursor-editor-sync.min.js
│   │   ├── navigator-indicator.js     # Navigator panel indicators
│   │   └── navigator-indicator.min.js
│   └── lib/
│       └── custom-cursor/
│           ├── custom-cursor.js       # ★ MAIN FILE (~2100 lines)
│           ├── custom-cursor.min.js
│           ├── custom-cursor.css
│           └── custom-cursor.min.css
│
├── includes/                ← CURSOR PHP (edit + deploy)
│   ├── editor.php            # Elementor editor integration
│   └── frontend.php          # WordPress frontend hooks
│
├── modules/                 ← CURSOR MODULES (edit + deploy)
│   ├── cursor-controls/
│   │   └── module.php        # Elementor widget controls
│   └── settings/
│       └── settings-page.php # WP admin settings page
│
├── cmsmasters-elementor-addon/  ← FULL PLUGIN (READ-ONLY reference)
│   └── ...                      # Use for context when needed
│
├── DOCS/                    ← 18 documentation files
│   ├── 00-CONTEXT.md         # ★ START HERE — index + navigation
│   ├── 01-ARCHITECTURE.md
│   ├── 02-CHANGELOG-v5_6.md
│   ├── 03-BACKLOG.md
│   ├── 04-KNOWN-ISSUES.md
│   ├── 05-API-JAVASCRIPT.md
│   ├── 06-API-CSS.md
│   ├── 07-API-DATA-ATTRIBUTES.md
│   ├── 08-API-PHP.md
│   ├── 09-MAP-DEPENDENCY.md
│   ├── 10-MAP-DATA-FLOW.md
│   ├── 11-MAP-EDITOR-SYNC.md
│   ├── 12-REF-BODY-CLASSES.md
│   ├── 13-REF-EFFECTS.md
│   ├── 14-REF-FILES.md
│   ├── 15-REF-SETTINGS.md
│   ├── 16-SEC-CODE-REVIEW.md
│   ├── 17-SEC-SVG-SANITIZER.md
│   ├── 18-SEC-TEST-CHECKLIST.md
│   └── DEVLOG.md              # ★ Living dev log — sessions, iterations, decisions
│
├── .claude/
│   ├── agents/              ← 10 sub-agents
│   └── commands/            ← slash commands
│
├── CLAUDE.md                ← this file
└── TASK-refactor-state-machine.md
```

### Deployment flow

```
repo: assets/ includes/ modules/
        │
        ├──→ GitHub
        │       │
        └───────┴──→ Server (overwrites matching paths in cmsmasters-elementor-addon plugin)
```

### Editable vs read-only

| Path | Access | Purpose |
|---|---|---|
| `assets/` | **EDIT** | JS + CSS source files for cursor |
| `includes/` | **EDIT** | PHP hooks (frontend, editor) |
| `modules/` | **EDIT** | Elementor controls, settings page |
| `DOCS/` | **EDIT** | Documentation (via doc-keeper agent) |
| `cmsmasters-elementor-addon/` | **READ-ONLY** | Full plugin for reference/context |

---

## ⚠️ Build System — CRITICAL

**Stack:** Grunt (via CMSMasters framework)

```
Source files:     assets/**/*.js, assets/**/*.css
Minified files:   assets/**/*.min.js, assets/**/*.min.css
Build command:    npm run build  (= grunt build)
Watch mode:       npm run watch  (auto-rebuild on save)
```

### Rules

1. **ALWAYS edit source files** (`*.js`, `*.css`) — NEVER edit `*.min.*` directly
2. **Server reads ONLY minified files** — changes to source have no effect until built
3. After any code change, remind the user to run `npm run build` or `npm run watch`
4. The `.min.*` files are auto-generated — do not commit them separately

### Key source files

| Source (edit this) | Minified (server reads this) |
|---|---|
| `assets/lib/custom-cursor/custom-cursor.js` | `assets/lib/custom-cursor/custom-cursor.min.js` |
| `assets/lib/custom-cursor/custom-cursor.css` | `assets/lib/custom-cursor/custom-cursor.min.css` |
| `assets/js/navigator-indicator.js` | `assets/js/navigator-indicator.min.js` |
| `assets/js/cursor-editor-sync.js` | `assets/js/cursor-editor-sync.min.js` |

---

## Sub-Agent Team

| Agent | Model | Focus |
|---|---|---|
| 🔒 security-sentinel | sonnet | XSS, postMessage, sanitizer |
| 📖 doc-keeper | sonnet | Documentation updates |
| 🏗️ architect | sonnet | Architecture invariants |
| ⚡ render-engine | sonnet | RAF loop, effects, 60fps |
| 🎨 css-compat | sonnet | Body classes, CSS vars, fallbacks |
| 🌉 elementor-bridge | sonnet | Editor ↔ Preview, postMessage |
| 🧹 memory-guardian | sonnet | Memory leaks, cleanup |
| 📦 wordpress-expert | sonnet | PHP, hooks, options API |
| 🧪 qa-strategist | sonnet | Test plans, false positives |
| 🔧 code-quality | haiku | Code debt, naming, JSDoc |

### Invocation Matrix

| What changed | Invoke agents |
|---|---|
| `custom-cursor.js` | security-sentinel → render-engine → css-compat → memory-guardian → doc-keeper |
| `custom-cursor.css` | css-compat → doc-keeper |
| `navigator-indicator.js` | security-sentinel → elementor-bridge → memory-guardian → doc-keeper |
| `cursor-editor-sync.js` | security-sentinel → elementor-bridge → doc-keeper |
| Any PHP file | wordpress-expert → security-sentinel → doc-keeper |
| Before release | qa-strategist → security-sentinel |
| Refactoring | code-quality → architect → doc-keeper |

---

## 5 Critical Patterns (never break these)

### 1. Singleton Guard
```javascript
if (window.cmsmastersCursor) return; // line ~152
```

### 2. SVG Sanitization
```javascript
container.innerHTML = sanitizeSvgHtml(rawHtml); // NEVER raw innerHTML
```

### 3. postMessage Origin Validation
```javascript
if (e.origin !== TRUSTED_ORIGIN) return; // EVERY message handler
```

### 4. Cleanup on Destroy
```javascript
// preview:destroyed → clear intervals, disconnect observers, remove listeners
```

### 5. Sticky Mode (adaptive)
```javascript
if (Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) return;
```

---

## Open Issues

| ID | Priority | Description |
|---|---|---|
| MEM-005 | LOW | Typography cache unbounded |
| PERF-001 | DEFERRED | RAF always running (3-5% CPU) |
| CODE-005 | PARTIAL | Long functions (render() still ~250 lines) |
| CODE-001,004,006-010 | Various | Code quality debt |

**Recently Resolved (v5.6):**
- ✅ CSS-001: z-index conflicts → CSS custom properties
- ✅ MEM-004: Special cursor accumulation → SpecialCursorManager
- ✅ CODE-002: Console.log in production → Debug mode
- ✅ CODE-003: Empty catch blocks → debugError + CMSM_DEBUG

---

## Workflow

1. Read `DOCS/00-CONTEXT.md` for orientation
2. Check invocation matrix → which agents needed
3. Edit **source** files in `assets/`, `includes/`, `modules/`
4. Run agents for verification
5. Update `DOCS/` via doc-keeper agent
6. Remind user: `npm run build` before testing
