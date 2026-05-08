-- 1. One-time sweep of orphan rows (must run BEFORE adding FKs, otherwise the
--    FK creation would fail on existing dangling references).
DELETE FROM public.client_bookings          WHERE client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.pack_members             WHERE client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.client_packs             WHERE client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.client_measurements      WHERE client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.client_measurement_prefs WHERE client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.daily_activity_log       WHERE client_id NOT IN (SELECT id FROM public.clients);

-- 2. Add cascading FKs (drop-if-exists makes the migration re-runnable).
ALTER TABLE public.client_bookings
  DROP CONSTRAINT IF EXISTS client_bookings_client_id_fkey,
  ADD  CONSTRAINT client_bookings_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_packs
  DROP CONSTRAINT IF EXISTS client_packs_client_id_fkey,
  ADD  CONSTRAINT client_packs_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.pack_members
  DROP CONSTRAINT IF EXISTS pack_members_client_id_fkey,
  ADD  CONSTRAINT pack_members_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_measurements
  DROP CONSTRAINT IF EXISTS client_measurements_client_id_fkey,
  ADD  CONSTRAINT client_measurements_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_measurement_prefs
  DROP CONSTRAINT IF EXISTS client_measurement_prefs_client_id_fkey,
  ADD  CONSTRAINT client_measurement_prefs_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.daily_activity_log
  DROP CONSTRAINT IF EXISTS daily_activity_log_client_id_fkey,
  ADD  CONSTRAINT daily_activity_log_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;