import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 帶使用者 session 的 client（Server Component、Route Handler、Server Action）。
 * 會讀 cookie，使用它的頁面會變成動態渲染；公開資料請改用 `createSupabasePublicClient`。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 在 Server Component 中無法寫入 cookie；session 由 proxy 負責刷新（P6）
        }
      },
    },
  });
}
