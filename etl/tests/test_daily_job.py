"""run_daily 的來源選擇與降級模式（以假的來源與資料庫測試，不連網路）。"""

from datetime import date
from typing import Any

import pytest

from tw_etl import jobs
from tw_etl.config import Settings
from tw_etl.http import FetchError
from tw_etl.jobs import Context, collect_market_daily, run_daily
from tw_etl.sources.quotes import Partial
from tw_etl.transform.snapshot import SanityError

from .test_snapshot_job import FakeDb

D1, D2 = date(2026, 10, 21), date(2026, 10, 22)
TWSE_CODES = [f"{1000 + i}" for i in range(1000)]
TPEX_CODES = [f"{5000 + i}" for i in range(800)]


def ok(market: str, kind: str, source: str, day: date):
    codes = TWSE_CODES if market == "twse" else TPEX_CODES
    field = {"close": 10.0} if kind == "quotes" else {"pe": 12.0}
    return lambda f: Partial(market, kind, source, trade_date=day, rows={c: dict(field) for c in codes})  # type: ignore[arg-type]


def fail(message: str):
    def fn(f):
        raise FetchError(message)

    return fn


def set_sources(monkeypatch, table: dict[tuple[str, str], list[tuple[str, Any]]], odd=None) -> None:
    monkeypatch.setattr(jobs, "DAILY_SOURCES", table)
    monkeypatch.setattr(
        jobs, "ODD_LOTS", odd or (lambda f, day: Partial("twse", "odd", "official", error="測試未提供"))
    )
    monkeypatch.setattr(jobs, "BLOCK_TRADES", lambda f, day: Partial("twse", "block", "official", error="測試未提供"))


def healthy(official_day=D2, openapi_day=D1):
    return {
        (m, k): [("official", ok(m, k, "official", official_day)), ("openapi", ok(m, k, "openapi", openapi_day))]
        for m in ("twse", "tpex")
        for k in ("quotes", "valuations")
    }


def make_ctx(db: FakeDb) -> Context:
    return Context(
        db=db,
        fetcher=None,  # type: ignore[arg-type]
        settings=Settings(supabase_url="https://x", service_key="k"),
        today=date(2026, 10, 23),
    )


@pytest.fixture
def companies(monkeypatch):
    rows = [{"code": c, "name": c, "market": "twse", "is_active": True} for c in TWSE_CODES] + [
        {"code": c, "name": c, "market": "tpex", "is_active": True} for c in TPEX_CODES
    ]
    monkeypatch.setattr(jobs.openapi, "fetch_companies", lambda f: rows)
    return rows


def written(db: FakeDb, table: str) -> list[dict[str, Any]]:
    return [r for t, rows in db.upserts if t == table for r in rows]


def test_official_is_used_when_it_is_fresher(monkeypatch):
    set_sources(monkeypatch, healthy(official_day=D2, openapi_day=D1))
    quote, valuation, report = collect_market_daily(None, "twse")  # type: ignore[arg-type]
    assert (quote.source, quote.trade_date) == ("official", D2)
    assert (valuation.source, valuation.trade_date) == ("official", D2)
    assert report["quotes"]["source"] == "official"
    assert len(report["quotes"]["candidates"]) == 2


def test_openapi_is_used_when_official_is_blocked(monkeypatch):
    table = healthy(official_day=D2, openapi_day=D2)
    table[("tpex", "quotes")][0] = ("official", fail("被網站安全機制（WAF）暫時封鎖"))
    set_sources(monkeypatch, table)
    quote, _, report = collect_market_daily(None, "tpex")  # type: ignore[arg-type]
    assert quote.source == "openapi"
    assert "WAF" in report["quotes"]["candidates"][0]


def test_run_daily_writes_source_and_does_not_degrade(monkeypatch, companies):
    set_sources(monkeypatch, healthy())
    db = FakeDb({})
    run_daily(make_ctx(db), snapshot=False)
    rows = written(db, "daily_valuation")
    assert {r["source"] for r in rows} == {"official"}
    assert {r["trade_date"] for r in rows} == {D2}
    assert len(rows) == len(TWSE_CODES) + len(TPEX_CODES)


def test_run_daily_degrades_to_finmind_when_a_market_has_no_quotes(monkeypatch, companies):
    table = healthy()
    table[("tpex", "quotes")] = [("official", fail("HTTP 503")), ("openapi", fail("回傳的不是 JSON"))]
    set_sources(monkeypatch, table)
    ranked = [{"code": c, "market_cap": 1000 - i} for i, c in enumerate(TPEX_CODES)]
    db = FakeDb({"screen_snapshot": ranked})
    asked: list[list[str]] = []

    def fake_fill(f, codes, since, token):
        asked.append(codes)
        return [{"code": c, "trade_date": D2, "close": 1.0, "source": "finmind"} for c in codes[:5]]

    monkeypatch.setattr(jobs.finmind, "fill_prices", fake_fill)
    run_daily(make_ctx(db), snapshot=False)

    assert asked[0] == TPEX_CODES[: jobs.FINMIND_MAX_STOCKS]  # 依市值排序、只補前 N 檔
    rows = written(db, "daily_valuation")
    assert sum(r["source"] == "finmind" for r in rows) == 5
    assert any(r["source"] == "official" and r["code"] in TPEX_CODES for r in rows)  # 上櫃估值仍寫入
    status = [v for t, _, v in db.updates if t == "etl_runs"][-1]
    assert status["status"] == "success" and status["details"]["degraded"] is True


def test_run_daily_fails_when_nothing_is_available(monkeypatch, companies):
    set_sources(monkeypatch, {key: [("official", fail("x")), ("openapi", fail("y"))] for key in healthy()})
    monkeypatch.setattr(jobs.finmind, "fill_prices", lambda *a: [])
    db = FakeDb({"screen_snapshot": []})
    with pytest.raises(SanityError, match="都無法取得"):
        run_daily(make_ctx(db), snapshot=False)
    assert not written(db, "daily_valuation")
