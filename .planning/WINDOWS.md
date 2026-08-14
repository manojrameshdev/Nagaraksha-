---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-14T20:27:01.061Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | frontend/lib/api.ts |  | Browser manual checks (plan verification 2-5): Authorization header, ws:// connection, useAuth login, useGeolocation coords — require running app + backend; not automatable here | open |  | 2026-08-14T20:27:01.061Z |  |

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
  }
]
````
