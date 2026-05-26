-- ============================================================================
-- Migration 0002 — battery capacity on records
-- Stores the EV battery capacity (kWh) per registered vehicle. Needed because
-- residents can enter custom models not in the built-in catalogue, so the value
-- can't always be derived from a lookup table.
-- Run in the Supabase SQL editor after 0001.
-- ============================================================================

alter table public.ev_records
  add column if not exists battery_capacity numeric;

-- numeric (kWh). NULL for legacy rows / unknown.
