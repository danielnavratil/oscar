---
name: mj-kickoff
description: Kicks off a new Midjourney magazine issue from Caleb's materials email — finds the email, takes the attachments from Downloads, adds the issue and daily-theme projects to Oscar, and posts the group schedule in the client_midjourney Slack channel. Use it when Daniel says "kick off NN", "set us off for a new issue", "Caleb sent the materials", "upload the new month to Oscar", or "send the schedule".
---

# Kickoff

One checkpoint (Daniel's preference): do steps 1–2 and the dry runs, then send one message with any questions (unclear file roles, group swaps, a closing line), both upload plans and the draft Slack message. On his OK: apply, confirm, post. If his answers change a plan, show the changed part again before applying. The upload and the post are shared and outward-facing; everything else is read-only.

## 1. Caleb's email

- Gmail: `from:ckruse@midjourney.com newer_than:21d`. Subjects vary ("October Magazine Materials", "Issue 44 October Magazine Materials"), and the materials sometimes come as a reply in Daniel's own request thread, so read the newest thread with `get_thread` (PLAIN_TEXT) rather than matching a subject.
- Note: attachment filenames, the address list link, and anything still to come ("Jobs to come tomorrow"). Materials can arrive across two emails; kick off with what's there and say what's missing.
- Typical set: the month's jobs as a zip (`2026_September_September_2026.zip`) and `daily_theme_jobs.json`.
- Caleb's issue numbers are unreliable (his Nov 1 email said 44 for 45). The number comes from Oscar (step 3).
- No Gmail tool in the session: ask Daniel for the filenames.
- The address list is not this skill's job: mj-distribution-csv, when Daniel wants the printer files. Pass the link on in the summary.

## 2. Files

- The Gmail connector can't download attachments. Daniel clicks "Download all" in Gmail; find the files in `~/Downloads` by the names from the email (they may land loose or bundled in one zip Gmail made). If any are missing, ask once and wait.
- Run:
  ```bash
  python3 .claude/skills/mj-kickoff/scripts/prepare.py <files or zips>
  ```
  It unzips (zips inside zips too) into a temp folder, parses each JSON exactly as Oscar does, and gives per file: role from the name, image count, first/last day, and the three group ranges as Oscar splits them. Changes nothing.
- Roles: "daily" in the name = daily theme, `whole_month` = main. A name that says neither (Caleb's `job_<id>.json`): ask in the checkpoint message. Don't guess from counts or dates.
- If `~/Documents/Creative/Asimov/Midjourney/Issue NN/` exists, copy (don't move) the JSONs there under their own names; mj-daily-theme and mj-toc look for them there. The folder itself is mj-new-issue's.

## 3. Oscar projects

ID and clash rules: mj-new-issue §2.

- `node .claude/skills/mj-kickoff/scripts/upload.mjs list` (read-only): current projects and `nextIssue` (highest numeric id + 1). Cross-check against the last ":calendar: Schedule for MJ NN" in #client_midjourney; if they disagree, ask.
- Ids `NN` and `NN-DT`; names follow the previous issue's entries in the list.
- Dry run each:
  ```bash
  node .claude/skills/mj-kickoff/scripts/upload.mjs add --id NN --name "<name>" --file <main json>
  node .claude/skills/mj-kickoff/scripts/upload.mjs add --id NN-DT --name "<name>" --file <daily theme json>
  ```
  Both plans go in the checkpoint message. On his OK, rerun with `--apply`, then `list` to confirm both are there.
- The script mirrors the project picker's Add project (upload to `issue-json/<id>.json`, `issues` row, `projects.json`) using the anon key in `.env.local`, refuses a used id, and re-reads `projects.json` just before writing it.
- "Supabase unreachable": mj-new-issue §2 (paused project).

## 4. Slack schedule

- Channel #client_midjourney (`C046SAX2U05`). Format, exactly (MJ 44's):
  ```
  :calendar: Schedule for MJ NN

  • <@U093MM2JA21> Group 1 (October 1 - October 10)
  • <@U5UTFDATV> Group 2 (October 10 - October 20)
  • <@U09EHQURZLH> Group 3 (October 20 - October 31)

  Images are <https://oscar-plum.vercel.app/|ready to go in Oscar now>!
  ```
- Group ranges: prepare.py's for the main project, unchanged. They match what each person sees in Oscar.
- Default order Daniel / Chase / Hongrae. If Daniel names a swap, use it (Val Yang `U0A95L151NJ`; anyone else via slack_search_users).
- No timeline. Optional closing line from Daniel (MJ 44 had one about when primary selects are due): ask in the checkpoint message.
- The exact message goes in the checkpoint message. Post it with slack_send_message only after both projects show up in `list` (the message says the images are ready), then give the link. No Slack tool in the session: give him the text to paste.

## 5. Summary

Projects added (ids, image counts), Slack link, the address list link, and what Caleb still owes.
