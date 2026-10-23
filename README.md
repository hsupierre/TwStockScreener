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
| 表格／圖表／URL 狀態 | TanStack Virtual（虛擬捲動）、Recharts（shadcn chart）、nuqs |
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
    screener/          選股器 UI（篩選面板、策略列、虛擬捲動表格、匯出）
    stock/             個股頁 UI（重點指標、營收與 EPS 圖表、季報表、股利表）
  lib/
    env.ts             環境變數 schema（zod）
    env.server.ts      伺服器專用環境變數（server-only）
    format.ts          數值格式化（千分位、%、億元）
    site.ts            網站設定、免責聲明、資料來源
    screener/          選股器的純函式：指標定義、篩選排序、策略模板、網址格式、CSV、資料過期判斷
    data/snapshot.ts   讀取快照（use cache + cacheTag，server-only）
    data/stock.ts      讀取個股資料（公司、快照、12 季財報、24 個月營收、股利）
    stock/compute.ts   個股頁的純函式：單季比率、營收序列、年度股利合計
    og-font.ts         OG 圖片用的中文字型子集（Google Fonts）
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
| `python -m tw_etl daily` | 公司基本資料、行情、估值，接著重算快照 | 週一至五 23:17、隔天 07:47 |
| `python -m tw_etl monthly` | 最新月營收 | 每月 1–15 日 21:23 |
| `python -m tw_etl quarterly` | 去年與今年各季季報（MOPS） | 財報季（3、4、5、8、11 月）每天 22:33，其他月份每週日 22:33 |
| `python -m tw_etl dividends` | 去年與今年董事會決議的股利 | 每週六 22:43 |
| `python -m tw_etl snapshot` | 只重算快照 | — |
| `python -m tw_etl backfill` | 一次性歷史回補（季報 2023 起、營收 36 個月、股利 10 年） | 手動 |
| `python -m tw_etl verify-margins` | 用單季值重組累計毛利率、營益率，與官方營益分析比對 | 手動 |

所有指令都可以加 `--dry-run`，只抓取和計算，不寫入資料庫。

**每日行情的來源與備援**（`sources/quotes.py`）：

| 順序 | 來源 | 說明 |
|---|---|---|
| 1 | 證交所／櫃買中心**官網** JSON | 主要來源。與 OpenAPI 是同一份資料、定義相同，但通常較早更新 |
| 2 | 證交所／櫃買中心 **OpenAPI** | 備援 |
| 3 | **FinMind**（降級模式） | 前兩者都失敗時才使用。只補上一份快照中**市值前 300 大**的收盤價，因為免費版只能逐檔查詢 |

- 每個市場、每種資料（行情、估值）都會同時抓官網和 OpenAPI，取**日期最新、筆數合理**的那個；日期相同時優先用官網。
- 每筆資料的來源記在 `daily_valuation.source`；每次選擇的結果和各來源的狀態記在 `etl_runs.details`。
- 快照計算時，收盤價、本益比等欄位**各自取最近一筆有值的資料**。降級模式或某天缺少估值時，本益比會沿用前一天的數值，不會整個消失。
- 進入降級模式時，資料照樣寫入，但工作會以失敗（exit 3）結束，GitHub 會寄 Email 通知。
- Yahoo Finance 不採用：批次 API 需要 cookie 和 crumb，單檔查詢沒有本益比與淨值比，而且是非官方服務，條款禁止自動抓取。

設計重點：

- **單季值**：官方季報是年度累計值，所以 quarterly 每次都抓整年各季，再前後相減。缺少前一季累計值時，單季流量存 `NULL`，不會猜測。
- **合理性檢查**：寫入快照前會檢查筆數 ≥ 1,500、有收盤價的比例 ≥ 90%、有近四季 EPS 的比例 ≥ 70%，以及 2330 的數值是否合理。沒通過就讓工作失敗，並**保留線上舊快照**。
- **禮貌抓取**：MOPS 每次請求間隔 3 秒，其他網站 0.5 秒；遇到逾時或 5xx 會指數退避重試；MOPS 回應「查詢過於頻繁」時至少等 60 秒。
- **冪等**：所有寫入都是 upsert，重跑不會產生重複資料。

