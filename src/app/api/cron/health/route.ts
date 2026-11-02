import { cronGuard, cronJson, ETL_REPO } from "@/lib/cron";
import { checkAndRepair, GitHubActions } from "@/lib/github-actions";
import { evaluateHealth } from "@/lib/health";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * 每日健康檢查（Vercel Cron 觸發，見 vercel.json）。與 GitHub Actions 完全獨立：
 *   1. 讀取一次 Supabase：即使 GitHub 排程停擺，資料庫每天仍有活動，避免免費專案因閒置 7 天被暫停。
 *   2. 有設定 GITHUB_ACTIONS_TOKEN 時，每天檢查 ETL workflow 的狀態（同時驗證權杖）：
 *      被 GitHub 因 60 天無活動停用時立刻重新啟用；每日 ETL 超過 72 小時沒有執行時觸發一次。
 */
export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  // 1. 讀取 Supabase（這次查詢本身就是讓專案保持活躍的「活動」）
  const { data, error } = await createSupabasePublicClient()
    .from("data_freshness")
    .select("job, as_of, finished_at");
  if (error) {
    console.error("健康檢查：無法連線 Supabase", error.message);
    return cronJson(503, { ok: false, supabase: "unreachable", error: error.message });
  }

  const daily = data.find((r) => r.job === "daily");
  const health = evaluateHealth({ dailyFinishedAt: daily?.finished_at ?? null, now: new Date() });

  // 2. 檢查 GitHub workflow，必要時重新啟用或觸發
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  const repair = token ? await checkAndRepair(new GitHubActions(ETL_REPO, token), health.stale) : null;
  if (health.stale || repair?.reenabled || repair?.error) {
    console.warn("健康檢查需要注意", { ageHours: health.ageHours, repair });
  }

  return cronJson(200, {
    // 資料正常、或已經觸發修復，且權杖可用時才算 ok
    ok: (!health.stale || repair?.dispatched === true) && !repair?.error,
    supabase: "reachable",
    daily: { asOf: daily?.as_of ?? null, finishedAt: daily?.finished_at ?? null, ...health },
    github: repair ?? { status: "not-configured" },
  });
}
