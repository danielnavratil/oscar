---
name: mj-feature-figma
description: Lays out a Midjourney magazine feature (Tatiana Tsiguleva's editor/technique series) in InDesign from its Figma design — grid, Feature paragraph styles, live Midjourney UI elements (imagine bar, tags, buttons), Figma icons, arrows and images. Use it when Daniel shares a figma.com link for a feature to build in the issue, asks to lay out Tatiana's feature, or to add/replace a feature image or UI element.
---

# Feature from Figma

Figma file "Midjourney Design 26 INTERNAL" (`ZxKSEOXt6IJ9Tu3CBzA5Qp`), one page per issue ("Issue NN - Tatiana Feature"). Daniel links a page or frame; the copy may come from a different frame (Tatiana's long draft) — read it, don't edit it. Read nodes with the Figma MCP (`get_metadata` for structure, `get_screenshot` to look, `get_design_context` for code + asset URLs; the spread-level design context also gives rotations/flips of vectors).

## Ask everything up front

Copy source, extra passages, captions, title/kicker wording, imagine bars full vs abridged, corner radius, shadows, heading levels. For 43 his answers were: match Figma's UI (attach row, Submit edit), rounded image corners, soft shadows on UI, plain text instead of bold runs (ABC Arizona has no bold).

## Build

- **Grid**: master margins + 3 columns split into 12 (column 0.408", gutter 1/6"). Figma pages are wider than 8.375 × 10.875: scale to the page width and snap to the grid. Keep everything out of the spine zone (7.4–9.35" on a spread).
- **Type**: the "Feature" paragraph style group from earlier Tatiana features. Body = ABC Arizona Text 9.5/12.5 + 12.5 pt space after; Scene/section heads = Diatype Ultra 24/28; subheads Diatype Heavy 10/12.5; Kicker = Diatype Ultra 11 caps; Prompt = DM Sans 18 pt at 85%; Tag = DM Sans 5.5; Caption = DM Sans Italic 6.5; UI/Button/Submit styles. Centred intro: hyphenation off.
- **UI elements are built live**, not flattened: imagine bar = Black 2% fill, Black 10% 0.57 pt stroke, ~0.1" radius, soft shadow (3 pt distance, 9 pt blur, 18%); abridged "tags" for in-line prompts; Smart Select / Erase / Restore / Open Editor buttons. All UI text vertically centred with first baseline = cap height (Daniel's rule).
- **Icons**: export from Figma via `get_design_context` asset URLs as SVG into `Issue NN/Feature Icons/`, place with `rect.place()`.
- **Arrows**: 0.25 pt, Black 25%, Simple Wide arrowhead at 100%. When Daniel has no designer's arrows to follow, every arrow is the same symmetric arc (sagitta 0.16 × chord) so heads aren't bent; when tracing a designer's arrows, fit one cubic per arrow (two anchor points: Daniel doesn't want lots of nodes), anchored to the objects it connects. He hand-adjusts afterwards.
- **Images**: pink (C0 M100 Y0 K0) placeholder frames named after the Figma image first, then real images placed fill-proportionally (prep per mj-image-prep; don't upscale a with/without --hd comparison image). The "green screen" Smart Select look was recreated from the studio photo with macOS Vision person segmentation + a striped green overlay.
- Name frames meaningfully ("IMG – …", "Body – …", "Caption – …"): later revisions and checks find things by name.

Run per mj-indesign-basics (inches need "Npt" strings for point sizes; don't set strokeWeight on text frames). Export spreads, send them, run mj-preflight.
