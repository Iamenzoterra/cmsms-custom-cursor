# Custom Cursor Addon — Overview

**Version:** 5.7 | **Last updated:** 2026-03-15

---

## What This Is

A WordPress + Elementor addon that replaces the system cursor with an animated custom cursor (dot + ring via RAF loop). Supports special cursors (image/text/icon), visual effects (wobble/pulse/shake/buzz), adaptive light/dark mode, blend modes, and per-element overrides through Elementor's Advanced tab.

The addon extends the CMSMasters Elementor Addon plugin. Settings cascade from Kit (global) → Page → Element, with PHP rendering body classes and data attributes that JS resolvers consume at runtime.

---

## Repo Map

```
repo-root/
├── assets/                     <- JS + CSS source (EDIT these)
│   ├── js/                      cursor-editor-sync.js, navigator-indicator.js
│   └── lib/custom-cursor/       custom-cursor.js (main, ~2100 lines), custom-cursor.css
├── includes/                   <- PHP hooks (EDIT)
│   ├── frontend.php              WordPress frontend hooks, settings bridge
│   └── editor.php                Elementor editor integration
├── modules/                    <- Elementor modules (EDIT)
│   ├── cursor-controls/module.php   Widget/section/container controls
│   └── settings/settings-page.php   WP admin settings (legacy, being removed)
├── cmsmasters-elementor-addon/ <- Full plugin (READ-ONLY reference)
├── Docsv2/                     <- Documentation (you are here)
│   ├── OVERVIEW.md               This file — router
│   ├── SOURCE-OF-TRUTH.md       Canonical behavior map (scenarios + matrices)
│   ├── TRAPS.md                  Pitfalls catalog (TRAP-NNN)
│   ├── DECISIONS.md              Design decisions (DEC-NNN)
│   ├── DEVLOG.md                 Living dev log
│   ├── BACKLOG.md                Planned work
│   └── ref/                      Deep-dive references
│       ├── REF-SETTINGS.md       Control IDs, defaults, PHP examples
│       ├── REF-EFFECTS.md        Effect formulas, CSS vars, physics
│       └── REF-EDITOR.md         PostMessage protocol, navigator, editor sync
├── DOCS/                       <- Old docs (deprecated, kept for reference)
└── CLAUDE.md                   <- Claude Code instructions
```

**Editable:** `assets/`, `includes/`, `modules/`, `Docsv2/`
**Read-only:** `cmsmasters-elementor-addon/`

---

## Where to Find What

| I need to...                               | Read                        |
|--------------------------------------------|-----------------------------|
| Understand how a feature works end-to-end  | `SOURCE-OF-TRUTH.md`        |
| Know why something was built a certain way | `DECISIONS.md` -> DEC-NNN   |
| Check if changing X will break Y           | `TRAPS.md` -> TRAP-NNN      |
| See what was done recently                 | `DEVLOG.md`                 |
| Look up control IDs / defaults             | `ref/REF-SETTINGS.md`       |
| Look up effect formulas / CSS vars         | `ref/REF-EFFECTS.md`        |
| Look up editor sync / postMessage          | `ref/REF-EDITOR.md`         |
| See planned work                           | `BACKLOG.md`                |

---

## Architecture Summary

```
Storage:
  Kit postmeta  ->  Page postmeta  ->  Element JSON
  (lowest)          (middle)            (highest priority)

PHP Bridge:
  get_cursor_mode()  ->  should_enable_custom_cursor()
  get_page_cursor_setting()  ->  body classes + CSS vars + window vars
  apply_cursor_attributes()  ->  data-cursor-* attributes on elements

JS Resolvers (WP-021):
  resolveElement(x, y)            -> which element is cursor over?
  resolveVisibility(el)           -> should cursor be visible?
  resolveSpecialCandidate(el)     -> which special cursor wins?
  resolveBlendForElement(el, ctx) -> what blend intensity?
  resolveEffectForElement(el)     -> which effect applies?

Orchestrator:
  detectCursorMode(x, y) calls resolvers in sequence, applies results

State + Render:
  CursorState manages body class transitions
  RAF render loop applies lerp position + effects at 60fps
```

Debug: `window.CMSM_DEBUG = true` in browser console to see resolver outputs + state transitions.

---

## Build System

```
Edit:    assets/**/*.js, assets/**/*.css     (source files)
Built:   assets/**/*.min.js, assets/**/*.min.css  (server reads ONLY these)
Build:   npm run build
Watch:   npm run watch
```

**ALWAYS edit source files. Server ignores unminified source. No build = no effect on production.**

---

*Migrated from DOCS/ on 2026-03-15 as part of WP-021 Phase 5.*
