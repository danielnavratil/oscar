-- Image IDs come from issue JSON in Storage, not the images table.
alter table bookmarks drop constraint if exists bookmarks_image_id_fkey;
alter table votes drop constraint if exists votes_image_id_fkey;
alter table categories drop constraint if exists categories_image_id_fkey;
alter table ref_types drop constraint if exists ref_types_image_id_fkey;
alter table pairs drop constraint if exists pairs_image_a_id_fkey;
alter table pairs drop constraint if exists pairs_image_b_id_fkey;
