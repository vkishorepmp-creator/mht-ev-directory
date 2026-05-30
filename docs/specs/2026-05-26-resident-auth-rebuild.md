# Design Spec — Resident-Only Directory Rebuild

**Date:** 2026-05-26
**Status:** Proposed (for owner review via PR)

## Goal

> Turn a publicly-exposed personal-data sheet into a trustworthy, resident-only
> directory — gated, self-serve, and forgiving to use.

## Why

The app is a society EV registry. Today it has three structural problems that
hurt the people it serves:

1. **Every resident's name, phone, email, and flat number is on the open web.**
   Anyone — strangers, scrapers, data brokers — can read the full directory.
   This is the single biggest reason residents distrust the tool and decline to
   register.
2. **"Admin" is client-side theater.** The admin password lives in `localStorage`
   (`admin123` default, printed on the login screen). The `isAdmin` React flag
   only hides UI buttons. The Supabase anon key shipped in the source can
   insert / update / delete from any browser console regardless of that flag.
3. **No self-service.** A resident registers once and can never correct their own
   phone or flat — they must chase the admin. Friction kills data quality.

## Non-Goals

- Hiding contact fields *from other residents*. A directory exists so neighbours
  can reach each other — once access is gated to residents, full visibility
  among them is the point.
- Native mobile apps. Web only.
- Multi-society / multi-tenant support. Single society.

## Architecture

### Access model

Self-signup + admin approval.

| Actor | Can do |
|---|---|
| anonymous (not logged in) | see nothing but the login / signup screen |
| `pending` (signed up, not approved) | see "awaiting approval" screen only |
| `approved` resident | read all records, add records, edit **their own** record |
| `admin` | everything + approve/reject signups + edit/delete any record + CSV import |

### Enforcement: RLS, not React

The React `isAdmin` flag is presentation only. The actual security boundary is
Postgres Row-Level Security on Supabase. This is load-bearing — a client-only
Supabase app *must* ship the anon key, so RLS is the only thing that makes that
safe.

Policies (see `supabase/migrations/`):

- `ev_records` SELECT: allowed only when the requester's profile is `approved`
  or `admin`.
- `ev_records` INSERT: requester `approved`/`admin`; row's `user_id` forced to
  `auth.uid()` for non-admins.
- `ev_records` UPDATE/DELETE: requester is the row owner (`user_id = auth.uid()`)
  OR `admin`. (DELETE: admin only.)
- `profiles` SELECT: own row, or any row if admin.
- `profiles` UPDATE (approval state): admin only.

### Data model changes

- `ev_records.user_id uuid` → references `auth.users(id)`. Links a record to the
  resident who owns it. Nullable for legacy/admin-entered rows.
- New `profiles` table: `id uuid pk → auth.users(id)`, `email text`,
  `full_name text`, `flat text`, `status text check in ('pending','approved','rejected')`,
  `role text check in ('resident','admin')`, `created_at`.
  A trigger creates a `pending` profile row on every new `auth.users` signup.

### Frontend modules

The current single 1230-line file gains an extracted data/auth layer so the
security-critical code is small and reviewable:

- `src/supabase.js` — Supabase client (Auth + REST), record CRUD helpers.
- `src/auth.js` — session helpers: `signUp`, `signIn`, `signOut`, `getSession`,
  `getProfile`, `approveUser`, `listPending`.
- `src/MHT_EV_Directory.jsx` — views, now gated on session + profile status.

### Views (gated)

- **Not logged in** → Login / Signup screen (replaces fake admin password gate).
- **Pending** → "Your account is awaiting approval" screen.
- **Approved resident** → Lookup / All Vehicles / Register / My Vehicle (edit own).
- **Admin** → all of the above + Approvals queue + edit/delete any + CSV import.

## Feature changes (beyond auth)

1. **Forgiving lookup.** The Lookup tab currently requires an exact vehicle-number
   match — one typo returns "not found." Change it to substring match across
   vehicle number, owner name, and flat (parity with the All Vehicles search that
   already works this way).
2. **Remove debug logging.** `console.log`/`console.error` spam in `sbUpdate`,
   `loadRecords`, and edit handlers is removed.
3. **Anon key from env.** Move `SUPABASE_URL` / anon key to `import.meta.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) so the rotated key is set in
   Vercel, not committed.

## Data migration

Existing records have no `user_id`. Plan:
- Migration adds the column as nullable. Legacy rows keep `user_id = NULL` and
  are treated as admin-managed (only admin can edit/delete them).
- Residents can "claim" their record later (future enhancement): match by
  vehicle number + phone, then set `user_id`. Out of scope for this PR; legacy
  rows simply stay admin-managed until claimed.

## Security preconditions (owner must do — see OWNER_SETUP.md)

1. **Rotate the Supabase anon key.** The current key has been in public GitHub
   history since repo creation and must be assumed compromised. Rotating it is a
   precondition for any of this mattering.
2. Apply the SQL migration.
3. Enable Email auth in Supabase (magic link or password).
4. Promote the first admin profile manually (`role = 'admin'`, `status = 'approved'`).

## Testing / verification status

- **Verifiable in this PR (no backend):** forgiving lookup, debug-log removal,
  env-var wiring, module extraction. Confirmed by `vite build`.
- **NOT end-to-end tested:** auth flows and RLS policies. They are authored from
  the data model but cannot be exercised until the owner applies the migration,
  enables Auth, and rotates the key on the live Supabase project. The PR
  description flags this explicitly. The owner's PR review + staging test is the
  verification gate.

## Rollout order

1. Owner rotates anon key + applies migration + enables Auth (breaks the old
   public app intentionally — data is now gated).
2. Promote first admin.
3. Deploy frontend with new env vars.
4. Residents sign up; admin approves; legacy rows claimed over time.
