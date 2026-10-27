---
name: mj-image-prep
description: The one place that decides how Midjourney magazine images get downloaded, upscaled and converted to the two print CMYK profiles (HH/SWOP and KOPA/PSO), and how the files are named and filed per section (pairs, community profiles, feature, posters, From the Artist, daily theme, cover). Use it whenever any image is headed for an MJ issue or poster doc — "upscale these", "convert to CMYK", "get the images for X", "is this high enough res", a downloaded image for a section — and whenever another mj-* skill reaches its image step.
---

# Image prep for print

Other mj-* skills call this for their image step instead of restating it, so the rules live here only.

## 1. Get the file

- **Pairs**: `scripts/download_images.py` (run by `oscar_pipeline.sh`, see mj-pairs) pulls full-res .webp from the Midjourney CDN with Arc cookies. It searches every Arc profile for the `__Host-Midjourney.AuthUserToken*` login (Daniel's is in "Profile 3"). 403s mean that profile is signed out; ask him to sign in to midjourney.com in Arc. The CDN's bot check also stops scripted downloads after ~30 images in some sessions; anything that needs many pixels can run in his browser instead.
- **Tally form uploads** (community profiles): `storage.tally.so/private/...` links 403 with urllib; `curl -sfL -A "Mozilla/5.0" -o out url` works.
- **X posts** (posters): x.com is blocked in the built-in browser. Use `https://api.fxtwitter.com/<user>/status/<id>` for the media list, then download `pbs.twimg.com/media/<id>.jpg?name=orig`.
- **Files Daniel drops in ~/Downloads**: copy (don't move) into the section folder under `originals/` with a clean name.

## 2. Decide whether to upscale

Upscale only what prints under 300 ppi at its final size. Upscaling a file that's already sharp wastes time and invents detail.

- Full page bleed is 8.625 × 11.125 in, so a full-bleed image needs about 2588 × 3338 px to cover it at 300 ppi (fill means the short side governs: scale = max(2588/w, 3338/h)). Posters are 16.25 × 20.25 in with bleed.
- When the slot isn't known yet (profiles, From the Artist), judge it at full-bleed page size.
- Never upscale an image whose point is its own level of detail, e.g. the "without --hd" half of an --hd comparison: AI upscaling adds detail and would falsify the comparison. Place it as is (and say so) if it's ≥300 ppi in its frame.
- Upscaler: Real-ESRGAN 4x, `~/tools/realesrgan/realesrgan-ncnn-vulkan -i in -o out.png -n realesrgan-x4plus -s 4 -m ~/tools/realesrgan/models`. If 4x is still short (posters), add a Lanczos resize after. Don't 4x sources whose long edge is already ≥3300 px: it can produce broken output at absurd sizes. `scripts/upscale_folder.sh` does a whole folder but REPLACES originals, so prefer per-file calls into an `upscaled/` folder.
- Run long batches in the background and wait for the completion notice rather than polling.

## 3. Convert to CMYK

`python3 /Users/daniel/Code/oscar-v1/scripts/convert_cmyk.py <in_dir> <out_dir> [file ...]` writes `<out_dir>/HH Links/<name>.jpg` (U.S. Web Coated SWOP v2, US press) and `<out_dir>/KOPA Links/<name>.jpg` (PSO Coated v3, Euro press): relative colorimetric + black point compensation, profile embedded exactly as Photoshop does, 72 dpi, resumable. ~1 min per issue. Images in an inset frame are converted the same way. Put non-upscaled originals through it directly (copy them into the input folder or pass the file names).

## 4. File it where the section expects

| Section | Folder (inside `Issue NN/`) | Names |
|---|---|---|
| Pairs | `oscar-NN-pairs-output/{downloads,HH Links,KOPA Links}` | `<image uuid>.jpg` |
| Community profiles | `Community Profiles/<Name>/{originals,upscaled,HH Links,KOPA Links}` | `01.jpg` … in upload order |
| Feature | `Feature Images/`, `Feature Upscaled/`, `Feature Links/{HH Links,KOPA Links}` | Figma image name |
| From the Artist | `From the Artist/{originals,upscaled,HH Links,KOPA Links}` | `<Artist_Name>.jpg` |
| Daily theme | `Daily Theme/{originals,upscaled}` + `<job id>_HH.jpg`, `<job id>_KOPA.jpg` in `Daily Theme/` | Midjourney job id (the download's file name) |
| Posters | `Links/Posters/{originals,upscaled}` + `<handle>_HH.jpg`, `<handle>_KOPA.jpg` in `Links/Posters/` | handle as on X |
| Cover / ads | `Cover/`, `Links/` | as supplied |

The HH doc links HH files; `make_kopa_doc.jsx` (mj-issue-finishing) relinks the KOPA copy by swapping `HH Links` ↔ `KOPA Links` folders or `_HH` ↔ `_KOPA` suffixes, so keep to these patterns or the swap misses files.

## 5. Report

Give per-image pixel size, effective ppi in its frame (or at full bleed), and what was upscaled/skipped and why.
