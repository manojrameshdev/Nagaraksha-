---
phase: 08-venomscore-and-august-15-demo-execution
review_path: .planning/phases/08-venomscore-and-august-15-demo-execution/08-REVIEW.md
fixed_at: 2026-08-16T07:20:00Z
fix_scope: critical_warning
findings_in_scope: 2
fixed: 2
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed:** 2026-08-16T07:20:00Z
**Fix Scope:** critical + warning (Info findings out of scope for `--fix` without `--all`)
**Findings in scope:** 2
**Fixed:** 2
**Skipped:** 0
**Status:** all_fixed

## Summary

Applied fixes for both Warning findings from `08-REVIEW.md` (WR-01 blink/severity
pinning, WR-02 unhandled `detectForVideo` exceptions). Each fix ships with a
regression test. Full suites verified green: 95 backend tests, 21 frontend tests,
`tsc --noEmit` clean, prettier clean. Info findings (IN-01..IN-04) are documented
in `08-REVIEW.md` and intentionally left unchanged — they are out of default
`--fix` scope (Critical + Warning only).

## Fixed Findings

### WR-01: Blink during tracking scored as severe ptosis; severity never recovers (max-of-history)

**Status:** ✅ Fixed

**Changes:**

1. `frontend/components/venom-score.tsx` — `capture()` now applies the blink
   guard (`avgAperture < BLINK_AVG_THRESHOLD`) in the **tracking branch** too:
   a blink frame is skipped entirely (no reading built, no submit, last status
   preserved), matching the existing baseline-phase guard. A recovered frame
   submits normally afterwards.
2. `backend/app/domain.py` — `compute_venom_score` now scores severity from the
   **latest** reading (`pcts[-1]`, rows arrive timestamp ASC) instead of the
   historical `max(pcts)`. The composite is no longer monotonic-non-decreasing:
   a recovered aperture brings `overallSeverity` (and with it the vials band and
   critical/ventilator alerts) back down.

**Tests added:**

- `frontend/components/__tests__/venom-score.test.tsx` — "skips a blink frame
  during tracking": baseline submit → blink at t+10s skipped (no submit, LIVE
  preserved) → recovered frame at t+20s submits with correct `percentChange`.
- `backend/tests/test_domain.py` — `test_composite_severity_tracks_latest_not_max`:
  readings [85.0, 20.0] yield `overallSeverity == 20.0` (not 85.0), diagnosis
  stays NEUROTOXIC, ventilator alert cleared.

### WR-02: `detectForVideo` has no try/catch — exceptions escape the interval callback

**Status:** ✅ Fixed

**Changes:**

- `frontend/components/venom-score.tsx` — `capture()` wraps the synchronous
  `detectForVideo` call in try/catch. On error it calls `stopTracking()`
  (clearing the interval + camera stream), sets `status` to `'error'`, and shows
  a "Tracking failed — restart VenomScore." message. The LIVE badge no longer
  stays lit while tracking is silently dead, and the interval stops throwing
  repeatedly.

**Tests added:**

- `frontend/components/__tests__/venom-score.test.tsx` — "shows the error state
  when detectForVideo throws mid-tracking": baseline submit → throwing frame at
  t+10s → error message rendered, LIVE badge gone, and the interval is cleared
  (no further submits over the next 30s).

## Skipped Findings

None in scope (2 of 2 fixed).

## Out-of-Scope Info Findings (unchanged, tracked in 08-REVIEW.md)

- **IN-01** — bound `percent_change` in `PtosisReadingRequest` (ge=-100, le=100).
- **IN-02** — unused `getVenomScore` helper in `frontend/lib/nagraksha.ts`.
- **IN-03** — severity thresholds (20/40/70) duplicated across layers.
- **IN-04** — `seed_demo.run()` summary return ignored in `__main__`.

Re-run with `/gsd:code-review 8 --fix --all` to include these in fix scope.

---

_Fixed by: Buffy (inline, no subagent API available on this runtime — gsd-code-fixer contract followed)_
