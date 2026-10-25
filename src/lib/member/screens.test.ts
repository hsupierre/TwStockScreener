import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fake } from "@/test/fake-supabase";

import {
  createScreen,
  deleteScreen,
  renameScreen,
  SCREEN_NAME_MAX,
  SCREENS_LIMIT,
  useSavedScreens,
  validateScreenName,
} from "./screens";

async function ready() {
  fake.session = { user: { id: "alice", user_metadata: {} } } as never;
  const hook = renderHook(() => useSavedScreens());
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

describe("validateScreenName", () => {
  it("去掉前後空白後檢查長度", () => {
    expect(validateScreenName("  ")).toBe("請輸入名稱");
    expect(validateScreenName("存股")).toBeNull();
    expect(validateScreenName("字".repeat(SCREEN_NAME_MAX))).toBeNull();
    expect(validateScreenName("字".repeat(SCREEN_NAME_MAX + 1))).toBe(`名稱最多 ${SCREEN_NAME_MAX} 個字`);
  });
});

describe("我的策略", () => {
  it("新增、重新命名、刪除", async () => {
    const { result } = await ready();

    let created: Awaited<ReturnType<typeof createScreen>> | undefined;
    await act(async () => {
      created = await createScreen("  高殖利率  ", "dy=4~&pe=~15");
    });
    expect(created?.ok).toBe(true);
    expect(result.current.data).toMatchObject([{ name: "高殖利率", query: "dy=4~&pe=~15" }]);
    const id = result.current.data[0]!.id;

    await act(async () => {
      expect(await renameScreen(id, "存股")).toEqual({ ok: true, value: undefined });
    });
    expect(result.current.data[0]!.name).toBe("存股");
    expect(fake.tables.saved_screens![0]!.name).toBe("存股");

    await act(async () => {
      expect(await deleteScreen(id)).toEqual({ ok: true, value: undefined });
    });
    expect(result.current.data).toEqual([]);
    expect(fake.tables.saved_screens).toEqual([]);
  });

  it("名稱不合法時不送出", async () => {
    await ready();
    expect(await createScreen(" ", "dy=4~")).toEqual({ ok: false, message: "請輸入名稱" });
    expect(fake.tables.saved_screens).toEqual([]);
  });

  it("達到上限", async () => {
    fake.tables.saved_screens = Array.from({ length: SCREENS_LIMIT }, (_, i) => ({
      id: `s${i}`,
      user_id: "alice",
      name: `s${i}`,
      query: "",
      created_at: `2026-10-01T00:00:${String(i).padStart(2, "0")}Z`,
    }));
    await ready();
    expect(await createScreen("再一個", "")).toEqual({
      ok: false,
      message: `我的策略最多 ${SCREENS_LIMIT} 個`,
    });
    expect(fake.tables.saved_screens).toHaveLength(SCREENS_LIMIT);
  });

  it("另一個裝置先存滿時，資料庫的 trigger 擋下；不更新清單", async () => {
    const { result } = await ready();
    fake.nextError = { message: "已達上限（50 筆）", code: "P0001", hint: "member_limit" };
    expect(await createScreen("x", "")).toEqual({ ok: false, message: `我的策略最多 ${SCREENS_LIMIT} 個` });
    expect(result.current.data).toEqual([]);
  });
});
