import type { Database } from "@/types/database";

/** 選股快照的一列（不含 updated_at）。 */
export type StockRow = Omit<Database["public"]["Tables"]["screen_snapshot"]["Row"], "updated_at">;

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
