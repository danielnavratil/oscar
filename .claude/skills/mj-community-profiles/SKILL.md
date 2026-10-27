---
name: mj-community-profiles
description: Turns Midjourney magazine Community Profile interview submissions (Tally CSV export or the "MJ Mag Interview Responses" Google Sheet) into laid-out profile pages in the issue doc — review, image download, copy edit with Daniel's rules, an edited-copy file plus an edits-explained page for approval, then InDesign layout. Use it when Daniel says he downloaded profiles/submissions/interviews, "do the profiles", "the three most recent submissions", asks how a profile was edited, or wants profile copy changed.
---

# Community profiles

Steps 1–3 happen before anything is placed; Daniel approves the copy in between. Ask all questions in one message (he wants them up front).

## 1. Look them over

- Source: a Tally export in Downloads (`Midjourney Magazine Community Profile_Submissions_<date>.csv`: name, occupation, city, 4 image URLs, Q1–Q10, consent), or the Google Sheet "MJ Mag Interview Responses <year>" (one tab per issue; read it as xlsx through the Drive connector). "The N most recent" = last N rows by `Submitted at`; skip the "Test" row.
- For each person report: consent, word count, answered questions, image count/orientation/size, and anything odd: broken sentences, answers repeating each other, competitor names, emoji, a city abbreviation, an occupation field that isn't one, images that are designed posters rather than raw outputs.
- Download images now (mj-image-prep: Tally needs `curl -A "Mozilla/5.0"`) into `Issue NN/Community Profiles/<Printed Name>/originals/01..04` in upload order, and send Daniel a contact sheet.
- Questions that usually need asking: how names print (Daniel's rule: capitalised, e.g. "DVK", "Kiu Zyx"), city normalisation ("BJ" → "Beijing, China", always "City, Country/State"), anything flagged above.

## 2. Copy edit

Rules (Daniel's):
- Fix spelling, grammar and punctuation; normal capitalisation (the all-lowercase prompt rule doesn't apply to answers). US spelling.
- Cut repetition: repeated words and repeated ideas or passages across answers. **Do not cut for length**: length is not an issue.
- Add "in the style of" / "inspired by" before a named artist, brand, franchise or film that lacks one ("Interstellar-style poster" → "a poster inspired by Interstellar"); camera brands are exempt; "the work of X" is fine as is.
- Name no competing software: make it vague ("another AI tool", "other image generators").
- Prompts quoted in answers stay word for word.
- Remove emoji (the fonts can't print them).
- When unsure what they meant, keep their wording and flag it (Daniel kept DVK's "units (images)" as written rather than accept a guess).

Write `Issue NN/MJNN profiles - edited copy.md`: `## Name`, a `**City** · **Occupation**` line, then `**N. Question**` + answer per answered question; cuts as `~~struck~~`, judgement calls as `**[FLAG: …]**`; unanswered questions left out. Send it. If Daniel wants context on the edits, generate the side-by-side page (write a notes JSON with the why for each changed answer first):
```bash
python3 .claude/skills/mj-community-profiles/scripts/edits_explained.py --csv <csv> --md <md> --out "Issue NN/MJNN profiles - edits explained.html" --notes notes.json
```
Apply his changes to the Markdown; it is the approved source for layout.

## 3. Images

Prep per mj-image-prep (profiles row of its filing table). Daniel places/reorders profile images himself, so don't block on slot orientation: the defaults are fine.

## 4. Layout

Template: the profile spread kept in the issue doc (44: the 2-page spread, header + text column above a wide image on the left, full-bleed wide image over a text frame on the right). If an older 4-page set is wanted it comes from an archived issue: ask where it is.

```bash
python3 .claude/skills/mj-community-profiles/scripts/copy_to_data.py "<edited copy.md>" data.json --images "Issue NN/Community Profiles"
python3 .claude/skills/mj-community-profiles/scripts/build_layout.py data.json build.jsx --doc MJ_NN.indd --template-page <page name of the template's left page> --base "<abs path>/Issue NN/Community Profiles/"
```
Run `build.jsx` per mj-indesign-basics (one undo step). It threads each person's Q&A (Question ¶, empty Question ¶, Body ¶s with empty ¶s between, empty ¶ before the next question) through the template's two frames and adds two-column continuation spreads while overset, puts two wide images in the frames and the rest on the pasteboard, and keeps every question with the line after it. The first person replaces the template's old content (the previous issue's profile).

Then export the spreads, look, send them; run mj-preflight. Daniel often reworks profiles by hand afterwards (shortens, parks cut text on the pasteboard): don't clean up his pasteboard unless asked.

## 5. Later

The TOC pull quote and "Interviews with" list come from these profiles: mj-toc. Quotes must come from text that actually prints.
