-- Add photo_url to clients for avatar display
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS photo_url text;

-- Create private bucket for client photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-photos', 'client-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: trainers can read/write only photos under their own user_id folder
-- Path convention: {trainer_user_id}/{client_id}.{ext}

CREATE POLICY "Trainers read own client photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Trainers upload own client photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Trainers update own client photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Trainers delete own client photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
