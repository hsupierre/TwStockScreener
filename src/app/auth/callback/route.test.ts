// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

async function get(query: string) {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest(`https://example.com/auth/callback?${query}`));
  return { status: res.status, location: res.headers.get("location") };
}

describe("GET /auth/callback", () => {
  beforeEach(() => exchangeCodeForSession.mockReset().mockResolvedValue({ error: null }));

  it("交換登入碼後回到 next", async () => {
    const res = await get("code=abc&next=%2Fscreener%3Fdy%3D4~");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(307);
    expect(res.location).toBe("https://example.com/screener?dy=4~");
  });

  it("next 不是站內路徑時回首頁", async () => {
    const res = await get("code=abc&next=%2F%2Fevil.com");
    expect(res.location).toBe("https://example.com/");
  });

  it("使用者取消、沒有 code、交換失敗時回登入頁並帶錯誤代碼", async () => {
    expect((await get("error=access_denied&next=%2Fwatchlist")).location).toBe(
      "https://example.com/login?error=denied&next=%2Fwatchlist",
    );
    expect((await get("")).location).toBe("https://example.com/login?error=callback");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();

    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid flow state" } });
    expect((await get("code=bad")).location).toBe("https://example.com/login?error=callback");
  });
});
