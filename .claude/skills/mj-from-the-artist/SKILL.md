---
name: mj-from-the-artist
description: Fills the Midjourney magazine "From the artist" spread for an issue — the artist's statement (light copy edit), the caption with their name and prompt word for word, and the full-bleed image prepped for print. Use it when Daniel sends an image and text "for the from the artist section", or asks to update that spread's text, caption or image.
---

# From the Artist

The spread (kept from the previous issue by mj-new-issue) has: a text frame starting "From the artist:" (Interview Question style) followed by Body paragraphs, a caption frame (artist name ¶ prompt, "Caption Line 1– Artist, Date" style) at the bottom of the left page, and a full-bleed image on the right page. Find them by text, not ids.

1. **Read what Daniel sent** (often a screenshot: statement + prompt). Ask only what changes the result: which prompt to print if the image's file name suggests a different one than the one sent (print the one the artist sent unless Daniel says otherwise), spelling of names or titles that could go either way (Daniel kept the artist's own transliteration of a book title in 44).
2. **Copy edit lightly**: the statement is the artist's voice. Fix grammar where a sentence doesn't parse; keep their wording otherwise; same house rules as profiles (no competitor names, "inspired by" before a named artist/brand/film; camera brands exempt). The prompt prints word for word.
3. **Image**: copy into `Issue NN/From the Artist/originals/<Artist_Name>.jpg`, prep per mj-image-prep (it's a full-bleed page, so most need 4x), link the HH file.
4. **Place** in one script (mj-indesign-basics): keep the "From the artist:" paragraph and the empty one after it, replace the rest with the statement (Body style, the artist's paragraph breaks), set the caption paragraphs (name, then prompt), place the image fill-proportionally + centered. Check overset and ppi, export the spread, send it.
