---
name: mj-new-issue
description: Sets up a new Midjourney magazine issue — the Issue NN folder, MJ_NN.indd stripped from the previous issue (cover and spine number updated), the posters doc, and the issue's projects in the Oscar app (Supabase) without clobbering anything. Use it when Daniel says "prep a new file for NN", "start issue NN", "set up the next issue", or adds a project/upload in Oscar for a new issue or its daily theme.
---

# New issue

Ask all questions up front in one message, then do the whole job without checking in page by page (Daniel's preference). Typical questions: which spreads to keep, poster sources and model versions (see mj-posters), anything unusual about the issue.

## 1. Folder and document

- Issue folders live in `~/Documents/Creative/Asimov/Midjourney/Issue NN/`. Older issues get archived out of that folder, so the previous issue may be the only one there.
- Copy the previous issue's `MJ_NN.indd` to `Issue NN/MJ_NN.indd` (`cp -n`), open it hidden and strip it (mj-indesign-basics for running scripts):
  - Keep: cover spread, inside front + TOC (pp 2–3), the first spread of the feature article, all daily-theme spreads, the From the Artist spread, the inside-back spread, plus one community-profile spread as a template if Daniel wants it (44 kept the 2-page one). Delete everything else, whole spreads (`spread.remove()`), never single pages. Verify each kept spread by a text it must contain before deleting anything, and check counts before `doc.save()` (saving this NEW file is expected).
  - Update the issue number on the front cover text frame ("Issue NN") and on the spine (text-on-path GraphicLines: "Midjourney", "Issue", and one digit per line; change only the digit(s) that differ).
  - Leave the pasteboard, the cover art and the model version ("V8.2" on cover and spine) until the new cover exists.
- Art and fonts that repeat every issue live in `~/Documents/Creative/Asimov/Midjourney/MJ_Template_2026 Folder/` (`Links/`: HH and KOPA Inside Front, KOPA Inside Back, Hemlock Inside Back, the subscribe QR; `Document fonts/`), so a new issue never needs the Passport drive, where finished issue folders get offloaded. Copy `HH Inside Front`, `KOPA Inside Front` and `KOPA Inside Back` into `Issue NN/Links/` (`cp -n`): make_kopa_doc.jsx looks for `<issue>/Links/KOPA Inside Back*.jpg`. Relink the new doc's inside covers to those copies; Hemlock Inside Back and the QR stay linked to the template folder. If an inside-cover file changes, put the new version in the template folder too.
- The section order and TOC come later (mj-issue-finishing, mj-toc). The posters doc: mj-posters.

## 2. Oscar projects (shared database: everyone sees changes live)

Each issue usually has two projects: the issue (`id "NN"`, file `NN.json`) and its daily theme (`id "NN-DT"`, file `NN-dt.json`). They are added in Oscar's project picker (Add project), which uploads the JSON to Supabase Storage (`issue-json` bucket), adds the row in `issues`, and updates `projects.json`. From Caleb's materials email in one go (upload from the command line + the Slack group schedule): mj-kickoff.

- The ID decides the storage file name. Reusing an ID overwrites the other project's images and makes both share bookmarks/votes; this happened in 44 (daily theme added as "44"). The app now refuses a used ID, but if you do anything by hand, use a distinct ID.
- If images look wrong after a replace: Storage files are cached for an hour; the loader now busts the cache, and the browser may remember the old project name in localStorage (re-pick the project in the picker).
- Writing to Storage/DB is shared and outward-facing: say exactly what will change and get Daniel's OK first. Read-only checks (list files, count rows) are fine.
- "Failed to fetch" on everything usually means the Supabase project is paused (free tier, ~a week idle): the project's hostname stops resolving (NXDOMAIN). Daniel restores it in the Supabase dashboard.
