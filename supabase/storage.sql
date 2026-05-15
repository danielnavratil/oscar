-- Oscar — Supabase Storage for issue JSON
-- Run once in the Supabase SQL Editor (after creating the bucket in Dashboard if needed)

insert into storage.buckets (id, name, public)
values ('issue-json', 'issue-json', true)
on conflict (id) do nothing;

-- Allow anon/authenticated clients to read and write issue JSON (internal tool)
create policy "issue-json public read"
  on storage.objects for select
  using (bucket_id = 'issue-json');

create policy "issue-json public insert"
  on storage.objects for insert
  with check (bucket_id = 'issue-json');

create policy "issue-json public update"
  on storage.objects for update
  using (bucket_id = 'issue-json');
