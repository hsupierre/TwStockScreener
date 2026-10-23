"""上市零股：用 2915 潤泰全 2026-10-22 的實際數字驗證「整股成交量」與其他看盤軟體一致（1,190 張）。"""

from datetime import date

import pytest

from tw_etl.sources.official import parse_twse_block, parse_twse_odd
from tw_etl.sources.quotes import Partial, merge_daily
from tw_etl.transform.snapshot import board_lot, latest_valuations

D = date(2026, 10, 22)
ODD_FIELDS = ["證券代號", "證券名稱", "成交股數", "成交筆數", "成交金額"]


def odd_json(rows, day="20261022"):
    return {"stat": "OK", "date": day, "fields": ODD_FIELDS, "data": rows}


def test_parse_twse_odd_sums_intraday_and_after_hours():
    p = parse_twse_odd(
        odd_json([["2915", "潤泰全", "9,676", "103", "561,326"], ["2330", "台積電", "50,000", "900", "119,250,000"]]),
        odd_json([["2915", "潤泰全", "40", "2", "2,304"]]),
    )
    assert (p.kind, p.trade_date) == ("odd", D)
    assert p.rows["2915"] == {"odd_volume": 9716, "odd_trade_value": 563630}
    assert p.rows["2330"] == {"odd_volume": 50000, "odd_trade_value": 119250000}


def test_parse_twse_odd_rejects_holiday_or_mismatched_dates():
    with pytest.raises(ValueError, match="沒有資料"):
        parse_twse_odd({"stat": "很抱歉，沒有符合條件的資料!"}, odd_json([]))
    with pytest.raises(ValueError, match="日期不一致"):
        parse_twse_odd(odd_json([], "20261022"), odd_json([], "20261021"))


def test_merge_daily_adds_odd_lots_only_for_same_day_quotes():
    quotes = Partial("twse", "quotes", "official", D, {"2915": {"volume": 1199716}, "2881": {"volume": 5000000}})
    odd = Partial("twse", "odd", "official", D, {"2915": {"odd_volume": 9716, "odd_trade_value": 563630}})
    rows = {r["code"]: r for r in merge_daily(quotes, None, odd)}
    assert rows["2915"]["odd_volume"] == 9716
    assert rows["2881"]["odd_volume"] == 0  # 當天沒有零股成交：記為 0，不是 NULL

    stale = Partial("twse", "odd", "official", date(2026, 10, 21), odd.rows)
    assert "odd_volume" not in merge_daily(quotes, None, stale)[0]  # 日期不同不併入

    failed = Partial("twse", "odd", "official", error="WAF")
    assert "odd_volume" not in merge_daily(quotes, None, failed)[0]


def test_board_lot():
    assert board_lot(1199716, 9716) == 1190000
    assert board_lot(9364000, None) == 9364000  # 上櫃：公布值就是整股
    assert board_lot(None, 10) is None
    assert board_lot(100, 500) == 0  # 不會變成負數


def test_snapshot_volume_is_board_lot_and_matches_other_sites():
    rows = [
        {
            "code": "2915",
            "trade_date": "2026-10-22",
            "close": 57.8,
            "change": 0.2,
            "volume": 1199716,
            "trade_value": 69591630,
            "odd_volume": 9716,
            "odd_trade_value": 563630,
        }
    ]
    v = latest_valuations(rows)["2915"]
    assert v["volume"] == 1_190_000  # 1,190 張
    assert v["trade_value"] == 69_028_000  # 0.690 億


def test_avg_volume_uses_board_lots():
    rows = [
        {"code": "2330", "trade_date": f"2026-10-{d:02d}", "close": 100.0, "volume": 1_001_500, "odd_volume": 1_500}
        for d in range(1, 21)
    ]
    assert latest_valuations(rows)["2330"]["avg_volume_20d"] == 1_000_000


BLOCK_FIELDS = ["證券代號", "證券名稱", "交易別", "成交價", "成交股數", "成交金額"]


def block_json(rows, day="20261022"):
    return {"stat": "OK", "date": day, "fields": BLOCK_FIELDS, "data": rows}


def test_parse_twse_block_sums_trades_per_stock():
    p = parse_twse_block(
        block_json(
            [
                ["1316", "上曜", "配對交易", "20.50", "4,000,000", "82,000,000"],
                ["1316", "上曜", "逐筆交易", "20.60", "655,843", "13,510,366"],
                ["2330", "台積電", "配對交易", "2,385.00", "500,000", "1,192,500,000"],
            ]
        )
    )
    assert (p.kind, p.trade_date) == ("block", D)
    assert p.rows["1316"] == {"block_volume": 4_655_843, "block_trade_value": 95_510_366}
    assert p.rows["2330"]["block_volume"] == 500_000


def test_parse_twse_block_day_without_trades_is_empty_success():
    p = parse_twse_block(block_json([]))
    assert (p.error, p.trade_date, p.rows) == (None, D, {})
    quotes = Partial("twse", "quotes", "official", D, {"1316": {"volume": 5_653_649}})
    assert merge_daily(quotes, None, p)[0]["block_volume"] == 0  # 沒有鉅額交易：記為 0


def test_block_trades_are_excluded_like_other_sites():
    # 1316 上曜 2026-10-22：證交所 5,653,649 股 − 零股 3,806 − 鉅額 4,655,843 = 994 張（Yahoo 總量 994 張）
    assert board_lot(5_653_649, 3_806, 4_655_843) == 994_000
    quotes = Partial("twse", "quotes", "official", D, {"1316": {"close": 20.5, "volume": 5_653_649}})
    odd = Partial("twse", "odd", "official", D, {"1316": {"odd_volume": 3_806, "odd_trade_value": 78_000}})
    block = Partial("twse", "block", "official", D, {"1316": {"block_volume": 4_655_843, "block_trade_value": 0}})
    rows = merge_daily(quotes, None, odd, block)
    for r in rows:
        r["trade_date"] = r["trade_date"].isoformat()
    assert latest_valuations(rows)["1316"]["volume"] == 994_000