GitHub Actions（`.github/workflows/etl.yml`）需要設定以下項目：

- **Secrets**：`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`REVALIDATE_SECRET`
- **Variables**：`NEXT_PUBLIC_SITE_URL`

也可以在 Actions 頁面手動執行（workflow_dispatch），選擇要跑的工作並加上參數。

> - 排程刻意避開整點。GitHub 在整點負載高，實測延遲 2～4 小時，偶爾還會略過。daily 一天排兩次就是為了互相備援。
> - 公開 repo 連續 60 天沒有任何 commit 時，GitHub 會自動停用排程，屆時要到 Actions 頁面重新啟用。
> - 每次執行的結果（狀態、筆數、資料基準、重試次數）會寫入 Actions 的 Step Summary（需登入檢視），也會記錄在資料庫的 `etl_runs`。

## 選股器（`/screener`）

- **資料流**：`getSnapshot()` 用 `'use cache'`、`cacheTag('snapshot')`、`cacheLife('hours')` 讀取整份快照（約 2,000 列，分頁突破 Supabase 1,000 列的上限）。結果會放進頁面的靜態外殼，由 CDN 提供；每小時、或 ETL 通知時才重新讀取資料庫。
- **篩選在瀏覽器進行**：條件改變只做本機運算，用 shallow 模式更新網址，不會發出請求。
- **網址就是狀態**，例如 `/screener?dy=4~&roe=8~&pe=~15&m=twse&ind=半導體業&q=台積&s=dy.desc&cols=price,pe,dy`
  - 範圍寫成 `最小~最大`，任一邊都可以省略。每個指標的參數名稱定義在 `src/lib/screener/metrics.ts` 的 `param`。
  - `m` 是市場（`twse` 上市、`tpex` 上櫃），`ind` 是產業，`q` 是代號或名稱，`s` 是排序（`參數.asc|desc`），`cols` 是要顯示的欄位。
  - 預設值不會出現在網址上。
- **策略模板**定義在 `src/lib/screener/presets.ts`：存股、價值、成長、財務體質。
- **缺值處理**：設了某個條件，但股票沒有這項資料時（例如金融業沒有毛利率），這檔股票會被排除；排序時缺值一律排在最後。
- **資料過期提醒**：依各資料集的公告期限判斷（月營收 10 日前、季報 3/31、5/15、8/14、11/14，各留緩衝），在瀏覽器端計算，延遲時顯示警示。

## 部署（Vercel）

- 正式網址：https://tw-stock-screener-fawn.vercel.app
- 只部署 Next.js 網站。ETL 在 GitHub Actions 執行，因為 Vercel Hobby 的函式最長只能跑 60 秒。
- 函式區域用 `vercel.json` 指定為 `syd1`（雪梨），跟 Supabase（`ap-southeast-2`）放在同一區，資料庫查詢就不用跨洲。頁面本身由 Vercel 的全球 CDN 提供，台灣的使用者會從香港節點取得。
- Vercel 環境變數：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`REVALIDATE_SECRET`、`NEXT_PUBLIC_SITE_URL`。**不需要** service role key。
- GitHub（給 ETL 通知網站）：Secret `REVALIDATE_SECRET` 要跟 Vercel 上的一樣；Variable 設 `NEXT_PUBLIC_SITE_URL`。

## 快取更新與監控

- **`POST /api/revalidate`**：ETL 寫入快照後呼叫，用 `revalidateTag(tag, 'max')` 讓選股頁與個股頁在背景重新產生。
  - 必須帶 `Authorization: Bearer <REVALIDATE_SECRET>`，比對時使用 `timingSafeEqual`。
  - body 是 `{"tags": ["snapshot"]}`，只接受 `snapshot` 或 `stock:XXXX`。
  - 伺服器沒設定密鑰時回 503，不會放行。
  - 網站本身**不需要** service role key。
- **ETL 失敗時**（`etl/tests/test_snapshot_job.py` 有測試涵蓋）：
  1. 合理性檢查沒通過時，不寫入也不刪除 `screen_snapshot`，`data_freshness` 也不更新，網站繼續顯示上一份正確的資料。
  2. 失敗原因寫入 `etl_runs.error`，有完整的 traceback。
  3. GitHub Actions 會寄 Email 給 workflow 的擁有者。排程工作的通知對象是最後修改 cron 的人，可以在 GitHub 的 Settings → Notifications → Actions 調整。
  4. 選股頁依各資料集的公告期限，顯示「資料可能尚未更新」的提醒。
  5. revalidate 通知失敗不會讓 ETL 失敗，頁面最晚一小時後也會自動更新。
- **選股頁資料量**：
  - 快照用欄位式緊湊格式內嵌（`lib/screener/codec.ts`），HTML 從 1.4 MB 降到 0.36 MB。
  - 靜態外殼直接放市值前 30 檔的預覽，版面跟選股器相同，表格不用等 JavaScript 就會出現，搜尋引擎也看得到。

## 每日健康檢查（`/api/cron/health`）

Vercel Cron 每天台灣時間 10:17 呼叫一次（`vercel.json`），跟 GitHub Actions 完全獨立：

1. **讓 Supabase 保持活躍**：每次都讀一次 `data_freshness`。就算 GitHub 排程停了，資料庫每天仍有活動，免費專案不會因為閒置 7 天被暫停。
2. **檢查 ETL 排程**（有設定 `GITHUB_ACTIONS_TOKEN` 時）：每天讀取一次 `etl.yml` 的狀態，這也順便驗證權杖還有效。
   - 被 GitHub 因為 60 天沒有活動而停用（`disabled_inactivity`）時，**立刻重新啟用**，資料不會出現空窗。
   - 每日 ETL 超過 72 小時沒有執行時，**觸發一次** `daily`，完成後會再呼叫 `/api/revalidate` 更新網站。72 小時的門檻用的是 ETL 的實際執行時間，所以週末（最長約 50 小時）和連假都不會誤判。
   - 你**手動停用**（`disabled_manually`）的排程會被尊重，不會自動重新啟用。
   - 權杖過期或權限不足時，回應裡的 `ok` 會是 `false`，`github.error` 會寫出原因。

Vercel 環境變數：

- `CRON_SECRET`：必填，至少 32 字元。
- `GITHUB_ACTIONS_TOKEN`：選填。fine-grained personal access token，**只授權這個 repo**，權限選 **Actions: Read and write**。沒有設定時只會保持 Supabase 活躍，不會自動修復。

手動測試：

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://tw-stock-screener-fawn.vercel.app/api/cron/health
```

