import "server-only";

/**
 * 透過 GitHub REST API 重新啟用並觸發 ETL workflow（官方文件記載的做法）。
 * 需要 fine-grained personal access token：只授權這個 repo、Actions 讀寫權限。
 */
const API = "https://api.github.com";
export const ETL_WORKFLOW = "etl.yml";

export type RepairResult =
  | { status: "dispatched" }
  | { status: "not-configured" }
  | { status: "failed"; step: "enable" | "dispatch"; httpStatus: number; message: string };

export async function enableAndDispatchEtl(
  repo: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RepairResult> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tw-stock-screener-health-check",
  };
  const base = `${API}/repos/${repo}/actions/workflows/${ETL_WORKFLOW}`;

  // 1. 重新啟用（排程因 60 天無活動被 GitHub 停用時）；已啟用時同樣回 204
  const enable = await fetchImpl(`${base}/enable`, { method: "PUT", headers });
  if (enable.status !== 204) {
    return {
      status: "failed",
      step: "enable",
      httpStatus: enable.status,
      message: (await enable.text()).slice(0, 200),
    };
  }

  // 2. 立刻執行一次每日工作（完成後 ETL 會呼叫 /api/revalidate 更新網站）
  const dispatch = await fetchImpl(`${base}/dispatches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { command: "daily", args: "" } }),
  });
  if (dispatch.status !== 204) {
    return {
      status: "failed",
      step: "dispatch",
      httpStatus: dispatch.status,
      message: (await dispatch.text()).slice(0, 200),
    };
  }
  return { status: "dispatched" };
}
