"""官網格式解析：樣本取自 2026-10-22 實際回應（節錄）。"""

from datetime import date

import pytest

from tw_etl.sources.official import (
    parse_tpex_quotes,
    parse_tpex_valuations,
    parse_twse_quotes,
    parse_twse_valuations,
)

TWSE_CSV = (
    "﻿日期,證券代號,證券名稱,成交股數,成交金額,開盤價,最高價,最低價,收盤價,漲跌價差,成交筆數\n"
    '"1151022","00400A","主動國泰動能高息","48178471","705168819","15.00","15.06","14.41","14.41","-0.4300","17103"\n'
    '"1151022","2330","台積電","29796590","71536783195","2435.00","2435.00","2385.00","2385.00","-35.0000","291228"\n'
    '"1151022","9958","世紀鋼","100","1000","--","--","--","--","0.0000","0"\n'
)


def test_twse_quotes_csv():
    p = parse_twse_quotes(TWSE_CSV)
    assert (p.market, p.kind, p.source, p.trade_date) == ("twse", "quotes", "official", date(2026, 10, 22))
    assert p.rows["2330"] == {"close": 2385.0, "change": -35.0, "volume": 29796590, "trade_value": 71536783195}
    assert "00400A" not in p.rows  # ETF
    assert p.rows["9958"] == {"change": 0.0, "volume": 100, "trade_value": 1000}  # 無收盤價


def test_twse_quotes_rejects_unexpected_format():
    with pytest.raises(ValueError, match="格式不符"):
        parse_twse_quotes("<html>維護中</html>")


def test_twse_valuations_json():
    p = parse_twse_valuations(
        {
            "stat": "OK",
            "date": "20261022",
            "fields": ["證券代號", "證券名稱", "收盤價", "殖利率(%)", "股利年度", "本益比", "股價淨值比", "財報年/季"],
            "data": [["2330", "台積電", "2,385.00", "0.92", 114, "27.65", "9.61", "115/2"]],
        }
    )
    assert p.trade_date == date(2026, 10, 22)
    assert p.rows == {"2330": {"pe": 27.65, "pb": 9.61, "dividend_yield": 0.92}}
    with pytest.raises(ValueError):
        parse_twse_valuations({"stat": "很抱歉，沒有符合條件的資料!"})


TPEX_QUOTE_FIELDS = [
    "代號", "名稱", "收盤 ", "漲跌", "開盤 ", "最高 ", "最低", "成交股數  ", " 成交金額(元)", " 成交筆數 ",
    "最後買價", "最後買量<br>(張數)", "最後賣價", "最後賣量<br>(張數)", "發行股數 ", "次日漲停價 ", "次日跌停價",
]  # fmt: skip


def test_tpex_quotes_json_with_padded_field_names():
    row = [
        "6488", "環球晶", "826.00", "-54.00", "896.00", "898.00", "815.00", "9,364,000", "7,986,265,000", "7,714",
        "825.00", "21", "826.00", "18", "528,113,725", "908.00", "744.00",
    ]  # fmt: skip
    p = parse_tpex_quotes(
        {
            "stat": "ok",
            "date": "20261022",
            "tables": [{"date": "115/10/22", "fields": TPEX_QUOTE_FIELDS, "data": [row]}],
        }
    )
    assert (p.market, p.trade_date) == ("tpex", date(2026, 10, 22))
    assert p.rows["6488"] == {"close": 826.0, "change": -54.0, "volume": 9364000, "trade_value": 7986265000}


def test_tpex_valuations_json():
    p = parse_tpex_valuations(
        {
            "stat": "ok",
            "tables": [
                {
                    "date": "115/10/22",
                    "fields": [
                        "股票代號",
                        "公司名稱",
                        "本益比",
                        "每股股利",
                        "股利年度",
                        "殖利率(%)",
                        "股價淨值比",
                        "財報年/季",
                    ],
                    "data": [["6488", "環球晶          ", "40.10", "7.70000000", 114, "0.93", "4.08", "115Q2"]],
                }
            ],
        }
    )
    assert p.rows == {"6488": {"pe": 40.1, "pb": 4.08, "dividend_yield": 0.93}}
    with pytest.raises(ValueError):
        parse_tpex_valuations({"stat": "error", "tables": []})
