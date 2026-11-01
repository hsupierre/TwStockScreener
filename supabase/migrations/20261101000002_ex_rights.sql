-- 除權息（證交所 TWT49U、櫃買中心 exDailyQ 的「除權除息計算結果表」）。
-- 用途：
-- 1. 除權息日的漲跌改用「收盤 − 參考價」（交易所公布的行情在這天把漲跌填 0 或文字）
-- 2. 日 K 線圖標示除權息日（缺口的原因）
create table public.ex_rights (
  code            text not null references public.companies (code) on delete cascade,
  trade_date      date not null,                -- 除權息交易日
  kind            text not null check (kind in ('權', '息', '權息')),
  prev_close      numeric(12, 2),               -- 除權息前收盤價
  reference_price numeric(12, 2) not null,      -- 除權息參考價
  value           numeric(14, 6),               -- 權值＋息值（元）
  cash_dividend   numeric(14, 6),               -- 息值（元；上市的表沒有分開列出時為 NULL）
  updated_at      timestamptz not null default now(),
  primary key (code, trade_date)
);
comment on table public.ex_rights is '除權息計算結果（每日 ETL 寫入）';

-- 權限與每日行情相同：只開放給登入會員讀取，寫入只有 service_role（ETL）
alter table public.ex_rights enable row level security;
revoke all on table public.ex_rights from anon, authenticated;
grant select on table public.ex_rights to authenticated;
create policy ex_rights_member_read on public.ex_rights
  for select to authenticated
  using (true);

-- daily_prices 加上除權息欄位（create or replace view 只能在最後新增欄位）
create or replace view public.daily_prices
with (security_invoker = true)
as
select
  v.code,
  v.trade_date,
  v.open,
  v.high,
  v.low,
  v.close,
  v.change,
  case when v.volume is null then null
       else greatest(v.volume - coalesce(v.odd_volume, 0) - coalesce(v.block_volume, 0), 0) end as volume,
  case when v.trade_value is null then null
       else greatest(v.trade_value - coalesce(v.odd_trade_value, 0) - coalesce(v.block_trade_value, 0), 0) end as trade_value,
  x.kind            as ex_kind,
  x.value           as ex_value,
  x.reference_price as ex_reference_price
from public.daily_valuation v
left join public.ex_rights x on x.code = v.code and x.trade_date = v.trade_date
where v.close is not null;
