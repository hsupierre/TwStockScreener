import { loadEnvConfig } from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { test as base } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * 已登入會員的 E2E fixture。Google 登入無法自動化，所以：
 * 1. 用 service_role 建立測試帳號（Email＋密碼，只有測試使用）
 * 2. 在 Node 端用 @supabase/ssr 登入，取得與瀏覽器相同格式的 session cookie
 * 3. 放進瀏覽器 → 頁面上的瀏覽器端 client 直接視為已登入
 * 測試結束後刪除帳號（自選股、策略一併刪除）。
 */

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface TestMember {
  id: string;
  email: string;
}

async function signInCookies(email: string, password: string) {
  const jar = new Map<string, string>();
  const db = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`測試帳號無法登入（Supabase 的 Email provider 需要開啟）：${error.message}`);
  return [...jar].map(([name, value]) => ({ name, value }));
}

export const test = base.extend<{ member: TestMember }>({
  // 參數名稱不用 `use`：會被 React hooks 的 lint 規則誤判
  member: async ({ context, baseURL }, provide) => {
    if (!serviceKey) throw new Error("會員 E2E 需要 .env.local 的 SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `e2e-${randomUUID()}@example.com`;
    const password = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "測試會員" },
    });
    if (error) throw error;

    const cookies = await signInCookies(email, password);
    await context.addCookies(cookies.map((c) => ({ ...c, url: baseURL! })));
    try {
      await provide({ id: data.user.id, email });
    } finally {
      await admin.auth.admin.deleteUser(data.user.id);
    }
  },
});

export { expect } from "@playwright/test";
