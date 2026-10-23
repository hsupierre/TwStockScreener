from datetime import date

from tw_etl.http import FetchError
from tw_etl.sources.quotes import Partial, choose, merge_daily, safe
from tw_etl.transform.snapshot import latest_valuations

D1, D2 = date(2026, 10, 21), date(2026, 10, 22)


def part(source, day, n=1000, kind="quotes", error=None):
    rows = {f"{1000 + i}": {"close": 10.0 + i} for i in range(n)}
    return Partial("twse", kind, source, trade_date=day, rows=rows, error=error)


def test_choose_prefers_latest_date_then_official():
    assert choose([part("official", D1), part("openapi", D2)], 900).source == "openapi"  # 日期新的優先
    assert choose([part("openapi", D2), part("official", D2)], 900).source == "official"  # 同日期 official 優先


def test_choose_skips_failed_or_incomplete_sources():
    assert choose([part("official", D2, n=10), part("openapi", D1)], 900).source == "openapi"  # 筆數不足
    assert choose([part("official", None, error="WAF"), part("openapi", D1)], 900).source == "openapi"
    assert choose([part("official", D2, n=10), part("openapi", D1, error="HTTP 503")], 900) is None


def test_safe_turns_exceptions_into_errors():
    def boom():
        raise FetchError("被網站安全機制（WAF）暫時封鎖")

    p = safe("tpex", "quotes", "official", boom)
    assert p.error and "WAF" in p.error and p.rows == {}


def test_merge_daily_combines_quotes_and_valuations():
    q = Partial("twse", "quotes", "official", D2, {"2330": {"close": 2385.0}})
    v_same = Partial("twse", "valuations", "openapi", D2, {"2330": {"pe": 27.65}, "1101": {"pe": 15.0}})
    rows = {(r["code"], r["trade_date"]): r for r in merge_daily(q, v_same)}
    assert rows[("2330", D2)] == {"code": "2330", "trade_date": D2, "close": 2385.0, "pe": 27.65, "source": "official"}
    assert rows[("1101", D2)]["source"] == "openapi"  # 只有估值的列，來源記為估值的來源

    v_old = Partial("twse", "valuations", "openapi", D1, {"2330": {"pe": 28.0}})
    assert {(r["code"], r["trade_date"]) for r in merge_daily(q, v_old)} == {("2330", D2), ("2330", D1)}
    assert merge_daily(None, None) == []


def test_latest_valuations_takes_latest_non_null_value_per_field():
    rows = [
        {"code": "2330", "trade_date": "2026-10-21", "close": 2420.0, "pe": 28.05, "pb": 9.76, "dividend_yield": 0.91},
        # 降級模式（FinMind）只有收盤價：本益比等沿用前一天
        {"code": "2330", "trade_date": "2026-10-22", "close": 2385.0, "pe": None, "pb": None, "dividend_yield": None},
    ]
    v = latest_valuations(rows)["2330"]
    assert v["trade_date"] == "2026-10-22"
    assert v["close"] == 2385.0
    assert (v["pe"], v["pb"], v["dividend_yield"]) == (28.05, 9.76, 0.91)


def test_latest_valuations_date_follows_latest_close():
    rows = [
        {"code": "6488", "trade_date": "2026-10-21", "close": 844.0},
        {"code": "6488", "trade_date": "2026-10-22", "close": None, "pe": 40.1},  # 只有估值
    ]
    v = latest_valuations(rows)["6488"]
    assert v["trade_date"] == "2026-10-21"
    assert (v["close"], v["pe"]) == (844.0, 40.1)
