"""除權息：解析證交所／櫃買中心的除權除息計算結果表，並修正除權息日的漲跌。"""

from datetime import date

import pytest

from tw_etl import jobs
from tw_etl.http import FetchError
from tw_etl.sources.official import parse_tpex_ex_rights, parse_twse_ex_rights
from tw_etl.sources.quotes import Partial, apply_ex_rights

from .test_daily_job import D2, FakeDb, companies, healthy, make_ctx, set_sources, written  # noqa: F401

TWSE_FIELDS = ["資料日期", "股票代號", "股票名稱", "除權息前收盤價", "除權息參考價", "權值+息值", "權/息", "漲停價格",
               "跌停價格", "開盤競價基準", "減除股利參考價", "詳細資料"]  # fmt: skip
TPEX_FIELDS = ["除權息日期", "代號", "名稱", "除權息前收盤價", "除權息參考價", "權值", "息值", "權值+息值", "權/息",
               "漲停價", "跌停價"]  # fmt: skip


def test_parse_twse_ex_rights():
    rows = parse_twse_ex_rights(
        {
            "stat": "OK",
            "fields": TWSE_FIELDS,
            "data": [
                # 興富發 2026-09-23 除息 4 元
                ["115年09月23日", "2542", "興富發", "45.45", "41.45", "4.000000", "息", "45.55", "37.35", "41.45",
                 "41.45", "2542,20260923"],
                ["115年09月01日", "00939", "統一台灣高息動能", "23.17", "23.04", "0.125000", "息", "25.34", "20.74",
                 "23.04", "23.04", ""],  # ETF 不是一般股票
            ],
        }
    )  # fmt: skip
    assert rows == [
        {
            "code": "2542",
            "trade_date": date(2026, 9, 23),
            "kind": "息",
            "prev_close": 45.45,
            "reference_price": 41.45,
            "value": 4.0,
            "cash_dividend": None,
        }
    ]


def test_parse_twse_ex_rights_empty_period():
    assert parse_twse_ex_rights({"stat": "很抱歉，沒有符合條件的資料!"}) == []
    with pytest.raises(ValueError, match="除權息表異常"):
        parse_twse_ex_rights({"stat": "查詢日期大於今日"})


def test_parse_tpex_ex_rights_normalizes_kind():
    rows = parse_tpex_ex_rights(
        {
            "tables": [
                {
                    "fields": TPEX_FIELDS,
                    "data": [
                        ["115/09/01", "3078", "僑威              ", "51.90", "47.90", "0.000000", "4.000000",
                         "4.000000", "除息", "52.60", "43.15"],
                        ["115/09/15", "6488", "環球晶", "900.00", "880.00", "10.000000", "10.000000", "20.000000",
                         "除權息", "968.00", "792.00"],
                    ],
                }
            ]
        }
    )  # fmt: skip
    assert [(r["code"], r["kind"], r["reference_price"], r["cash_dividend"]) for r in rows] == [
        ("3078", "息", 47.9, 4.0),
        ("6488", "權息", 880.0, 10.0),
    ]


def test_apply_ex_rights_uses_reference_price():
    # 3078 在 9/1 除息：收盤 48.45、參考價 47.90，櫃買中心的漲跌欄位是文字（解析為 None）
    quotes = Partial("tpex", "quotes", "official", date(2026, 9, 1), {"3078": {"close": 48.45}, "6488": {"close": 1}})
    ex = [
        {"code": "3078", "trade_date": date(2026, 9, 1), "reference_price": 47.9},
        {"code": "3078", "trade_date": date(2026, 9, 2), "reference_price": 1.0},  # 不同天不影響
        {"code": "9999", "trade_date": date(2026, 9, 1), "reference_price": 1.0},  # 當天沒有行情
    ]
    assert apply_ex_rights(quotes, ex) == 1
    assert quotes.rows["3078"]["change"] == 0.55
    assert "change" not in quotes.rows["6488"]


def test_run_daily_fixes_change_on_ex_rights_day(monkeypatch, companies):  # noqa: F811
    code = companies[0]["code"]  # 上市第一檔；healthy() 的收盤價都是 10.0
    ex = [{"code": code, "trade_date": D2, "kind": "息", "prev_close": 10.6, "reference_price": 9.6, "value": 1.0}]
    set_sources(monkeypatch, healthy(), ex={"twse": lambda f, s, e: ex, "tpex": lambda f, s, e: []})
    db = FakeDb({})
    jobs.run_daily(make_ctx(db), snapshot=False)

    row = next(r for r in written(db, "daily_valuation") if r["code"] == code)
    assert row["change"] == 0.4  # 10.0 − 9.6
    assert written(db, "ex_rights") == ex
    status = [v for t, _, v in db.updates if t == "etl_runs"][-1]
    assert status["details"]["twse"]["ex_rights"] == 1


def test_run_daily_continues_when_ex_rights_fails(monkeypatch, companies):  # noqa: F811
    def boom(f, s, e):
        raise FetchError("HTTP 503")

    set_sources(monkeypatch, healthy(), ex={"twse": boom, "tpex": lambda f, s, e: []})
    db = FakeDb({})
    jobs.run_daily(make_ctx(db), snapshot=False)
    assert len(written(db, "daily_valuation")) > 0
    status = [v for t, _, v in db.updates if t == "etl_runs"][-1]
    assert status["status"] == "success"
    assert status["details"]["twse"]["ex_rights"] == "失敗"
