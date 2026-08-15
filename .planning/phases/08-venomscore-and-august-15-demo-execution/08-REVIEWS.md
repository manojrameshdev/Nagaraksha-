---
phase: 08
reviewers: [codex]
reviewed_at: 2026-08-15T15:20:00Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 8

> **Run note:** Codex completed a source-grounded review. Gemini was invoked but
> failed at authentication (`IneligibleTierError` — the installed gemini CLI's
> Google account tier is no longer supported; the CLI itself advises migrating to
> the Antigravity suite). OpenCode was detected but is unavailable because `jq`
> is not on PATH (a declared prerequisite for that lane). The consensus below is
> therefore based on **one** grounded reviewer plus orchestrator verification of
> every HIGH/MEDIUM claim against the actual code.

## Codex Review

# Phase 8 Plan Review

Overall, the plans have a sensible cleanup → backend/frontend parallel work → demo integration sequence, and the backend has useful existing patterns to build on. However, several plans assume files, components, and data flows that do not exist in this repository. Most critically, the proposed SOS limiter will fail without restructuring, and the frontend/hospital/demo requirements cannot be met by the listed files alone. Overall phase risk: **HIGH** until these plan gaps are resolved.

## Plan 08-01 — Cleanup & Deep Link Fix

### Summary

The cleanup and store deep-link fix are well-scoped, but the rate-limiting task is incomplete and would cause an import/runtime failure if implemented literally.

### Strengths

- The deep-link diagnosis is correct: `setIncident` currently omits `incidentId` at [frontend/store/sos-store.ts:51](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:51), while later WebSocket refresh logic depends on it at [frontend/store/sos-store.ts:83](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:83).
- The planned `.gitignore` change precisely targets the existing broad `test` rule at [.gitignore:50](C:/Users/OM%20Prakash/Documents/Nagaraksha-/.gitignore:50).
- The package/setup corrections match current state: root Prisma scripts exist at [package.json:12](C:/Users/OM%20Prakash/Documents/Nagaraksha-/package.json:12), frontend still uses `npm install` at [setup.py:88](C:/Users/OM%20Prakash/Documents/Nagaraksha-/setup.py:88), and the frontend package is named `"my-project"` at [frontend/package.json:2](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/package.json:2).

### Concerns

- **HIGH — The limiter decorator cannot be added as written.** `limiter` is defined in `main.py` at [backend/app/main.py:47](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/main.py:47), but `sos.py` neither imports it nor can safely import `main` because `main` imports `sos` first at [backend/app/main.py:30](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/main.py:30). Adding only `@limiter.limit(...)` to [backend/app/routes/sos.py:15](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/sos.py:15) produces `NameError`.
- **HIGH — The planned handler signature lacks the required request injection.** The working rate-limited endpoint includes `request: Request` at [backend/app/main.py:94](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/main.py:94); `trigger_sos` currently accepts only `req` at [backend/app/routes/sos.py:16](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/sos.py:16).
- **MEDIUM — Setup remains inconsistent after the requested command swap.** Prerequisite validation still checks and advertises npm at [setup.py:34](C:/Users/OM%20Prakash/Documents/Nagaraksha-/setup.py:34), so changing only the install command to pnpm leaves fresh setups able to pass checks but fail at installation.
- **LOW — The zip cleanup must be idempotent.** `nag-raksha.zip` is not currently present, so the task should treat its absence as success rather than a failed delete.

### Suggestions

- Add `backend/app/limiter.py`, move the shared limiter there, import it from both `main.py` and `sos.py`, and change the route to `def trigger_sos(request: Request, req: SosRequest)`.
- Update `setup.py` to check for pnpm (and print pnpm-specific setup guidance), not npm.
- Add a rate-limit test that makes an allowed request and then verifies a `429` after the configured threshold; do not rely solely on lint/tests that never exercise the decorator.

### Risk Assessment

**MEDIUM**, escalating to **HIGH** if implemented verbatim because the rate limiter is not currently importable from the SOS module.

---

## Plan 08-02 — VenomScore Backend Engine

### Summary

The route design follows the existing wound-tracker pattern reasonably well, but the plan needs a complete data contract, authorization, migration, and test strategy before it can safely claim clinical scoring or real-time delivery.

