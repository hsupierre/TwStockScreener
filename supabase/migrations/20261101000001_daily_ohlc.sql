-- 日 K 線圖（會員限定）：
-- 1. daily_valuation 新增開盤、最高、最低價（ETL 從證交所／櫃買中心的收盤行情一併取得）
-- 2. daily_prices view：K 線圖用的欄位，成交量、成交金額已扣除零股與鉅額交易（與快照相同口徑）
-- 3. 每日行情改成只有登入會員能讀取（網站其他地方只讀 screen_snapshot，不受影響）

alter table public.daily_valuation
  add column open numeric(12, 2),
  add column high numeric(12, 2),
  add column low  numeric(12, 2);

-- 與 etl/tw_etl/transform/snapshot.py 的 board_lot() 相同：公布值 − 零股 − 鉅額，最小為 0；
-- 公布值是 NULL 時維持 NULL（GREATEST 會忽略 NULL，不能直接用）
create view public.daily_prices
with (security_invoker = true) -- 依查詢者的權限套用 daily_valuation 的 RLS
as
select
  code,
  trade_date,
  open,
  high,
  low,
  close,
  change,
  case when volume is null then null
       else greatest(volume - coalesce(odd_volume, 0) - coalesce(block_volume, 0), 0) end as volume,
  case when trade_value is null then null
       else greatest(trade_value - coalesce(odd_trade_value, 0) - coalesce(block_trade_value, 0), 0) end as trade_value
from public.daily_valuation
where close is not null;

comment on view public.daily_prices is '日 K 線圖資料（會員限定）；成交量不含零股與鉅額交易';

-- ── 權限：每日行情只開放給登入會員 ─────────────────────────
drop policy daily_valuation_public_read on public.daily_valuation;
revoke select on table public.daily_valuation from anon;
create policy daily_valuation_member_read on public.daily_valuation
  for select to authenticated
  using (true);

revoke all on table public.daily_prices from anon, authenticated;
grant select on table public.daily_prices to authenticated;
