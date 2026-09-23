#!/usr/bin/env python3
"""
convert_cmyk.py — RGB → the two print CMYKs, without Photoshop.

    python3 convert_cmyk.py <upscaled_dir> <output_dir> [file.png ...]

Writes every image in <upscaled_dir> (or just the files named) to
    <output_dir>/HH Links/<name>.jpg    U.S. Web Coated (SWOP) v2  (US press)
    <output_dir>/KOPA Links/<name>.jpg  PSO Coated v3               (Euro press)

Same recipe as convert_both.jsx in Photoshop: relative colorimetric with
black point compensation, profile embedded, 72 dpi. Untagged sources are
treated as sRGB (Photoshop's working space). Uses LittleCMS through Pillow.
Against Photoshop's own output for Issue 42 the average difference was
0.5–0.9 ΔE76, 99% of pixels within 2 — invisible in print — at ~20x speed.

Resumable: outputs that already exist are skipped, and each file is written
to a .part name first, so an interrupted run never leaves a half-written JPEG
under the real name. Runs several images at once (one per performance core).
Exit status 1 if any conversion failed.
"""
import io
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

from PIL import Image, ImageCms

Image.MAX_IMAGE_PIXELS = None  # 4x upscales are legitimately huge

SRGB_ICC = "/System/Library/ColorSync/Profiles/sRGB Profile.icc"
PROFILES = [
    # (output folder, ICC file, description Photoshop knows it by)
    ("HH Links",   "/Library/Application Support/Adobe/Color/Profiles/Recommended/USWebCoatedSWOP.icc",
                   "U.S. Web Coated (SWOP) v2"),
    ("KOPA Links", os.path.expanduser("~/Library/ColorSync/Profiles/PSOcoated_v3.icc"),
                   "PSO Coated v3"),
]
QUALITY = 95          # 4:4:4, no chroma subsampling


def embed_bytes(icc_path):
    """The profile exactly as Photoshop embeds it: the original file with the
    header's rendering intent (byte 67) set to relative colorimetric. Viewers
    such as macOS use that byte; re-serializing through LittleCMS changes more."""
    b = bytearray(open(icc_path, "rb").read())
    b[64:68] = (1).to_bytes(4, "big")
    return bytes(b)


EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp")


def convert_one(src_path, out_dir):
    """Convert one image to every profile whose output is missing. Returns (name, made, error)."""
    name = os.path.splitext(os.path.basename(src_path))[0]
    todo = [(folder, icc) for folder, icc, _ in PROFILES
            if not os.path.exists(os.path.join(out_dir, folder, name + ".jpg"))]
    if not todo:
        return name, 0, None
    try:
        im = Image.open(src_path)
        embedded = im.info.get("icc_profile")
        if im.mode in ("RGBA", "LA", "P") or (im.mode == "RGB" and "transparency" in im.info):
            im = im.convert("RGBA")
            flat = Image.new("RGB", im.size, (255, 255, 255))   # Photoshop's flatten: onto white
            flat.paste(im, mask=im.getchannel("A"))
            im = flat
        elif im.mode != "RGB":
            im = im.convert("RGB")
        src_prof = ImageCms.ImageCmsProfile(io.BytesIO(embedded)) if embedded \
            else ImageCms.getOpenProfile(SRGB_ICC)
        made = 0
        for folder, icc in todo:
            dst_prof = ImageCms.getOpenProfile(icc)
            xf = ImageCms.buildTransform(
                src_prof, dst_prof, "RGB", "CMYK",
                renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
                flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
            cmyk = ImageCms.applyTransform(im, xf)
            dest = os.path.join(out_dir, folder, name + ".jpg")
            part = dest + ".part"
            cmyk.save(part, "JPEG", quality=QUALITY, subsampling=0, dpi=(72, 72),
                      icc_profile=embed_bytes(icc))
            os.replace(part, dest)
            made += 1
        return name, made, None
    except Exception as e:  # report, keep going with the rest
        for folder, _ in todo:
            try:
                os.remove(os.path.join(out_dir, folder, name + ".jpg.part"))
            except OSError:
                pass
        return name, 0, "%s: %s" % (type(e).__name__, e)


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip().splitlines()[2].strip())
        sys.exit(2)
    src_dir, out_dir = sys.argv[1], sys.argv[2]
    for folder, icc, _ in PROFILES:
        if not os.path.exists(icc):
            print("ICC profile missing: " + icc)
            sys.exit(2)
        os.makedirs(os.path.join(out_dir, folder), exist_ok=True)
    if len(sys.argv) > 3:
        files = [f if os.path.isabs(f) else os.path.join(src_dir, f) for f in sys.argv[3:]]
    else:
        files = sorted(os.path.join(src_dir, f) for f in os.listdir(src_dir)
                       if f.lower().endswith(EXTS) and not f.startswith("."))
    total = len(files)
    if not total:
        print("No images in " + src_dir)
        return
    workers = min(total, max(1, int(os.popen("sysctl -n hw.perflevel0.physicalcpu 2>/dev/null").read().strip() or os.cpu_count() or 4)))
    t0 = time.time()
    made = skipped = 0
    errors = []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(convert_one, f, out_dir): f for f in files}
        for n, fut in enumerate(as_completed(futs), 1):
            name, m, err = fut.result()
            pct = n * 100 // total
            if err:
                errors.append(name + " → " + err)
                print("[%d/%d] (%d%%) FAILED %s  %s" % (n, total, pct, name, err), flush=True)
            elif m:
                made += 1
                print("[%d/%d] (%d%%) converted %s" % (n, total, pct, name), flush=True)
            else:
                skipped += 1
                print("[%d/%d] (%d%%) skip      %s (already converted)" % (n, total, pct, name), flush=True)
    print("CMYK conversion: %d converted, %d skipped, %d failed in %.0fs (%d at a time)."
          % (made, skipped, len(errors), time.time() - t0, workers))
    if errors:
        print("\nFailed:\n  " + "\n  ".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
