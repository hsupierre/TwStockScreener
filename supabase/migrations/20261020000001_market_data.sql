-- 市場資料表：由 ETL（service_role）寫入，所有人唯讀。
-- 慣例：
--   * 金額一律以「元」儲存（官方資料多為千元，ETL 負責換算）
--   * 比率以「百分比數字」儲存，例如 12.34 代表 12.34%
--   * 季報損益項目存「單季值」（官方為年度累計值，ETL 負責相減）；資產負債項目為期末值
--   * 缺值用 NULL，不用 0（例如金融業沒有毛利率）

-- ── 共用：updated_at 觸發器 ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 公司基本資料 ─────────────────────────────────────────
create table public.companies (
  code               text primary key check (code ~ '^[0-9A-Z]{4,6}$'),
  name               text not null,                 -- 公司簡稱
  full_name          text,
  market             text not null check (market in ('twse', 'tpex')),
  industry           text,
  report_type        text check (report_type in ('ci', 'fh', 'basi', 'bd', 'ins', 'mim')), -- 財報格式
  capital            bigint,                         -- 實收資本額（元）
  shares_outstanding bigint,                         -- 已發行普通股數
  listed_at          date,
  is_active          boolean not null default true,
  updated_at         timestamptz not null default now()
);
comment on table public.companies is '上市櫃公司基本資料';
comment on column public.companies.report_type is '財報格式：ci 一般業、fh 金控、basi 銀行、bd 證券期貨、ins 保險、mim 異業';
create index companies_market_industry_idx on public.companies (market, industry);
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ── 每日行情與估值 ───────────────────────────────────────
create table public.daily_valuation (
  code           text not null references public.companies (code) on delete cascade,
  trade_date     date not null,
  close          numeric(12, 2),
  change         numeric(12, 2),
  volume         bigint,          -- 成交股數
  trade_value    bigint,          -- 成交金額（元）
  pe             numeric(10, 2),  -- 本益比
  pb             numeric(10, 2),  -- 股價淨值比
  dividend_yield numeric(6, 2),   -- 殖利率 %
  primary key (code, trade_date)
);
comment on table public.daily_valuation is '每日收盤價、本益比、殖利率、股價淨值比（保留約 3 年）';
create index daily_valuation_trade_date_idx on public.daily_valuation (trade_date);

-- ── 月營收 ───────────────────────────────────────────────
create table public.monthly_revenue (
  code              text not null references public.companies (code) on delete cascade,
  year              smallint not null check (year between 1990 and 2100),
  month             smallint not null check (month between 1 and 12),
  revenue           bigint,          -- 當月營收（元）
  revenue_last_year bigint,          -- 去年同月營收（元）
  mom               numeric(12, 2),  -- 月增率 %
  yoy               numeric(12, 2),  -- 年增率 %
  cum_revenue       bigint,          -- 當年累計營收（元）
  cum_yoy           numeric(12, 2),  -- 累計年增率 %
  note              text,
  primary key (code, year, month)
);
comment on table public.monthly_revenue is '每月營業收入';
create index monthly_revenue_period_idx on public.monthly_revenue (year, month);

-- ── 季報 ─────────────────────────────────────────────────
create table public.financials_quarterly (
  code                 text not null references public.companies (code) on delete cascade,
  year                 smallint not null check (year between 1990 and 2100),
  quarter              smallint not null check (quarter between 1 and 4),
  report_type          text check (report_type in ('ci', 'fh', 'basi', 'bd', 'ins', 'mim')),
  -- 損益（單季，元）
  revenue              bigint,
  gross_profit         bigint,
  operating_income     bigint,
  pretax_income        bigint,
  net_income           bigint,
  net_income_parent    bigint,          -- 歸屬母公司業主淨利
  eps                  numeric(10, 2),  -- 單季基本每股盈餘
  -- 資產負債（期末，元）
  total_assets         bigint,
  total_liabilities    bigint,
  equity               bigint,
  equity_parent        bigint,          -- 歸屬母公司業主權益
  current_assets       bigint,
  current_liabilities  bigint,
  book_value_per_share numeric(10, 2),
  -- 現金流量（單季，元）
  operating_cash_flow  bigint,
  updated_at           timestamptz not null default now(),
  primary key (code, year, quarter)
);
comment on table public.financials_quarterly is '季報：損益與現金流為單季值，資產負債為期末值';
create index financials_quarterly_period_idx on public.financials_quarterly (year, quarter);
create trigger financials_quarterly_set_updated_at before update on public.financials_quarterly
  for each row execute function public.set_updated_at();

-- ── 股利 ─────────────────────────────────────────────────
create table public.dividends (
  code           text not null references public.companies (code) on delete cascade,
  fiscal_year    smallint not null check (fiscal_year between 1990 and 2100), -- 股利所屬年度
  period         text not null check (period in ('FY', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4')),
  cash_dividend  numeric(10, 4),  -- 每股現金股利（元）
  stock_dividend numeric(10, 4),  -- 每股股票股利（元）
  board_date     date,            -- 董事會決議日
  primary key (code, fiscal_year, period)
);
comment on table public.dividends is '股利分派（依所屬期間）';
