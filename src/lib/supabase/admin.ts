import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * 使用 service_role key 的 client，會略過 RLS。
 * 只能在伺服器端、而且確定需要管理權限時使用（例如 revalidate webhook 寫入紀錄）。
 */
export function createSupabaseAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
