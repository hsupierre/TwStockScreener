import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fake } from "@/test/fake-supabase";

import { toggleWatch, useWatchlist, WATCHLIST_LIMIT } from "./watchlist";

const ALICE = { id: "alice", email: "alice@example.com" };

async function signedInWatchlist(codes: string[] = []) {
  fake.session = { user: { ...ALICE, user_metadata: {} } } as never;
  fake.tables.watchlist_items = codes.map((code, i) => ({
    user_id: ALICE.id,
    code,
    created_at: `2026-10-0${i + 1}T00:00:00Z`,
  }));
  const hook = renderHook(() => useWatchlist());
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

describe("自選股", () => {
  it("未登入時是 idle，不能加入", async () => {
    const { result } = renderHook(() => useWatchlist());
    await act(async () => {});
    expect(result.current.status).toBe("idle");
    expect(await toggleWatch("2330")).toEqual({ ok: false, message: "請先登入" });
  });

  it("登入後讀取自己的清單（依加入順序），看不到別人的", async () => {
    fake.tables.watchlist_items = [{ user_id: "bob", code: "1101", created_at: "2026-10-01T00:00:00Z" }];
    const { result } = await signedInWatchlist(["2330", "2317"]);
    expect(result.current.data).toEqual(["2330", "2317"]);
  });

  it("加入、移除會立即更新並寫入資料庫", async () => {
    const { result } = await signedInWatchlist(["2330"]);
    await act(async () => {
      expect(await toggleWatch("2881")).toEqual({ ok: true, added: true });
    });
    expect(result.current.data).toEqual(["2330", "2881"]);
    expect(fake.tables.watchlist_items!.map((r) => r.code)).toEqual(["2330", "2881"]);

    await act(async () => {
      expect(await toggleWatch("2330")).toEqual({ ok: true, added: false });
    });
    expect(result.current.data).toEqual(["2881"]);
    expect(fake.tables.watchlist_items!.map((r) => r.code)).toEqual(["2881"]);
  });

  it("寫入失敗時還原並回傳訊息", async () => {
    const { result } = await signedInWatchlist(["2330"]);
    fake.nextError = { message: "已達上限（200 筆）", code: "P0001", hint: "member_limit" };
    let res: Awaited<ReturnType<typeof toggleWatch>> | undefined;
    await act(async () => {
      res = await toggleWatch("2881");
    });
    expect(res).toEqual({ ok: false, message: `自選股最多 ${WATCHLIST_LIMIT} 檔` });
    expect(result.current.data).toEqual(["2330"]);

    fake.nextError = { message: "JWT expired", code: "PGRST301" };
    await act(async () => {
      res = await toggleWatch("2330");
    });
    expect(res).toEqual({ ok: false, message: "登入已過期，請重新登入" });
    expect(result.current.data).toEqual(["2330"]);
  });

  it("已經在清單中（另一個分頁剛加入）視為成功", async () => {
    await signedInWatchlist([]);
    fake.tables.watchlist_items!.push({ user_id: ALICE.id, code: "2330", created_at: "x" });
    expect(await toggleWatch("2330")).toEqual({ ok: true, added: true });
  });

  it("達到上限時不送出請求", async () => {
    const codes = Array.from({ length: WATCHLIST_LIMIT }, (_, i) => String(1000 + i));
    await signedInWatchlist(codes);
    expect(await toggleWatch("9999")).toEqual({ ok: false, message: `自選股最多 ${WATCHLIST_LIMIT} 檔` });
    expect(fake.tables.watchlist_items).toHaveLength(WATCHLIST_LIMIT);
  });

  it("登出時清空", async () => {
    const { result } = await signedInWatchlist(["2330"]);
    const { signOut } = await import("@/lib/auth/session");
    await act(async () => {
      await signOut();
    });
    expect(result.current).toEqual({ status: "idle", userId: null, data: [] });
  });
});
