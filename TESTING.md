# Test Checklist — run on a staging Supabase project before going live

Goal: prove the **resident-only** gate and RLS actually protect data, and that
every feature works end-to-end. Do this on a throwaway Supabase project first,
not production.

Prereqs (from `OWNER_SETUP.md`): migrations `0001`–`0004` applied, Email auth
enabled, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set, app deployed (or
`npm run dev`).

You'll need **three** test accounts: one admin, one approved resident, one
left pending. Use real inboxes (or disable "Confirm email" in Supabase Auth for
staging).

---

## A. Setup sanity
- [ ] App loads and shows the **login/signup** screen (not the directory).
- [ ] No console errors about missing `VITE_SUPABASE_*`.

## B. The critical security test (RLS) — do this first
This is the whole point of the rebuild. Data must NOT be readable without an
approved login.

- [ ] **Anonymous REST probe returns nothing.** Run (replace URL + anon key):
  ```sh
  curl "https://YOUR-PROJECT.supabase.co/rest/v1/ev_records?select=*" \
    -H "apikey: ANON_KEY" -H "Authorization: Bearer ANON_KEY"
  ```
  Expected: `[]` (empty array), NOT a list of residents. If you see resident
  rows here, **RLS is not on — stop and re-run migration 0001.**
  - PowerShell equivalent:
    ```powershell
    Invoke-RestMethod "https://YOUR-PROJECT.supabase.co/rest/v1/ev_records?select=*" `
      -Headers @{ apikey="ANON_KEY"; Authorization="Bearer ANON_KEY" }
    ```
- [ ] Repeat the probe for `posts` and `charger_faults` → both return `[]`.

## C. Sign-up + approval flow
- [ ] Sign up account #1 (your admin email). Then in Supabase SQL editor run the
      promote-admin snippet from `OWNER_SETUP.md` (set role=admin, status=approved).
- [ ] Sign up account #2 (resident) and #3 (pending — leave it).
- [ ] Log in as #2 (not yet approved) → see **"Awaiting Approval"** screen, no data.
- [ ] Log in as admin (#1) → **Admin** tab shows #2 and #3 in **Pending Approvals**.
- [ ] Approve #2. Reject #3.
- [ ] Log out, log in as #2 → now sees the directory. Log in as #3 → still blocked.

## D. Registration + validation
- [ ] As #2, go to **Register**. Try bad inputs, confirm each is rejected:
  - [ ] Vehicle number `ABC` → "valid Indian number" error.
  - [ ] Phone `12345` → "exactly 10 digits".
  - [ ] Flat `12` or `12345` → "3 or 4 digits".
  - [ ] Battery empty → "required".
- [ ] Register a valid **car** (e.g. `MH12AB1234`, Tata / Nexon EV → battery options appear).
- [ ] Toggle to **Bike**, register a valid one (e.g. Ather / 450X). Battery list switches.
- [ ] Register a **custom** model not in the list (type a new manufacturer/model + battery) → saves.
- [ ] Duplicate vehicle number → "already registered".

## E. Self-service + ownership (RLS write rules)
- [ ] As #2, open **My Vehicles** → see only your own cars/bikes, each with an edit button.
- [ ] Edit one of your records → saves.
- [ ] In **All Vehicles**, find a record you do NOT own → no edit/delete button on it.
- [ ] Confirm a resident has **no Delete** button anywhere (admin-only).

## F. Admin powers
- [ ] As admin, **All Vehicles** → edit any record, delete any record (confirm prompt).
- [ ] **Upload CSV** (a few rows incl. a `batteryCapacity` and `vehicleType` column) → imported, duplicates skipped.
- [ ] Admin sees Delete + Resolve actions that residents don't.

## G. Feature smoke tests
- [ ] **Lookup** — partial vehicle number / owner name / flat all return the right record; type icon (car/bike) shows; Call/WhatsApp/Email buttons open correctly.
- [ ] **Dashboard** — counts for total / cars / bikes / brands / kWh look right; bar lists populate; newest-EV feed shows recent registrations.
- [ ] **Cars/Bikes filter** on All Vehicles switches the list.
- [ ] **Community Board** — post a tip and a question; reply to one; delete your own post; confirm you can't delete someone else's (non-admin).
- [ ] **Charger Faults** — report a fault as resident; as admin mark it resolved; badge flips to RESOLVED.

## H. Free-tier keep-alive (optional)
- [ ] Add `SUPABASE_URL` + `SUPABASE_ANON_KEY` repo secrets; run the
      **Supabase keep-alive** workflow manually from the Actions tab → green check.

---

If B fails, nothing else matters — fix RLS before continuing. Everything in
C–G assumes B passed.
