-- ============================================================================
-- Migration 0001 — Resident-only auth + RLS
-- Run this in the Supabase SQL editor (or via the Supabase CLI) AFTER rotating
-- the anon key. See OWNER_SETUP.md.
--
-- This migration is the security boundary for the app. The frontend's "isAdmin"
-- flag is presentation only; these policies are what actually protect resident
-- personal data. Review them carefully before applying.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles — one row per auth user, holds approval state + role
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  flat       text,
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'rejected')),
  role       text not null default 'resident'
             check (role in ('resident', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a pending profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Helper functions — used inside policies (security definer to read profiles
--    without recursive RLS evaluation)
-- ----------------------------------------------------------------------------
create or replace function public.is_approved()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (status = 'approved' or role = 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. ev_records — add owner link
-- ----------------------------------------------------------------------------
alter table public.ev_records
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4. Enable RLS
-- ----------------------------------------------------------------------------
alter table public.ev_records enable row level security;
alter table public.profiles   enable row level security;

-- ---- profiles policies -----------------------------------------------------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Approval/role changes: admin only.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- ev_records policies ---------------------------------------------------
-- Read: any approved resident or admin. Anonymous users get nothing.
drop policy if exists ev_select_approved on public.ev_records;
create policy ev_select_approved on public.ev_records
  for select to authenticated
  using (public.is_approved());

-- Insert: approved/admin. Non-admins may only set their own user_id.
drop policy if exists ev_insert_approved on public.ev_records;
create policy ev_insert_approved on public.ev_records
  for insert to authenticated
  with check (
    public.is_approved()
    and (public.is_admin() or user_id = auth.uid())
  );

-- Update: row owner or admin.
drop policy if exists ev_update_owner_or_admin on public.ev_records;
create policy ev_update_owner_or_admin on public.ev_records
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

-- Delete: admin only.
drop policy if exists ev_delete_admin on public.ev_records;
create policy ev_delete_admin on public.ev_records
  for delete to authenticated
  using (public.is_admin());

-- ============================================================================
-- NOTE: legacy ev_records rows have user_id = NULL. They are admin-managed
-- (residents cannot edit them until claimed). A future "claim my record"
-- migration can match by vehicle_number + phone and set user_id.
-- ============================================================================
