-- Bookmarks reference image IDs from issue JSON (Storage), not the images table.
alter table bookmarks
  drop constraint if exists bookmarks_image_id_fkey;
