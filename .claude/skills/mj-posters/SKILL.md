---
name: mj-posters
description: Builds the Midjourney magazine posters doc for an issue (MJ NN Posters.indd: two 16×20 in full-bleed posters with an @handle + model credit and a QR code to the source post) from X/Twitter post links, plus its KOPA copy and PDFs. Use it when Daniel sends X post links "for posters", asks to prep or update the posters, change a poster credit, crop or QR code.
---

# Posters

Ask up front: the Midjourney version for each credit (posts rarely say), and anything about cropping. Default crop: fill the page, centered; Daniel nudges it in InDesign.

## Build

1. **Images**: download, upscale and convert per mj-image-prep (X posts, poster size, posters row of its filing table).
2. **QR codes**: black, medium error correction, box size 40, no border, PNG named `<handle>.png` in `Links/Posters/`, encoding the X post URL:
   ```python
   q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=40, border=0); q.add_data(url); q.make(fit=True)
   ```
   (use the python3 that has `qrcode` + Pillow, e.g. `/usr/local/bin/python3`).
3. **Doc**: copy the previous issue's `MJ NN Posters.indd` to `Issue NN/MJ NN Posters.indd` (`cp -n`), then in one script (mj-indesign-basics): relink each page's poster image and QR to the new files (match the old links by name), refit the image fill-proportionally + centered and the QR proportionally, and change the credit text "@handle" / forced line break / "Midjourney V8.x" (12 pt, Diatype Heavy; edit the characters so the formatting stays). Save the posters doc (it's a new file). An old hidden credit frame from an earlier issue sits behind the image on each page: leave it.
4. Export a preview, send it, and report ppi per poster.

## Finish (after Daniel's crop nudges, not before, or the KOPA copy needs the same nudges)

`make_kopa_doc.jsx` makes "MJ NN Posters KOPA.indd"; `export_issue_pdfs.jsx` writes `HH/MJ NN Posters/…` and `KOPA/MJ NN Posters KOPA.pdf`. Both are described in mj-issue-finishing; they handle the posters docs the same way as the issue.
