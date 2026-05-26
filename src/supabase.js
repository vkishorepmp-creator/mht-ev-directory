// Supabase client + record data layer.
// The client auto-attaches the logged-in user's JWT to every request, which is
// what makes the RLS policies in supabase/migrations/0001 actually enforce.
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see .env.example");
}

export const supabase = createClient(URL, KEY);

const TABLE = "ev_records";

// snake_case row -> camelCase record
function toRecord(r) {
  return {
    id: r.id,
    userId: r.user_id || null,
    createdAt: r.created_at || null,
    vehicleType: r.vehicle_type || "car",
    vehicleNumber: r.vehicle_number,
    ownerName: r.owner_name,
    tower: r.tower,
    flat: r.flat,
    phone: r.phone,
    email: r.email || "",
    manufacturer: r.manufacturer || "",
    vehicleModel: r.vehicle_model || "",
    batteryCapacity: r.battery_capacity ?? "",
  };
}

// camelCase record -> snake_case row (without id/user_id)
function toRow(rec) {
  return {
    vehicle_type: rec.vehicleType || "car",
    vehicle_number: rec.vehicleNumber,
    owner_name: rec.ownerName,
    tower: rec.tower,
    flat: rec.flat,
    phone: rec.phone,
    email: rec.email || "",
    manufacturer: rec.manufacturer || "",
    vehicle_model: rec.vehicleModel || "",
    battery_capacity: rec.batteryCapacity === "" || rec.batteryCapacity == null
      ? null : Number(rec.batteryCapacity),
  };
}

export async function fetchRecords() {
  const { data, error } = await supabase
    .from(TABLE).select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(toRecord);
}

// Insert a record owned by the current user (RLS requires user_id = auth.uid()
// for non-admins). Pass ownerUserId from the caller's session.
export async function insertRecord(rec, ownerUserId) {
  const row = { ...toRow(rec), user_id: ownerUserId || null };
  const { data, error } = await supabase.from(TABLE).insert(row).select();
  if (error) throw new Error(error.message);
  return toRecord(data[0]);
}

export async function updateRecord(id, rec) {
  const { error } = await supabase.from(TABLE).update(toRow(rec)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Admin-only bulk import (RLS allows admin to insert rows without user_id).
export async function bulkInsert(recs) {
  const rows = recs.map(toRow);
  const { error } = await supabase.from(TABLE).insert(rows);
  if (error) throw new Error(error.message);
}