### Strengths

- Reusing the async WebSocket pattern is sound: wound submissions validate the incident, persist a record, and `await broadcast(...)` at [backend/app/routes/wound.py:31](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/wound.py:31) and [backend/app/routes/wound.py:74](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/wound.py:74).
- The database already uses `SCHEMA` plus a dedicated migration path at [backend/app/database.py:244](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:244), providing an appropriate place for forward-compatible PtosisReading changes.
- The plan correctly identifies the missing test fixture: current fixtures include only `seeded_hospital` at [backend/tests/conftest.py:37](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/conftest.py:37), while route tests create incidents inline.

### Concerns

- **HIGH — The endpoint lacks an authorization requirement.** The analogous wound endpoint restricts submissions to approved roles at [backend/app/routes/wound.py:20](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/wound.py:20). The VenomScore plan does not specify equivalent access control, allowing arbitrary clients to create clinically consequential updates for any guessed incident ID.
- **HIGH — The proposed domain contract is underspecified and conflicts with the desired persisted fields.** The phase research schema names fields such as `closurePct` and `baselineRight`, whereas Plan 08-02 only says “normalized apertures and severity levels.” The frontend plan additionally expects baseline, percentage closure, and asymmetry. Without one canonical JSON/DB naming contract, the functions and UI can silently calculate from different fields.
- **HIGH — “Broadcasts” is untested.** Existing route tests use HTTPX ASGI transport only ([backend/tests/conftest.py:30](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/conftest.py:30)); they cannot prove a WebSocket message was emitted. The stated route tests therefore do not establish the must-have real-time behavior.
- **MEDIUM — No migration/backfill decision is specified.** `CREATE TABLE IF NOT EXISTS` covers new databases, but existing runtime databases rely on `migrate_db()` for schema evolution ([backend/app/database.py:264](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:264).) The plan should explicitly decide whether the new table/index is schema-only or must be verified against existing databases.
- **MEDIUM — The clinical output needs strict safeguards.** Project guidance explicitly says antivenom dosage is decided by a doctor, not the platform ([backend/app/knowledge_base_data.py:58](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/knowledge_base_data.py:58)). Returning vial counts as a definitive “estimate” requires a prominent non-prescriptive disclaimer and conservative unknown/error states.
- **MEDIUM — Missing edge tests.** The listed tests omit invalid aperture/severity values, missing/invalid bite times, empty readings, unknown incident on both GET endpoints, ordering by timestamp, and persistence of the computed payload.

### Suggestions

- Define a versioned response shape and field naming convention shared by Pydantic, SQLite rows, domain functions, WebSocket payloads, and TypeScript.
- Apply `require_role_if_enforced(...)`, validate the incident before every GET/POST, and return `404` rather than an ambiguous empty score for nonexistent incidents.
- Test broadcast by patching `venom_score.broadcast` with `AsyncMock` and asserting the exact event name/payload. Add a separate WebSocket integration test if feasible.
- Make all score outputs advisory, include calculation inputs/timestamp, and ensure uncertain or conflicting signals never produce a clinical directive.

### Risk Assessment

**HIGH** due to the incomplete clinical/API contract and missing authorization/realtime verification.

---

## Plan 08-03 — Frontend Face Tracking & Hospital Packet

### Summary

The plan describes the desired product experience clearly, but its file inventory is materially incomplete for this repository. It cannot deliver the hospital live packet or typed WebSocket handling without changes to files not listed in the plan.

### Strengths

- The existing incident page already connects the incident WebSocket at [frontend/app/incidents/[id]/page.tsx:21](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/app/incidents/[id]/page.tsx:21), so extending the store event handler is a reasonable integration direction.
- The socket lifecycle itself supports reconnection and keep-alives at [frontend/lib/realtime.ts:22](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:22), providing a usable transport foundation.
- The plan correctly places domain API types with the existing API client, which currently centralizes SOS and incident requests at [frontend/lib/nagraksha.ts:132](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/nagraksha.ts:132).

### Concerns

