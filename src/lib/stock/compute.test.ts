import { describe, expect, it } from "vitest";

import { dividendYears, type FinancialRow, revenueSeries, summarizeQuarters } from "./compute";

const q = (year: number, quarter: number, extra: Partial<FinancialRow> = {}): FinancialRow => ({
  year,
  quarter,
  report_type: "ci",
  revenue: 1000,
  gross_profit: 400,
  operating_income: 300,
  net_income: 200,
  net_income_parent: 190,
  eps: 1.5,
  operating_cash_flow: 250,
  total_assets: 5000,
  total_liabilities: 2000,
  ...extra,
});

describe("summarizeQuarters", () => {
  it("由舊到新排序並計算單季比率", () => {
    const out = summarizeQuarters([q(2026, 2), q(2025, 4), q(2026, 1)]);
    expect(out.map((r) => r.label)).toEqual(["2025Q4", "2026Q1", "2026Q2"]);
    expect(out[0]).toMatchObject({
      grossMargin: 40,
      operatingMargin: 30,
      netMargin: 20,
      netIncome: 190, // 優先使用歸屬母公司淨利
      debtRatio: 40,
    });
  });

  it("金融業不計算毛利率等比率，但保留 EPS 與負債比", () => {
    const [r] = summarizeQuarters([q(2026, 2, { report_type: "fh", gross_profit: null })]);
    expect(r).toMatchObject({
      grossMargin: null,
      operatingMargin: null,
      netMargin: null,
      eps: 1.5,
      debtRatio: 40,
    });
  });

  it("營收為 0 或缺值時比率為 null", () => {
    const [a, b] = summarizeQuarters([q(2026, 1, { revenue: 0 }), q(2026, 2, { revenue: null })]);
    expect(a!.grossMargin).toBeNull();
    expect(b!.grossMargin).toBeNull();
  });
});

describe("revenueSeries", () => {
  it("由舊到新、換算成億元", () => {
    const out = revenueSeries([
      { year: 2026, month: 9, revenue: 511_857_399_000, mom: -0.57, yoy: 54.65 },
      { year: 2025, month: 12, revenue: null, mom: null, yoy: null },
    ]);
    expect(out).toEqual([
      { label: "2025/12", revenue: null, yoy: null, mom: null },
      { label: "2026/09", revenue: 5118.57, yoy: 54.65, mom: -0.57 },
    ]);
  });
});

describe("dividendYears", () => {
  it("依所屬年度加總季配息，由新到舊", () => {
    const out = dividendYears([
      { fiscal_year: 2025, period: "Q1", cash_dividend: 5, stock_dividend: 0, board_date: null },
      { fiscal_year: 2025, period: "Q2", cash_dividend: 5, stock_dividend: 0, board_date: null },
      { fiscal_year: 2024, period: "FY", cash_dividend: 2.5, stock_dividend: 0.5, board_date: null },
      { fiscal_year: 2025, period: "Q3", cash_dividend: null, stock_dividend: null, board_date: null },
    ]);
    expect(out).toEqual([
      { year: 2025, cash: 10, stock: 0, payments: 3 },
      { year: 2024, cash: 2.5, stock: 0.5, payments: 1 },
    ]);
  });
});
