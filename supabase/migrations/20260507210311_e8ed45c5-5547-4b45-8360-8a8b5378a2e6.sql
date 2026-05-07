
-- 1. Per-client color
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS color text;

-- Backfill: prefer first pack color, fallback to a stable hash-based pick
WITH first_pack AS (
  SELECT DISTINCT ON (client_id) client_id, color
  FROM public.client_packs
  ORDER BY client_id, created_at ASC
),
palette AS (
  SELECT unnest(ARRAY['emerald','amber','blue','violet','rose','cyan','orange','lime']) AS c, generate_series(0,7) AS idx
)
UPDATE public.clients c
SET color = COALESCE(
  (SELECT fp.color FROM first_pack fp WHERE fp.client_id = c.id),
  (SELECT p.c FROM palette p WHERE p.idx = (abs(hashtext(c.id::text)) % 8))
)
WHERE c.color IS NULL;

-- 2. Pack members (shared packs)
CREATE TABLE IF NOT EXISTS public.pack_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id uuid NOT NULL,
  client_id uuid NOT NULL,
  trainer_id uuid NOT NULL,
  primary_payer boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (pack_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_members_pack_id ON public.pack_members(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_members_client_id ON public.pack_members(client_id);

ALTER TABLE public.pack_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own pack members"
ON public.pack_members
FOR ALL
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

-- Backfill: every existing pack gets its owner as the primary payer
INSERT INTO public.pack_members (pack_id, client_id, trainer_id, primary_payer, position)
SELECT id, client_id, trainer_id, true, 0
FROM public.client_packs
ON CONFLICT (pack_id, client_id) DO NOTHING;
