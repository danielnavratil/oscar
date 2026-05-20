-- Oscar — Supabase Schema
-- Run this entire file once in the Supabase SQL Editor

-- ── ISSUES ────────────────────────────────────────────────────
create table if not exists issues (
  id text primary key,          -- e.g. '38', '39'
  name text,
  created_at timestamptz default now()
);

-- Image data lives in issue JSON (Storage). Tables below store image_id text only.

-- ── BOOKMARKS ─────────────────────────────────────────────────
-- image_id matches IDs in issue JSON (Storage); no FK to images table
create table if not exists bookmarks (
  id uuid default gen_random_uuid() primary key,
  image_id text not null,
  voter_name text not null,
  issue_id text references issues(id) on delete cascade,
  created_at timestamptz default now(),
  unique(image_id, voter_name, issue_id)
);
create index if not exists bookmarks_issue_idx on bookmarks(issue_id);

-- ── CATEGORIES ────────────────────────────────────────────────
create table if not exists categories (
  image_id text primary key,
  category text,
  updated_at timestamptz default now()
);

-- ── REFERENCE TYPES ───────────────────────────────────────────
create table if not exists ref_types (
  image_id text primary key,
  types text[] default '{}',
  updated_at timestamptz default now()
);

-- ── VOTES ─────────────────────────────────────────────────────
-- image_id matches IDs in issue JSON (Storage); no FK to images table
create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  image_id text not null,
  voter_name text not null,
  issue_id text references issues(id) on delete cascade,
  created_at timestamptz default now(),
  unique(image_id, voter_name, issue_id)
);
create index if not exists votes_issue_idx on votes(issue_id);

-- ── VOTE SUBMISSIONS ──────────────────────────────────────────
-- Tracks who has clicked "submit votes" for the issue
create table if not exists vote_submissions (
  voter_name text not null,
  issue_id text references issues(id) on delete cascade,
  submitted_at timestamptz default now(),
  primary key(voter_name, issue_id)
);

-- ── VOTING STATE ──────────────────────────────────────────────
create table if not exists voting_state (
  issue_id text references issues(id) on delete cascade primary key,
  is_open boolean default false,
  updated_at timestamptz default now()
);

-- ── PAIRS ─────────────────────────────────────────────────────
create table if not exists pairs (
  id text primary key,
  issue_id text references issues(id) on delete cascade,
  image_a_id text not null,
  image_b_id text not null,
  side_a text default 'L',
  size_a text default 'full bleed',
  side_b text default 'R',
  size_b text default 'full bleed',
  creator text,
  type text default 'confirmed',  -- 'confirmed' or 'proposal'
  created_at timestamptz default now()
);
create index if not exists pairs_issue_idx on pairs(issue_id);

-- ── ENABLE REAL-TIME ──────────────────────────────────────────
-- Allows Supabase to push live updates to all connected clients
alter publication supabase_realtime add table bookmarks;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table vote_submissions;
alter publication supabase_realtime add table pairs;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table voting_state;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- For now: allow all authenticated and anon access.
-- Tighten this when you add proper auth.
alter table issues enable row level security;
alter table bookmarks enable row level security;
alter table categories enable row level security;
alter table ref_types enable row level security;
alter table votes enable row level security;
alter table vote_submissions enable row level security;
alter table voting_state enable row level security;
alter table pairs enable row level security;

create policy "allow all" on issues for all using (true) with check (true);
create policy "allow all" on bookmarks for all using (true) with check (true);
create policy "allow all" on categories for all using (true) with check (true);
create policy "allow all" on ref_types for all using (true) with check (true);
create policy "allow all" on votes for all using (true) with check (true);
create policy "allow all" on vote_submissions for all using (true) with check (true);
create policy "allow all" on voting_state for all using (true) with check (true);
create policy "allow all" on pairs for all using (true) with check (true);

-- ── SEED: initial issue ───────────────────────────────────────
insert into issues (id, name) values ('38', 'Issue 38') on conflict do nothing;
