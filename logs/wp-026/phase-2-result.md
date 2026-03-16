# WP-026 Phase 2: Documentation Update

> Date: 2026-03-16
> Status: COMPLETE

---

## Changes Made

### SOURCE-OF-TRUTH.md

1. **Settings Cross-Reference** — Blend Mode row: Kit Control Suffix and Window Var marked as removed (WP-026)
2. **Value Mappings** — Removed `blend_mode` | `disabled` | `''` from kit_value_map table
3. **Kit Controls table (Matrix A)** — Removed `blend_mode` row (#6), renumbered remaining controls (11 -> 10)
4. **Scenario 5** — Rewritten: "Enable Blend Mode Globally" -> "Enable Blend Mode" (page/element only). Removed two-global-blend-values table.
5. **Scenario 6** — Rewritten: "Blend Resolution for Widgets" -> "Blend Resolution for Elements". Simplified resolution logic reflecting empty trueGlobalBlend.
6. **Scenario 10** — Added note that blend is NOT read through `get_page_cursor_setting()`, removed `disabled->''` from value mapping example
7. **Matrix E** — `cmsmCursorTrueGlobalBlend` row marked as removed (WP-026)
8. **Appendix pitfall summaries** — Updated TRAP-003 and TRAP-004 summaries

### TRAPS.md

9. **TRAP-001** — Added WP-026 note: Kit blend removed, sync only needed for page blend
10. **TRAP-003** — Updated: blend "Default" is now "Off" (no global), effect "Default" still falls through
11. **TRAP-004** — Updated: `trueGlobalBlend` always empty, dirty widget fallback = no blend

### DECISIONS.md

12. **DEC-001** — Added WP-026 note: dual ownership now applies only for page blend
13. **DEC-013** — New decision record for Kit blend removal

### DEVLOG.md

14. Updated existing WP-026 entry with phase 2 docs summary

## Verification

All acceptance criteria met — see verification output below.
