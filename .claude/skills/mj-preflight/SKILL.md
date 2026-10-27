---
name: mj-preflight
description: Pre-flight check for a Midjourney magazine InDesign document (MJ_NN.indd, its KOPA copy, posters) — overset text, missing/low-res/RGB links, fonts, pink placeholders, leftover text, prompts closer than 0.4" to images or wider than the cap, pair spreads missing a prompt, pages without a master. Use it after placing pairs or any section, before making the KOPA doc or exporting PDFs, after Daniel's hand edits, and whenever he asks "is the issue ok", "check the doc", "anything broken", or reports an overlap. Report first; fix only what he OKs.
---

# Pre-flight an issue

Run the repo scan (it changes nothing and adds nothing to the undo stack), following mj-indesign-basics for how to run scripts:

```js
$.global.OSCAR_SCAN_PRESET = { docName: "MJ_44.indd", quiet: true };
var r; try { r = $.evalFile(File("/Users/daniel/Code/oscar-v1/scripts/scan_issue.jsx")); }
finally { $.global.OSCAR_SCAN_PRESET = undefined; }
r;
```

## Reading the report

- **OVERSET, FONT PROBLEMS, PINK PLACEHOLDERS, PAIR SPREADS WITH A MISSING PROMPT**: real problems; list them.
- **LINK PROBLEMS**: separate links carried over from the previous issue (cover, TOC art, daily theme, profiles: they disappear when the 44 content replaces them) from new ones. Old issue folders get archived out of `Asimov/Midjourney/`, so carried-over links show as missing.
- **UNDER 300 PPI / NON-CMYK**: see mj-image-prep for the fix; QR codes are excluded on purpose.
- **PROMPTS WITHIN 0.4" OF AN IMAGE / WIDER THAN THE CAP**: the prompt rules and how to fix them (re-rag the page; the full-bleed cases) are in mj-pairs. Re-ragging replaces Daniel's hand-set widths on that page, so name the pages before running.
- **PAGES WITH NO MASTER**: cover (116, 117, 1), TOC (2, 3) and inside back are normal. Pair pages need "A-Page #" (it carries the folios).
- **TEXT ON PASTEBOARD / EMPTY TEXT FRAMES**: alternates on the TOC pasteboard and parked cut text are Daniel's: leave them. Empty frames can be artwork: never delete an empty frame that has a stroke, a fill or a non-rectangular path (the back cover's MIDJOURNEY letter outline and bottom band are empty frames; deleting them shipped PDFs without them once). List on-page deletions item by item and wait for a yes.
- Locked items: skip and say so.

## What the scan can't judge

Read these yourself: TOC page numbers, quote and credit, the stat (mj-toc); that every pair image matches its prompt's username; for the final pass, an HH ↔ KOPA diff (stories by id plus item geometry) and whether PDFs are older than the last .indd edit (re-export after any edit).

## Visual check

For anything layout-related, export JPEGs of the affected spreads (mj-indesign-basics) and look before reporting; send them to Daniel.