- **HIGH — The realtime event type rejects the proposed event.** `IncidentSocketEvent.event` is a closed union containing only dispatch and incident-state events at [frontend/lib/realtime.ts:3](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:3). Plan 08-03 does not list this file, so handling `VENOM_SCORE_UPDATE` in the store will not typecheck.
- **HIGH — The proposed hospital integration target does not exist in the live workflow.** The incident page has no role selection or hospital packet—only dispatch actions and symptom logging at [frontend/app/incidents/[id]/page.tsx:93](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/app/incidents/[id]/page.tsx:93). The role-based Hospital workspace is a static presentation at [frontend/components/nagraksha/workspaces.tsx:276](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/components/nagraksha/workspaces.tsx:276), explicitly stating no clinical decision is calculated at [frontend/components/nagraksha/workspaces.tsx:309](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/components/nagraksha/workspaces.tsx:309). Editing only the incident page cannot make that view live.
- **HIGH — The plan assumes frontend components/dependencies that are absent.** There is no existing frontend WoundTracker or hospital-packet component in the repository, and `recharts` is not in [frontend/package.json](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/package.json:11). The plan must add the dependency and select a real host surface rather than say “alongside WoundTracker.”
- **MEDIUM — MediaPipe lifecycle/error paths are missing.** A ten-second capture loop needs camera-permission denial, no-face detection, model/WASM load failure, stale asynchronous callbacks, stream/interval cleanup on unmount, and prevention of concurrent submissions. Otherwise a failed camera or navigation can create noisy requests or retain the camera.
- **MEDIUM — One-frame baseline calibration is unreliable.** The plan says establish a baseline on the first frame, but a single blink/head pose can make subsequent closure percentages misleading. Use a short multi-frame calibration window and gate calculations until landmark quality is stable.
- **MEDIUM — MSW tests do not validate the camera feature.** Handlers can validate API request/response wiring, but not landmark geometry, percent-closure thresholds, permissions, cleanup, or component state transitions.

### Suggestions

- Add `frontend/lib/realtime.ts` and the actual hospital presentation component/page to `files_modified`; define whether the hospital user opens `/incidents/[id]` or a dedicated authenticated view.
- Add `recharts` explicitly, update the lockfile, and write component tests that mock MediaPipe and `getUserMedia`.
- Make the feature client-only with explicit model asset handling, status UI (“camera permission,” “calibrating,” “face not detected,” “offline/queued”), and cleanup for tracks, animation frames, timers, and in-flight submissions.
- Retain the advisory disclaimer in the hospital packet and distinguish a score from a diagnosis.

### Risk Assessment

**HIGH**. The plan’s core hospital-live-update outcome is blocked by missing target surfaces and a missing realtime type change.

---

## Plan 08-04 — Demo Seed Data & Integration Rehearsal

### Summary

A dedicated Karnataka seed script is appropriate, but this plan conflates database seeding with proving a cross-browser demo. It also cannot make the listed hospital, ASHA, and stakeholder views render the data because those views are currently static.

### Strengths

- The database already contains the needed tables: `VillageAudit` at [backend/app/database.py:192](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:192) and `Stakeholder` at [backend/app/database.py:226](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:226).
- Existing seed code demonstrates a useful idempotent hospital-name upsert pattern at [backend/app/seed.py:28](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/seed.py:28).
- The project has real API routes for reviewing seeded stakeholder records ([backend/app/routes/stakeholders.py:16](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/stakeholders.py:16)) and ASHA audits ([backend/app/routes/audit.py:105](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/audit.py:105)).

### Concerns

