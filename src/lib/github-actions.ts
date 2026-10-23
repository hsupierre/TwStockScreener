import "server-only";

/**
 * 透過 GitHub REST API 檢查、重新啟用並觸發 ETL workflow（皆為官方文件記載的 API）。
 * 需要 fine-grained personal access token：只授權這個 repo、Actions 讀寫權限。
 */
const API = "https://api.github.com";
export const ETL_WORKFLOW = "etl.yml";

/** GitHub workflow 狀態：active、disabled_inactivity（60 天無活動被停用）、disabled_manually、deleted… */
export type WorkflowState = "active" | "disabled_inactivity" | "disabled_manually" | (string & {});

type Fetch = typeof fetch;

export class GitHubApiError extends Error {
  constructor(
    readonly step: "state" | "enable" | "dispatch",
    readonly httpStatus: number,
    detail: string,
  ) {
    super(`GitHub ${step} → HTTP ${httpStatus}: ${detail.slice(0, 200)}`);
  }
}

export class GitHubActions {
  private readonly base: string;
  private readonly headers: Record<string, string>;

  constructor(
    repo: string,
    token: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    this.base = `${API}/repos/${repo}/actions/workflows/${ETL_WORKFLOW}`;
    this.headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tw-stock-screener-health-check",
    };
  }

  /** 唯讀：每天檢查一次，同時驗證權杖仍然有效。 */
  async state(): Promise<WorkflowState> {
    const res = await this.fetchImpl(this.base, { headers: this.headers });
    if (res.status !== 200) throw new GitHubApiError("state", res.status, await res.text());
    return ((await res.json()) as { state: WorkflowState }).state;
  }

  async enable(): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/enable`, { method: "PUT", headers: this.headers });
    if (res.status !== 204) throw new GitHubApiError("enable", res.status, await res.text());
  }

  /** 立刻執行一次每日工作（完成後 ETL 會呼叫 /api/revalidate 更新網站）。 */
  async dispatchDaily(): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/dispatches`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { command: "daily", args: "" } }),
    });
    if (res.status !== 204) throw new GitHubApiError("dispatch", res.status, await res.text());
  }
}

export interface RepairReport {
  workflowState: WorkflowState | null;
  /** 因 60 天無活動被停用，已重新啟用 */
  reenabled: boolean;
  /** 資料停擺，已觸發每日工作 */
  dispatched: boolean;
  /** 手動停用的 workflow 不自動處理 */
  skipped?: "disabled_manually";
  error?: string;
}

/**
 * 每日檢查：
 * - 被 GitHub 因閒置停用（disabled_inactivity）→ 立刻重新啟用，避免資料出現空窗
 * - 資料停擺（stale）→ 觸發一次每日工作
 * - 使用者手動停用（disabled_manually）→ 尊重設定，不自動處理
 */
export async function checkAndRepair(gh: GitHubActions, stale: boolean): Promise<RepairReport> {
  const report: RepairReport = { workflowState: null, reenabled: false, dispatched: false };
  try {
    report.workflowState = await gh.state();
    if (report.workflowState === "disabled_manually") {
      report.skipped = "disabled_manually";
      return report;
    }
    if (report.workflowState !== "active") {
      await gh.enable();
      report.reenabled = true;
    }
    if (stale) {
      await gh.dispatchDaily();
      report.dispatched = true;
    }
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
  }
  return report;
}
