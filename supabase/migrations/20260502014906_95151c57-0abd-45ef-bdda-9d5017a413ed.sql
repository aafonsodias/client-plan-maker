ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS performed_on date;
UPDATE public.assessments SET performed_on = created_at::date WHERE performed_on IS NULL;