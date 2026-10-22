import { METRICS } from "./metrics";
import type { StockRow } from "./types";

/** 測試用：建立一列快照，未指定的指標為 null。 */
export function makeRow(partial: Partial<StockRow> & Pick<StockRow, "code" | "name">): StockRow {
  const metrics = Object.fromEntries(METRICS.map((m) => [m.key, null]));
  return {
    market: "twse",
    industry: null,
    price_date: "2026-10-21",
    financial_period: "2026Q2",
    revenue_period: "2026-09",
    ...metrics,
    ...partial,
  } as StockRow;
}
