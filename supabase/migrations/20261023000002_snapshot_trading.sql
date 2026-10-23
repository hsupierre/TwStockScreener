-- 選股快照新增交易相關欄位（成交量單位為「股」，前端以「張」= 1,000 股顯示）
alter table public.screen_snapshot
  add column change         numeric(12, 2),  -- 漲跌（元）
  add column change_pct     numeric(8, 2),   -- 漲跌幅 %
  add column volume         bigint,          -- 成交量（股）
  add column trade_value    bigint,          -- 成交金額（元）
  add column avg_volume_20d bigint;          -- 近 20 個交易日平均成交量（股）

comment on column public.screen_snapshot.avg_volume_20d is '近 20 個交易日平均成交量（股）；資料不足 10 天時為 NULL';
