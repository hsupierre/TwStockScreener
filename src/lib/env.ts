import { z } from "zod";

/**
 * 環境變數 schema。
 * 公開變數（NEXT_PUBLIC_*）必須用 `process.env.NEXT_PUBLIC_X` 的靜態寫法讀取，Next.js 才會在 build 時內嵌到前端。
 * 伺服器專用的變數請透過 `@/lib/env.server` 讀取，該檔案用 `server-only` 擋住前端 import。
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REVALIDATE_SECRET: z.string().min(32, "REVALIDATE_SECRET 至少要 32 字元"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** 解析並驗證；失敗時丟出列出所有缺漏變數的錯誤，方便在部署時一眼看出問題。 */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
): z.infer<S> {
  // 空字串視為未設定，避免 `.env.example` 複製過來的空值通過驗證
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`環境變數設定錯誤：\n${issues}\n請參考 .env.example`);
  }
  return result.data;
}

let cachedPublic: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cachedPublic ??= parseEnv(publicEnvSchema, {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cachedPublic;
}

/** 只需要網站網址的地方（metadata、sitemap）使用，不強制要求 Supabase 設定。 */
export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(z.url().parse(raw));
}
