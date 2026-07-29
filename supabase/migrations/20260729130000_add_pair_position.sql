-- Manual sort position for confirmed pairs, set by drag-reorder in the pair
-- tab. Pairs sort by category first, then position (null = created order,
-- after any positioned pairs in the same category).
alter table pairs add column if not exists position double precision;
