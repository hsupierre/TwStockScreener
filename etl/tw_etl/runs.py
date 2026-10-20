"""ETL 執行紀錄（etl_runs）與資料基準（data_freshness）。"""

from __future__ import annotations

import logging
import traceback
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from .load.supabase import Supabase

log = logging.getLogger(__name__)

# 工作名稱 → data_freshness.job（回補與定期工作更新同一個資料集）
FRESHNESS_JOB = {
    "daily": "daily",
    "monthly": "monthly",
    "quarterly": "quarterly",
    "dividend": "dividend",
    "snapshot": "snapshot",
    "backfill-quarterly": "quarterly",
    "backfill-revenue": "monthly",
    "backfill-dividend": "dividend",
}


@dataclass
class Run:
    job: str
    started_at: datetime
    rows_written: int = 0
    as_of: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


@contextmanager
def track_run(db: Supabase, job: str, *, dry_run: bool = False) -> Iterator[Run]:
    run = Run(job=job, started_at=datetime.now(UTC))
    run_id: int | None = None
    if not dry_run:
        run_id = db.insert("etl_runs", {"job": job, "status": "running", "started_at": run.started_at})["id"]
    try:
        yield run
    except BaseException as e:
        log.error("%s 失敗：%s", job, e)
        if run_id is not None:
            db.update(
                "etl_runs",
                {"id": f"eq.{run_id}"},
                {
                    "status": "failed",
                    "finished_at": datetime.now(UTC),
                    "rows_written": run.rows_written,
                    "details": run.details,
                    "error": "".join(traceback.format_exception(e))[-4000:],
                },
            )
        raise
    log.info("%s 完成：寫入 %d 列，資料基準 %s", job, run.rows_written, run.as_of)
    if run_id is not None:
        finished = datetime.now(UTC)
        db.update(
            "etl_runs",
            {"id": f"eq.{run_id}"},
            {"status": "success", "finished_at": finished, "rows_written": run.rows_written, "details": run.details},
        )
        if run.as_of and (freshness_job := FRESHNESS_JOB.get(job)):
            db.upsert(
                "data_freshness",
                [{"job": freshness_job, "as_of": run.as_of, "finished_at": finished}],
                on_conflict="job",
            )
