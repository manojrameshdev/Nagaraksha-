---
phase: 08-venomscore-and-august-15-demo-execution
reviewed: 2026-08-16T02:45:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .gitignore
  - backend/app/database.py
  - backend/app/domain.py
  - backend/app/limiter.py
  - backend/app/main.py
  - backend/app/models.py
  - backend/app/routes/sos.py
  - backend/app/routes/venom_score.py
  - backend/seed_demo.py
  - backend/tests/conftest.py
  - backend/tests/test_domain.py
  - backend/tests/test_routes.py
  - backend/tests/test_seed_demo.py
  - frontend/app/incidents/[id]/page.tsx
  - frontend/components/__tests__/venom-score.test.tsx
  - frontend/components/venom-score-chart.tsx
  - frontend/components/venom-score.tsx
  - frontend/lib/__tests__/nagraksha.test.ts
  - frontend/lib/nagraksha.ts
  - frontend/lib/realtime.ts
  - frontend/package.json
  - frontend/pnpm-lock.yaml
  - frontend/pnpm-workspace.yaml
  - frontend/store/__tests__/sos-store.test.ts
  - frontend/store/sos-store.ts
  - frontend/test/handlers.ts
  - package.json
  - setup.py
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-16T02:45:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Adversarial per-file review of all Phase 08 changes: the VenomScore backend engine (PtosisReading storage, domain classification, VENOM_SCORE_UPDATE broadcast), the frontend MediaPipe tracker + hospital packet, the SOS rate-limiting refactor, and the Karnataka demo seed. Test quality is strong (94 backend / 19 frontend green, including AsyncMock broadcast proof, two-session loop, and mocked MediaPipe component tests). No critical/security defects found — parameterized SQL throughout, no secrets, no injection surfaces, React-escaped rendering. Two warnings concern the ptosis severity pipeline's robustness to real-world webcam noise (blinks), and one unhandled-exception path in the capture loop.

## Warnings

### WR-01: Blink during tracking is scored as severe ptosis; severity never recovers (max-of-history)

**File:** `frontend/components/venom-score.tsx:168-172` + `backend/app/domain.py:259`
**Issue:** The plan's blink guard (`avg < 0.01`) is applied **only during the baseline phase**. During active tracking, a normal blink drives `avgAperture` toward 0, so `percentChange = ((baseline - avg) / baseline) * 100` spikes toward ~100% → `ptosisDetected = true` → severity `'severe'` → a `NEUROTOXIC` classification is submitted. Compounding this, `compute_venom_score` uses `ptosis_severity = min(100.0, max(pcts))` — the **historical maximum** percent change across all readings — so a single blink permanently pins `overallSeverity`, the antivenom-vials estimate (15-25 band), and the ventilator/critical-alert flags even if the patient's aperture recovers. On a live feed this makes the score monotonic-non-decreasing and blink-sensitive, which is the exact class of false positive a medical-adjacent advisory must avoid.
**Fix:** Apply the blink guard in the tracking branch too — skip/ignore frames with `avgAperture < BLINK_AVG_THRESHOLD` (do not submit, keep last status), and compute severity from the **latest** reading (or a small trailing window) instead of `max(pcts)`, e.g. `ptosis_severity = pcts[-1]` with optional 2-3 reading smoothing:

```ts
// venom-score.tsx capture(): before severity math
if (avgAperture < BLINK_AVG_THRESHOLD) {
  setStatus('no-face'); // or keep 'tracking' — but DO NOT submit a blink frame
  return;
}
```
```python
# domain.py compute_venom_score
pcts = [...]
ptosis_severity = min(100.0, pcts[-1]) if pcts else 0.0  # latest, not historical max
```

### WR-02: `detectForVideo` has no try/catch — exceptions escape the interval callback

**File:** `frontend/components/venom-score.tsx:139-141`
**Issue:** `capture()` calls `landmarker.detectForVideo(video, performance.now())` synchronously inside the `setInterval` callback with no try/catch. MediaPipe can throw if the video element has no ready frame yet (the first `capture()` fires immediately after `await video.play()`), the GPU/WebGL context is lost, or the model fails a frame decode. Such an exception propagates out of the interval callback uncaught, repeatedly, and the status machine never transitions to `'error'` — the UI keeps showing the LIVE badge while tracking is silently dead.
**Fix:** Wrap the `detectForVideo` call (or the whole `capture` body) in try/catch; on error, `stopTracking()` + `setStatus('error')` + set `initError` with a retry message:

```ts
const capture = () => {
  const landmarker = landmarkerRef.current;
  const video = videoRef.current;
  if (!landmarker || !video) return;
  try {
    const result = landmarker.detectForVideo(video, performance.now());
    // ... existing body
  } catch {
    stopTracking();
    setStatus('error');
    setInitError('Tracking failed — restart VenomScore.');
  }
};
```

## Info

### IN-01: `percent_change` unbounded on the wire

**File:** `backend/app/models.py:117`
**Issue:** `PtosisReadingRequest` bounds the three apertures (`ge=0.0, le=1.0`) but `percent_change: Optional[float] = None` is unbounded. A negative or absurd value (e.g., -5000, 1e9) flows into `compute_venom_score`; `min(100.0, max(pcts))` caps the high end but negative percent changes yield negative `overallSeverity` and odd advisory outputs. Low impact (client is the only caller), but cheap to bound.
**Fix:** `percent_change: Optional[float] = Field(None, ge=-100.0, le=100.0)`.

### IN-02: `getVenomScore` helper is unused in app code

**File:** `frontend/lib/nagraksha.ts:184`
**Issue:** `getVenomScore` is exported and unit-tested but never called by the app — the hospital packet reads `venomScore` from the store (updated via WS + POST responses). Dead API-surface code.
**Fix:** Either wire the hospital view to fetch on mount via `getVenomScore(id)` (useful when the WS missed events) or drop it and its test.

### IN-03: Severity thresholds duplicated across three layers

**File:** `frontend/components/venom-score.tsx:175-181`, `frontend/components/venom-score-chart.tsx:32-33`, `backend/app/domain.py` (20/40/70)
**Issue:** The 20/40/70 mild/moderate/severe thresholds live in the component, the chart's ReferenceLines (40/70), and the domain. A threshold change in one layer silently diverges from the others.
**Fix:** Export a shared constant set (e.g., `SEVERITY_THRESHOLDS` from `frontend/lib/nagraksha.ts` for the client layers); the backend domain already owns its copy — document the linkage in a comment.

### IN-04: Seed script summary return unused in `__main__`

**File:** `backend/seed_demo.py:169-171`
**Issue:** `run()` returns a summary dict that `if __name__ == "__main__"` ignores. Trivial.
**Fix:** `print(run())` or drop the return (tests call `run()` and re-query the DB anyway).

---

_Reviewed: 2026-08-16T02:45:00Z_
_Reviewer: Buffy (inline, no subagent API available on this runtime — gsd-code-reviewer contract followed)_
_Depth: standard_
