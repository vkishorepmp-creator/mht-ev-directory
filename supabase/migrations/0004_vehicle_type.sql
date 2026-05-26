-- ============================================================================
-- Migration 0004 — vehicle type (car / bike)
-- Splits the directory into electric cars and electric two-wheelers without a
-- second table: one column, separate catalogues + views in the app.
-- Run in the Supabase SQL editor after 0003.
-- ============================================================================

alter table public.ev_records
  add column if not exists vehicle_type text not null default 'car'
    check (vehicle_type in ('car', 'bike'));

-- Existing rows default to 'car'. The app filters and reports by this column.
