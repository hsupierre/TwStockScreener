from datetime import date

import pytest

from tw_etl.transform.snapshot import (
    SnapshotInputs,
    build_snapshot,
    check_snapshot,
    dividend_metrics,
    financial_metrics,
    latest_complete_fiscal_year,
    prev_month,
    prev_quarter,
    revenue_metrics,
)


def test_prev_quarter_and_month_wrap_years():
    assert prev_quarter((2026, 1)) == (2025, 4)
    assert prev_quarter((2026, 2), 4) == (2025, 2)
    assert prev_month((2026, 1)) == (2025, 12)
    assert prev_month((2026, 3), 3) == (2025, 12)


def _q(eps, *, revenue=100, gross=40, op=30, net=20, parent=20, equity=1000, assets=2000, liab=500, ca=300, cl=150):
    return {
        "report_type": "ci",
        "eps": eps,
        "revenue": revenue,
        "gross_profit": gross,
        "operating_income": op,
        "net_income": net,
        "net_income_parent": parent,
        "equity_parent": equity,
        "total_assets": assets,
        "total_liabilities": liab,
        "current_assets": ca,
        "current_liabilities": cl,
    }


def eight_quarters():
    # 2024Q3..2026Q2，EPS 逐季成長
    keys = [(2024, 3), (2024, 4), (2025, 1), (2025, 2), (2025, 3), (2025, 4), (2026, 1), (2026, 2)]
    return {k: _q(eps=1.0 + i * 0.5, equity=1000 + i * 100) for i, k in enumerate(keys)}


def test_financial_metrics_ttm_and_ratios():
    m = financial_metrics(eight_quarters())
    assert m["financial_period"] == "2026Q2"
    # EPS 依序為 1.0, 1.5, ..., 4.5；近四季 = 3.0 + 3.5 + 4.0 + 4.5
    assert m["eps_ttm"] == pytest.approx(15.0)
    # ROE = 近四季淨利 80 ÷ 平均權益 (1700 + 1300) / 2
    assert m["roe_ttm"] == pytest.approx(80 / 1500 * 100, abs=0.01)
    assert m["gross_margin"] == 40.0
    assert m["operating_margin"] == 30.0
    assert m["net_margin"] == 20.0
    assert m["debt_ratio"] == 25.0
    assert m["current_ratio"] == 200.0
    # 2026Q2 EPS 4.5 vs 2025Q2 2.5
    assert m["eps_yoy"] == 80.0
    # 2026Q2、Q1、2025Q4、Q3 都比去年同季高；再往前沒有去年同季資料
    assert m["eps_growth_quarters"] == 4


def test_financial_metrics_missing_quarter_breaks_ttm():
    qs = eight_quarters()
    del qs[(2025, 4)]
    m = financial_metrics(qs)
    assert m["eps_ttm"] is None
    assert m["roe_ttm"] is None


def test_financial_metrics_financial_industry_has_no_margins():
    qs = {k: {**v, "report_type": "fh"} for k, v in eight_quarters().items()}
    m = financial_metrics(qs)
    assert m["gross_margin"] is None
    assert m["operating_margin"] is None
    assert m["current_ratio"] is None
    assert m["eps_ttm"] is not None


def test_revenue_metrics():
    ms = {
        (2026, 7): {"revenue": 110, "revenue_last_year": 100, "yoy": -5.0, "mom": 1.0, "cum_yoy": 3.0},
        (2026, 8): {"revenue": 120, "revenue_last_year": 100, "yoy": 20.0, "mom": 9.1, "cum_yoy": 4.0},
        (2026, 9): {"revenue": 130, "revenue_last_year": 100, "yoy": 30.0, "mom": 8.3, "cum_yoy": 5.0},
    }
    m = revenue_metrics(ms)
    assert m["revenue_period"] == "2026-09"
    assert m["revenue_yoy"] == 30.0
    assert m["revenue_yoy_3m"] == 20.0
    assert m["revenue_growth_months"] == 2


def test_latest_complete_fiscal_year():
    assert latest_complete_fiscal_year(date(2026, 10, 20)) == 2025
    assert latest_complete_fiscal_year(date(2026, 3, 1)) == 2024


def test_dividend_metrics_sums_quarterly_payments_by_fiscal_year():
    records = [
        {"fiscal_year": fy, "period": f"Q{q}", "cash_dividend": 4.0, "board_date": f"{fy}-0{q * 2}-10"}
        for fy in range(2019, 2026)
        for q in range(1, 5)
    ]
    m = dividend_metrics(records, date(2026, 10, 20), listed_year=1994)
    assert m["cash_dividend_avg_5y"] == 16.0
    assert m["dividend_streak_years"] == 7
    assert m["cash_dividend_latest"] == 0.0  # 測試資料的決議日都早於一年前


def test_dividend_metrics_skip_years_before_listing():
    records = [{"fiscal_year": 2025, "period": "FY", "cash_dividend": 3.0, "board_date": "2026-03-01"}]
    m = dividend_metrics(records, date(2026, 10, 20), listed_year=2024)
    assert m["cash_dividend_avg_5y"] == 1.5  # 只計 2024、2025 兩年
    assert m["dividend_streak_years"] == 1
    assert m["cash_dividend_latest"] == 3.0


def test_build_snapshot_and_sanity_check():
    inp = SnapshotInputs(
        companies=[
            {"code": "2330", "name": "台積電", "market": "twse", "industry": "半導體業", "shares_outstanding": 10},
            {"code": "9999", "name": "下市", "market": "twse", "is_active": False},
        ],
        valuations={"2330": {"trade_date": "2026-10-19", "close": 2420.0, "pe": 28.05, "pb": 9.76}},
        quarters={"2330": eight_quarters()},
        today=date(2026, 10, 20),
    )
    rows = build_snapshot(inp)
    assert [r["code"] for r in rows] == ["2330"]
    assert rows[0]["market_cap"] == 24200
    assert rows[0]["revenue_period"] is None
    assert check_snapshot(rows, min_rows=1) == []
    assert check_snapshot(rows) == ["只有 1 檔（預期至少 1500）"]
