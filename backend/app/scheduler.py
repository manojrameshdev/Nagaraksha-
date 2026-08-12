"""APScheduler setup — replaces threading outbox for compliance job.

The outbox dispatch worker (threading.Thread) is kept for real-time dispatch.
APScheduler runs the compliance scoring job every 15 minutes on the async loop.
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .compliance import run_compliance_job

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_compliance_job,
        trigger="interval",
        minutes=15,
        id="compliance_job",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    # Run once immediately on startup so scores are fresh from the start
    run_compliance_job()
    print("[Scheduler] APScheduler started — compliance job runs every 15 min")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
