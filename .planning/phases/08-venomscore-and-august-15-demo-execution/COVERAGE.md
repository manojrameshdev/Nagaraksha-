# API Coverage Declaration — Phase 08

**Date:** 2026-08-15
**Checkpoint:** ai-integration (Full API Coverage by Default — Opt Out, Never Opt In)

## Decision

**No external API coverage matrix warranted.** The phase integrates exactly one
external SDK — the MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) on-device
vision library — and its consumed capability surface is pinned to five calls,
fully enumerated in PLAN 08-03 Task 2:

| SDK call | Used for |
|----------|----------|
| `FilesetResolver.forVisionTasks(wasmUrl)` | load WASM runtime (pinned `@0.10.3` CDN URL) |
| `FaceLandmarker.createFromOptions(fs, { baseOptions.modelAssetPath, delegate, runningMode, numFaces, outputFaceBlendshapes })` | instantiate the landmarker (pinned official googleapis model asset) |
| `landmarker.detectForVideo(video, performance.now())` | per-frame landmark inference |
| `result.faceLandmarks[0][159/145/386/374]` | eyelid aperture geometry (normalized y-difference) |
| `landmarker.close()` | teardown on unmount |

A capability matrix over MediaPipe's full surface (gesture/pose/holistic tracking,
blendshape outputs, image-mode inference, segmentation) is deliberately **not**
produced: only the five calls above are in scope, the rest are never invoked, and
the SDK is not a server-side API with an account/endpoint contract to exhaust.

## Why this is not an opt-out of the checkpoint's intent

The detector also fires on the phase's own "VenomScore API routes" — but those are
a FastAPI surface this phase **creates** (backend/app/routes/venom_score.py, three
endpoints), not an external API consumed. Their full surface is enumerated in the
plan itself (POST reading, GET score, GET readings) with auth, 404, and validation
behavior specified.

## Coverage of the created surface (for completeness)

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `POST /api/venom-score/{id}/reading` | `require_role_if_enforced` | 404 unknown incident, persist, `await broadcast("VENOM_SCORE_UPDATE")`, return `{id, venomScore}` |
| `GET /api/venom-score/{id}/score` | `require_role_if_enforced` | 404 unknown incident, compute, return `{venomScore}` |
| `GET /api/venom-score/{id}/readings` | `require_role_if_enforced` | 404 unknown incident, ordered rows, return `{incidentId, readings}` |

This declaration supersedes any blanket API-coverage requirement for Phase 08.