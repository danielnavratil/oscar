---
name: mj-issue-finishing
description: Takes a Midjourney magazine issue from "everything is placed" to print PDFs — spreading the non-pair sections evenly through the pairs, the TOC, the pre-flight, the KOPA (Euro press) copy with its inside-cover ads, the one-export-per-document PDFs for both printers, and the final HH↔KOPA check; also one-off image edits that must be mirrored into both editions. Use it when Daniel says "finish the issue", "make the KOPA doc", "export the PDFs", "move the sections around", "spread out the profiles", or brightens/edits an image late.
---

# Finishing an issue

Order: sections → TOC (mj-toc) → pre-flight (mj-preflight) → KOPA doc → PDFs → final pass. Posters go through the same KOPA/export steps (mj-posters).

## 1. Spread the non-pair sections through the pairs

Ask which sections count (in 43: each community profile, the feature, the daily theme, From the Artist). Keep each section's spreads together; none first or last (the pairs open right after the TOC and close before the inside back); mix them so two profiles never touch. Propose the order with resulting page numbers, then move whole spreads with `spread.move(LocationOptions.AFTER, refSpread)` in one undo step. Inserted or moved pair pages must keep the "A-Page #" master (it carries the folios); check pages without a master afterwards.

## 2. TOC and pre-flight

mj-toc, then mj-preflight. Fix only what Daniel OKs.

## 3. KOPA document

`make_kopa_doc.jsx` (preset `OSCAR_KOPA_PRESET = { docName, quiet }`): saves a copy "MJ_NN KOPA.indd" next to the issue (the open HH doc isn't saved or changed), swaps every link to its KOPA twin via `swap_print_profile.jsx` (`HH Links` ↔ `KOPA Links`, `_HH` ↔ `_KOPA`), swaps the Hemlock inside-back ad for `Issue NN/Links/KOPA Inside Back*.jpg` and reports anything still on an HH file.
- Copy the KOPA inside-back ad into `Issue NN/Links/` from the previous issue first.
- Inside front: the template's "Inside Front 2:10:26.jpg" is the PSO (KOPA) version; the HH doc wants the SWOP one (`MJ_Template_2026 Folder/Links/JPEG/Inside Front 2_10_26.jpg`, copied in as `Links/HH Inside Front 2:10:26.jpg`).
- Verify every KOPA-doc image's ICC is "PSO Coated v3".
- Edits made in HH after this (arrows, shadows, text) must be mirrored into KOPA by hand, keeping KOPA images on KOPA files. `sync_qr_scale.jsx` copies hand-scaled QR codes between the editions.

## 4. PDFs

`export_issue_pdfs.jsx` (preset `OSCAR_EXPORT_PRESET = { docs: [...], quiet }`): one export per open document. HH → HEMLOCK preset → `HH/MJ_NN/MJ_NN_01.pdf …` (the preset splits pages itself; 01 = back cover, document order); KOPA → KOPA preset → `KOPA/MJ_NN KOPA.pdf`. Never export page by page: every export makes its own folder (once made 39 of them). InDesign won't overwrite a split folder (writes "MJ_NN(1)"), so the script refuses to run over existing output: move old output to the Trash first. Exports include unsaved changes: say so.

## 5. Final pass

HH ↔ KOPA diff (stories by id + item geometry) and re-sync; re-export any PDF older than the last .indd edit; pages without a master; nothing deleted that is artwork (see mj-preflight on empty frames).

## Late image edits

If Daniel brightens an image in Photoshop: back up both originals first (`oscar-NN-pairs-output/_before <edit>/`), save over the HH file (flatten, JPEG quality 12, profile embedded), duplicate his adjustment layer onto the KOPA file and save that too, update the InDesign links in both docs.
