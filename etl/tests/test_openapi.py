from datetime import date

from tw_etl.sources.openapi import map_daily, map_revenue, map_tpex_company, map_twse_company


def test_map_twse_company():
    row = map_twse_company(
        {
            "公司代號": "2330",
            "公司名稱": "台灣積體電路製造股份有限公司",
            "公司簡稱": "台積電",
            "產業別": "24",
            "上市日期": "19940905",
            "實收資本額": "259323700670",
            "已發行普通股數或TDR原股發行股數": "25932370067",
        }
    )
    assert row == {
        "code": "2330",
        "name": "台積電",
        "full_name": "台灣積體電路製造股份有限公司",
        "market": "twse",
        "industry": "半導體業",
        "capital": 259323700670,
        "shares_outstanding": 25932370067,
        "listed_at": date(1994, 9, 5),
        "is_active": True,
    }


def test_map_tpex_company_and_skip_non_common_stock():
    row = map_tpex_company(
        {"SecuritiesCompanyCode": "6488", "CompanyAbbreviation": "環球晶", "SecuritiesIndustryCode": "24"}
    )
    assert row is not None and row["market"] == "tpex" and row["industry"] == "半導體業"
    assert map_tpex_company({"SecuritiesCompanyCode": "00878"}) is None


def test_map_daily_merges_quote_and_valuation_by_code_and_date():
    rows = map_daily(
        twse_quotes=[{"Code": "2330", "Date": "1151019", "ClosingPrice": "2420.00", "Change": "0.0000"}],
        twse_valuations=[
            {"Code": "2330", "Date": "1151019", "PEratio": "28.05", "DividendYield": "0.91", "PBratio": "9.76"}
        ],
        tpex_quotes=[
            {"SecuritiesCompanyCode": "6488", "Date": "1151020", "Close": "844.00", "Change": "-38.00 "},
            {"SecuritiesCompanyCode": "700001", "Date": "1151020", "Close": "1.00"},  # 權證
            {"SecuritiesCompanyCode": "6499", "Date": "1151020", "Close": "---"},  # 無成交
        ],
        tpex_valuations=[{"SecuritiesCompanyCode": "6488", "Date": "1151020", "PriceEarningRatio": "0.00"}],
    )
    by_code = {r["code"]: r for r in rows}
    assert set(by_code) == {"2330", "6488"}
    assert by_code["2330"] == {
        "code": "2330",
        "trade_date": date(2026, 10, 19),
        "close": 2420.0,
        "change": 0.0,
        "pe": 28.05,
        "pb": 9.76,
        "dividend_yield": 0.91,
    }
    assert by_code["6488"]["change"] == -38.0
    assert "pe" not in by_code["6488"]  # 本益比 0 代表不適用


def test_map_revenue():
    row = map_revenue(
        {
            "資料年月": "11509",
            "公司代號": "2330",
            "營業收入-當月營收": "511857399",
            "營業收入-去年當月營收": "330980920",
            "營業收入-上月比較增減(%)": "-0.5726315925897248",
            "營業收入-去年同月增減(%)": "54.64861207105231",
            "累計營業收入-當月累計營收": "3898726974",
            "累計營業收入-前期比較增減(%)": "41.106694993093484",
            "備註": "因先進製程產品需求增加所致。",
        }
    )
    assert row is not None
    assert (row["year"], row["month"]) == (2026, 9)
    assert row["revenue"] == 511_857_399_000
    assert row["yoy"] == 54.65
    assert row["mom"] == -0.57
    assert row["note"] == "因先進製程產品需求增加所致。"
