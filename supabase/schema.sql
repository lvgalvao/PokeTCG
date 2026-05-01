-- Apply this in the Supabase SQL editor before running the app against this project.
-- Requires Anonymous Sign-Ins enabled (Project Settings → Auth → Providers → Anonymous).

create table if not exists public.collections (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null default '{"schemaVersion":2,"entries":{},"bySet":{}}'::jsonb,
  updated_at  timestamptz not null default now()
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
