-- 上市鉅額交易（BFIAUU：配對交易、逐筆交易）。證交所公布的成交股數含鉅額交易，
-- 一般看盤軟體的「成交量」不含（例如 1316 上曜 2026-10-22：Yahoo 總量 994 張）。
-- 快照的成交量 = volume − odd_volume − block_volume（上櫃兩者皆為 NULL：櫃買中心公布值本來就不含）。
alter table public.daily_valuation
  add column block_volume      bigint,  -- 鉅額交易成交股數（上市；0 代表當天沒有鉅額交易）
  add column block_trade_value bigint;  -- 鉅額交易成交金額（元）

comment on column public.daily_valuation.block_volume is '上市鉅額交易成交股數；上櫃為 NULL';
