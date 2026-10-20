"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** 瀏覽器端 client（會員功能使用，P6）。 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
