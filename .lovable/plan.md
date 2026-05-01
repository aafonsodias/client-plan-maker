## Goal

Confirm the phased pipeline actually activates by (1) turning the feature flag on for your trainer account and (2) proving in the browser console that the Generate button takes the new branch.

## Findings (already verified)

- `SELECT user_id, phased_generation_enabled FROM profiles WHERE phased_generation_enabled = true;` → **0 rows**. Flag is off for everyone, so nothing routes to the new flow.
- Your trainer id (derived from the client you're viewing): `69a581e5-c4bf-4888-95dc-7a51e24e9ee2`.
- Routing logic in `src/routes/clients_.$clientId.tsx` (lines 1446–1460) is correct: when `phasedEnabled === true` the button navigates to `/plans/new?clientId=...`; otherwise it calls the legacy `generate()`.
- All new routes exist on disk and are registered: `plans.new.tsx`, `plans.$planId.brief.tsx`, `plans.$planId.blueprint.tsx`, `plans.$planId.microcycle.tsx`, `plans.$planId.progressions.tsx`.

## Changes

### 1. Migration: enable flag for your account

New file `supabase/migrations/<timestamp>_enable_phased_for_trainer.sql`:

```sql
UPDATE public.profiles
SET phased_generation_enabled = true
WHERE user_id = '69a581e5-c4bf-4888-95dc-7a51e24e9ee2';
```

### 2. Temporary console log in `src/routes/clients_.$clientId.tsx`

Inside the `ClientDetail` component, add a `useEffect` that logs the flag whenever it changes:

```ts
useEffect(() => {
  console.log('[phased] enabled =', phasedEnabled);
}, [phasedEnabled]);
```

Placed right after the existing flag-loading effect (~line 490). This is explicitly temporary and will be removed once we confirm the new branch is taken.

## Stop conditions

After the migration runs and the log lands:

- Hard-refresh the client page. Console should show `[phased] enabled = true`.
- Click "Generate plan draft". Browser should navigate to `/plans/new?clientId=bfc11030-...` (the Brief preview), **not** spin in place.

If both check out, report back. Do NOT build any new Stage logic, do NOT touch generation code, do NOT proceed to anything else until you confirm.

## Out of scope

- No changes to Stage 1–5 server functions.
- No changes to the legacy `generate()` flow.
- No new routes or UI.