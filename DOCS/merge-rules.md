# Merge Rules — Deployment Workflow

## Overview

This repository is a **development mirror** of the custom cursor code. To deploy changes to the main plugin, you must copy compiled files to the production repository.

---

## Repository Structure

```
custom-cursor/github/          ← DEV REPO (this one)
├── assets/                    Source files + compiled
├── includes/                  PHP hooks
├── modules/                   Elementor controls
├── DOCS/                      Documentation
└── commit/                    ← AUTO-GENERATED for merge

cmsmasters-elementor-addon/    ← PRODUCTION REPO
└── cmsmasters-elementor-addon/
    ├── assets/                ← Copy from commit/assets/
    ├── includes/              ← Copy from commit/includes/
    └── modules/               ← Copy from commit/modules/
```

---

## Deployment Process

### Step 1: Build Minified Files

```bash
npm run build
```

**What happens:**
- Compiles `.js` → `.min.js`
- Compiles `.css` → `.min.css`
- Uses terser for JS, clean-css for CSS

**Source files:**
```
assets/lib/custom-cursor/custom-cursor.js
assets/lib/custom-cursor/custom-cursor.css
assets/js/navigator-indicator.js
assets/js/cursor-editor-sync.js
assets/css/editor-navigator.css
```

**Generated minified:**
```
assets/lib/custom-cursor/custom-cursor.min.js
assets/lib/custom-cursor/custom-cursor.min.css
assets/js/navigator-indicator.min.js
assets/js/cursor-editor-sync.min.js
assets/css/editor-navigator.min.css
```

---

### Step 2: Prepare Commit Folder

```bash
# Create /commit folder with all deployment files
mkdir -p commit
cp -r assets includes modules commit/

# Remove backup files (not needed in production)
find commit -type f \( -name "*.pre-*" -o -name "*.backup" \) -delete
```

**Result:** `/commit` folder contains 15 files ready for deployment:
- 10 files from `assets/` (5 source + 5 minified)
- 3 PHP files from `includes/` (frontend.php, editor.php, managers/modules.php)
- 2 PHP files from `modules/`

**Important:** `includes/managers/modules.php` registers `cursor-controls` module.
Without it, the cursor controls won't appear in Elementor editor on new sites.

---

### Step 3: Copy to Production Repo

Navigate to production repository:
```bash
cd ../cmsmasters-elementor-addon/cmsmasters-elementor-addon/
```

Copy files from `/commit`:
```bash
cp -r ../custom-cursor/github/commit/assets ./
cp -r ../custom-cursor/github/commit/includes ./
cp -r ../custom-cursor/github/commit/modules ./
```

---

### Step 4: Commit & Push

```bash
git status
git add assets/ includes/ modules/
git commit -m "Update: Custom cursor v5.6 [describe changes]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

## Important Notes

### ⚠️ Critical Rules

1. **Always build first** — server reads ONLY minified files (`.min.js`, `.min.css`)
2. **Never edit `.min.*` directly** — they're auto-generated
3. **Test before merge** — verify cursor works in Elementor editor + frontend
4. **Keep dev repo clean** — `/commit` folder is temporary, git-ignored

### 🔄 Two-Repository Workflow

| Repository | Purpose | Commit here? |
|---|---|---|
| `custom-cursor/github/` | Development, source files | ✅ Yes, for code changes |
| `cmsmasters-elementor-addon/` | Production plugin | ✅ Yes, for deployments |

### 📦 What Goes to Production

**Include:**
- ✅ Source files (`.js`, `.css`, `.php`)
- ✅ Minified files (`.min.js`, `.min.css`)

**Exclude:**
- ❌ Backup files (`.pre-*`, `.backup`)
- ❌ Documentation (`DOCS/`)
- ❌ Config files (`package.json`, `Gruntfile.js`)
- ❌ Git files (`.git/`, `.gitignore`)

---

## Quick Reference

```bash
# Full deployment sequence
cd custom-cursor/github/
npm run build
mkdir -p commit && cp -r assets includes modules commit/
find commit -type f -name "*.pre-*" -delete

cd ../cmsmasters-elementor-addon/cmsmasters-elementor-addon/
cp -r ../custom-cursor/github/commit/* ./
git add assets/ includes/ modules/
git commit -m "Update: Custom cursor"
git push
```

---

## Troubleshooting

### Build fails
```bash
npm install           # Reinstall dependencies
npm run build         # Try again
```

### Minified files not updated
- Check file timestamps: `ls -la assets/**/*.min.js`
- Build should create files newer than source files

### Changes not visible on site
- Clear WordPress cache (if caching plugin active)
- Hard refresh browser (Ctrl+F5)
- Check if minified files were copied to production repo

---

## Version Control

- **Dev commits:** Code changes, documentation, bug fixes
- **Production commits:** Deployment only (copy from `/commit`)
- **Commit messages:** Use semantic prefixes: `Update:`, `Fix:`, `Add:`, `Refactor:`

---

Last updated: 2026-02-09
