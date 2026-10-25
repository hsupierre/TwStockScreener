import { type NextRequest, NextResponse } from "next/server";

import { safeNext } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google 登入完成後 Supabase 導回這裡（PKCE）：用網址上的 code 換成 session，寫入 cookie 後回到原本的頁面。
 * code verifier 由瀏覽器端 client 在開始登入時存在 cookie。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const fail = (reason: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  // 使用者在 Google 按了取消，或 Supabase 回報錯誤
  if (searchParams.get("error")) {
    return fail(searchParams.get("error") === "access_denied" ? "denied" : "callback");
  }
  const code = searchParams.get("code");
  if (!code) return fail("callback");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("callback");
  return NextResponse.redirect(new URL(next, origin));
}
