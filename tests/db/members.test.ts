import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

/**
 * 會員資料的 RLS：每位會員只能讀寫自己的自選股與策略。
 * 用 service_role 建立兩個測試帳號（A、B），再以各自的身分登入（Email＋密碼，只有測試使用），
 * 測試結束後刪除帳號（資料會 cascade 刪除）。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !anonKey || !serviceKey) throw new Error("DB 測試需要 Supabase 環境變數（見 rls.test.ts）");

type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, serviceKey, opts);
const anon = createClient<Database>(url, anonKey, opts);

// 一定存在的代號：用市值最大的兩檔
let CODE_1 = "";
let CODE_2 = "";

interface TestUser {
  id: string;
  db: Client;
}

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = createClient<Database>(url, anonKey, opts);
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`測試帳號無法登入（Email provider 需要開啟）：${signInError.message}`);
  return { id: data.user.id, db };
}

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  const { data, error } = await admin
    .from("screen_snapshot")
    .select("code")
    .order("market_cap", { ascending: false, nullsFirst: false })
    .limit(2);
  if (error || data.length < 2) throw new Error("需要已有快照資料");
  [CODE_1, CODE_2] = [data[0]!.code, data[1]!.code];
  [a, b] = await Promise.all([createUser("a"), createUser("b")]);
});

afterAll(async () => {
  await Promise.all([a, b].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

describe("自選股 watchlist_items", () => {
  it("可以新增、讀取、刪除自己的；user_id 自動帶入", async () => {
    const { error } = await a.db.from("watchlist_items").insert({ code: CODE_1 });
    expect(error).toBeNull();
    const { data } = await a.db.from("watchlist_items").select("user_id, code");
    expect(data).toEqual([{ user_id: a.id, code: CODE_1 }]);
  });

  it("看不到、刪不到別人的", async () => {
    const { data } = await b.db.from("watchlist_items").select("code");
    expect(data).toEqual([]);
    await b.db.from("watchlist_items").delete().eq("code", CODE_1);
    const { count } = await admin
      .from("watchlist_items")
      .select("code", { count: "exact", head: true })
      .eq("user_id", a.id);
    expect(count).toBe(1);
  });

  it("不能替別人新增（偽造 user_id）", async () => {
    const { error } = await b.db.from("watchlist_items").insert({ user_id: a.id, code: CODE_2 });
    expect(error?.code).toBe("42501"); // new row violates row-level security policy
  });

  it("同一檔重複加入會被拒絕（23505）", async () => {
    const { error } = await a.db.from("watchlist_items").insert({ code: CODE_1 });
    expect(error?.code).toBe("23505");
  });

  it("不存在的代號會被拒絕（外鍵）", async () => {
    const { error } = await a.db.from("watchlist_items").insert({ code: "ZZZZZZ" });
    expect(error?.code).toBe("23503");
  });

  it("匿名使用者不能讀寫", async () => {
    expect((await anon.from("watchlist_items").select("code")).error?.code).toBe("42501");
    expect((await anon.from("watchlist_items").insert({ code: CODE_1 })).error?.code).toBe("42501");
  });
});

describe("我的策略 saved_screens", () => {
  let id = "";

  it("可以新增、改名；看不到別人的", async () => {
    const { data, error } = await a.db
      .from("saved_screens")
      .insert({ name: "存股", query: "dy=4~" })
      .select("id, user_id, name")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ user_id: a.id, name: "存股" });
    id = data!.id;

    const renamed = await a.db.from("saved_screens").update({ name: "高殖利率" }).eq("id", id).select("name");
    expect(renamed.data).toEqual([{ name: "高殖利率" }]);

    expect((await b.db.from("saved_screens").select("id")).data).toEqual([]);
  });

  it("別人改不到、刪不到（影響 0 列）", async () => {
    const updated = await b.db.from("saved_screens").update({ name: "被竄改" }).eq("id", id).select("id");
    expect(updated.data).toEqual([]);
    await b.db.from("saved_screens").delete().eq("id", id);
    const { data } = await admin.from("saved_screens").select("name").eq("id", id).single();
    expect(data?.name).toBe("高殖利率");
  });

  it("不能把策略轉給別人（user_id 不允許更新）", async () => {
    const { error } = await a.db.from("saved_screens").update({ user_id: b.id }).eq("id", id);
    expect(error?.code).toBe("42501");
  });

  it("名稱與條件有長度限制", async () => {
    expect((await a.db.from("saved_screens").insert({ name: "  ", query: "" })).error?.code).toBe("23514");
    expect((await a.db.from("saved_screens").insert({ name: "x".repeat(41), query: "" })).error?.code).toBe(
      "23514",
    );
    expect(
      (await a.db.from("saved_screens").insert({ name: "x", query: "q".repeat(2001) })).error?.code,
    ).toBe("23514");
  });

  it("每人最多 50 個（trigger）", async () => {
    const rows = Array.from({ length: 49 }, (_, i) => ({ name: `s${i}`, query: "" }));
    expect((await b.db.from("saved_screens").insert(rows)).error).toBeNull();
    expect((await b.db.from("saved_screens").insert({ name: "第 50 個", query: "" })).error).toBeNull();
    const { error } = await b.db.from("saved_screens").insert({ name: "第 51 個", query: "" });
    expect(error?.hint).toBe("member_limit");
  });
});

describe("刪除帳號 delete_my_account()", () => {
  it("匿名不能呼叫", async () => {
    const { error } = await anon.rpc("delete_my_account");
    expect(error?.code).toBe("42501");
  });

  it("只刪除自己，資料一併刪除", async () => {
    const { error } = await b.db.rpc("delete_my_account");
    expect(error).toBeNull();

    const gone = await admin.auth.admin.getUserById(b.id);
    expect(gone.data.user).toBeNull();
    const { count } = await admin
      .from("saved_screens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", b.id);
    expect(count).toBe(0);

    // A 不受影響
    expect((await admin.auth.admin.getUserById(a.id)).data.user?.id).toBe(a.id);
    expect((await a.db.from("watchlist_items").select("code")).data).toHaveLength(1);
  });
});
