create table if not exists prompt_edits (
  image_id    text        not null,
  issue_id    text        not null references issues(id),
  raw_prompt  text        not null,
  claude_body text        not null,
  edited_body text,
  params      text        not null default '',
  flagged     boolean     not null default false,
  flag_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (image_id, issue_id)
);

alter table prompt_edits enable row level security;
create policy "allow all" on prompt_edits for all using (true) with check (true);
