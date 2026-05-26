# MHT EV Directory

A resident-only directory of electric vehicles for the MHT housing society. Look
up who owns a car, register your own EV, see community ownership stats, and learn
shared-charger etiquette.

## Features

- **Lookup** — find an owner by partial vehicle number, name, or flat.
- **All Vehicles** — browse the directory; edit your own entry.
- **Register** — add your EV. Indian registration format, 10-digit phone, 3–4
  digit flat, and battery capacity are validated. Pick a model from the built-in
  Indian-EV catalogue or type your own.
- **Dashboard** — community EV ownership by brand, model, and battery capacity.
- **Charging** — do's & don'ts for using the community chargers.
- **Admin** — approve resident sign-ups, edit/delete any record, bulk CSV import.

## Access model

The directory is gated to residents. New users sign up, then a society admin
approves them before they can see any data. Enforcement is Postgres Row-Level
Security on Supabase — not the UI — so resident contact details are never on the
open web.

## Stack

- React 18 + Vite
- Supabase (Auth + Postgres + RLS)
- Deployed on Vercel

## Local development

```sh
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

Build for production:

```sh
npm run build
```

## Configuration

Set these environment variables (`.env` locally, Vercel project settings in prod):

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

## Backend setup

Database schema, RLS policies, auth, and first-admin promotion are described in
[`OWNER_SETUP.md`](OWNER_SETUP.md). Apply the SQL in `supabase/migrations/` in
order. **Rotate the Supabase anon key before going live** — see the setup guide.

## Design

See [`docs/specs/2026-05-26-resident-auth-rebuild.md`](docs/specs/2026-05-26-resident-auth-rebuild.md).
