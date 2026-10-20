-- 權限：市場資料「所有人可讀、只有 service_role 可寫」；etl_runs 完全不公開。
-- 兩層防護：(1) RLS 只建立 SELECT policy；(2) 撤銷 anon / authenticated 的寫入權限。
-- service_role 本身就略過 RLS，不需要額外 policy。

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'daily_valuation', 'monthly_revenue', 'financials_quarterly',
    'dividends', 'screen_snapshot', 'data_freshness'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end;
$$;

alter table public.etl_runs enable row level security;
revoke all on table public.etl_runs from anon, authenticated;

-- 之後新增的資料表不要自動開放給 anon / authenticated，必須在 migration 裡明確授權
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
