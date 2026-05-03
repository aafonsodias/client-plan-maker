insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "trainers read own client docs"
  on storage.objects for select
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trainers insert own client docs"
  on storage.objects for insert
  with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trainers update own client docs"
  on storage.objects for update
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trainers delete own client docs"
  on storage.objects for delete
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);
