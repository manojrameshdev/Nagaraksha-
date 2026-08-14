# Deferred Items — Phase 07

Out-of-scope discoveries logged during plan execution (per the executor scope boundary rule). These are NOT fixed here; they are surfaced for a later phase/plan to address.

## FEAT requirement IDs not registered in REQUIREMENTS.md

- **Found during:** Plan 07-03 (state updates, `requirements.mark-complete FEAT-05 FEAT-06 FEAT-07`)
- **Issue:** ROADMAP.md Phase 7 declares requirements `FEAT-01..FEAT-08, CI-07`, and every Phase 7 plan/summary frontmatter references `FEAT-0x` IDs — but REQUIREMENTS.md has no FEAT section. The v1 requirements table only covers the Phase 1-6 IDs (FORMAT/LINT/TYPES/TEST/STATIC/CI/DX). `gsd requirements.mark-complete FEAT-05 FEAT-06 FEAT-07` returned `not_found`.
- **Impact:** Phase 7 requirement traceability (checkboxes + traceability table) cannot be updated by the tooling until the FEAT IDs are registered in REQUIREMENTS.md.
- **Suggested fix (future plan):** Add a "Phase 7 — Frontend-Backend Integration" section to REQUIREMENTS.md with FEAT-01..FEAT-08 (and CI-07 if applicable), then run `requirements.mark-complete` per plan.