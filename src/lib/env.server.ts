import "server-only";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

/** 伺服器端專用（Route Handler、Server Component、Server Action）。前端 import 會在 build 時報錯。 */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env);
  return cached;
}

/**
 * revalidate webhook 的密鑰。網站本身不需要 service role key，所以獨立讀取；
 * 沒有設定時回傳 null（端點回 503），設定了但太短則丟出錯誤，避免弱密鑰上線。
 */
export function getRevalidateSecret(): string | null {
  const raw = process.env.REVALIDATE_SECRET;
  if (!raw) return null;
  if (raw.length < 32) throw new Error("REVALIDATE_SECRET 至少要 32 字元");
  return raw;
}
