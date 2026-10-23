// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { checkAndRepair, GitHubActions } from "./github-actions";

const REPO = "hsupierre/TwStockScreener";
const BASE = `https://api.github.com/repos/${REPO}/actions/workflows/etl.yml`;

/** 依序回應的假 fetch；state 端點回傳指定的 workflow 狀態。 */
function mockGitHub(state: string, overrides: Partial<Record<"state" | "enable" | "dispatch", number>> = {}) {
  const calls: { method: string; url: string; body?: string; auth: string | null }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url: String(url),
      body: init?.body as string | undefined,
      auth: new Headers(init?.headers).get("authorization"),
    });
    const step = method === "GET" ? "state" : method === "PUT" ? "enable" : "dispatch";
    const status = overrides[step] ?? (step === "state" ? 200 : 204);
    if (status === 200) return Response.json({ id: 1, name: "ETL", state });
    return new Response(status === 204 ? null : "Bad credentials", { status });
  });
  return { gh: new GitHubActions(REPO, "tok", impl as unknown as typeof fetch), calls };
}

describe("checkAndRepair", () => {
  it("排程正常、資料正常：只讀取狀態（同時驗證權杖）", async () => {
    const { gh, calls } = mockGitHub("active");
    expect(await checkAndRepair(gh, false)).toEqual({
      workflowState: "active",
      reenabled: false,
      dispatched: false,
    });
    expect(calls).toEqual([{ method: "GET", url: BASE, body: undefined, auth: "Bearer tok" }]);
  });

  it("被 GitHub 因閒置停用：立刻重新啟用，不必等資料過期", async () => {
    const { gh, calls } = mockGitHub("disabled_inactivity");
    expect(await checkAndRepair(gh, false)).toMatchObject({ reenabled: true, dispatched: false });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", BASE],
      ["PUT", `${BASE}/enable`],
    ]);
  });

  it("資料停擺：觸發一次每日工作", async () => {
    const { gh, calls } = mockGitHub("disabled_inactivity");
    expect(await checkAndRepair(gh, true)).toMatchObject({ reenabled: true, dispatched: true });
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: `${BASE}/dispatches` });
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ ref: "main", inputs: { command: "daily", args: "" } });
  });

  it("使用者手動停用：尊重設定，不重新啟用也不觸發", async () => {
    const { gh, calls } = mockGitHub("disabled_manually");
    expect(await checkAndRepair(gh, true)).toMatchObject({ skipped: "disabled_manually", dispatched: false });
    expect(calls).toHaveLength(1);
  });

  it("權杖失效或權限不足：回報錯誤，不繼續呼叫", async () => {
    const { gh, calls } = mockGitHub("active", { state: 401 });
    const report = await checkAndRepair(gh, true);
    expect(report.error).toMatch(/state → HTTP 401/);
    expect(report.dispatched).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("觸發失敗時回報錯誤", async () => {
    const { gh } = mockGitHub("active", { dispatch: 403 });
    expect((await checkAndRepair(gh, true)).error).toMatch(/dispatch → HTTP 403/);
  });
});
