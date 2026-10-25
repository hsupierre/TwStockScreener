/**
 * 登入後要回到的頁面（?next=）。只接受站內的相對路徑，避免被用來導向其他網站（open redirect）。
 * 伺服器（/auth/callback）與瀏覽器共用。
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // 控制字元（例如換行）也拒絕，避免瀏覽器把 "/\t/evil.com" 解析成其他網站
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** 登入頁網址；next 為目前頁面（含查詢字串）。 */
export function loginHref(next: string): string {
  const target = safeNext(next);
  return target === "/" ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}
