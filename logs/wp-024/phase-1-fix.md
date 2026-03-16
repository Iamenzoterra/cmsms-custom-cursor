# WP-024 Phase 1: Fix Widget-Only Page Promotion

**Date:** 2026-03-16
**Status:** Complete

## Problem

When Kit visibility = `elements` (internal mode = `widgets`), enabling cursor on a specific page via Page Settings toggle "promotes" that page to full cursor mode. `add_cursor_body_class()` promotes correctly (body gets `cmsmasters-cursor-enabled`), but two downstream consumers ignored promotion:

1. **`is_show_render_mode()`** in module.php — always returned `true` when Kit=widgets, regardless of page promotion. Elements rendered `data-cursor-show="yes"` instead of full `data-cursor-*` attrs.
2. **`print_custom_cursor_html()`** in frontend.php — skipped critical inline JS on all widget-only pages, including promoted ones.

## Changes

### module.php

1. **Added `$page_promoted_cache`** property — caches promotion check per document ID.
2. **Added `is_page_promoted($document)`** method — checks if Kit=widgets AND page toggle=yes. Uses `get_settings()` (not `get_settings_for_display()` per TRAP-011). Caches by doc ID.
3. **Updated `is_show_render_mode($document = null)`** — now accepts optional document param. Returns false for promoted pages (so elements get full attrs).
4. **Updated `apply_cursor_attributes()`** — resolves document via `$element->get_document()` (with `method_exists` guard matching existing pattern at `is_popup_editor_context`) and passes to `is_show_render_mode()`.

### frontend.php

5. **Updated `print_custom_cursor_html()`** — added else branch for widget-only mode: checks promotion using same `get_cursor_context_document()` → `get_document_cursor_state()` pattern as `add_cursor_body_class()`. Prints critical JS for promoted pages.

## Verification

- `php -l` passes on both files
- `is_show_render_mode()` accepts `$document` param, checks `is_page_promoted()`
- `is_page_promoted()` uses `get_settings()` (not `get_settings_for_display()`) and caches by doc ID
- `apply_cursor_attributes()` resolves document with `method_exists` guard
- `print_custom_cursor_html()` reuses exact same document resolution as `add_cursor_body_class()`
- No changes to existing functions: `is_widget_only_mode()`, `add_cursor_body_class()`, `get_document_cursor_state()`

## Files Modified

- `modules/cursor-controls/module.php` — +cache property, +is_page_promoted(), ~is_show_render_mode(), ~apply_cursor_attributes()
- `includes/frontend.php` — ~print_custom_cursor_html()
