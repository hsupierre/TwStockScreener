-- P6 會員：自選股、我的策略。
-- 權限：只有登入的使用者（authenticated）能存取，而且只能讀寫自己的資料（RLS：user_id = auth.uid()）。
-- 前端直接用瀏覽器端的 Supabase client 存取，RLS 是唯一的防線，所以每個動作都要有 policy。
-- 刪除帳號（auth.users）時，資料一併刪除（on delete cascade）。

-- ── 自選股 ─────────────────────────────────────────────
create table public.watchlist_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code       text not null references public.companies (code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);
comment on table public.watchlist_items is '自選股（每人一份清單，最多 200 檔）';

-- ── 我的策略 ───────────────────────────────────────────
create table public.saved_screens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  -- 選股器網址的查詢字串（不含開頭的 ?），例如 "dy=4~&roe=8~"；格式由前端的 nuqs parsers 定義
  query      text not null check (char_length(query) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.saved_screens is '使用者儲存的選股條件（每人最多 50 個）';
create index saved_screens_user_idx on public.saved_screens (user_id, created_at);

-- ── 數量上限（防止濫用；超過時拋出錯誤，前端顯示訊息）───────
create function public.enforce_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_rows int := tg_argv[0]::int;
  n int;
begin
  -- 同一使用者同時新增時，以 advisory lock 排隊，避免同時通過檢查而超過上限
  perform pg_advisory_xact_lock(hashtext(tg_table_name || new.user_id::text));
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= max_rows then
    raise exception '已達上限（% 筆）', max_rows using errcode = 'P0001', hint = 'member_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_member_limit() from public;

create trigger watchlist_items_limit
  before insert on public.watchlist_items
  for each row execute function public.enforce_member_limit('200');

create trigger saved_screens_limit
  before insert on public.saved_screens
  for each row execute function public.enforce_member_limit('50');

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public;

create trigger saved_screens_touch
  before update on public.saved_screens
  for each row execute function public.touch_updated_at();

-- ── 權限與 RLS ─────────────────────────────────────────
alter table public.watchlist_items enable row level security;
alter table public.saved_screens enable row level security;

-- default privileges 已撤銷所有權限（見 20261020000003_rls.sql），這裡只開放給 authenticated
grant select, insert, delete on table public.watchlist_items to authenticated;
grant select, insert, delete on table public.saved_screens to authenticated;
-- 只允許改名稱與條件，不能改 user_id、id、時間
grant update (name, query) on table public.saved_screens to authenticated;

-- (select auth.uid()) 讓 Postgres 每個查詢只算一次（Supabase 建議的寫法）
create policy watchlist_items_own on public.watchlist_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_screens_own on public.saved_screens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── 刪除帳號 ───────────────────────────────────────────
-- 使用者只能刪除自己（auth.uid()）；自選股、策略會因 on delete cascade 一併刪除。
-- 用 security definer 才能刪 auth.users，所以不需要把 service_role key 放到網站伺服器。
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '尚未登入' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
