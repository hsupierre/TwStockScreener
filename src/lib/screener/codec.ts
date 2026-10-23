import { METRICS, type MetricKey } from "./metrics";
import { MARKETS, type ScreenerRow } from "./types";

/**
 * 選股頁內嵌的快照改用欄位式緊湊格式：欄位名稱只出現一次、市場與產業以索引表示。
 * 約 2,000 列時 HTML 從 1.4 MB 降到約一半以下，瀏覽器解析（TBT）也明顯變快。
 *
 * 每列：[代號, 名稱, 市場索引, 產業索引（-1 = 無）, ...METRIC_KEYS 依序的數值]
 */
export type PackedRow = [string, string, number, number, ...(number | null)[]];

export interface PackedSnapshot {
  metrics: MetricKey[];
  industries: string[];
  rows: PackedRow[];
}

const METRIC_KEYS = METRICS.map((m) => m.key);

export function packRows(rows: readonly ScreenerRow[], industries: readonly string[]): PackedSnapshot {
  const industryIndex = new Map(industries.map((name, i) => [name, i]));
  return {
    metrics: METRIC_KEYS,
    industries: [...industries],
    rows: rows.map((r) => [
      r.code,
      r.name,
      Math.max(0, (MARKETS as readonly string[]).indexOf(r.market)),
      r.industry ? (industryIndex.get(r.industry) ?? -1) : -1,
      ...METRIC_KEYS.map((k) => r[k]),
    ]),
  };
}

export function unpackRows(packed: PackedSnapshot): ScreenerRow[] {
  return packed.rows.map(([code, name, market, industry, ...values]) => {
    const row = {
      code,
      name,
      market: MARKETS[market] ?? "twse",
      industry: packed.industries[industry] ?? null,
    } as ScreenerRow;
    packed.metrics.forEach((key, i) => {
      row[key] = values[i] ?? null;
    });
    return row;
  });
}
