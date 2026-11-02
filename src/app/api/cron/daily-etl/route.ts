import { cronGuard, cronJson, ETL_REPO, taipeiDate } from "@/lib/cron";
import { checkAndRepair, GitHubActions } from "@/lib/github-actions";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * 每個交易日下午觸發一次每日 ETL（Vercel Cron，見 vercel.json）。
 *
 * GitHub 的 schedule 在負載高時會延遲數小時，甚至整次略過（2026-11-02 的 14:03 就沒有執行）；
 * workflow_dispatch 則幾乎立刻開始。所以改由這裡準時觸發，GitHub 的兩個排程保留當備援。
 * 今天的資料已經在了（例如 GitHub 排程準時跑完）就不重複觸發。
 */
export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return cronJson(503, { error: "伺服器未設定 GITHUB_ACTIONS_TOKEN" });

  const today = taipeiDate(new Date());
  const { data, error } = await createSupabasePublicClient()
    .from("data_freshness")
    .select("as_of")
    .eq("job", "daily")
    .maybeSingle();
  if (error) console.warn("每日 ETL 觸發：讀不到 data_freshness，照常觸發", error.message);
  if (data?.as_of === today) return cronJson(200, { ok: true, skipped: "already-updated", asOf: today });

  // 同時確認 workflow 沒有被停用（被 GitHub 因閒置停用時先重新啟用）
  const github = await checkAndRepair(new GitHubActions(ETL_REPO, token), true);
  if (github.error || github.skipped) console.warn("每日 ETL 觸發失敗", github);
  return cronJson(github.error ? 502 : 200, {
    ok: github.dispatched,
    today,
    previousAsOf: data?.as_of ?? null,
    github,
  });
}
