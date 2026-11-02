import "server-only";

import { timingSafeEqual } from "node:crypto";

/** Vercel Cron 共用：驗證 CRON_SECRET、回應格式、ETL 所在的 repo。 */

export const ETL_REPO = process.env.GITHUB_REPOSITORY || "hsupierre/TwStockScreener";

export function cronJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authorized(header: string | null, secret: string): boolean {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>（需在 Vercel 設定 CRON_SECRET）。
 * 驗證失敗時回傳要直接回應的 Response；通過時回傳 null。
 */
export function cronGuard(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32)
    return cronJson(503, { error: "伺服器未設定 CRON_SECRET（至少 32 字元）" });
  if (!authorized(request.headers.get("authorization"), secret)) return cronJson(401, { error: "未授權" });
  return null;
}

/** 台灣時間的日期（YYYY-MM-DD），與 data_freshness.as_of 的格式相同。 */
export function taipeiDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(now);
}
