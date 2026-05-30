// Community board (tips / questions / replies) + charger fault reporting.
import { supabase } from "./supabase";

// ── Posts ───────────────────────────────────────────────────────────────────
export async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addPost({ kind, title, body, parentId, authorName }, userId) {
  const { data, error } = await supabase.from("posts").insert({
    kind,
    title: title || null,
    body,
    parent_id: parentId || null,
    author_name: authorName || null,
    user_id: userId || null,
  }).select();
  if (error) throw new Error(error.message);
  return data[0];
}

export async function deletePost(id) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Charger faults ────────────────────────────────────────────────────────────
export async function fetchFaults() {
  const { data, error } = await supabase
    .from("charger_faults").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addFault({ location, description, reporterName }, userId) {
  const { data, error } = await supabase.from("charger_faults").insert({
    location: location || null,
    description,
    reporter_name: reporterName || null,
    user_id: userId || null,
  }).select();
  if (error) throw new Error(error.message);
  return data[0];
}

export async function resolveFault(id) {
  const { error } = await supabase.from("charger_faults").update({ status: "resolved" }).eq("id", id);
  if (error) throw new Error(error.message);
}
