-- 本機開發用的少量樣本資料（`supabase db reset` 時套用；不會推到雲端）。
-- 正式資料由 ETL 寫入。

insert into public.companies (code, name, full_name, market, industry, report_type, capital, listed_at) values
  ('2330', '台積電', '台灣積體電路製造股份有限公司', 'twse', '半導體業', 'ci', 259327332420, '1994-09-05'),
  ('2881', '富邦金', '富邦金融控股股份有限公司', 'twse', '金融保險業', 'fh', 136989271440, '2001-12-19'),
  ('6488', '環球晶', '環球晶圓股份有限公司', 'tpex', '半導體業', 'ci', 4780824480, '2015-09-25');

insert into public.screen_snapshot
  (code, name, market, industry, price_date, financial_period, revenue_period,
   close, pe, pb, dividend_yield, eps_ttm, roe_ttm, gross_margin, operating_margin, net_margin,
   revenue_yoy, debt_ratio, current_ratio, dividend_streak_years) values
  ('2330', '台積電', 'twse', '半導體業', '2026-10-19', '2026Q2', '2026-09',
   2420.00, 28.05, 8.10, 1.20, 86.27, 32.50, 59.10, 49.20, 43.10, 35.20, 32.00, 250.00, 20),
  ('2881', '富邦金', 'twse', '金融保險業', '2026-10-19', '2026Q2', '2026-09',
   158.50, 14.81, 1.80, 4.50, 10.70, 12.10, null, null, null, null, 93.00, null, 15),
  ('6488', '環球晶', 'tpex', '半導體業', '2026-10-19', '2026Q2', '2026-09',
   420.00, 18.20, 2.10, 3.80, 23.08, 12.80, 33.40, 22.50, 18.70, -5.20, 55.00, 180.00, 10);

insert into public.data_freshness (job, as_of) values
  ('daily', '2026-10-19'), ('monthly', '2026-09'), ('quarterly', '2026Q2'), ('snapshot', '2026-10-19');
