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
    supabase/          public（唯讀、可快取）、server（帶 session）、client（瀏覽器）、admin（service_role）
  types/database.ts    由 `npm run db:types` 產生，不要手動修改
tests/e2e/             Playwright E2E 測試
tests/db/              Supabase RLS 整合測試
scripts/               開發用腳本（型別產生）
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

### Supabase（第一次設定）

1. 在 [supabase.com](https://supabase.com) 建立免費專案。區域建議選 Northeast Asia (Tokyo)。
2. 到 **Project Settings → API Keys** 複製 publishable key 和 secret key（或舊版的 anon、service_role），**Project URL** 在 **Data API**。把這三個值填進 `.env.local`。
3. 確認可以連線：`python etl/scripts/check_supabase.py`
4. 連結專案並套用 schema：

```bash
npx supabase login
npx supabase link --project-ref <你的 project ref>
npm run db:push        # 套用 supabase/migrations/
npm run db:types       # 產生 src/types/database.ts
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
| `npm run test:db` | 對 Supabase 專案跑 RLS／權限整合測試（需要 `.env.local`） |
| `npm run db:push` | 把新的 migration 套用到已連結的專案 |
| `npm run db:status` | 列出本機與遠端各自套用了哪些 migration（不需要 Docker） |
| `npm run db:types` | 重新產生資料庫 TypeScript 型別（schema 有變更時執行） |
| `python etl/scripts/check_supabase.py` | 檢查 `.env.local` 的 Supabase 設定與連線（不會印出 key） |
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

## ETL（`etl/`）

純 Python，只依賴 httpx，透過 Supabase REST API 寫入（使用 service_role key）。

```
etl/tw_etl/
  sources/openapi.py     TWSE / TPEx OpenAPI：公司、行情、估值、最新月營收、官方營益分析
  sources/mops.py        MOPS：季報彙總表（損益、資產負債、現金流量）、月營收歷史、股利分派
  transform/financials.py  欄位對應（各產業格式）、年度累計 → 單季
  transform/snapshot.py    選股指標計算、寫入前合理性檢查
  load/supabase.py       分批 upsert、分頁讀取
  jobs.py                daily / monthly / quarterly / dividends / snapshot / backfill
  runs.py                etl_runs 執行紀錄、data_freshness
  verify.py              與官方「營益分析」交叉比對
```

| 指令（在 `etl/` 目錄） | 內容 | 排程（台灣時間） |
|---|---|---|
| `python -m tw_etl daily` | 公司基本資料、行情、估值，接著重算快照 | 週一至五 23:00、隔天 07:30 |
| `python -m tw_etl monthly` | 最新月營收 | 每月 1–15 日 21:00 |
| `python -m tw_etl quarterly` | 去年與今年各季季報（MOPS） | 財報季（3、4、5、8、11 月）每天，其他月份每週日 |
| `python -m tw_etl dividends` | 去年與今年董事會決議的股利 | 每週六 |
| `python -m tw_etl snapshot` | 只重算快照 | — |
| `python -m tw_etl backfill` | 一次性歷史回補（季報 2023 起、營收 36 個月、股利 10 年） | 手動 |
| `python -m tw_etl verify-margins` | 用單季值重組累計毛利率、營益率，與官方營益分析比對 | 手動 |

所有指令都可以加 `--dry-run`，只抓取和計算，不寫入資料庫。

設計重點：

- **單季值**：官方季報是年度累計值，所以 quarterly 每次都抓整年各季，再前後相減。缺少前一季累計值時，單季流量存 `NULL`，不會猜測。
- **合理性檢查**：寫入快照前會檢查筆數 ≥ 1,500、有收盤價的比例 ≥ 90%、有近四季 EPS 的比例 ≥ 70%，以及 2330 的數值是否合理。沒通過就讓工作失敗，並**保留線上舊快照**。
- **禮貌抓取**：MOPS 每次請求間隔 3 秒，其他網站 0.5 秒；遇到逾時或 5xx 會指數退避重試；MOPS 回應「查詢過於頻繁」時至少等 60 秒。
- **冪等**：所有寫入都是 upsert，重跑不會產生重複資料。

GitHub Actions（`.github/workflows/etl.yml`）需要設定以下項目：

- **Secrets**：`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`REVALIDATE_SECRET`
- **Variables**：`NEXT_PUBLIC_SITE_URL`

也可以在 Actions 頁面手動執行（workflow_dispatch），選擇要跑的工作並加上參數。

> 公開 repo 連續 60 天沒有任何 commit 時，GitHub 會自動停用排程，屆時要到 Actions 頁面重新啟用。

## 資料庫

Schema 放在 `supabase/migrations/`。**不要在 Dashboard 直接改表**，所有變更都要寫成新的 migration。

| 資料表 | 內容 | 權限 |
|---|---|---|
| `companies` | 公司基本資料、市場別、產業、財報格式 | 公開唯讀 |
| `daily_valuation` | 每日收盤價、本益比、殖利率、股價淨值比 | 公開唯讀 |
| `monthly_revenue` | 月營收、月增率、年增率、累計 | 公開唯讀 |
| `financials_quarterly` | 季報（損益與現金流為單季值、資產負債為期末值） | 公開唯讀 |
| `dividends` | 股利分派 | 公開唯讀 |
| `screen_snapshot` | 選股快照，每檔一列，由 ETL 整批重算 | 公開唯讀 |
| `data_freshness` | 各資料集最後更新時間 | 公開唯讀 |
| `etl_runs` | ETL 執行紀錄 | 只有 service_role |

慣例：

- 金額單位是**元**。
- 比率存成**百分比數字**，例如 `12.34` 代表 12.34%。
- 沒有資料就存 `NULL`，不要存 0。例如金融業沒有毛利率。

權限有兩層：

- RLS 只開放 SELECT policy。
- 另外撤銷 anon／authenticated 的寫入權限。之後新增的資料表，預設也不開放給這兩個角色。

> Supabase API 預設每次最多回傳 1,000 列（`max_rows`），讀取完整快照（約 1,800 列）時要用 `.range()` 分頁。

## 開發進度

- [x] **P0** 資料端點驗證、專案骨架、CI
- [x] **P1** Supabase schema、migrations、RLS
- [x] **P2** ETL 與排程
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

### P1

1. `python etl/scripts/check_supabase.py`：URL、公開 key、機密 key 三項都顯示 ✅。
2. `npm run db:push`：顯示 `Remote database is up to date`，代表 migrations 都已經套用。
3. `npm run db:status`：3 個 migration 在 Local 和 Remote 兩欄都有出現，代表兩邊一致。
   （`supabase db diff` 需要 Docker 建立 shadow database，本專案不使用。）
4. `npm run test:db`：15 個測試通過，包括：
   - anon 可以讀 7 張公開表
   - anon 不能新增、修改、刪除（`42501`）
   - anon 讀不到 `etl_runs`
   - service_role 可以寫入
   - 格式錯誤的代號會被 check constraint 擋下
5. `npm run db:types` 之後執行 `git diff src/types/database.ts`：沒有差異，代表型別和 schema 同步。
6. `npm run check && npm run build`：通過。

### P2

在 `etl/` 目錄執行：

1. `pytest`：單元測試全部通過。涵蓋民國日期、千元換算、HTML 解析容錯、各產業財報欄位對應、累計轉單季、TTM、ROE、連續成長、股利、合理性檢查。
2. `ruff check . && ruff format --check .`：通過。
3. `python -m tw_etl daily --dry-run`：抓到約 1,980 家公司、約 1,980 筆行情估值。資料庫還沒有季報時，快照會被合理性檢查擋下（這是預期行為）。
4. `python -m tw_etl backfill`：完成後在 Supabase 的 SQL Editor 執行：
   ```sql
   select status, job, rows_written, finished_at from etl_runs order by id desc limit 10;
   select count(*) from screen_snapshot;              -- 約 1,900
   select * from screen_snapshot where code in ('2330', '2881', '6488');
   ```
5. `python -m tw_etl verify-margins`：重組的累計毛利率、營益率，與官方「營益分析」比對，不一致比例 ≤ 1%。
6. 抽查 2330 的單季 EPS、ROE、月營收年增率，跟公開資訊觀測站的數字一致。
