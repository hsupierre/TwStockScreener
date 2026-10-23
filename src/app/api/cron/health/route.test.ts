// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({ from: () => ({ select }) }),
}));
const checkAndRepair = vi.fn();
vi.mock("@/lib/github-actions", () => ({
  checkAndRepair,
  GitHubActions: class {
    constructor(
      readonly repo: string,
      readonly token: string,
    ) {}
  },
}));

const SECRET = "c".repeat(40);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

async function call(auth: string | null = `Bearer ${SECRET}`) {
  const { GET } = await import("./route");
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  const res = await GET(new Request("http://localhost/api/cron/health", { headers }));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/cron/health", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    select.mockReset();
    checkAndRepair.mockReset();
  });

  it("沒有或錯誤的密鑰會被拒絕，且不會查詢資料庫", async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(select).not.toHaveBeenCalled();
  });

  it("沒有設定 CRON_SECRET 時回 503", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(503);
  });

  it("沒有設定權杖時只讀取資料庫", async () => {
    select.mockResolvedValue({
      data: [{ job: "daily", as_of: "2026-10-22", finished_at: hoursAgo(10) }],
      error: null,
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      supabase: "reachable",
      daily: { stale: false },
      github: { status: "not-configured" },
    });
    expect(checkAndRepair).not.toHaveBeenCalled();
  });

  it("有權杖時每天檢查 workflow，資料是否停擺會傳給修復邏輯", async () => {
    vi.stubEnv("GITHUB_ACTIONS_TOKEN", "gh-token");
    select.mockResolvedValue({
      data: [{ job: "daily", as_of: "2026-10-15", finished_at: hoursAgo(100) }],
      error: null,
    });
    checkAndRepair.mockResolvedValue({ workflowState: "active", reenabled: false, dispatched: true });
    const res = await call();
    const [gh, stale] = checkAndRepair.mock.calls[0]!;
    expect(gh).toMatchObject({ repo: "hsupierre/TwStockScreener", token: "gh-token" });
    expect(stale).toBe(true);
    expect(res.body).toMatchObject({ ok: true, daily: { stale: true }, github: { dispatched: true } });
  });

  it("停擺但沒有設定權杖時，ok 為 false（需要人工處理）", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const res = await call();
    expect(res.body).toMatchObject({
      ok: false,
      daily: { stale: true },
      github: { status: "not-configured" },
    });
  });

  it("權杖失效時 ok 為 false，即使資料正常", async () => {
    vi.stubEnv("GITHUB_ACTIONS_TOKEN", "expired");
    select.mockResolvedValue({
      data: [{ job: "daily", as_of: "2026-10-22", finished_at: hoursAgo(5) }],
      error: null,
    });
    checkAndRepair.mockResolvedValue({
      workflowState: null,
      reenabled: false,
      dispatched: false,
      error: "HTTP 401",
    });
    expect((await call()).body).toMatchObject({ ok: false, github: { error: "HTTP 401" } });
  });

  it("Supabase 無法連線時回 503", async () => {
    select.mockResolvedValue({ data: null, error: { message: "project is paused" } });
    const res = await call();
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ supabase: "unreachable" });
  });
});
