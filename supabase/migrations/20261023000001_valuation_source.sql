-- 記錄每筆收盤價的來源，方便追查資料問題：
--   official：證交所／櫃買中心官網（主要來源，通常比 OpenAPI 早一天更新）
--   openapi ：證交所／櫃買中心 OpenAPI（備援）
--   finmind ：FinMind（降級模式，只補市值較大的股票收盤價）
alter table public.daily_valuation
  add column source text check (source in ('official', 'openapi', 'finmind'));

comment on column public.daily_valuation.source is '收盤價來源：official、openapi、finmind';
