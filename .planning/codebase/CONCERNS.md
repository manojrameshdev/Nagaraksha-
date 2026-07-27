# CONCERNS.md — Known Issues, Technical Debt, and Risks

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## 🔴 Critical — Address Before Production

### 1. Dispatch Responders Are Simulated
**File**: `backend/app/domain.py:simulate_dispatch()`  
**Issue**: All three dispatch lanes (TRAINED, RESCUE, AMBULANCE) use hardcoded candidate lists (`Anjali M.`, `Ravi K.`, `Bannerghatta Rescue Cell`, etc.). These are fictional responders. In production, this must be replaced with a real responder registry API/database.  
**Impact**: SOS fires against a real incident DB with real coordinates, but responders are simulated — no real alerts are sent.

### 2. Hospital Data Is Seeded Demo Data
**File**: `backend/app/seed.py`  
**Issue**: 4 hospitals are seeded with hardcoded Bengaluru coordinates and manually set antivenom stock status. This is not live hospital data — it doesn't reflect actual antivenom availability.  
**Impact**: Hospital ranking works correctly algorithmically, but the data it ranks is fabricated.

### 3. No Authentication / Authorization
**Issue**: All API endpoints are public. Anyone with network access can POST `/api/sos`, PATCH stock, or read audit trails. No JWT, API key, or session system exists.  
**Impact**: Spam incidents, stock manipulation, audit data exposure.

---

## 🟡 Medium — Tech Debt

### 4. `interactive.tsx` Is a God File (62KB, 1700+ lines)
**File**: `frontend/src/components/interactive.tsx`  
**Issue**: Contains 10+ exported components: `LiveSosDemo`, `RiskPanel`, `SnakeId`, `MythBuster`, `StatsStrip`, `AuditTrailPanel`, `OutboxPanel`, `HospitalStockConsole`, `SymptomLogger`, `KnowledgeBasePanel`. All in one 1700-line file.  
**Impact**: Hard to navigate, long compile times, poor code splitting. Should be split into `components/sos/`, `components/myth/`, etc.

### 5. Geolocation Label Is Raw Coordinates
**File**: `frontend/src/hooks/use-geolocation.ts`  
**Issue**: When GPS is acquired, the label is `GPS location (12.9719, 77.5937)` — raw lat/lng. No reverse geocoding is wired, so the address displayed to the user is opaque.  
**Mitigation**: Could call a free geocoding API (Nominatim/OpenStreetMap) to convert coords to area name.

### 6. SSE Stream Has No Reconnect Handling
**File**: `frontend/src/components/interactive.tsx:LiveSosDemo`  
**Issue**: `EventSource.onerror` callback is empty — network interruptions silently kill the stream. The incident view freezes.  
**Fix**: Add reconnect logic with exponential backoff or use the native EventSource `retry` field.

### 7. Risk Data Is Static (Not Weather-Driven)
**File**: `backend/app/seed.py`, `backend/app/routes/risk.py`  
**Issue**: Risk reports are seeded once at startup with fixed weather strings (`Monsoon 28C 86% humidity`). They don't update based on actual weather. The risk level shown to the user never changes.  
**Fix**: Integrate OpenWeatherMap API to dynamically compute risk score based on real weather.

### 8. `domain.py:simulate_dispatch()` Ignores Real GPS Coordinates
**File**: `backend/app/domain.py`  
**Issue**: `simulate_dispatch(origin)` receives real lat/lng from the SOS payload but ignores it — distances are hardcoded (2.4km, 3.0km, etc.). The responder ETAs do not reflect the user's actual location.  
**Fix**: Once a real responder registry exists, distances should be computed with Haversine.

### 9. Prisma Listed as Dependency But Unused at Runtime
**File**: `frontend/package.json`  
**Issue**: `@prisma/client` and `prisma` are in dependencies, and `db:push`/`db:generate` scripts exist, suggesting a Prisma migration was planned or partially wired. The Python backend uses raw sqlite3, not Prisma.  
**Risk**: Adds ~8MB to bundle; confusing to contributors.

---

## 🟢 Low — Minor Issues

### 10. `gen_incident_ref()` Uses `random.randint()`
**File**: `backend/app/domain.py`  
**Issue**: Incident reference numbers (`NR-1234`) can collide if two incidents are created near-simultaneously.  
**Fix**: Use a monotonic sequence counter or include a timestamp component.

### 11. Service Worker Disabled on Localhost But Enabled in Prod
**File**: `frontend/src/app/layout.tsx`  
**Issue**: SW registration is blocked for `localhost`/`127.0.0.1`. This was the fix for the repetitive re-render loop in dev. However, if the dev server is accessed by IP (e.g. `192.168.x.x`), the SW may still register and cause issues.  
**Fix**: Check `NODE_ENV !== 'production'` instead of hostname.

### 12. Audit Route Returns Full JSON Metadata
**File**: `backend/app/routes/incidents.py`  
**Issue**: Audit events include `metadata` as full JSON strings. For high-volume incidents, this could be large — no pagination, no field filtering.

### 13. Bandit False Positive: `# nosec B608`
**File**: `backend/app/seed.py`  
**Issue**: `DELETE FROM {t}` suppresses B608 with `# nosec B608`. While the table name comes from a hardcoded tuple and is safe, future developers may copy this pattern with user-supplied table names.

---

## Summary Table

| # | Severity | Area | Fix Effort |
|---|---------|------|-----------|
| 1 | 🔴 Critical | Simulated responders | High (new system) |
| 2 | 🔴 Critical | Demo hospital data | High (data ops) |
| 3 | 🔴 Critical | No auth | High |
| 4 | 🟡 Medium | God file interactive.tsx | Medium (refactor) |
| 5 | 🟡 Medium | Raw GPS label | Low (API call) |
| 6 | 🟡 Medium | SSE reconnect | Low |
| 7 | 🟡 Medium | Static risk data | Medium (weather API) |
| 8 | 🟡 Medium | Hardcoded dispatch distances | Blocked on #1 |
| 9 | 🟡 Medium | Unused Prisma dep | Low (remove) |
| 10 | 🟢 Low | Ref collision | Low |
| 11 | 🟢 Low | SW env check | Low |
| 12 | 🟢 Low | Audit pagination | Low |
| 13 | 🟢 Low | Bandit nosec pattern | Low |
