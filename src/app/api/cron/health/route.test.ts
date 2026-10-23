// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({ from: () => ({ select }) }),
}));
const enableAndDispatchEtl = vi.fn();
vi.mock("@/lib/github-actions", () => ({ enableAndDispatchEtl }));

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
    enableAndDispatchEtl.mockReset();
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

  it("ETL 正常時只讀取資料庫，不觸發修復", async () => {
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
      repair: { status: "not-needed" },
    });
    expect(enableAndDispatchEtl).not.toHaveBeenCalled();
  });

  it("ETL 停擺超過 72 小時時，用設定的權杖重新啟用並觸發", async () => {
    vi.stubEnv("GITHUB_ACTIONS_TOKEN", "gh-token");
    select.mockResolvedValue({
      data: [{ job: "daily", as_of: "2026-10-15", finished_at: hoursAgo(100) }],
      error: null,
    });
    enableAndDispatchEtl.mockResolvedValue({ status: "dispatched" });
    const res = await call();
    expect(enableAndDispatchEtl).toHaveBeenCalledWith("hsupierre/TwStockScreener", "gh-token");
    expect(res.body).toMatchObject({ ok: true, daily: { stale: true }, repair: { status: "dispatched" } });
  });

  it("停擺但沒有設定權杖時，回報需要人工處理", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const res = await call();
    expect(res.body).toMatchObject({
      ok: false,
      daily: { stale: true },
      repair: { status: "not-configured" },
    });
    expect(enableAndDispatchEtl).not.toHaveBeenCalled();
  });

  it("Supabase 無法連線時回 503", async () => {
    select.mockResolvedValue({ data: null, error: { message: "project is paused" } });
    const res = await call();
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ supabase: "unreachable" });
  });
});
