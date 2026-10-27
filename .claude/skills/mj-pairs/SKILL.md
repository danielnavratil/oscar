---
name: mj-pairs
description: Takes the Oscar pairs export (oscar-NN-pairs.json) all the way into the Midjourney magazine issue doc — download, upscale and CMYK the images, check their shapes, place every pair spread with prompts, rag, QR codes, the 0.4" clearance and width cap, then scan for problems. Use it when Daniel says the pairs are in Downloads, "start the process", "place the pairs", "run the pipeline", or asks about prompts colliding with images, prompt widths, QR codes or re-ragging pair pages. Also covers the pair-matcher check after he finishes pairing in Oscar.
---

# Pairs: JSON → placed spreads

Give Daniel a short plan and wait for his go before starting (he likes to see it). Ask everything up front in one message: where to insert (usually after page "3", the TOC), whether you run the placement or he does, and whether to save the doc first (never save without being asked; see mj-indesign-basics).

## 1. Look over the JSON

`~/Downloads/oscar-NN-pairs.json` is a list of pairs, each with `imageA`/`imageB`: `id`, `username`, `aspect` ("9:16", or null = Midjourney's default square), `size` ("full bleed" | "inset large" | "inset small"), `side`, `cleanedPrompt`, `rawPrompt`, `hasImageRefs` (gets a QR code). Report pairs, images, QR count, aspect mix. Copy it into `Issue NN/` (the QR step finds the single `oscar-*-pairs*.json` next to the .indd).

## 2. Images

Run the pipeline in the background from the issue folder and wait for the completion notice:
```bash
/bin/bash /Users/daniel/Code/oscar-v1/scripts/oscar_pipeline.sh "$PWD/oscar-NN-pairs.json" > pipeline_run.out 2>&1
```
It downloads, upscales 4x, converts to `oscar-NN-pairs-output/{HH Links,KOPA Links}` and deletes `upscaled/` when both are complete. Check the first downloads early: a wall of 403s means the Arc login is missing (mj-image-prep). The rules for upscaling/conversion are mj-image-prep's; the pipeline already follows them.

Then compare each downloaded image's real shape with its JSON `aspect` (2% tolerance; null = 1:1). The placement sizes frames from the JSON, so a mismatch (e.g. reshaped in the editor) gives a wrongly cropped frame. Fix mismatches in the Issue NN copy of the JSON only.

## 3. Place

Run `place_oscar_pairs.jsx` with its preset on the open doc (mj-indesign-basics for running; paths in these skills are relative to the oscar-v1 repo root):
```js
$.global.OSCAR_PRESET = { docName: "MJ_NN.indd", jsonPath: base + "oscar-NN-pairs.json",
  imagesFolder: base + "oscar-NN-pairs-output/HH Links", afterPage: "3", autoConfirm: true, quiet: true };
```
`afterPage` is a page NAME. One run = one undo step ("Place Oscar Pairs") that also chains `rag_prompts.jsx` (new pages) and `place_qr_codes.jsx` (QR PNGs via Python `qrcode`, medium error correction, no border, linked from `Issue NN/QR Codes/`). The script forces default script units itself; if type ever comes out absurdly large or every prompt is overset, suspect units first.

How prompts are laid out (so you can explain or debug it):
- Each image's prompt sits under it (native) unless the image reaches the prompt zone, in which case it moves to the facing page beside that page's prompt (displaced). Prompts are bottom-anchored and grow upward.
- The rag searches widths for the evenest line endings, preferring about half a page, never wider than 5/9 of the margin width (~4.1"). Two prompts on a page are optimized jointly (they trade width; never stacked; order never swapped).
- Tracking: each line gets -10, 0 or +10, only settings that keep its words, and the combination with the tightest spread of line endings wins (last line excluded). Daniel judges rag by line endings with the same words on each line; "even" (tightest spread) is the approved goal (MJ 44 p44). `OSCAR_RAG_TRACK_ONLY = [frames]` re-chooses tracking on hand-set frames without touching width or breaks.
- Clearance: only widths that keep the prompts (plus any QR code under them) 0.4" below the image above are allowed. If none clears, it takes the lowest-sitting width and shrinks the inset image from its top outer corner, crop kept. Full-bleed images can't shrink and are reported.

## 4. Check

Run mj-preflight and look at exported spreads. Typical fixes, each per page:
- **Both images on a spread are full bleed**: the prompts land on the photos. Make one image inset large (Daniel chose the left one in 44), move both prompts onto that page, re-rag it.
- **A prompt under a full-bleed image that still won't clear**: ask Daniel.
- **Full-bleed images stopping just short of the spine or bottom trim**: `snap_full_bleeds.jsx`.
- **Chinese/Korean runs in prompts**: placement styles them; `style_cjk_prompts.jsx` fixes older docs, then re-rag those pages.
- **A frame whose width Daniel set by hand**: `rag_selected.jsx` re-rags near that width (±0.25").
- Re-ragging pages overrides his hand edits on them: name the pages first.

## 5. Pair-matcher check (Oscar app)

After Daniel finishes pairing an issue in Oscar (and match notes were written there), run `node scripts/match_eval.mjs <issue>` in the repo and report how often his chosen partner is in the top 20 (target 75%).
