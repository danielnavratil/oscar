---
name: mj-daily-theme
description: Works out the month's Daily Theme for the Midjourney magazine from the daily-theme jobs export — which theme ran on which days, counts leveled for heavy posters (Sly Fox), the issue's pick, the blurb in the house voice, and the daily-theme spread. Use it when Daniel says "our usual parsing of the daily theme themes", "what were the daily theme keywords", asks which theme won or to "level out" for a dominant user, wants the daily theme blurb, or drops a daily_theme_jobs / whole_month JSON for a new issue.
---

# Daily Theme

## 1. Themes by day

The export (`daily_theme_jobs*.json` in Downloads or `Issue NN/`) is a list of jobs (`enqueue_time`, `prompt`, `user_name`, …) for one month. Don't confuse it with the issue's `whole_month.json` (the main Oscar project's images). Each day's prompts share the day's theme word, so the theme falls out of the vocabulary:
```bash
python3 .claude/skills/mj-daily-theme/scripts/daily_theme.py days <jobs.json>
```
Read the table and give Daniel the month as `Dates | Theme`, using the community's own word (with its "-punk"/"-goth"/"-core" coinages when they matter). Note themes carried over from the previous month (they open the month; not candidates) and ones that run into the next. Days too quiet to read: say so. Mapping is inferred from vocabulary, not an official list: say that too.

## 2. Level it out

One or two people post hundreds of images on some days (Sly Fox, two accounts; hevell is sometimes close behind), so raw counts mislead. Write the theme windows to a JSON (`[{"name", "keyword", "from": "MM-DD", "to": "MM-DD"}]`) and run:
```bash
python3 .claude/skills/mj-daily-theme/scripts/daily_theme.py level <jobs.json> themes.json
```
It gives raw count, Sly Fox's share, count without Sly Fox, count with every user capped at 20 images a day, and distinct users, sorted by the capped count. Present that table plus two or three sentences: which theme leads once leveled, which one drops most and why, carry-overs that aren't candidates. Daniel picks the issue's theme.

## 3. Blurb

Read `references/blurb-example.md` and the blurbs already on the daily-theme spreads in the doc, then write ~150 words in that voice about the chosen theme, grounded in actual images from the Oscar daily-theme project (describe what's in them; don't invent). Real-world events tied to the theme are worth a sentence if true.

## 4. Spread and images

- The daily-theme images come from the issue's daily-theme project in Oscar (`NN-DT`); the Export tab's "Download my images" gives a zip of JPGs. Daily-theme projects skip the pairs pipeline and placement entirely.
- Downloaded daily-theme JPGs carry no metadata (no EXIF/XMP prompt), but each file name is the Midjourney job ID: look it up by `id` in the jobs export to get the creator, date, aspect and full prompt for the caption.
- Prep them per mj-image-prep. They're usually native resolution (about 900–1400 px on the long side), so most need upscaling for print.
- In the doc, the daily-theme spreads were kept from the previous issue (mj-new-issue): swap content like for like (theme name, blurb, images, captions with the creator and prompt word for word) and ask Daniel for picks you don't have. The TOC's daily theme box gets the theme name (mj-toc).
