-- ============================================================================
-- Migration 0003 — community board + charger fault reporting
-- Depends on 0001 (provides is_approved() / is_admin() and RLS conventions).
-- Run in the Supabase SQL editor after 0001 and 0002.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- posts — tips, questions, and replies (threaded via parent_id)
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  author_name text,
  kind        text not null check (kind in ('tip', 'question', 'reply')),
  parent_id   uuid references public.posts (id) on delete cascade,  -- set for replies
  title       text,                                                 -- for tip/question
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists posts_parent_idx on public.posts (parent_id);

-- ----------------------------------------------------------------------------
-- charger_faults — report a broken/occupied community charger
-- ----------------------------------------------------------------------------
create table if not exists public.charger_faults (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  reporter_name text,
  location      text,            -- which charger / bay
  description   text not null,
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.posts          enable row level security;
alter table public.charger_faults enable row level security;

-- posts: approved residents read all; insert their own; edit/delete own or admin.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated using (public.is_approved());

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (public.is_approved() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- faults: approved read all; insert own; status change (resolve) admin only; delete admin.
drop policy if exists faults_select on public.charger_faults;
create policy faults_select on public.charger_faults
  for select to authenticated using (public.is_approved());

drop policy if exists faults_insert on public.charger_faults;
create policy faults_insert on public.charger_faults
  for insert to authenticated
  with check (public.is_approved() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists faults_update_admin on public.charger_faults;
create policy faults_update_admin on public.charger_faults
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists faults_delete_admin on public.charger_faults;
create policy faults_delete_admin on public.charger_faults
  for delete to authenticated using (public.is_admin());
