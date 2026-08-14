---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-14T20:57:12.786Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | frontend/lib/api.ts |  | Browser manual checks (plan verification 2-5): Authorization header, ws:// connection, useAuth login, useGeolocation coords — require running app + backend; not automatable here | open |  | 2026-08-14T20:27:01.061Z |  |
| 2 | 07 | unrun-verify | frontend/app/hospitals/page.tsx |  | Plan 07-03 browser checks (D9): /hospitals, /dashboard, /myth-buster, /risk render; SymptomLogger POST, DispatchActions accept, StockUpdate role gate, HealthIndicator badge — require running backend + browser; not automatable here | open |  | 2026-08-14T20:57:12.786Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "frontend/lib/api.ts",
    "line": null,
    "description": "Browser manual checks (plan verification 2-5): Authorization header, ws:// connection, useAuth login, useGeolocation coords — require running app + backend; not automatable here",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-14T20:27:01.061Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "frontend/app/hospitals/page.tsx",
    "line": null,
    "description": "Plan 07-03 browser checks (D9): /hospitals, /dashboard, /myth-buster, /risk render; SymptomLogger POST, DispatchActions accept, StockUpdate role gate, HealthIndicator badge — require running backend + browser; not automatable here",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-14T20:57:12.786Z",
    "resolved_at": null
  }
]
````
