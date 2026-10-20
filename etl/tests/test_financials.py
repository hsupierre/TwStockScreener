import pytest

from tw_etl.sources.mops import StatementRow
from tw_etl.transform.financials import map_balance, map_income, merge_statements, to_single_quarter

# 2330 115Q2（2026 上半年累計，千元）— 取自 MOPS 與 OpenAPI 的實際資料
TSMC_INCOME = {
    "營業收入": "2,404,483,690",
    "營業毛利（毛損）淨額": "1,611,606,116",
    "營業利益（損失）": "1,425,568,793",
    "稅前淨利（淨損）": "1,550,229,773",
    "本期淨利（淨損）": "1,279,582,227",
    "淨利（淨損）歸屬於母公司業主": "1,279,041,690",
    "基本每股盈餘（元）": "49.33",
}
TSMC_BALANCE = {
    "流動資產": "4,565,700,742",
    "資產總計": "9,375,654,727",
    "流動負債": "1,857,761,825",
    "負債總計": "2,901,183,746",
    "歸屬於母公司業主之權益合計": "6,432,518,334",
    "權益總計": "6,474,470,981",
    "每股參考淨值": "248.05",
}


def test_map_income_general_industry():
    out = map_income(TSMC_INCOME)
    assert out["revenue"] == 2_404_483_690_000
    assert out["gross_profit"] == 1_611_606_116_000
    assert out["net_income_parent"] == 1_279_041_690_000
    assert out["eps"] == 49.33
    # 與官方營益分析 115Q2 毛利率 67.03%、營益率 59.29% 一致
    assert out["gross_profit"] / out["revenue"] * 100 == pytest.approx(67.03, abs=0.005)
    assert out["operating_income"] / out["revenue"] * 100 == pytest.approx(59.29, abs=0.005)


def test_map_income_bank_sums_interest_and_other_income():
    out = map_income({"利息淨收益": "27,106,352", "利息以外淨損益": "18,203,737", "本期稅後淨利（淨損）": "10"})
    assert out["revenue"] == (27_106_352 + 18_203_737) * 1000
    assert out["gross_profit"] is None
    assert out["net_income"] == 10_000


def test_map_income_financial_holding_uses_net_revenue():
    out = map_income({"利息淨收益": "1", "利息以外淨收益": "2", "淨收益": "3"})
    assert out["revenue"] == 3000


def test_map_balance():
    out = map_balance(TSMC_BALANCE)
    assert out["total_assets"] == 9_375_654_727_000
    assert out["equity_parent"] == 6_432_518_334_000
    assert out["book_value_per_share"] == 248.05
    assert map_balance({"資產總額": "5", "負債總額": "4", "歸屬於母公司業主之權益": "1"})["total_liabilities"] == 4000


def _stmt(code, values, report_type="ci"):
    return StatementRow(code=code, report_type=report_type, values=values)


def test_to_single_quarter_subtracts_previous_cumulative():
    cum = {}
    cum.update(merge_statements(2026, 1, [_stmt("2330", {"營業收入": "1,000", "基本每股盈餘（元）": "20.10"})], [], []))
    cum.update(
        merge_statements(
            2026,
            2,
            [_stmt("2330", {"營業收入": "2,500", "基本每股盈餘（元）": "49.33"})],
            [_stmt("2330", {"資產總計": "9,000"}, None)],
            [_stmt("2330", {"營業活動之淨現金流入（流出）": "700"}, None)],
        )
    )
    rows = {(r["year"], r["quarter"]): r for r in to_single_quarter(cum)}
    assert rows[(2026, 1)]["revenue"] == 1_000_000
    assert rows[(2026, 2)]["revenue"] == 1_500_000
    assert rows[(2026, 2)]["eps"] == 29.23
    assert rows[(2026, 2)]["total_assets"] == 9_000_000  # 資產負債是期末值，不相減
    assert rows[(2026, 2)]["operating_cash_flow"] is None  # Q1 沒有現金流量，無法相減
    assert rows[(2026, 2)]["report_type"] == "ci"


def test_to_single_quarter_missing_previous_quarter_gives_none():
    cum = merge_statements(2026, 3, [_stmt("6488", {"營業收入": "3,000"})], [], [])
    (row,) = to_single_quarter(cum)
    assert row["revenue"] is None