> 如果 Supabase 真的被暫停了，到 Supabase 後台按 Restore 即可。暫停期間不收費，資料也會保留。這裡刻意不用 Management API 自動恢復，因為那需要權限涵蓋整個帳號的權杖。

## 個股頁（`/stocks/[code]`）

- **靜態輸出**：`ensureStatic = 'navigation'`。build 時用 `generateStaticParams` 預先產生市值前 100 大；其他股票第一次被造訪時產生並存進快取，之後都是靜態頁。實測第一次約 0.7 秒，之後約 0.08 秒。
- **正確的 404**：沒預先產生的頁面，第一次請求會等整頁產生完才回應，所以不存在的代號能回傳 HTTP 404 加上 noindex，不會變成串流後才出錯的「軟 404」。
- **快取**：`getStockDetail()` 跟快照共用 `snapshot` 標籤，ETL 通知時兩者一起失效；另外每小時自動更新一次。
- **SEO**：
  - 每檔股票各有 title 和 description（內含股價、本益比、殖利率等數字），以及 canonical、Open Graph 和麵包屑 JSON-LD。
  - `sitemap.xml` 列出全部約 1,980 檔。
  - OG 圖片用中文字型子集產生（約 40 KB），可被 CDN 快取一天。
- **內容**：重點指標（與選股器使用相同的定義）、24 個月營收與年增率圖、12 季 EPS 圖與季報表（金額固定以億元顯示）、近 10 年股利、公司資料。
- **連結**：選股結果的股票名稱連到個股頁；個股頁的「同產業選股」會帶入產業條件。

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
- [x] **P3** 選股器
- [x] **P4** 個股頁與 SEO
- [x] **P5** 部署與監控
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

