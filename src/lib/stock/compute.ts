import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type FinancialRow = Pick<
  Tables["financials_quarterly"]["Row"],
  | "year"
  | "quarter"
  | "report_type"
  | "revenue"
  | "gross_profit"
  | "operating_income"
  | "net_income"
  | "net_income_parent"
  | "eps"
  | "operating_cash_flow"
  | "total_assets"
  | "total_liabilities"
>;
export type RevenueRow = Pick<Tables["monthly_revenue"]["Row"], "year" | "month" | "revenue" | "mom" | "yoy">;
export type DividendRow = Pick<
  Tables["dividends"]["Row"],
  "fiscal_year" | "period" | "cash_dividend" | "stock_dividend" | "board_date"
>;

const pct = (n: number | null, d: number | null) =>
  n === null || d === null || d <= 0 ? null : (n / d) * 100;

export interface QuarterSummary {
  label: string;
  revenue: number | null;
  eps: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  debtRatio: number | null;
}

/** 單季資料 → 由舊到新排序；比率只對一般業（ci）計算，金融業為 null。 */
export function summarizeQuarters(rows: readonly FinancialRow[]): QuarterSummary[] {
  return [...rows]
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
    .map((r) => {
      const general = r.report_type === "ci" || r.report_type === null;
      return {
        label: `${r.year}Q${r.quarter}`,
        revenue: r.revenue,
        eps: r.eps,
        grossMargin: general ? pct(r.gross_profit, r.revenue) : null,
        operatingMargin: general ? pct(r.operating_income, r.revenue) : null,
        netMargin: general ? pct(r.net_income, r.revenue) : null,
        netIncome: r.net_income_parent ?? r.net_income,
        operatingCashFlow: r.operating_cash_flow,
        debtRatio: pct(r.total_liabilities, r.total_assets),
      };
    });
}

export interface RevenuePoint {
  label: string;
  /** 億元 */
  revenue: number | null;
  yoy: number | null;
  mom: number | null;
}

/** 月營收 → 由舊到新，營收換算成億元（圖表 Y 軸）。 */
export function revenueSeries(rows: readonly RevenueRow[]): RevenuePoint[] {
  return [...rows]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((r) => ({
      label: `${r.year}/${String(r.month).padStart(2, "0")}`,
      revenue: r.revenue === null ? null : Math.round((r.revenue / 1e8) * 100) / 100,
      yoy: r.yoy,
      mom: r.mom,
    }));
}

export interface DividendYear {
  year: number;
  cash: number;
  stock: number;
  /** 例如季配息為 4 */
  payments: number;
}

/** 依所屬年度合計（季配息、半年配息加總），由新到舊。 */
export function dividendYears(rows: readonly DividendRow[]): DividendYear[] {
  const byYear = new Map<number, DividendYear>();
  for (const r of rows) {
    const y = byYear.get(r.fiscal_year) ?? { year: r.fiscal_year, cash: 0, stock: 0, payments: 0 };
    y.cash += r.cash_dividend ?? 0;
    y.stock += r.stock_dividend ?? 0;
    y.payments += 1;
    byYear.set(r.fiscal_year, y);
  }
  return [...byYear.values()]
    .map((y) => ({ ...y, cash: Math.round(y.cash * 1e4) / 1e4, stock: Math.round(y.stock * 1e4) / 1e4 }))
    .sort((a, b) => b.year - a.year);
}
