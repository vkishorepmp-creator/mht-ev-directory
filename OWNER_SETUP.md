# Owner Setup Guide

This PR hardens the EV directory from a publicly-readable personal-data sheet
into a resident-only app. Some steps must be done by you in the Supabase and
Vercel dashboards — they can't live in code.

Do them **in this order**.

---

## ⚠️ Step 1 — Rotate the Supabase anon key (do this first, regardless)

The old anon key has been committed in this repo's public git history since the
project was created. Assume it is compromised and scraped. Even with the new RLS
policies, that key must be rotated or the hardening is meaningless.

1. Supabase dashboard → Project Settings → **API**.
2. Roll / regenerate the **anon (public)** key.
3. Copy the new key — you'll use it in Step 4.

> Note: this repo no longer hardcodes the key. It now reads
> `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment
> (see `.env.example`).

---

## Step 2 — Apply the database migration

Supabase dashboard → **SQL Editor** → run both migration files in order:
1. `supabase/migrations/0001_resident_auth.sql`
2. `supabase/migrations/0002_battery_capacity.sql`
3. `supabase/migrations/0003_community.sql`

0001 creates the `profiles` table, the signup trigger, the `is_admin()` /
`is_approved()` helpers, adds `ev_records.user_id`, and **enables Row-Level
Security**. 0002 adds `ev_records.battery_capacity` (kWh) used by the dashboard.
0003 adds the `posts` (tips/Q&A board) and `charger_faults` tables with RLS.

> ⚠️ The moment RLS is enabled, anonymous reads stop working — which is the
> point. The app will only return data to logged-in, approved users. Do not
> enable this in production until the auth frontend (Phase 2 below) is deployed,
> or schedule a short maintenance window.

---

## Step 3 — Enable Auth

Supabase dashboard → **Authentication** → Providers → enable **Email**
(magic link or email+password — your choice; the frontend supports email).

Configure the Site URL / redirect URLs to your Vercel domain.

---

## Step 4 — Set environment variables

Local dev: copy `.env.example` to `.env` and fill in the rotated values.

Vercel: Project → Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the rotated anon key from Step 1 |

Redeploy so the build picks them up.

---

## Step 5 — Promote the first admin

After you sign up once (so an `auth.users` row + `profiles` row exist), run in
the SQL editor:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where email = 'YOUR-EMAIL@example.com';
```

You can now log in and approve other residents from the Admin → Approvals queue.

---

## Test before going live

After completing the steps above on a **staging** Supabase project, run the
end-to-end test checklist in [`TESTING.md`](TESTING.md) — especially section B,
which proves Row-Level Security actually blocks anonymous access to resident
data. Only point the env vars at production once the checklist passes.

---

## Step 6 — Keep the free Supabase project awake (optional but recommended)

Supabase free-tier projects pause after ~7 days of inactivity. A daily
keep-alive workflow (`.github/workflows/keepalive.yml`) pings the database so it
never sleeps. To enable it, add two **repo secrets** (GitHub → Settings →
Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_ANON_KEY` | the rotated anon key |

It runs daily and can also be triggered manually from the Actions tab. This
keeps the app fully free (Vercel Hobby + Supabase free tier).

---

## What's in this PR vs what's next

**Included & build-verified (works today, before RLS):**
- Strict registration validation — Indian vehicle-number format (standard +
  BH series), 10-digit phone, 3–4 digit flat.
- Forgiving lookup (partial match on vehicle number / owner / flat).
- Supabase URL + key moved to environment variables.
- Production debug logging removed.
- SQL migration (schema + RLS policies) — **authored, not yet exercised**
  against a live RLS-enabled table. Review before applying.

**Phase 2 — frontend auth wiring (specced, depends on Steps 1–3 above):**
- Email login / signup replacing the `localStorage` admin-password gate.
- Pending-approval screen; admin Approvals queue.
- Self-service: residents edit their own record; admin edits/deletes any.
- Record requests carrying the user JWT (required for RLS to return rows).

See `docs/specs/2026-05-26-resident-auth-rebuild.md` for the full design.
