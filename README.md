# 台股選股 TwStockScreener

面向台灣投資人的**基本面選股平台**。可以用本益比、殖利率、ROE、營收成長、負債比等條件，篩選上市、上櫃股票。
只使用免費資料來源、部署在免費方案上，不需要付費 API。

> 本站資料僅供參考，不構成投資建議。

## 架構

```
GitHub Actions cron ──► Python ETL（etl/）──► Supabase Postgres ──► Next.js（Vercel）
   TWSE / TPEx OpenAPI      正規化、計算指標        screen_snapshot      瀏覽器端篩選
   MOPS 彙總報表            upsert                 RLS 只開放讀取       個股頁 ISR
                            └─ 完成後呼叫 /api/revalidate 讓快取失效
```

- **篩選在瀏覽器端進行**：每天只從 Supabase 讀一次快照（Next.js 快取），使用量增加也不會耗盡免費額度。
- **ETL 不放在 Next.js 裡**：Vercel Hobby 的 Function 最多執行 60 秒，cron 一天只能跑一次，不適合長時間的資料回補。

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | Next.js 16（App Router）、React 19、TypeScript（strict）、Tailwind CSS v4、shadcn/ui |
| 表格／圖表／URL 狀態 | TanStack Table、Recharts（shadcn chart）、nuqs |
| 資料庫／認證 | Supabase（Postgres + RLS、Auth） |
| ETL | Python 3.12 |
| 測試 | Vitest + Testing Library、Playwright、pytest |
| 部署 | Vercel Hobby（非商業）、GitHub Actions |

## 資料夾結構

```
src/
  app/                 App Router 頁面、Route Handler、sitemap / robots
  components/
    ui/                shadcn/ui 元件（由 CLI 產生）
    layout/            頁首、頁尾
  lib/
    env.ts             環境變數 schema（zod）
    env.server.ts      伺服器專用環境變數（server-only）
    format.ts          數值格式化（千分位、%、億元）
    site.ts            網站設定、免責聲明、資料來源
tests/e2e/             Playwright E2E 測試
etl/
  scripts/verify_sources.py   資料端點驗證腳本
  tests/                      pytest
  reports/                    驗證報告輸出
supabase/              migrations、seed（P1）
.github/workflows/     CI 與 ETL 排程
```

## 本機開發

需要 Node.js ≥ 20.9（建議使用 `.nvmrc` 指定的 24）、Python 3.12。

```bash
npm install
cp .env.example .env.local      # 依說明填入 Supabase 等設定（P0 不需要）
npm run dev                     # http://localhost:3000
```

ETL：

```bash
cd etl
python -m venv .venv
.venv\Scripts\activate          # macOS / Linux：source .venv/bin/activate
pip install -e ".[dev]"
```

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 啟動開發伺服器（Turbopack） |
| `npm run build` / `npm start` | 正式版 build 與啟動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run format` / `format:check` | Prettier 格式化與檢查 |
| `npm test` | Vitest 單元測試 |
| `npm run e2e` | Playwright E2E（會自動 build 並啟動；第一次執行前要跑 `npx playwright install chromium`） |
| `npm run check` | lint、typecheck、format、unit 一次跑完 |
| `python etl/scripts/verify_sources.py` | 實測所有資料端點，輸出 `etl/reports/sources.md` |
| `cd etl && pytest` / `ruff check .` | ETL 測試與 lint |

## 資料來源

| 資料 | 上市（TWSE） | 上櫃（TPEx） |
|---|---|---|
| 公司基本資料 | `opendata/t187ap03_L` | `mopsfin_t187ap03_O` |
| 日行情 | `exchangeReport/STOCK_DAY_ALL` | `tpex_mainboard_daily_close_quotes` |
| 本益比／殖利率／淨值比 | `exchangeReport/BWIBBU_ALL` | `tpex_mainboard_peratio_analysis` |
| 月營收 | `opendata/t187ap05_L` | `mopsfin_t187ap05_O` |
| 綜合損益表 | `opendata/t187ap06_L_{ci,fh,basi,bd,ins,mim}` | `mopsfin_t187ap06_O_*` |
| 資產負債表 | `opendata/t187ap07_L_*` | `mopsfin_t187ap07_O_*` |
| 營益分析 | `opendata/t187ap17_L` | `mopsfin_187ap17_O` |
| 股利分派 | `opendata/t187ap45_L` | `mopsfin_t187ap39_O` |
| 歷史財報回補 | MOPS `ajax_t163sb04` 等彙總報表 | 同左（`TYPEK=otc`） |

處理資料時要注意：

- 日期是**民國年**格式（`1151019` = 2026-10-19，`11509` = 2026 年 9 月）。
- 季報數字是**年度累計值**，單季數字要用前後期相減算出；金額單位是**千元**。
- OpenAPI 只提供最新一期，歷史資料要從 MOPS 回補。
- 上櫃行情包含權證、債券等，要用代號規則過濾。
- 證交所與櫃買中心的資料開放**非商業使用**。商業化前請洽詢資訊授權。

## 開發進度

- [x] **P0** 資料端點驗證、專案骨架、CI
- [ ] **P1** Supabase schema、migrations、RLS
- [ ] **P2** ETL 與排程
- [ ] **P3** 選股器
- [ ] **P4** 個股頁與 SEO
- [ ] **P5** 部署與監控
- [ ] **P6** 會員功能

## 測試方法

### P0

1. `python etl/scripts/verify_sources.py`：應顯示 19/19 成功，並產生 `etl/reports/sources.md`。
2. `npm run check`：lint、型別、格式、單元測試全部通過。
3. `npm run e2e`：首頁、404、安全性標頭的 E2E 測試通過（桌面與手機兩種裝置）。
4. `cd etl && pytest && ruff check .`：通過。
5. 推上 GitHub 後，CI 的 web、e2e、etl 三個 job 都是綠燈。
