// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({ from: () => ({ select: () => ({ eq }) }) }),
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
// 2026-11-02（週一）14:40 台灣時間
const NOW = new Date("2026-11-02T06:40:00Z");

async function call(auth: string | null = `Bearer ${SECRET}`) {
  const { GET } = await import("./route");
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  const res = await GET(new Request("http://localhost/api/cron/daily-etl", { headers }));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/cron/daily-etl", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("GITHUB_ACTIONS_TOKEN", "gh-token");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    maybeSingle.mockReset();
    checkAndRepair.mockReset();
  });

  it("沒有或錯誤的密鑰會被拒絕，不會觸發", async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(checkAndRepair).not.toHaveBeenCalled();
  });

  it("沒有設定 GitHub 權杖時回 503", async () => {
    vi.stubEnv("GITHUB_ACTIONS_TOKEN", "");
    expect((await call()).status).toBe(503);
  });

  it("今天的資料已經在了就不重複觸發", async () => {
    maybeSingle.mockResolvedValue({ data: { as_of: "2026-11-02" }, error: null });
    const res = await call();
    expect(res).toEqual({ status: 200, body: { ok: true, skipped: "already-updated", asOf: "2026-11-02" } });
    expect(eq).toHaveBeenCalledWith("job", "daily");
    expect(checkAndRepair).not.toHaveBeenCalled();
  });

  it("資料還停在前一個交易日時觸發每日工作（台灣時間判斷日期）", async () => {
    maybeSingle.mockResolvedValue({ data: { as_of: "2026-10-30" }, error: null });
    checkAndRepair.mockResolvedValue({ workflowState: "active", reenabled: false, dispatched: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, today: "2026-11-02", previousAsOf: "2026-10-30" });
    const [gh, stale] = checkAndRepair.mock.calls[0]!;
    expect(gh).toMatchObject({ repo: "hsupierre/TwStockScreener", token: "gh-token" });
    expect(stale).toBe(true);
  });

  it("讀不到資料庫時照常觸發；GitHub 失敗時回 502", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "timeout" } });
    checkAndRepair.mockResolvedValue({
      workflowState: null,
      reenabled: false,
      dispatched: false,
      error: "GitHub dispatch → HTTP 401",
    });
    const res = await call();
    expect(checkAndRepair).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ ok: false, previousAsOf: null });
  });
});