- **HIGH — The stated “render accurately” demo outcome cannot be achieved by modifying only `backend/seed_demo.py`.** The Hospital, ASHA, and Stakeholder workspaces render hard-coded static records, e.g. the hospital pre-arrival card at [frontend/components/nagraksha/workspaces.tsx:308](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/components/nagraksha/workspaces.tsx:308) and stakeholder rows at [frontend/components/nagraksha/workspaces.tsx:400](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/components/nagraksha/workspaces.tsx:400). They do not fetch the backend APIs.
- **HIGH — “End-to-end demo flow succeeds” is not a verification method.** The listed commands prove unit/build checks, but no automated or repeatable manual procedure verifies that a separate hospital session receives `VENOM_SCORE_UPDATE` over WebSocket.
- **MEDIUM — The script invocation contract is unspecified.** The existing seed module uses package-relative imports, `from . import database`, at [backend/app/seed.py:5](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/seed.py:5). A new script expected to run as `python seed_demo.py` must import through `app` or configure `PYTHONPATH`; copying this import style will fail.
- **MEDIUM — Seed idempotency and stock history are unclear.** Existing seed code adds a new AntivenomStock row every run at [backend/app/seed.py:48](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/seed.py:48). A rehearsal script should either upsert a clearly identified demo snapshot or clean only its own deterministic records; otherwise repeated rehearsals change ranking input unpredictably.
- **MEDIUM — Named stakeholder data has reputational risk.** The existing stakeholder route frames these entries as documented community support at [backend/app/routes/stakeholders.py:1](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/stakeholders.py:1). Do not seed real people as supporters without verified consent and correct role/organization details; mark demonstration records transparently if consent is absent.
- **LOW — Seed correctness lacks tests.** No post-seed assertions check the exact hospitals, compliance values, stock status, stakeholders, or village aggregates.

### Suggestions

- Split this into two explicit deliverables: an idempotent backend seed script and frontend data-binding work (or amend the demo checklist to honestly use API inspection rather than claim static pages render seed data).
- Add a verification test/script that runs the seed against a temporary `NAGRAKSHA_DB` and asserts exact row counts, named records, compliance values, stock, and audit aggregates.
- Define deterministic identifiers/prefixes for seed records and avoid modifying unrelated user/demo data.
- Add a rehearsable two-session acceptance test: victim triggers SOS, simulated ptosis submission is made, hospital client receives and renders the score within a defined timeout.

### Risk Assessment

**HIGH** because the plan’s declared demo outcomes exceed the listed file scope and its “E2E” verification does not actually exercise the real-time path.

---

## Consensus Summary

### Review context

- **Codex** ran a source-grounded review (all four plans) and rates overall phase risk **HIGH**. Every HIGH/MEDIUM claim was re-verified against the codebase by the orchestrator; all held. Additional issues surfaced during verification are listed below.
- **Gemini** could not run: `IneligibleTierError` at authentication (Google has deprecated the individual tier this CLI uses; it points to the Antigravity suite). The lane is a system-level failure, not a plan issue.
- **OpenCode** is installed but its lane requires `jq`, which is missing from PATH — treated as undetected.

### Agreed Strengths

With a single grounded reviewer, "agreed" means confirmed by both Codex and orchestrator verification:

- The deep-link diagnosis (`sos-store.ts` `setIncident` omitting `incidentId`) is correct and the fix is right.
- Backend pattern reuse (wound.py route + `await broadcast`, `SCHEMA`/`migrate_db`, existing seed upsert pattern) is appropriate.
- The wave structure 08-01 → (08-02 ‖ 08-03) → 08-04 is sound; 08-02 and 08-03 correctly depend only on 08-01.
- Phase research is unusually thorough and correctly pre-flagged the `limiter.py` extraction and the `broadcast` vs `broadcast_sync` distinction.

### Agreed Concerns (highest priority)

