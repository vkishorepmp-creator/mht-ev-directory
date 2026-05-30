// Auth + profile helpers. Wraps Supabase Auth and the `profiles` table.
import { supabase } from "./supabase";

export async function signUp({ email, password, fullName, flat }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, flat } },
  });
  if (error) throw new Error(error.message);
  // The DB trigger creates a `pending` profile row. Fill in name/flat best-effort.
  if (data.user) {
    await supabase.from("profiles")
      .update({ full_name: fullName, flat })
      .eq("id", data.user.id);
  }
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

// Subscribe to auth changes; returns an unsubscribe function.
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// The current user's profile row (status + role). null if none/not logged in.
export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

// Admin: list signups awaiting approval.
export async function listPending() {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// Admin: approve or reject a signup.
export async function setApproval(id, status) {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
