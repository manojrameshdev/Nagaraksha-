---
phase: 09
reviewers: [codex]
reviewed_at: 2026-08-16T02:21:22Z
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md, 09-04-PLAN.md, 09-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 9

## Consensus Summary

Only one external reviewer produced a source-grounded review this run: **Codex**
(gpt-5.6-terra). The **Gemini** lane could not run — its CLI is installed, but on
this Windows host the review lane runner cannot spawn the bare `gemini` binary
(ENOENT; node cannot start the npm `.cmd` shim) and a direct invocation fails
authentication with `IneligibleTierError` (Gemini Code Assist for individuals is
being retired — Google points to the Antigravity suite). Gemini findings are
therefore absent from the consensus below; treat plan-level consensus as the
Codex review, which is source-grounded (it read the actual repo and cites
`path/to/file:line` evidence).

### Agreed Strengths

Single-reviewer run — the strengths below come from the Codex review:

- Plans target the right existing seams: guarded SQLite `ALTER TABLE` migration
  pattern (`backend/app/database.py:257,262`), pure domain logic in
  `backend/app/domain.py`, the established per-incident WebSocket channel
  (`backend/app/routes/ws.py:40-72`), Zustand + `frontend/lib/realtime.ts`
  conventions, and idempotent seeding (`backend/seed_demo.py:64-101`).
- Clinical safety logic is correctly isolated in pure, deterministic functions
  with zero DB I/O; capability filtering layers onto the existing ranking
  engine without replacing established routing behavior.

### Agreed Concerns

Highest-priority concerns raised (all from Codex):

1. **HIGH — Invalid execution ordering.** All five plans declare `wave: 1` and
   `depends_on: []`, despite a hard chain 09-01 schema → 09-02 domain → 09-03
   API/outbox → 09-04 frontend → 09-05 seed/verification. Parallel execution
   risks colliding edits to `test_domain.py`/`test_routes.py` and tests written
   against APIs that do not exist yet.
