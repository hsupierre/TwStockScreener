import { timingSafeEqual } from "node:crypto";

import { enableAndDispatchEtl } from "@/lib/github-actions";
import { evaluateHealth } from "@/lib/health";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * 每日健康檢查（Vercel Cron 觸發，見 vercel.json）。與 GitHub Actions 完全獨立：
 *   1. 讀取一次 Supabase：即使 GitHub 排程停擺，資料庫每天仍有活動，避免免費專案因閒置 7 天被暫停。
 *   2. 每日 ETL 超過 72 小時沒有執行時，透過 GitHub API 重新啟用並觸發 ETL（自動修復）。
 *
 * Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>（需在 Vercel 設定 CRON_SECRET）。
 */
const DEFAULT_REPO = "hsupierre/TwStockScreener";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authorized(header: string | null, secret: string): boolean {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return json(503, { error: "伺服器未設定 CRON_SECRET（至少 32 字元）" });
  if (!authorized(request.headers.get("authorization"), secret)) return json(401, { error: "未授權" });

  // 1. 讀取 Supabase（這次查詢本身就是讓專案保持活躍的「活動」）
  const { data, error } = await createSupabasePublicClient()
    .from("data_freshness")
    .select("job, as_of, finished_at");
  if (error) {
    console.error("健康檢查：無法連線 Supabase", error.message);
    return json(503, { ok: false, supabase: "unreachable", error: error.message });
  }

  const daily = data.find((r) => r.job === "daily");
  const health = evaluateHealth({ dailyFinishedAt: daily?.finished_at ?? null, now: new Date() });

  // 2. ETL 停擺時自動修復
  let repair: Record<string, unknown> = { status: "not-needed" };
  if (health.stale) {
    const token = process.env.GITHUB_ACTIONS_TOKEN;
    repair = token
      ? await enableAndDispatchEtl(process.env.GITHUB_REPOSITORY || DEFAULT_REPO, token)
      : { status: "not-configured" };
    console.warn("健康檢查：每日 ETL 已停擺", { ageHours: health.ageHours, repair });
  }

  return json(200, {
    ok: !health.stale || repair.status === "dispatched",
    supabase: "reachable",
    daily: { asOf: daily?.as_of ?? null, finishedAt: daily?.finished_at ?? null, ...health },
    repair,
  });
}
