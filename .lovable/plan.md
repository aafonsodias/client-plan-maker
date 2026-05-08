# Fix: dashboard still shows old sessions after deleting all clients

## Root cause

When you deleted your old clients, the rows in `client_bookings` and `client_packs` (plus a few related tables) were **not** removed. Those tables don't have a cascading foreign key on `client_id`, so the underlying rows stayed behind as orphans pointing to clients that no longer exist.

The dashboard's "This week — 16 sessions", the week timetable dots, and the Packs page reading "Pacote 5 / Pacote 10" with no client name (just "—") are all rendering those orphan rows. They're filtered by `trainer_id`, not by joining clients, so deleted-client data still surfaces.

Confirmed in DB for your trainer account:
- `clients`: 1 row (Maria Santos)
- `client_packs`: 6 rows (all orphans)
- `client_bookings`: 16 rows (all orphans)

I also found that `client_measurements`, `client_measurement_prefs`, `pack_members`, and `daily_activity_log` are in the same situation — no cascade. (`assessments`, `client_capacity_snapshots`, `workout_plans`, `missions`, `plan_feedback`, `demo_runs` already cascade correctly.)

## Plan — two parts

### 1. Clean up your account right now
One-shot SQL to delete orphan rows for **your trainer id** only (`69a581e5-…`). After this the dashboard will read 0 sessions, the week timetable will be empty, and the Packs page will only show packs that belong to Maria Santos (none yet).

Tables cleaned: `client_bookings`, `client_packs`, `pack_members`, `client_measurements`, `client_measurement_prefs`, `daily_activity_log` — only rows whose `client_id` no longer exists in `clients`.

### 2. Permanent fix — migration
Add `ON DELETE CASCADE` on the `client_id` foreign key for the 6 tables above so this never happens again. If a table is missing the FK entirely, add it as `REFERENCES clients(id) ON DELETE CASCADE`.

Also do a one-time global sweep of orphans across all trainers (same DELETE pattern as step 1, without the trainer filter) inside the same migration so no other account is sitting on stale data.

### Out of scope
- Not touching the "delete client" UI flow — once the FKs cascade, the existing delete works correctly.
- Not changing dashboard queries. The bug is data, not the read path.

## Technical details

Tables to fix (all in `public` schema):

| Table | Current behavior | Action |
|---|---|---|
| `client_bookings.client_id` | no cascade | drop FK if exists, re-add with `ON DELETE CASCADE` |
| `client_packs.client_id` | no cascade | same |
| `pack_members.client_id` | no cascade | same |
| `client_measurements.client_id` | no cascade | same |
| `client_measurement_prefs.client_id` | no cascade | same |
| `daily_activity_log.client_id` | no cascade | same |

Migration shape:
```sql
ALTER TABLE client_bookings
  DROP CONSTRAINT IF EXISTS client_bookings_client_id_fkey,
  ADD CONSTRAINT client_bookings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
-- repeat for the 5 others

-- one-time sweep
DELETE FROM client_bookings        WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM client_packs           WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM pack_members           WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM client_measurements    WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM client_measurement_prefs WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM daily_activity_log     WHERE client_id NOT IN (SELECT id FROM clients);
```

After applying, refresh the dashboard — the "This week" hero will show 0 sessions and the timetable + Packs page will be clean.
