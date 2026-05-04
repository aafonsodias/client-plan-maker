create policy "trainers read own client-documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trainers insert own client-documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trainers update own client-documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trainers delete own client-documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );