import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { StockRow } from "@/lib/screener/types";
import type { DividendRow, FinancialRow, RevenueRow } from "@/lib/stock/compute";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

import { SNAPSHOT_TAG } from "./snapshot";

export type CompanyInfo = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "code" | "name" | "full_name" | "market" | "industry" | "listed_at" | "capital" | "shares_outstanding"
>;

export interface StockDetail {
  company: CompanyInfo;
  snapshot: StockRow | null;
  /** 最近 12 季（由新到舊） */
  financials: FinancialRow[];
  /** 最近 24 個月（由新到舊） */
  revenues: RevenueRow[];
  dividends: DividendRow[];
}

export const STOCK_CODE_RE = /^\d{4}$/;

/**
 * 個股頁資料。與快照共用 SNAPSHOT_TAG，ETL 通知時一起失效；不存在或已下市回傳 null。
 * 五個查詢並行，結果納入個股頁的靜態輸出。
 */
export async function getStockDetail(code: string): Promise<StockDetail | null> {
  "use cache";
  cacheTag(SNAPSHOT_TAG, `stock:${code}`);
  cacheLife("hours");

  if (!STOCK_CODE_RE.test(code)) return null;
  const db = createSupabasePublicClient();

  const [company, snapshot, financials, revenues, dividends] = await Promise.all([
    db
      .from("companies")
      .select("code, name, full_name, market, industry, listed_at, capital, shares_outstanding, is_active")
      .eq("code", code)
      .maybeSingle(),
    db.from("screen_snapshot").select("*").eq("code", code).maybeSingle(),
    db
      .from("financials_quarterly")
      .select(
        "year, quarter, report_type, revenue, gross_profit, operating_income, net_income, net_income_parent, eps, operating_cash_flow, total_assets, total_liabilities",
      )
      .eq("code", code)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })
      .limit(12),
    db
      .from("monthly_revenue")
      .select("year, month, revenue, mom, yoy")
      .eq("code", code)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(24),
    db
      .from("dividends")
      .select("fiscal_year, period, cash_dividend, stock_dividend, board_date")
      .eq("code", code)
      .order("fiscal_year", { ascending: false })
      .limit(60),
  ]);

  for (const r of [company, snapshot, financials, revenues, dividends]) {
    if (r.error) throw new Error(`讀取 ${code} 資料失敗：${r.error.message}`);
  }
  if (!company.data || !company.data.is_active) return null;

  const { is_active: _active, ...info } = company.data;
  let row: StockRow | null = null;
  if (snapshot.data) {
    const { updated_at: _updated, ...rest } = snapshot.data;
    row = rest;
  }
  return {
    company: info,
    snapshot: row,
    financials: financials.data ?? [],
    revenues: revenues.data ?? [],
    dividends: dividends.data ?? [],
  };
}
