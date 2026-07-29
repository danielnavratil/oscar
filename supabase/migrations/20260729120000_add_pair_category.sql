-- Manual category override for a pair, used to order spreads in the export.
-- Set from the pair tab when the two images' categories differ or image A
-- has no category; otherwise the pair inherits the images' shared category.
alter table pairs add column if not exists category text;
