import type { Ranges, Sort } from "./filters";
import type { MetricKey } from "./metrics";

export interface Preset {
  id: string;
  name: string;
  description: string;
  ranges: Ranges;
  sort: Sort;
  columns: MetricKey[];
}

/** 內建策略模板。門檻是常見的參考值，不構成投資建議，使用者可以再微調。 */
export const PRESETS: readonly Preset[] = [
  {
    id: "dividend",
    name: "存股",
    description: "殖利率 4% 以上、連續配息 5 年以上、ROE 8% 以上且有獲利",
    ranges: {
      dividend_yield: { min: 4, max: null },
      dividend_streak_years: { min: 5, max: null },
      roe_ttm: { min: 8, max: null },
      eps_ttm: { min: 0, max: null },
    },
    sort: { key: "dividend_yield", desc: true },
    columns: ["close", "dividend_yield", "cash_dividend_latest", "cash_dividend_avg_5y", "dividend_streak_years", "eps_ttm", "roe_ttm", "pe"],
  },
  {
    id: "value",
    name: "價值",
    description: "本益比 12 倍以下、股價淨值比 1.5 倍以下、ROE 8% 以上",
    ranges: {
      pe: { min: null, max: 12 },
      pb: { min: null, max: 1.5 },
      roe_ttm: { min: 8, max: null },
    },
    sort: { key: "pe", desc: false },
    columns: ["close", "pe", "pb", "roe_ttm", "eps_ttm", "dividend_yield", "debt_ratio", "market_cap"],
  },
  {
    id: "growth",
    name: "成長",
    description: "近 3 月營收年增 20% 以上、單季 EPS 年增 20% 以上且連續 2 季成長、ROE 10% 以上",
    ranges: {
      revenue_yoy_3m: { min: 20, max: null },
      eps_yoy: { min: 20, max: null },
      eps_growth_quarters: { min: 2, max: null },
      roe_ttm: { min: 10, max: null },
    },
    sort: { key: "revenue_yoy_3m", desc: true },
    columns: ["close", "revenue_yoy", "revenue_yoy_3m", "revenue_growth_months", "eps_yoy", "eps_growth_quarters", "roe_ttm", "pe"],
  },
  {
    id: "quality",
    name: "財務體質",
    description: "ROE 15% 以上、毛利率 30% 以上、負債比 40% 以下、流動比 150% 以上",
    ranges: {
      roe_ttm: { min: 15, max: null },
      gross_margin: { min: 30, max: null },
      debt_ratio: { min: null, max: 40 },
      current_ratio: { min: 150, max: null },
    },
    sort: { key: "roe_ttm", desc: true },
    columns: ["close", "roe_ttm", "gross_margin", "operating_margin", "debt_ratio", "current_ratio", "eps_ttm", "pe"],
  },
] as const; // prettier-ignore