1. **HIGH — SOS rate limiting breaks as written (08-01).** `limiter` lives in `main.py`; `sos.py` cannot import it without a circular import, and `trigger_sos` lacks the `request: Request` parameter slowapi requires. The reference doc (0.6) has the same flaw; the research doc's `backend/app/limiter.py` extraction was not carried into the plan.
2. **HIGH — Frontend realtime type is a closed union (08-03).** `realtime.ts:3` must be extended with `'VENOM_SCORE_UPDATE'` (and the store's if/else chain adapted), but `frontend/lib/realtime.ts` is not in `files_modified` — the phase will not typecheck otherwise.
3. **HIGH — The hospital live-packet target does not exist (08-03/08-04).** The incident page has no role split or hospital view; the Hospital workspace is static demo data. The plan's "mount VenomScore in hospital view" and "render accurately" outcomes require building that surface (or explicitly deciding the demo shows the static workspace).
4. **HIGH — No authorization on VenomScore endpoints (08-02).** The wound POST uses `require_role_if_enforced`; the reference `venom_score.py` omits it. Gate is off by default (demo), so this is HIGH-in-principle / MEDIUM-for-demo — but must be stated.
5. **HIGH — WebSocket broadcast is not testable by the planned tests (08-02).** httpx ASGI transport cannot observe emitted WS messages; route tests need to patch `venom_score.broadcast` with `AsyncMock` (or add a real WS integration test) to substantiate the must-have.
6. **MEDIUM — Seed script is not idempotent (08-04).** `INSERT OR IGNORE` + `new_id()` duplicates hospitals and stock rows on every run (`Hospital.name` is not unique).

### Additional verified findings (orchestrator, not from Codex)

- **HIGH (latent) — `db.mins_since` does not exist.** The reference implementation's `_compute_score` calls `db.mins_since(bite_time)` ([docs/AUGUST_15_EXECUTION_PLAN.md:429](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md#hour-0--cleanup-first-both-people-30-minutes)), but `backend/app/database.py` only defines `days_since` (line 295). Executed verbatim, GET score / POST reading raises `AttributeError`. Use `round(db.days_since(bite_time) * 1440)` (the wound.py pattern) or add `mins_since` to `database.py`.
- **MEDIUM — The plan's data contract must pick one of two conflicting schemas.** `08-RESEARCH.md` specifies `closurePct`, `baselineRight`, `baselineLeft`, `asymmetry`; the reference doc specifies `percentChange`, `baselineAperture`, `asymmetric`. The frontend (reference) reads `percentChange`; the domain functions read either key. Plan 08-02 should pin the reference-doc contract and keep the dual-key handling in domain functions.
- **MEDIUM — Domain returns `"unknown"`, never `"dry_bite"`.** `classify_venom_type` returns `neurotoxic`/`hemotoxic`/`unknown`; `estimate_antivenom_vials` branches on `"dry_bite"` which is unreachable. Roadmap/research prose uses `DRY_BITE`/`NEUROTOXIC` (uppercase). Align the vocabulary across docs, domain, frontend type union, and tests before implementation.
- **MEDIUM — `setup.py` npm prerequisite check (line 34–41) still requires npm** after the plan's install-command swap — fresh setups can pass the check and then fail `pnpm install`. Update both.
- **LOW — `nag-raksha.zip` is already absent** — make the delete step tolerate that (it already does under `rm -f`, but the plan should say so).
- **LOW — Reference `seeded_incident` fixture** uses the deprecated `asyncio.get_event_loop().run_until_complete()` pattern inside a sync fixture; under current pytest-asyncio it can raise. Prefer creating the incident via `db` directly or an async fixture.

### Divergent Views

- **Reference doc vs. reviewer (mitigations).** Several Codex HIGHs are *plan-level* gaps that the reference doc already mitigates: the seed script's `sys.path.insert` handles the import contract (08-04 MEDIUM); the frontend chart/component code fully defines the data contract the plan omits; the WS message shape (`{"event", "data"}`) matches the frontend parser. **Resolution for planning:** carry the relevant reference-doc details into the plans' `files_modified`/tasks rather than relying on the executor to read the reference — the plan file is the source of truth for execution.
- **One-frame baseline vs. multi-frame (08-03).** Codex recommends a multi-frame calibration window; the reference implementation uses the first frame for simplicity (acceptable for a 10-minute demo, where the victim is stationary). Acceptable divergence — keep first-frame for demo simplicity but guard against a detected blink.
- **Rate limit value.** Codex did not contest `10/minute`; note the reference's `async def` on `trigger_sos` conflicts with the current sync `def` — slowapi works with both, but changing to `async` requires `await`-free body (the current body is sync DB calls; keep `def`).

### Recommendation for planning

Overall risk: **HIGH** until (a) the limiter extraction is added to 08-01, (b) `realtime.ts` + the hospital surface are added to 08-03's scope, (c) auth + broadcast testing + the `mins_since` fix are added to 08-02, and (d) seed idempotency + a two-session demo verification are added to 08-04. None of these are architecture changes — all are scoped additions to existing tasks.

Incorporate via: `/gsd:plan-phase 8 --reviews`
