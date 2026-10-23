"""run_snapshot 的整合測試：用假的資料庫確認「失敗時不覆蓋線上快照」與成功時的寫入內容。"""

from datetime import date
from typing import Any

import httpx
import pytest

from tw_etl import jobs
from tw_etl.config import Settings
from tw_etl.jobs import Context, run_snapshot
from tw_etl.transform.snapshot import SanityError


class FakeDb:
    def __init__(self, tables: dict[str, list[dict[str, Any]]]):
        self.tables = tables
        self.upserts: list[tuple[str, list[dict[str, Any]]]] = []
        self.updates: list[tuple[str, dict[str, str], dict[str, Any]]] = []
        self.deletes: list[tuple[str, dict[str, str]]] = []

    def select_all(self, table, *, select="*", order, filters=None):
        return list(self.tables.get(table, []))

    def insert(self, table, row):
        return {"id": 1, **row}

    def update(self, table, filters, values):
        self.updates.append((table, filters, values))

    def upsert(self, table, rows, *, on_conflict, chunk=500):
        self.upserts.append((table, list(rows)))
        return len(rows)

    def delete(self, table, filters):
        self.deletes.append((table, filters))


def make_tables(n: int = 3) -> dict[str, list[dict[str, Any]]]:
    companies = [
        {"code": f"{1000 + i}", "name": f"公司{i}", "market": "twse", "industry": "測試", "report_type": "ci",
         "shares_outstanding": 1000, "listed_at": "2000-01-01", "is_active": True}
        for i in range(n)
    ]  # fmt: skip
    valuations = [{"code": c["code"], "trade_date": "2026-10-21", "close": 100.0, "pe": 10.0} for c in companies]
    return {"companies": companies, "daily_valuation": valuations}


def make_ctx(db: FakeDb, **settings) -> Context:
    s = Settings(supabase_url="https://x.supabase.co", service_key="k", **settings)
    return Context(db=db, fetcher=None, settings=s, today=date(2026, 10, 23))  # type: ignore[arg-type]


def test_failed_sanity_check_keeps_existing_snapshot(monkeypatch):
    db = FakeDb(make_tables())
    monkeypatch.setattr(jobs, "check_snapshot", lambda rows: ["只有 3 檔（預期至少 1500）"])

    with pytest.raises(SanityError, match="保留線上舊資料"):
        run_snapshot(make_ctx(db))

    assert not any(table == "screen_snapshot" for table, _ in db.upserts), "失敗時不可寫入快照"
    assert not any(table == "screen_snapshot" for table, _ in db.deletes), "失敗時不可刪除快照"
    assert not any(table == "data_freshness" for table, _ in db.upserts), "失敗時不可更新資料日期"
    status = [v for t, _, v in db.updates if t == "etl_runs"][-1]
    assert status["status"] == "failed"
    assert "problems" in status["details"]
    assert "SanityError" in status["error"]


def test_successful_snapshot_writes_rows_removes_stale_and_updates_freshness(monkeypatch):
    db = FakeDb(make_tables())
    monkeypatch.setattr(jobs, "check_snapshot", lambda rows: [])

    run_snapshot(make_ctx(db))

    (rows,) = [rows for table, rows in db.upserts if table == "screen_snapshot"]
    assert [r["code"] for r in rows] == ["1000", "1001", "1002"]
    assert rows[0]["close"] == 100.0 and rows[0]["market_cap"] == 100_000
    stamp = rows[0]["updated_at"]
    assert db.deletes == [("screen_snapshot", {"updated_at": f"lt.{stamp.isoformat()}"})]
    (freshness,) = [rows for table, rows in db.upserts if table == "data_freshness"]
    assert freshness[0]["job"] == "snapshot" and freshness[0]["as_of"] == "2026-10-21"
    assert [v for t, _, v in db.updates if t == "etl_runs"][-1]["status"] == "success"


def test_revalidate_is_called_after_success_when_configured(monkeypatch):
    db = FakeDb(make_tables())
    monkeypatch.setattr(jobs, "check_snapshot", lambda rows: [])
    calls: list[dict[str, Any]] = []

    def fake_post(url, json, headers, timeout):
        calls.append({"url": url, "json": json, "auth": headers["Authorization"]})
        return httpx.Response(200)

    monkeypatch.setattr(jobs.httpx, "post", fake_post)
    run_snapshot(make_ctx(db, site_url="https://example.com", revalidate_secret="s" * 40))

    assert calls == [
        {"url": "https://example.com/api/revalidate", "json": {"tags": ["snapshot"]}, "auth": "Bearer " + "s" * 40}
    ]


def test_revalidate_failure_does_not_fail_the_job(monkeypatch):
    db = FakeDb(make_tables())
    monkeypatch.setattr(jobs, "check_snapshot", lambda rows: [])

    def broken_post(*args, **kwargs):
        raise httpx.ConnectError("網站暫時連不上")

    monkeypatch.setattr(jobs.httpx, "post", broken_post)
    run_snapshot(make_ctx(db, site_url="https://example.com", revalidate_secret="s" * 40))  # 不應丟出例外
    assert any(table == "screen_snapshot" for table, _ in db.upserts)
