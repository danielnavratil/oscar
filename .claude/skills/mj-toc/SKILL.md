---
name: mj-toc
description: Gathers the content for the Midjourney magazine table of contents — salient facts and stats about the issue's image pool (the month's Oscar project) and the printed selection, plus highlight quotes from the community-profile interviews — as a file Daniel lays out himself. Use it when Daniel asks to "do our usual thing for the TOC", for TOC facts, stats, numbers or quotes, "what's interesting about this issue's images", or pull quotes from the interviews.
---

# TOC content

Daniel does the TOC layout himself (pages 2–3 of MJ_NN.indd). What he wants from you is material: facts about the image pool and quotes from the interviews. Don't worry about length or fitting; give him more than he needs and let him choose. Don't edit the TOC pages unless he asks.

## Sources

- **The printed selection only** (Daniel isn't interested in the wider pool): `Issue NN/oscar-NN-pairs.json` (`rawPrompt`, `aspect`, `size`, `category`, `votes`, `hasImageRefs`). If pages were cut after placement, use the prompt frames actually in the doc instead (label `oscar_prompt` on a page). The month's project JSON (`whole_month.json` / `NN.json`) is only useful joined by image `id`, for per-image fields the pairs file lacks: `type` (`v8-2_hd_diffusion`…), `event_type` (variation/remix), `enqueue_time`.
- **Interviews**: the approved edited copy `Issue NN/MJNN profiles - edited copy.md` with ~~struck~~ text removed. Quotes must come from text that prints.

## Facts worth computing (printed images only)

Share using a personalization code (`--p`/`--profile`; the long-running TOC stat) and prompts stacking several codes; codes shared between creators (in 44 a pair shared nine); `--hd`, `--chaos` (and its range), `--raw`, `--sref`, `--weird`, `--no`, reference images; variations/remixes; model version; median prompt length, the longest and shortest prompts (an empty `""` prompt with only a profile code is a good one), very short prompts, all-lowercase prompts, non-Latin prompts; most-used colour word after black and white (another recurring stat); most common words and subjects; orientation and aspect ratios; full bleed vs insets; QR codes; votes; categories; busiest day/weekday of making.

Compute with a short Python script; strip parameters and URLs before counting words; match parameters as whole tokens; give page numbers for anything a reader could look up.

## Quotes

Per interviewee, 4–6 candidates of different lengths: aphoristic one-liners, a vivid concrete line, something about how they work. Verbatim from the edited copy (curly quotes, their punctuation). Mark your favourite per person.

## Deliverable

Write `Issue NN/MJNN TOC facts and quotes.md` (facts grouped, each one a ready-to-print line with the number; quotes per person with the credit as "Name, City, Country"), send it, and put the 3–4 strongest facts and quotes in the reply.
