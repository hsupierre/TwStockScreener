import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "DB 測試需要 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY",
  );
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient<Database>(url, anonKey, opts);
const admin = createClient<Database>(url, serviceKey, opts);

// 測試專用代號，不會與真實股票衝突
const TEST_CODE = "ZZTEST";

const PUBLIC_TABLES = [
  "companies",
  "daily_valuation",
  "monthly_revenue",
  "financials_quarterly",
  "dividends",
  "screen_snapshot",
  "data_freshness",
] as const;

beforeAll(async () => {
  const { error } = await admin.from("companies").upsert({
    code: TEST_CODE,
    name: "測試公司",
    market: "twse",
    industry: "測試",
  });
  if (error) throw error;
});

afterAll(async () => {
  await admin.from("companies").delete().eq("code", TEST_CODE);
});

describe("匿名使用者（anon key）", () => {
  it.each(PUBLIC_TABLES)("可以讀取 %s", async (table) => {
    const { error } = await anon.from(table).select("*").limit(1);
    expect(error).toBeNull();
  });

  it("讀得到 service_role 寫入的資料", async () => {
    const { data, error } = await anon.from("companies").select("code, name").eq("code", TEST_CODE).single();
    expect(error).toBeNull();
    expect(data?.name).toBe("測試公司");
  });

  it("不能新增資料", async () => {
    const { error } = await anon.from("companies").insert({ code: "ZZANON", name: "x", market: "twse" });
    expect(error?.code).toBe("42501"); // permission denied
  });

  it("不能修改資料", async () => {
    const { error } = await anon.from("companies").update({ name: "被竄改" }).eq("code", TEST_CODE);
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("companies").select("name").eq("code", TEST_CODE).single();
    expect(data?.name).toBe("測試公司");
  });

  it("不能刪除資料", async () => {
    const { error } = await anon.from("companies").delete().eq("code", TEST_CODE);
    expect(error?.code).toBe("42501");
    const { count } = await admin
      .from("companies")
      .select("code", { count: "exact", head: true })
      .eq("code", TEST_CODE);
    expect(count).toBe(1);
  });

  it("不能讀取 etl_runs", async () => {
    const { error } = await anon.from("etl_runs").select("*").limit(1);
    expect(error?.code).toBe("42501");
  });
});

describe("service_role（ETL）", () => {
  it("可以寫入與刪除快照", async () => {
    const { error: upsertError } = await admin
      .from("screen_snapshot")
      .upsert({ code: TEST_CODE, name: "測試公司", market: "twse", pe: 12.34 });
    expect(upsertError).toBeNull();

    const { data } = await anon.from("screen_snapshot").select("pe").eq("code", TEST_CODE).single();
    expect(Number(data?.pe)).toBeCloseTo(12.34);

    const { error: deleteError } = await admin.from("screen_snapshot").delete().eq("code", TEST_CODE);
    expect(deleteError).toBeNull();
  });

  it("可以寫入 etl_runs", async () => {
    const { data, error } = await admin
      .from("etl_runs")
      .insert({ job: "rls-test", status: "skipped" })
      .select("id")
      .single();
    expect(error).toBeNull();
    await admin.from("etl_runs").delete().eq("id", data!.id);
  });

  it("違反 check constraint 會被拒絕", async () => {
    const { error } = await admin.from("companies").insert({ code: "bad code", name: "x", market: "twse" });
    expect(error?.code).toBe("23514");
  });
});
