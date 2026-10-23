// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, cacheLife: vi.fn(), cacheTag: vi.fn() }));

const SECRET = "x".repeat(40);

async function post(body: unknown, auth: string | null = `Bearer ${SECRET}`) {
  const { POST } = await import("./route");
  const headers = new Headers({ "content-type": "application/json" });
  if (auth) headers.set("authorization", auth);
  const res = await POST(
    new Request("http://localhost/api/revalidate", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

describe("POST /api/revalidate", () => {
  beforeEach(() => vi.stubEnv("REVALIDATE_SECRET", SECRET));
  afterEach(() => {
    vi.unstubAllEnvs();
    revalidateTag.mockClear();
  });

  it("密鑰正確時清除快取（stale-while-revalidate）", async () => {
    const res = await post({ tags: ["snapshot", "stock:2330", "snapshot"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revalidated: ["snapshot", "stock:2330"] });
    expect(res.cache).toBe("no-store");
    expect(revalidateTag).toHaveBeenCalledWith("snapshot", "max");
    expect(revalidateTag).toHaveBeenCalledWith("stock:2330", "max");
  });

  it.each([null, "Bearer wrong", `Basic ${SECRET}`, `Bearer ${SECRET}x`])(
    "拒絕錯誤的授權 %s",
    async (auth) => {
      const res = await post({ tags: ["snapshot"] }, auth);
      expect(res.status).toBe(401);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it("只接受白名單內的標籤", async () => {
    for (const tags of [["other"], ["stock:abc"], [], "snapshot"]) {
      expect((await post({ tags })).status).toBe(400);
    }
    expect((await post("not json")).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("伺服器沒設定密鑰時回 503，不會放行", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await post({ tags: ["snapshot"] })).status).toBe(503);
  });
});