### P3

1. `npm test`：59 個單元與元件測試通過。涵蓋：
   - 篩選（含邊界、缺值、單位換算）、排序（缺值排最後、結果穩定）
   - 網址格式的解析與序列化、策略模板、CSV（BOM、跳脫）、資料過期判斷
   - 選股器元件：從網址還原、套用模板、即時輸入、表頭排序、空結果
2. `npm run e2e`：桌面與手機各 8 項，使用真實快照。流程是「套用存股模板 → 改用 ROE 排序 → 匯出 CSV（筆數一致）→ 用同一個網址重新開啟，結果相同」，另外還測搜尋、範圍條件、全部清除、首頁策略卡片，以及手機版沒有整頁橫向捲動。
3. 手動測試：`npm run dev` 後開啟 http://localhost:3000/screener ，套用任一模板、調整條件、複製網址到無痕視窗開啟，結果應該一樣。
4. CI 需要在 GitHub Secrets 設定 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`，build 時會預先渲染 `/screener`。

### P4

1. `npm test`：65 個測試通過，新增個股頁計算函式的測試：單季比率、金融業不適用、營收序列、季配息加總。
2. `npm run e2e`：30 項通過（桌面與手機各 15 項）。新增的項目：
   - 個股頁各區塊、title、canonical、description、og:image、JSON-LD
   - 不存在或格式錯誤的代號回傳 404，並且只有一個 noindex
   - 從選股結果點進個股頁、同產業選股
   - sitemap 至少 1,500 個個股網址、robots.txt
   - OG 圖片是 PNG，且帶有 CDN 快取標頭
3. 狀態碼手動驗證（`npm run build && npm start`）：
   ```bash
   curl -s -o /dev/null -w "%{http_code}
" http://localhost:3000/stocks/2330   # 200
   curl -s -o /dev/null -w "%{http_code}
" http://localhost:3000/stocks/9999   # 404
   ```
4. Lighthouse（本機正式版）：
   - 個股頁：SEO 100、無障礙 100、最佳做法 100、效能 85
   - 選股頁：SEO 100、無障礙 100、最佳做法 100、效能 76

### P5

在正式環境（https://tw-stock-screener-fawn.vercel.app ）驗證：

1. **狀態碼與快取**
   - 首頁、選股頁、預先產生的個股頁直接由 CDN 提供（HIT），約 0.1 秒。
   - 沒預先產生的個股頁，第一次開啟約 0.7～1.2 秒，之後都是 HIT。
   - `/stocks/9999` 回傳 404。
2. **函式區域**：任何會執行函式的請求，回應標頭 `x-vercel-id` 都應該是 `…::syd1::…`。
3. **正式網址**：sitemap、canonical、og:image、robots.txt 都使用正式網址。
4. **快取更新**：在 GitHub Actions 手動執行 ETL `snapshot`。完成後，選股頁 HTML 裡的 `data_freshness` 快照時間，應該要等於 `etl_runs` 最新一筆的 `finished_at`。實測：06:29:29 那次 ETL 完成後，頁面在幾秒內更新。
5. **revalidate 端點**：
   - 不帶密鑰回 401。
   - 帶正確密鑰回 200，之後選股頁先回應 STALE（背景重新產生中），約 10 秒後回到 HIT。
6. **ETL 失敗**：`etl/tests/test_snapshot_job.py` 驗證失敗時不寫入、不刪除快照。GitHub Actions 失敗時會寄 Email 給 repo 擁有者。
7. **正式環境 Lighthouse**：

   | 頁面 | 手機效能 | 桌機效能 | 無障礙／最佳做法／SEO |
   |---|---|---|---|
   | 首頁 | 94 | 100 | 100／100／100 |
   | 選股 | 88 | 100 | 100／100／100 |
   | 個股 | 87～89 | 100 | 100／100／100 |
