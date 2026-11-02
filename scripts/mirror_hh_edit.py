#!/usr/bin/env python3
"""Mirror a hand retouch (e.g. a removed wordmark) from an HH file into its KOPA twin.

    python3 scripts/mirror_hh_edit.py <backup dir> <issue pairs-output dir> <name>.jpg

<backup dir> holds the untouched originals as "HH Links/<name>" and "KOPA Links/<name>";
the edited HH file sits in "<pairs-output>/HH Links/<name>" (Daniel's Photoshop save).
The edited area is found by diffing the edit against the HH original at 1/8 size (so
JPEG recompression noise is ignored). Only that area, feathered 32 px, is taken from
the edit: into the HH original as is, into the KOPA original converted SWOP -> PSO
(relative colorimetric + BPC). Both are saved the way convert_cmyk.py saves, so the
rest of each image keeps its original pixels whatever quality Photoshop saved at.
Daniel's save is kept next to the backups as "HH photoshop save.jpg".
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageCms

import convert_cmyk as cc

STEP, NOISE, PAD, FEATHER = 8, 6, 48, 32


def main():
    backup, out, name = sys.argv[1:4]
    swop = next(p for f, p, _ in cc.PROFILES if f == "HH Links")
    pso = next(p for f, p, _ in cc.PROFILES if f == "KOPA Links")
    edited_path = os.path.join(out, "HH Links", name)
    saved = os.path.join(backup, "HH photoshop save.jpg")
    shutil.copy2(edited_path, saved)
    edited = Image.open(saved); edited.load()
    old_hh = Image.open(os.path.join(backup, "HH Links", name)); old_hh.load()
    old_k = Image.open(os.path.join(backup, "KOPA Links", name)); old_k.load()
    if not (edited.size == old_hh.size == old_k.size):
        sys.exit("sizes differ: %s %s %s" % (edited.size, old_hh.size, old_k.size))
    w, h = edited.size

    small = (w // STEP, h // STEP)
    d = np.abs(np.asarray(edited.resize(small, Image.BOX)).astype(int)
               - np.asarray(old_hh.resize(small, Image.BOX)).astype(int)).max(axis=2)
    ys, xs = np.nonzero(d > NOISE)
    if not len(ys):
        sys.exit("no edit found")
    top, bottom = max(0, ys.min() * STEP - PAD), min(h, (ys.max() + 1) * STEP + PAD)
    left, right = max(0, xs.min() * STEP - PAD), min(w, (xs.max() + 1) * STEP + PAD)
    print("edited area: x %d-%d, y %d-%d" % (left, right, top, bottom))

    def ramp(n, lo, hi):  # 0 outside, 1 inside, linear over FEATHER px (none at the image edge)
        i = np.arange(n, dtype=float)
        up = np.ones(n) if lo == 0 else np.clip((i - (lo - FEATHER)) / FEATHER, 0, 1)
        down = np.ones(n) if hi == n else np.clip(((hi + FEATHER) - i) / FEATHER, 0, 1)
        return np.minimum(up, down)
    mask = Image.fromarray((np.outer(ramp(h, top, bottom), ramp(w, left, right)) * 255).astype(np.uint8), "L")

    xf = ImageCms.buildTransform(ImageCms.getOpenProfile(swop), ImageCms.getOpenProfile(pso), "CMYK", "CMYK",
                                 renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
                                 flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
    for folder, base, src, icc in (("HH Links", old_hh, edited, swop),
                                   ("KOPA Links", old_k, ImageCms.applyTransform(edited, xf), pso)):
        dest = os.path.join(out, folder, name)
        Image.composite(src, base, mask).save(dest + ".part", "JPEG", quality=cc.QUALITY, subsampling=0,
                                              dpi=(72, 72), icc_profile=cc.embed_bytes(icc))
        os.replace(dest + ".part", dest)
        print("wrote " + dest)


if __name__ == "__main__":
    main()