2. **HIGH — "Transactional outbox" is not transactional as proposed.**
   `append_outbox()` opens its own connection and commits separately
   (`backend/app/eventbus.py:54-60`); direct broadcast from the route (as the
   plan's task states) is not durable and can precede commit. The outbox worker
   only directly handles `IncidentCreated` today.
3. **HIGH — No facility-scoped authorization.** Auth is a broad role that is
   disabled by default (`backend/app/auth.py:61-66`); a hospital role could
   accept another hospital's referral. The acceptance payload has no verified
   hospital identity.
4. **HIGH — Lifecycle transitions are not specified as guarded SQL.**
   Concurrent accept/decline and duplicate transport/arrival need
   `UPDATE ... WHERE status=?` + `rowcount == 1`, otherwise the closed-loop
   state is race-prone.
5. **HIGH — No incident-to-current-facility data model.** `Incident` has no
   hospital FK (`backend/app/database.py:20`), so `evaluate_capability_gap`
   cannot reliably know which facility's capabilities to assess.
6. **HIGH — Capability filtering must be a hard filter, not a penalty.**
   "Filter or penalize heavily" is unsafe: a closer incapable hospital must
   never become the recommended destination.
7. **HIGH — Demo entities don't exist yet.** The seed has no Malavalli PHC /
   Srirangapatna CHC (`backend/seed_demo.py:33-36`), and incident IDs are
   randomly generated `NR-####` (`backend/app/domain.py:149-151`) — NR-1042's
   identity (primary ID vs. stable reference column) is undefined.

### Divergent Views

None — only one reviewer produced output. Gemini's absence is noted above; a
second independent reviewer (e.g. `--claude`, `--qwen`, or Antigravity once
auth is migrated) should be added before re-planning to get genuine
cross-model divergence.

## Codex Review

# Phase 09 Plan Review

## Overall summary

The plans target the right existing seams—raw SQLite migrations, pure domain logic, the established WebSocket channel, Zustand, and the current seed/test infrastructure. However, execution ordering is invalid (`wave: 1`, `depends_on: []` on every plan), and critical contracts are unresolved: an incident has no current-facility association, lifecycle authorization is only role-level, and the proposed “transactional outbox” would not be transactional using the current helper. Address these before execution.

## 09-01 — Facility Capability Model & SQLite Schema Migration

### Summary

A sensible additive-schema plan, aligned with the project’s `CREATE TABLE` plus guarded `ALTER TABLE` approach. It needs tighter data constraints and an explicit migration/test strategy for existing databases.

### Strengths

- The plan follows the established guarded migration pattern: `_column_exists()` checks schema state before `ALTER TABLE` in [backend/app/database.py:257](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:257) and [backend/app/database.py:262](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:262).
- SQLite foreign keys are enabled per connection in [backend/app/database.py:293](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:293), so the proposed referral foreign keys can be meaningful.
- The existing test database uses a temporary file rather than `:memory:` at [backend/tests/conftest.py:7](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/conftest.py:7), which is appropriate for migration behavior.

### Concerns

- **HIGH — “status enum” is not achievable as written.** SQLite’s current schema uses unconstrained `TEXT` for status fields, e.g. `Incident.state` at [backend/app/database.py:29](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:29). A `Referral.status TEXT` alone accepts arbitrary states; lifecycle safety must use a `CHECK` constraint and guarded transition queries.
- **MEDIUM — Capability data is under-specified.** A comma-separated `TEXT` field permits invalid/duplicate tags and conflicts with the seed plan’s `OXYGEN` tag, which is absent from the phase’s defined tag set. Define canonical serialization, validation, and whether `OXYGEN` is supported.
- **MEDIUM — No incident-to-current-facility data model.** `Incident` has no hospital/facility foreign key ([backend/app/database.py:20](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:20)); without it, later evaluation cannot reliably know what facility’s capabilities to assess.
- **LOW — Model naming is inconsistent.** Frontmatter requires `ReferralRequest`, while tasks specify `ReferralCreateRequest`. Choose one public contract and use it consistently.

### Suggestions

- Add `currentHospitalId`/`presentingHospitalId` to `Incident`, or a separately timestamped clinical-assessment entity.
- Use `CHECK (status IN (...))`, `NOT NULL` where clinically required, and Pydantic `Literal`/`Enum` validation.
- Test both fresh-schema creation and migration from a pre-capability Hospital table, including re-running `init_db()`.

### Risk Assessment

**MEDIUM.** The migration mechanism is proven, but the proposed schema currently does not enforce the lifecycle or provide the data required for referral evaluation.

---

## 09-02 — Clinical Capability-Gap Evaluator & Recommendation Filter

### Summary

The plan correctly isolates safety-critical clinical rules in pure functions and builds on the existing ranking engine. It needs a precise telemetry-to-rule contract and a strict capable-facility filter rather than an optional penalty.

### Strengths

- Existing domain code is already a suitable pure-function home: geo/ranking is in [backend/app/domain.py:10](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/domain.py:10) and contains no database access.
- The current ranking output already computes distance, stock freshness, compliance, ETA, and recommendation ([backend/app/domain.py:87](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/domain.py:87)–[128](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/domain.py:128)), so capability filtering can be layered without replacing established routing behavior.
- Existing VenomScore uses persisted ptosis and wound data ([backend/app/routes/venom_score.py:22](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/venom_score.py:22)–[33](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/venom_score.py:33)), making deterministic evaluator inputs attainable.

### Concerns

- **HIGH — Input semantics are ambiguous.** The plan says “ptosis >40%,” but persisted data includes numeric `percentChange` and lower-case severity strings ([backend/app/models.py:90](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/models.py:90)–[97](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/models.py:97)). It does not specify whether the evaluator consumes raw percentages, categorical severity, or computed VenomScore.
- **HIGH — “Filter or penalize heavily” is unsafe ambiguity.** Phase success requires capable destinations. A closer incapable hospital must never become recommended merely from a penalty-based score.
- **MEDIUM — ASV availability is not a capability tag.** Current routing derives ASV status from the newest `AntivenomStock` record ([backend/app/eventbus.py:266](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:266)–[300](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:300)). The new evaluator must require both the `ASV` capability and currently acceptable, fresh stock.
- **MEDIUM — Determinism needs ordered output.** The example uses a set to compose requirements; that produces unstable list order and flaky API/UI tests unless normalized.

### Suggestions

- Specify an evaluator input DTO with normalized values and conservative handling of absent/unknown observations.
- Implement `rank_capable_hospitals` as: hard capability filter → active facility → acceptable/fresh ASV stock → existing score.
- Add tests for unknown/malformed capability values, no eligible facility, stale/out-of-stock ASV, mixed neurotoxic plus hemotoxic signs, and deterministic ordering/reasons.

### Risk Assessment

**HIGH.** This is clinical routing logic; unresolved input interpretation or a soft filter could route a patient to a facility that cannot provide required care.

---

## 09-03 — Referral Lifecycle, Hospital Acceptance & Realtime Outbox Events

### Summary

This plan covers the necessary endpoint surface, but it currently conflicts with the existing event architecture and lacks safeguards for authorization, concurrent state changes, and event durability.

### Strengths

- Router registration is straightforward and follows the existing centralized pattern in [backend/app/main.py:107](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/main.py:107)–[125](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/main.py:125).
- A shared per-incident WebSocket channel already broadcasts to all views ([backend/app/routes/ws.py:40](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/ws.py:40)–[72](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/ws.py:72)).
- The existing app has role-gated mutating routes, including hospital stock updates at [backend/app/routes/hospitals.py:21](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/hospitals.py:21)–[39](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/hospitals.py:39).

### Concerns

- **HIGH — The proposed outbox is not transactional with the referral write.** `append_outbox()` opens its own connection and commits separately ([backend/app/eventbus.py:54](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:54)–[60](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:60)). Calling it after referral insertion leaves a crash window where a referral exists without an event.
- **HIGH — The task contradicts the outbox requirement.** It says to create a row, enqueue an outbox event, *and directly broadcast*; direct broadcast is not durable and can precede commit. The worker currently only directly handles `IncidentCreated`; unknown events are merely `_emit`ted and marked processed ([backend/app/eventbus.py:211](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:211)–[220](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/eventbus.py:220)), not sent over WebSocket.
- **HIGH — No facility-scoped authorization.** Existing auth only establishes a broad role and is disabled by default ([backend/app/auth.py:61](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/auth.py:61)–[66](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/auth.py:66)). A hospital role can otherwise accept another hospital’s referral; the proposed acceptance payload has no verified hospital identity.
- **HIGH — State transitions are not specified as guarded SQL.** Concurrent accept/decline and duplicate transport/arrival calls require `UPDATE ... WHERE status=?` and `rowcount == 1`, otherwise the phase’s closed-loop state is race-prone.
- **MEDIUM — API contract mismatch.** Phase success criteria mention `/api/referrals`; the plan creates under `/api/incidents/{id}/referrals`. Decide whether the canonical creation URL is nested or top-level and keep frontend, tests, and docs aligned.
- **MEDIUM — “decline triggers re-route” is not implemented by the listed endpoints.** Declining only changes state; no re-evaluation/recommendation/new-referral behavior is defined.
- **MEDIUM — Corridor source is incomplete.** `_load_incident()` returns incident, dispatch, symptoms, and snake observations ([backend/app/routes/incidents.py:17](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/incidents.py:17)–[38](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/routes/incidents.py:38)), but no referral or telemetry timeline. Define a stable timeline schema and ordering/tie-break rule.

### Suggestions

- Add a connection-aware `append_outbox(conn, ...)` and write referral, audit row, and outbox event in one `get_conn()` transaction; broadcast only from the dispatched outbox handler.
- Define exact guarded transitions: `PENDING → ACCEPTED|DECLINED`, `ACCEPTED → IN_TRANSIT`, `IN_TRANSIT → ARRIVED`; return `409` for stale/illegal transitions.
- Require an authenticated coordinator bound to `toHospitalId`; do not trust a hospital ID supplied by the client.
- Test rollback (no referral/event if insert fails), competing accept/decline, unauthorized cross-hospital action, duplicate/idempotent requests, and an incident with no viable target.

### Risk Assessment

**HIGH.** The plan’s current durability and authorization gaps undermine the core “closed-loop” claim.

---

## 09-04 — Care Corridor Frontend UI & Closed-Loop Timeline

### Summary

The UI plan builds naturally on existing typed API and realtime conventions. It needs route-data loading, event payload contracts, and error/role handling defined before component work begins.

### Strengths

- The incident page already distinguishes `?role=hospital` from victim mode at [frontend/app/incidents/[id]/page.tsx:27](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/app/incidents/[id]/page.tsx:27)–[36](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/app/incidents/[id]/page.tsx:36).
- Realtime has a single reconnecting client abstraction ([frontend/lib/realtime.ts:13](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:13)–[54](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:54)) and Zustand already consumes its events ([frontend/store/sos-store.ts:66](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:66)–[105](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:105)).
- MSW is already installed and models current API responses in [frontend/test/handlers.ts:20](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/test/handlers.ts:20), so endpoint-level UI tests fit the project.

### Concerns

- **HIGH — Current refresh discards referral state.** Every WebSocket event refreshes only `GET /api/incidents/{id}` ([frontend/store/sos-store.ts:97](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:97)–[105](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/store/sos-store.ts:105)), whose current response has no referral data. The new store must fetch/merge corridor state explicitly.
- **MEDIUM — Event typing is a closed union.** `IncidentSocketEvent.event` currently accepts only four existing names ([frontend/lib/realtime.ts:3](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:3)–[7](C:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/lib/realtime.ts:7)); payload schemas are unvalidated `Record<string, unknown>`.
- **MEDIUM — The hospital view is selected by a query parameter, not authorization.** The current page can display hospital data/actions based solely on `?role=hospital`; any real acceptance action must handle 401/403 and hide/disable controls when not authorized.
- **MEDIUM — “real-time updates” component tests cannot prove WebSocket integration using MSW alone.** MSW covers HTTP; tests should invoke the store event handler or mock the socket hook.
- **LOW — Store/API naming should preserve the existing `updateFromWsEvent` seam.** The plan’s proposed `handleReferralWsEvent` risks duplicate dispatch logic.

### Suggestions

- Make `getCorridorTimeline()` the initial page load and the reconciliation fetch after referral events; use sequence/version or timestamps to avoid stale refreshes overwriting newer socket events.
- Define discriminated TypeScript event payload types matching backend responses.
- Test loading, empty/no-referral, pending/declined/reroute, forbidden accept, API failure/retry, and all eight stage states—not only happy-path transitions.

### Risk Assessment

**MEDIUM.** The rendering work is contained, but it depends on unresolved backend contracts and can easily show stale or unauthorized clinical workflow state.

---

## 09-05 — Demo Seed, NAPSE RAG Grounding & End-to-End Verification

### Summary

A reproducible Karnataka scenario and grounded knowledge additions are valuable. The plan must first reconcile the existing seed shape with the new clinical flow and avoid claiming browser-style E2E coverage that the specified tests do not provide.

### Strengths

- The existing seed is already idempotent: it updates/creates hospitals and deletes/recreates their stock rows ([backend/seed_demo.py:64](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/seed_demo.py:64)–[101](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/seed_demo.py:101)).
- Seed tests already isolate the database and verify repeatability; `test_rerun_is_idempotent` checks equal counts over two runs at [backend/tests/test_seed_demo.py:113](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/test_seed_demo.py:113)–[118](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/test_seed_demo.py:118).
- Knowledge content is centrally curated in [backend/app/knowledge_base_data.py:1](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/knowledge_base_data.py:1), consistent with adding reviewed clinical chunks.

### Concerns

- **HIGH — The planned PHC/CHC demo facilities do not exist in the current seed.** Current hospital data starts with District Hospital entries, including Mandya DH and K.R. Hospital Mysore ([backend/seed_demo.py:33](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/seed_demo.py:33)–[36](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/seed_demo.py:36)); it has no Malavalli PHC or Srirangapatna CHC.
- **HIGH — `NR-1042` cannot currently be represented as stated.** `Incident.id` is an arbitrary text primary key ([backend/app/database.py:20](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/database.py:20)), while SOS references are generated randomly as `NR-####` in [backend/app/domain.py:149](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/domain.py:149)–[151](C:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/app/domain.py:151). Define whether NR-1042 is the primary ID, a token, or a new stable `reference` column.
- **MEDIUM — The demo tag `OXYGEN` conflicts with the six tag vocabulary defined in the phase.** Either make it canonical and add it to validation, or exclude it.
- **MEDIUM — “E2E verification” is mislabeled.** Backend route integration plus Vitest/MSW do not exercise the deployed frontend/backend corridor together. Browser E2E is explicitly outside the milestone; call this end-to-end API-flow verification.
- **MEDIUM — Fixed test-count claims are brittle.** “110+” and “20+” are not functional acceptance criteria. Assert named behavior and use suite success/build success as the gate.
- **LOW — RAG grounding should include provenance.** The seed format should preserve authoritative source title/section/date, not only narrative content, to make citations inspectable.

### Suggestions

- Seed a stable incident ID/reference and an initial `PENDING` referral only if that supports the demo script; otherwise seed incident + clinical observations and exercise referral creation during rehearsal.
- Assert all capability fields, active status, stock freshness, incident-to-PHC linkage, deterministic target ranking, and no duplicate referrals after two seed runs.
- Add provenance metadata and retrieval tests showing the new chunks are returned for ventilation/referral queries.

### Risk Assessment

**MEDIUM-HIGH.** The intended demo is valuable, but it presently relies on entities and identifiers that the seed/schema do not yet contain.

---

## Cross-plan dependency and execution risk

**HIGH.** All five plans declare `wave: 1` and no dependencies, despite a hard chain:

`09-01 schema → 09-02 domain → 09-03 API/outbox → 09-04 frontend → 09-05 seed/verification`

At minimum, make 09-03 depend on 09-01/02, 09-04 depend on 09-03, and 09-05 depend on all prior plans. This prevents parallel edits to `test_domain.py`, `test_routes.py`, the schema, and contracts from colliding or producing tests against APIs that do not yet exist.

The plans should be revised before implementation, primarily to establish the referral/facility data model, hard lifecycle transition rules, facility-scoped authorization, and truly transactional outbox behavior.
---

## Gemini Review

gemini review failed or returned empty output. stderr:

[spawn error: ENOENT]

Manual diagnostic: the `gemini` CLI (v0.54.4) is installed and on PATH, but the
review lane runner cannot spawn it on this Windows host (the lane declares the
bare binary name `gemini`; node's CreateProcess cannot start the npm `.cmd`
shim, and the gsd-core #2667/#3086 shim only mediates binaries whose names end
in `.cmd`/`.bat`).

Direct invocation was also attempted. The CLI fails authentication before any
review output:

Error authenticating: IneligibleTierError: This client is no longer supported
for Gemini Code Assist for individuals. To continue using Gemini, please
migrate to the Antigravity suite of products: https://antigravity.google

No review was produced for this lane.
