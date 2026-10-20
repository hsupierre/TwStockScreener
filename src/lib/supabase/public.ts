import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 不帶使用者 session 的唯讀 client，用於讀取公開市場資料。
 * 不讀 cookie，所以可以在快取（`use cache`、ISR）中使用，不會讓頁面變成動態。
 */
export function createSupabasePublicClient() {
  const env = getPublicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
