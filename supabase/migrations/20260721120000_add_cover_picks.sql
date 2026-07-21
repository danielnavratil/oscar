-- Cover picks: images flagged as potential cover options.
-- Run manually in the Supabase SQL Editor.

create table if not exists cover_picks (
  id uuid default gen_random_uuid() primary key,
  image_id text not null,
  voter_name text not null,
  issue_id text references issues(id) on delete cascade,
  created_at timestamptz default now(),
  unique(image_id, voter_name, issue_id)
);
create index if not exists cover_picks_issue_idx on cover_picks(issue_id);

alter table cover_picks enable row level security;
create policy "allow all" on cover_picks for all using (true) with check (true);

alter publication supabase_realtime add table cover_picks;
