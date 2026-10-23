import type { StockRow } from "./types";

/** 可以篩選、排序、顯示的數值指標。 */
export type MetricKey = keyof {
  [K in keyof StockRow as StockRow[K] extends number | null ? K : never]: true;
};

export type MetricGroup = "valuation" | "trading" | "profitability" | "growth" | "health" | "dividend";

export const METRIC_GROUPS: { id: MetricGroup; label: string }[] = [
  { id: "valuation", label: "估值" },
  { id: "trading", label: "交易" },
  { id: "profitability", label: "獲利能力" },
  { id: "growth", label: "成長" },
  { id: "health", label: "財務體質" },
  { id: "dividend", label: "股利" },
];

/**
 * price：元（2 位小數）；ratio：倍；percent：%；growth：%，正紅負綠；
 * twd：金額（元，顯示為億）；count：整數期數；dividend：每股元（2 位小數）；lots：股數，以「張」（1,000 股）顯示
 */
export type MetricFormat = "price" | "ratio" | "percent" | "growth" | "twd" | "count" | "dividend" | "lots";

export interface MetricDef {
  key: MetricKey;
  /** 網址參數名稱（短，方便分享） */
  param: string;
  label: string;
  group: MetricGroup;
  format: MetricFormat;
  /** 篩選輸入框的單位文字 */
  unit: string;
  /** 篩選輸入值 × scale = 資料庫數值（市值以「億」輸入） */
  scale?: number;
  description: string;
}

export const METRICS: readonly MetricDef[] = [
  // 估值
  { key: "close", param: "price", label: "股價", group: "valuation", format: "price", unit: "元", description: "最近交易日收盤價" },
  {
    key: "market_cap",
    param: "cap",
    label: "市值",
    group: "valuation",
    format: "twd",
    unit: "億",
    scale: 1e8,
    description: "收盤價 × 已發行普通股數",
  },
  { key: "pe", param: "pe", label: "本益比", group: "valuation", format: "ratio", unit: "倍", description: "證交所／櫃買中心公布；虧損公司不適用" },
  { key: "pb", param: "pb", label: "股價淨值比", group: "valuation", format: "ratio", unit: "倍", description: "證交所／櫃買中心公布" },
  { key: "dividend_yield", param: "dy", label: "殖利率", group: "valuation", format: "percent", unit: "%", description: "證交所／櫃買中心公布" },
  // 交易
  { key: "change_pct", param: "chg", label: "漲跌幅", group: "trading", format: "growth", unit: "%", description: "最近交易日收盤價相對前一日" },
  { key: "volume", param: "vol", label: "成交量", group: "trading", format: "lots", unit: "張", scale: 1000, description: "最近交易日成交股數（1 張 = 1,000 股）" },
  { key: "trade_value", param: "tv", label: "成交金額", group: "trading", format: "twd", unit: "億", scale: 1e8, description: "最近交易日成交金額" },
  { key: "avg_volume_20d", param: "av", label: "20 日均量", group: "trading", format: "lots", unit: "張", scale: 1000, description: "近 20 個交易日平均成交量；可用來排除不易買賣的冷門股" },
  // 獲利能力
  { key: "eps_ttm", param: "eps", label: "近四季 EPS", group: "profitability", format: "price", unit: "元", description: "近四季單季基本每股盈餘合計" },
  { key: "roe_ttm", param: "roe", label: "ROE", group: "profitability", format: "percent", unit: "%", description: "近四季歸屬母公司淨利 ÷ 平均股東權益" },
  { key: "roa_ttm", param: "roa", label: "ROA", group: "profitability", format: "percent", unit: "%", description: "近四季淨利 ÷ 平均總資產" },
  { key: "gross_margin", param: "gm", label: "毛利率", group: "profitability", format: "percent", unit: "%", description: "近四季；金融業不適用" },
  { key: "operating_margin", param: "om", label: "營益率", group: "profitability", format: "percent", unit: "%", description: "近四季；金融業不適用" },
  { key: "net_margin", param: "nm", label: "淨利率", group: "profitability", format: "percent", unit: "%", description: "近四季；金融業不適用" },
  // 成長
  { key: "revenue_yoy", param: "ry", label: "月營收年增", group: "growth", format: "growth", unit: "%", description: "最新月營收與去年同月比較" },
  { key: "revenue_mom", param: "rm", label: "月營收月增", group: "growth", format: "growth", unit: "%", description: "最新月營收與上月比較" },
  { key: "revenue_yoy_3m", param: "r3", label: "近3月營收年增", group: "growth", format: "growth", unit: "%", description: "近三個月營收合計與去年同期比較" },
  { key: "revenue_cum_yoy", param: "rc", label: "累計營收年增", group: "growth", format: "growth", unit: "%", description: "今年累計營收與去年同期比較" },
  { key: "eps_yoy", param: "ey", label: "單季 EPS 年增", group: "growth", format: "growth", unit: "%", description: "最新一季 EPS 與去年同季比較" },
  { key: "revenue_growth_months", param: "rgm", label: "營收連續年增", group: "growth", format: "count", unit: "個月", description: "月營收年增率連續為正的月數" },
  { key: "eps_growth_quarters", param: "egq", label: "EPS 連續年增", group: "growth", format: "count", unit: "季", description: "單季 EPS 連續高於去年同季的季數" },
  // 財務體質
  { key: "debt_ratio", param: "dr", label: "負債比", group: "health", format: "percent", unit: "%", description: "總負債 ÷ 總資產（金融業通常高於 90%）" },
  { key: "current_ratio", param: "cr", label: "流動比", group: "health", format: "percent", unit: "%", description: "流動資產 ÷ 流動負債；金融業不適用" },
  // 股利
  { key: "cash_dividend_latest", param: "cd", label: "近一年現金股利", group: "dividend", format: "dividend", unit: "元", description: "近 12 個月董事會決議的每股現金股利合計" },
  { key: "cash_dividend_avg_5y", param: "cd5", label: "5年平均現金股利", group: "dividend", format: "dividend", unit: "元", description: "近五個完整年度平均每股現金股利" },
  { key: "dividend_streak_years", param: "ds", label: "連續配息", group: "dividend", format: "count", unit: "年", description: "連續發放現金股利的年數（資料涵蓋近 10 年）" },
] as const; // prettier-ignore

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<
  MetricKey,
  MetricDef
>;
export const METRIC_BY_PARAM = Object.fromEntries(METRICS.map((m) => [m.param, m])) as Record<
  string,
  MetricDef
>;

export const DEFAULT_COLUMNS: MetricKey[] = [
  "close",
  "change_pct",
  "volume",
  "pe",
  "pb",
  "dividend_yield",
  "eps_ttm",
  "roe_ttm",
  "gross_margin",
  "revenue_yoy",
  "eps_yoy",
  "debt_ratio",
  "dividend_streak_years",
];
