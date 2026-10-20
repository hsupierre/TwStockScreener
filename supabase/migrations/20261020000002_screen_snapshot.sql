-- 選股快照：每檔股票一列，由 ETL 每次執行後整批重算。
-- 前端一次讀取整張表（約 1,800 列）並在瀏覽器篩選，所以這裡不建篩選用的索引。

create table public.screen_snapshot (
  code                     text primary key references public.companies (code) on delete cascade,
  name                     text not null,
  market                   text not null check (market in ('twse', 'tpex')),
  industry                 text,

  -- 資料基準
  price_date               date,      -- 股價日期
  financial_period         text,      -- 最新季報，例如 2026Q2
  revenue_period           text,      -- 最新月營收，例如 2026-09

  -- 估值
  close                    numeric(12, 2),
  market_cap               bigint,          -- 市值（元）
  pe                       numeric(10, 2),
  pb                       numeric(10, 2),
  dividend_yield           numeric(6, 2),

  -- 獲利能力（近四季）
  eps_ttm                  numeric(10, 2),
  roe_ttm                  numeric(10, 2),  -- %
  roa_ttm                  numeric(10, 2),  -- %
  gross_margin             numeric(10, 2),  -- %，金融業為 NULL
  operating_margin         numeric(10, 2),  -- %
  net_margin               numeric(10, 2),  -- %

  -- 成長
  revenue_mom              numeric(12, 2),  -- 最新月營收月增 %
  revenue_yoy              numeric(12, 2),  -- 最新月營收年增 %
  revenue_cum_yoy          numeric(12, 2),  -- 累計營收年增 %
  revenue_yoy_3m           numeric(12, 2),  -- 近 3 個月營收合計年增 %
  eps_yoy                  numeric(12, 2),  -- 最新單季 EPS 年增 %
  revenue_growth_months    smallint,        -- 月營收年增率連續為正的月數
  eps_growth_quarters      smallint,        -- 單季 EPS 年增連續為正的季數

  -- 財務體質
  debt_ratio               numeric(10, 2),  -- 負債比 %
  current_ratio            numeric(10, 2),  -- 流動比 %

  -- 股利
  cash_dividend_latest     numeric(10, 4),  -- 最近一個年度的現金股利合計
  cash_dividend_avg_5y     numeric(10, 4),  -- 近 5 年平均現金股利
  dividend_streak_years    smallint,        -- 連續發放現金股利年數

  updated_at               timestamptz not null default now()
);
comment on table public.screen_snapshot is '選股快照（每檔一列，ETL 整批重算）';

-- 每個 ETL 工作最後一次成功的資料基準，前端顯示「資料日期」與過期警示用
create table public.data_freshness (
  job         text primary key check (job in ('daily', 'monthly', 'quarterly', 'dividend', 'snapshot')),
  as_of       text not null,         -- 資料基準：日期、年月或季別
  finished_at timestamptz not null default now()
);
comment on table public.data_freshness is '各資料集最後成功更新時間（公開）';

-- ETL 執行紀錄：只給 service_role 看（錯誤訊息可能含內部細節）
create table public.etl_runs (
  id           bigint generated always as identity primary key,
  job          text not null,
  status       text not null default 'running' check (status in ('running', 'success', 'failed', 'skipped')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  rows_written integer,
  details      jsonb not null default '{}'::jsonb,
  error        text
);
comment on table public.etl_runs is 'ETL 執行紀錄（非公開）';
create index etl_runs_job_started_idx on public.etl_runs (job, started_at desc);
