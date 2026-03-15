# Custom Cursor Addon v5.7

WordPress + Elementor addon for custom animated cursors with effects, adaptive mode, and special cursor types.

---

## Skills (deep knowledge — auto-loaded by context)

| Skill | What it knows | When it triggers |
|---|---|---|
| `cmsmasters-custom-cursor` | Architecture, settings rosetta stone, toggle semantic flip, findWithBoundary cascade, blend/effect resolution, CursorState, mandatory code patterns, pre-change checklist | Any cursor file change |
| `cmsmasters-kit-migration` | Kit architecture, Utils API, value mappings, __globals__ traps, CSS var override mechanism, two-repo workflow | WP-020 migration work, get_option→Kit changes |
| 13× WordPress skills | WP coding standards, security, performance, Elementor hooks/controls/forms, WooCommerce, accessibility | General WP/Elementor development |

**Rule:** Don't duplicate skill content here. If you need patterns, settings maps, or architecture details — the skills have them.

---

## Repo Structure

```
repo-root/
├── assets/                     ← JS + CSS source (EDIT these)
│   ├── js/                      cursor-editor-sync.js, navigator-indicator.js
│   └── lib/custom-cursor/       custom-cursor.js (★ main, ~2100 lines), custom-cursor.css
├── includes/                   ← PHP hooks (EDIT)
│   ├── frontend.php              WordPress frontend hooks, settings bridge
│   └── editor.php                Elementor editor integration
├── modules/                    ← Elementor modules (EDIT)
│   ├── cursor-controls/module.php   Widget/section/container controls
│   └── settings/settings-page.php   WP admin settings (being removed in WP-020)
├── cmsmasters-elementor-addon/ ← Full plugin (READ-ONLY reference)
├── Docsv2/                     ← ★ Primary documentation (start here)
│   ├── OVERVIEW.md               Router — what this is, where to find what
│   ├── SOURCE-OF-TRUTH.md        Canonical behavior map (scenarios + matrices)
│   ├── TRAPS.md                  Pitfalls catalog (TRAP-NNN)
│   ├── DECISIONS.md              Design decisions (DEC-NNN)
│   ├── DEVLOG.md                 ★ Living dev log — MANDATORY updates
│   ├── BACKLOG.md                Planned work
│   └── ref/                      Deep-dive references
│       ├── REF-SETTINGS.md        Control IDs, defaults, PHP examples
│       ├── REF-EFFECTS.md         Effect formulas, CSS vars, physics
│       └── REF-EDITOR.md          PostMessage protocol, navigator, editor sync
├── DOCS/                       ← Old docs (deprecated, kept for reference)
├── .claude/agents/             ← 10 sub-agents
├── .claude/commands/           ← slash commands
└── CLAUDE.md                   ← this file
```

### Deployment

```
assets/ includes/ modules/ → GitHub → Server (overwrites paths in plugin)
```

**Editable:** `assets/`, `includes/`, `modules/`, `Docsv2/`
**Read-only:** `cmsmasters-elementor-addon/`

---

## ⚠️ Build System — CRITICAL

```
Edit:    assets/**/*.js, assets/**/*.css     (source files)
Built:   assets/**/*.min.js, assets/**/*.min.css  (server reads ONLY these)
Build:   npm run build
Watch:   npm run watch
```

1. **ALWAYS edit source** — NEVER touch `*.min.*`
2. **Server ignores source** — no build = no effect
3. After code changes, remind user: `npm run build`

---

## Sub-Agents

| Agent | Focus |
|---|---|
| 🔒 security-sentinel | XSS, postMessage, sanitizer |
| 📖 doc-keeper | Documentation updates |
| 🏗️ architect | Architecture invariants |
| ⚡ render-engine | RAF loop, effects, 60fps |
| 🎨 css-compat | Body classes, CSS vars, fallbacks |
| 🌉 elementor-bridge | Editor ↔ Preview, postMessage |
| 🧹 memory-guardian | Memory leaks, cleanup |
| 📦 wordpress-expert | PHP, hooks, Kit API |
| 🧪 qa-strategist | Test plans, false positives |
| 🔧 code-quality | Code debt, naming, JSDoc |

### When to invoke

| Changed | Agents |
|---|---|
| `custom-cursor.js` | security-sentinel → render-engine → css-compat → memory-guardian → doc-keeper |
| `custom-cursor.css` | css-compat → doc-keeper |
| `navigator-indicator.js` | security-sentinel → elementor-bridge → memory-guardian → doc-keeper |
| `cursor-editor-sync.js` | security-sentinel → elementor-bridge → doc-keeper |
| Any PHP file | wordpress-expert → security-sentinel → doc-keeper |
| Before release | qa-strategist → security-sentinel |
| Refactoring | code-quality → architect → doc-keeper |

---

## Open Issues

| ID | Priority | Description |
|---|---|---|
| MEM-005 | LOW | Typography cache unbounded |
| PERF-001 | DEFERRED | RAF always running (3-5% CPU) |
| CODE-005 | PARTIAL | render() still ~250 lines |

---

## Workflow

1. Skills auto-load context — check them before reading DOCS manually
2. Check invocation matrix → which agents needed
3. Edit **source** files only (`assets/`, `includes/`, `modules/`)
4. Run relevant agents for verification
5. Update `Docsv2/` via doc-keeper
6. **MANDATORY: Append to `Docsv2/DEVLOG.md`** — problem, iterations (what failed + why), solution, insights
7. Remind user: `npm run build` before testing
