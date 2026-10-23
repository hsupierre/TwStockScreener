"""成交量相關：MI_INDEX 解析、20 日均量、漲跌幅、歷史行情回補。"""

from datetime import date, timedelta

import pytest

from tw_etl import jobs
from tw_etl.config import Settings
from tw_etl.jobs import Context, load_price_history
from tw_etl.runs import Run
from tw_etl.sources.official import parse_twse_mi_index
from tw_etl.sources.quotes import Partial
from tw_etl.transform.snapshot import change_pct, latest_valuations

from .test_snapshot_job import FakeDb

MI_FIELDS = ["證券代號", "證券名稱", "成交股數", "成交筆數", "成交金額", "開盤價", "最高價", "最低價", "收盤價",
             "漲跌(+/-)", "漲跌價差", "最後揭示買價"]  # fmt: skip


def mi_row(code, close, sign_html, diff, volume="1,000"):
    return [code, "名稱", volume, "10", "100,000", close, close, close, close, sign_html, diff, close]


def test_parse_twse_mi_index_combines_sign_and_magnitude():
    data = {
        "stat": "OK",
        "date": "20260915",
        "tables": [
            {"title": "價格指數", "fields": ["指數", "收盤指數"], "data": [["寶島股價指數", "50,907.44"]]},
            {
                "title": "每日收盤行情",
                "fields": MI_FIELDS,
                "data": [
                    mi_row("2330", "2,385.00", "<p style= color:red>+</p>", "5.00", "15,215,752"),
                    mi_row("1101", "30.00", "<p style= color:green>-</p>", "0.50"),
                    mi_row("2881", "158.50", " ", "0.00"),
                    mi_row(
                        "00878", "22.00", "+", "0.10"
                    ),  # 5 碼 ETF 被代號格式排除（0050 這類 4 碼 ETF 由公司清單排除）
                ],
            },
        ],
    }
    p = parse_twse_mi_index(data)
    assert p.trade_date == date(2026, 9, 15)
    assert p.rows["2330"] == {"close": 2385.0, "change": 5.0, "volume": 15215752, "trade_value": 100000}
    assert p.rows["1101"]["change"] == -0.5
    assert p.rows["2881"]["change"] == 0.0
    assert "00878" not in p.rows


def test_parse_twse_mi_index_holiday():
    with pytest.raises(ValueError, match="沒有資料"):
        parse_twse_mi_index({"stat": "很抱歉，沒有符合條件的資料!"})


def test_change_pct_uses_previous_close():
    assert change_pct(33.9, -0.45) == pytest.approx(-1.31, abs=0.01)  # 前一日 34.35
    assert change_pct(10.0, None) is None
    assert change_pct(None, 1.0) is None
    assert change_pct(1.0, 1.0) is None  # 前一日收盤為 0


def _days(n, start=date(2026, 9, 1)):
    return [(start + timedelta(days=i)).isoformat() for i in range(n)]


def test_latest_valuations_quote_fields_come_only_from_latest_trading_day():
    rows = [
        {"code": "1808", "trade_date": "2026-10-21", "close": 34.35, "change": -0.15, "volume": 1209249, "pe": 8.1},
        {"code": "1808", "trade_date": "2026-10-22", "close": 33.9, "change": -0.45, "volume": None, "pe": None},
    ]
    v = latest_valuations(rows)["1808"]
    assert (v["trade_date"], v["close"], v["change"]) == ("2026-10-22", 33.9, -0.45)
    assert v["volume"] is None  # 不沿用前一天的成交量
    assert v["pe"] == 8.1  # 估值沿用最近一筆


def test_avg_volume_20d_uses_last_20_days_and_needs_at_least_10():
    rows = [
        {"code": "2330", "trade_date": d, "close": 100.0, "volume": (i + 1) * 1000} for i, d in enumerate(_days(25))
    ]
    v = latest_valuations(rows)["2330"]
    assert v["avg_volume_20d"] == round(sum(range(6, 26)) * 1000 / 20)  # 第 6～25 天
    few = latest_valuations(rows[:9])["2330"]
    assert few["avg_volume_20d"] is None


def test_load_price_history_skips_weekends_and_holidays(monkeypatch):
    requested: list[tuple[str, date]] = []

    def fake(market):
        def fn(f, day):
            requested.append((market, day))
            if day == date(2026, 10, 9):  # 國慶日連假
                return Partial(market, "quotes", "official", error="沒有可用的資料")
            n = 1000 if market == "twse" else 800
            rows = {f"{(1000 if market == 'twse' else 5000) + i}": {"close": 10.0, "volume": 1000} for i in range(n)}
            return Partial(market, "quotes", "official", trade_date=day, rows=rows)

        return fn

    monkeypatch.setattr(jobs, "HISTORY_QUOTES", {"twse": fake("twse"), "tpex": fake("tpex")})
    monkeypatch.setattr(jobs, "ODD_LOTS", lambda f, day: Partial("twse", "odd", "official", trade_date=day, rows={}))
    monkeypatch.setattr(
        jobs, "BLOCK_TRADES", lambda f, day: Partial("twse", "block", "official", trade_date=day, rows={})
    )
    codes = [{"code": f"{1000 + i}"} for i in range(1000)] + [{"code": f"{5000 + i}"} for i in range(800)]
    db = FakeDb({"companies": codes})

    class FakeFetcher:
        def set_min_interval(self, host, seconds):
            pass

    ctx = Context(
        db=db,  # type: ignore[arg-type]
        fetcher=FakeFetcher(),  # type: ignore[arg-type]
        settings=Settings(supabase_url="x", service_key="k"),
        today=date(2026, 10, 13),  # 週二
    )
    run = Run(job="backfill-prices", started_at=None)  # type: ignore[arg-type]
    load_price_history(ctx, run, days=7)  # 10/6（二）～10/12（一）

    days = sorted({d for _, d in requested})
    assert days == [date(2026, 10, d) for d in (6, 7, 8, 9, 12)]  # 不查 10/10、10/11（週六日）
    written_days = {r["trade_date"] for t, rows in db.upserts if t == "daily_valuation" for r in rows}
    assert date(2026, 10, 9) not in written_days
    assert run.details["trading_days"] == 4
    assert run.as_of == "2026-10-12"
