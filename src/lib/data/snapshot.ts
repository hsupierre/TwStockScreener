import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Freshness, FreshnessJob, Snapshot, StockRow } from "@/lib/screener/types";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/** ETL 完成後呼叫 revalidateTag(SNAPSHOT_TAG) 讓快取失效。 */
export const SNAPSHOT_TAG = "snapshot";

const PAGE_SIZE = 1000; // Supabase 預設 max_rows

/**
 * 讀取完整選股快照（約 2,000 列）與各資料集的更新時間。
 *
 * 使用 `use cache`：結果會被納入頁面的靜態外殼、從 CDN 提供，每小時或 ETL 通知時才重新讀取 Supabase，
 * 所以使用者再多也不會增加資料庫負擔。
 */
export async function getSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheTag(SNAPSHOT_TAG);
  cacheLife("hours");

  const db = createSupabasePublicClient();
  const rows: StockRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("screen_snapshot")
      .select("*")
      .order("code")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`讀取選股快照失敗：${error.message}`);
    for (const { updated_at: _, ...row } of data) rows.push(row);
    if (data.length < PAGE_SIZE) break;
  }

  const { data: freshnessRows, error } = await db.from("data_freshness").select("job, as_of, finished_at");
  if (error) throw new Error(`讀取資料更新時間失敗：${error.message}`);

  const industries = [...new Set(rows.map((r) => r.industry).filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  );
  const freshness: Freshness[] = freshnessRows.map((f) => ({
    job: f.job as FreshnessJob,
    asOf: f.as_of,
    finishedAt: f.finished_at,
  }));
  return { rows, industries, freshness };
}
