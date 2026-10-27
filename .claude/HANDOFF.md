# Handoff — MJ 44, Oct 27 2026

Start a new session with: "read .claude/HANDOFF.md". The print workflow lives in the
skills in `.claude/skills/mj-*` (one owner per rule; others point to it).

## State of MJ_44.indd
- Open in InDesign with a lot of UNSAVED work from Oct 27 (pairs fixes, profiles,
  From the Artist, feature image, daily theme, TOC-related edits). Save it before
  switching accounts or machines.
- Pairs placed after page 3 (88 pages). Profiles: Vigo Zhao 92–95, DVK 96–99, Kiu Zyx 100–101.
  Feature (Tatiana Part 2) with Chase's edits; "without --hd" image placed on p106.
  Daily theme (Cubes) 108–111: images, option A blurb, captions. From the Artist 112–113 (Noa Katana).
- Files written to `Issue 44/`: `MJ44 profiles - edited copy.md` (approved), `MJ44 profiles -
  edits explained.html`, `MJ44 TOC facts and quotes.md` (printed selection only),
  `MJ44 daily theme - text options.md`.

## Open
1. **Rag full search** (requested, not built): for every candidate width, evaluate the
   per-line tracking combos (-10/0/+10, same words per line) and pick the best rag across
   width × tracking together, instead of width first and tracking after. Add hyphenation as
   an option: never on the params line, at most one hyphenated line in any 3 consecutive
   lines, small penalty so it's used only when it clearly helps. Goal = even line endings
   (tightest spread; Daniel approved the p44 result). Test on a COPY of MJ_44 first and
   time it (88 frames × ~34 widths × 2 hyphenation modes).
2. **p15**: prompt under a full-bleed image sits 0.25" below it (rule is 0.4"); at the
   4.1" cap it would overlap. Daniel to decide (make image inset / hand fix).
3. **17 prompts wider than the 4.1" cap** (placed before the cap existed, incl. weskiii
   on p91 which Daniel showed as a good example): apply the cap or leave? Ask.
4. **Daily theme caption 1** (hellshot514, p108) is overset: long prompt, narrow column.
   Daniel's layout call.
5. **tromigou p13** now 7 lines vs Pacifico Retiro's 6 after the consistency edit;
   offer `rag_selected` near its width.
6. The TOC fact "25 of 88 are variations" comes from `event_type` in whole_month.json;
   unverified against the jobs. Spot-check or drop.
7. Distribution CSV format: does it also apply to the subscriber HH/KOPA lists? Ask.
