// 從已連結的 Supabase 專案產生 TypeScript 型別，寫入 src/types/database.ts。
// 用 Node 寫檔而不是 shell 重導向，Windows cmd / PowerShell / bash 行為一致。
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const out = resolve(import.meta.dirname, "../src/types/database.ts");

const types = execSync("supabase gen types typescript --linked --schema public", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 16 * 1024 * 1024,
});

if (!types.includes("export type Database")) {
  console.error("產生的內容看起來不是型別定義，未寫入檔案。");
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, types.replace(/\r\n/g, "\n"));
console.log(`已寫入 ${out}`);
