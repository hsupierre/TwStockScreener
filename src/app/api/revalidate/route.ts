import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { SNAPSHOT_TAG } from "@/lib/data/snapshot";
import { getRevalidateSecret } from "@/lib/env.server";

/** 只允許清除這些快取標籤：整份快照，或單一個股。 */
const TAG = z.union([z.literal(SNAPSHOT_TAG), z.string().regex(/^stock:\d{4}$/)]);
const BODY = z.object({ tags: z.array(TAG).min(1).max(50) });

function json(status: number, body: Record<string, unknown>) {
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
 * ETL 完成後呼叫：POST /api/revalidate，Authorization: Bearer <REVALIDATE_SECRET>，body {"tags":["snapshot"]}。
 * 使用 stale-while-revalidate（'max'）：下一位訪客先看到舊頁面，同時在背景產生新頁面。
 */
export async function POST(request: Request) {
  const secret = getRevalidateSecret();
  if (!secret) return json(503, { error: "伺服器未設定 REVALIDATE_SECRET" });
  if (!authorized(request.headers.get("authorization"), secret)) return json(401, { error: "未授權" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "body 必須是 JSON" });
  }
  const parsed = BODY.safeParse(payload);
  if (!parsed.success)
    return json(400, { error: "tags 格式錯誤", issues: parsed.error.issues.map((i) => i.message) });

  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) revalidateTag(tag, "max");
  return json(200, { revalidated: tags });
}
