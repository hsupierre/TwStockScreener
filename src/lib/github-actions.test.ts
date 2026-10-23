// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { enableAndDispatchEtl } from "./github-actions";

const REPO = "hsupierre/TwStockScreener";

function mockFetch(...statuses: number[]) {
  const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
      auth: headers.get("authorization") ?? undefined,
    });
    const status = statuses[calls.length - 1] ?? 500;
    return new Response(status === 204 ? null : "Resource not accessible by personal access token", {
      status,
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("enableAndDispatchEtl", () => {
  it("先重新啟用 workflow，再觸發每日工作", async () => {
    const { impl, calls } = mockFetch(204, 204);
    expect(await enableAndDispatchEtl(REPO, "tok", impl)).toEqual({ status: "dispatched" });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["PUT", `https://api.github.com/repos/${REPO}/actions/workflows/etl.yml/enable`],
      ["POST", `https://api.github.com/repos/${REPO}/actions/workflows/etl.yml/dispatches`],
    ]);
    expect(JSON.parse(calls[1]!.body!)).toEqual({ ref: "main", inputs: { command: "daily", args: "" } });
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  it("權杖權限不足時回報失敗的步驟，且不會繼續觸發", async () => {
    const { impl, calls } = mockFetch(403);
    const result = await enableAndDispatchEtl(REPO, "tok", impl);
    expect(result).toMatchObject({ status: "failed", step: "enable", httpStatus: 403 });
    expect(calls).toHaveLength(1);
  });

  it("觸發失敗時回報", async () => {
    const { impl } = mockFetch(204, 422);
    expect(await enableAndDispatchEtl(REPO, "tok", impl)).toMatchObject({
      step: "dispatch",
      httpStatus: 422,
    });
  });
});
