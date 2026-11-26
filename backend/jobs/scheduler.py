"""
backend/jobs/scheduler.py
==========================
APScheduler configuration for Daily Job Intelligence background synchronization.
Runs collection daily at 6:00 AM (and seeds database on startup if empty).
"""

from __future__ import annotations

import logging
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database import get_db
from backend.jobs.collector import run_job_collection, seed_curated_jobs
from backend.db_models import JobListing

logger = logging.getLogger(__name__)

_SCHEDULER: Optional[BackgroundScheduler] = None


def daily_job_sync_task() -> None:
    """Scheduled task to execute job collection."""
    logger.info("Executing scheduled daily job synchronization...")
    db = next(get_db())
    try:
        res = run_job_collection(db)
        logger.info(f"Daily job sync completed: {res}")
    except Exception as e:
        logger.error(f"Error during scheduled job sync: {e}", exc_info=True)
    finally:
        db.close()


def ensure_jobs_seeded_on_startup() -> None:
    """Check if job_listings is empty on startup, and seed if needed."""
    db = next(get_db())
    try:
        count = db.query(JobListing).count()
        if count == 0:
            logger.info("job_listings table is empty. Seeding initial curated tech opportunities...")
            seed_curated_jobs(db)
    except Exception as e:
        logger.warning(f"Could not check/seed jobs on startup: {e}")
    finally:
        db.close()


def start_job_scheduler() -> Optional[BackgroundScheduler]:
    """Start background scheduler configured for daily 6:00 AM execution."""
    global _SCHEDULER
    if _SCHEDULER is not None and _SCHEDULER.running:
        return _SCHEDULER

    # Initial seed on startup
    ensure_jobs_seeded_on_startup()

    try:
        _SCHEDULER = BackgroundScheduler()
        _SCHEDULER.add_job(
            daily_job_sync_task,
            trigger=CronTrigger(hour=6, minute=0),
            id="daily_job_sync_job",
            replace_existing=True,
        )
        _SCHEDULER.start()
        logger.info("APScheduler initialized for Daily Job Intelligence (Daily @ 6:00 AM).")
        return _SCHEDULER
    except Exception as e:
        logger.error(f"Failed to start APScheduler: {e}")
        return None


def stop_job_scheduler() -> None:
    """Shut down scheduler on app termination."""
    global _SCHEDULER
    if _SCHEDULER is not None and _SCHEDULER.running:
        _SCHEDULER.shutdown(wait=False)
        logger.info("APScheduler shut down.")
