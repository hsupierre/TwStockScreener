import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// 對真實 Supabase 專案跑的整合測試（RLS、權限）。需要 .env.local 或 CI secrets。
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    fileParallelism: false,
  },
}));
