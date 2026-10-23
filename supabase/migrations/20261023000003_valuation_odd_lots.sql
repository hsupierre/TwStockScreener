-- 上市零股成交（盤中零股 TWTC7U + 盤後零股 TWT53U）。
-- 證交所公布的成交股數「含零股」，櫃買中心公布的「不含零股」；為了與一般看盤軟體一致，
-- 快照顯示「整股」成交量 = volume − odd_volume（上櫃的 odd_volume 為 NULL，volume 本身即為整股）。
-- volume / trade_value 維持交易所公布的原始數字。
alter table public.daily_valuation
  add column odd_volume      bigint,  -- 零股成交股數（上市；0 代表當天沒有零股成交）
  add column odd_trade_value bigint;  -- 零股成交金額（元）

comment on column public.daily_valuation.odd_volume is '上市零股成交股數（盤中＋盤後）；上櫃為 NULL';
