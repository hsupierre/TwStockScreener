import { METRIC_BY_KEY, type MetricKey } from "./metrics";
import type { Market, StockRow } from "./types";

/** 篩選範圍，以輸入單位表示（例如市值以「億」）。null 代表不限。 */
export interface Range {
  min: number | null;
  max: number | null;
}

export type Ranges = Partial<Record<MetricKey, Range>>;

export interface ScreenerFilters {
  q: string;
  markets: Market[];
  industries: string[];
  ranges: Ranges;
}

export type SortKey = MetricKey | "code";

export interface Sort {
  key: SortKey;
  desc: boolean;
}

export const EMPTY_FILTERS: ScreenerFilters = { q: "", markets: [], industries: [], ranges: {} };

export function isActiveRange(range: Range | undefined): range is Range {
  return !!range && (range.min !== null || range.max !== null);
}

export function activeRanges(ranges: Ranges): [MetricKey, Range][] {
  return (Object.entries(ranges) as [MetricKey, Range | undefined][]).filter(
    (entry): entry is [MetricKey, Range] => isActiveRange(entry[1]),
  );
}

/** 數值在範圍內（含邊界）。有設定範圍但沒有資料（例如金融業沒有毛利率）的股票會被排除。 */
export function inRange(value: number | null, range: Range, scale = 1): boolean {
  if (value === null) return false;
  const v = value / scale;
  return (range.min === null || v >= range.min) && (range.max === null || v <= range.max);
}

export function applyFilters(rows: readonly StockRow[], filters: ScreenerFilters): StockRow[] {
  const q = filters.q.trim().toLowerCase();
  const markets = new Set<string>(filters.markets);
  const industries = new Set(filters.industries);
  const ranges = activeRanges(filters.ranges);

  return rows.filter((row) => {
    if (markets.size > 0 && !markets.has(row.market)) return false;
    if (industries.size > 0 && (!row.industry || !industries.has(row.industry))) return false;
    if (q && !row.code.startsWith(q) && !row.name.toLowerCase().includes(q)) return false;
    return ranges.every(([key, range]) => inRange(row[key], range, METRIC_BY_KEY[key].scale));
  });
}

/** 排序；沒有資料的股票一律排在最後（不論升冪或降冪）。 */
export function sortRows(rows: readonly StockRow[], sort: Sort): StockRow[] {
  const dir = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.key === "code") return a.code.localeCompare(b.code) * dir;
    const va = a[sort.key];
    const vb = b[sort.key];
    if (va === null && vb === null) return a.code.localeCompare(b.code);
    if (va === null) return 1;
    if (vb === null) return -1;
    return va === vb ? a.code.localeCompare(b.code) : (va - vb) * dir;
  });
}
