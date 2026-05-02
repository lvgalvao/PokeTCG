-- 0001_init.sql
-- Apply on a fresh Supabase project (Project → SQL editor) and enable
-- "Anonymous Sign-Ins" in Authentication → Providers → Anonymous.

-- ----------------------------------------------------------------------------
-- profiles: 1 row per auth user (anonymous or otherwise).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  is_anonymous boolean not null default false,
  display_name text,
  created_at   timestamptz not null default now(),
  last_active  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-provision a profile row whenever an auth user is created. Runs as
-- SECURITY DEFINER so it bypasses RLS during the trigger context.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, is_anonymous)
  values (new.id, coalesce(new.is_anonymous, false))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- collections: 1 row per user with the full collection JSON.
-- ----------------------------------------------------------------------------
create table if not exists public.collections (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{"schemaVersion":2,"entries":{},"bySet":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.collections enable row level security;

drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own"
  on public.collections for select
  using (auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections for delete
  using (auth.uid() = user_id);
