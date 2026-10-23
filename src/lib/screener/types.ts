import type { Database } from "@/types/database";

import type { MetricKey } from "./metrics";

/** 選股快照的一列（不含 updated_at）。 */
export type StockRow = Omit<Database["public"]["Tables"]["screen_snapshot"]["Row"], "updated_at">;

/** 選股器實際使用的欄位（不含資料日期等只在個股頁顯示的欄位）。 */
export type ScreenerRow = Pick<StockRow, "code" | "name" | "market" | "industry" | MetricKey>;

export const MARKETS = ["twse", "tpex"] as const;
export type Market = (typeof MARKETS)[number];

export const MARKET_LABELS: Record<Market, string> = { twse: "上市", tpex: "上櫃" };

export type FreshnessJob = "daily" | "monthly" | "quarterly" | "dividend" | "snapshot";

export interface Freshness {
  job: FreshnessJob;
  asOf: string;
  finishedAt: string;
}

export interface Snapshot {
  rows: StockRow[];
  industries: string[];
  freshness: Freshness[];
}
