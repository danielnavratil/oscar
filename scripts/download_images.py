#!/usr/bin/env python3
# ───────────────────────────────────────────────────────────────
# download_images.py
# Downloads full-resolution images from the Midjourney CDN.
# Reads the pairs JSON exported from the Oscar app.
#
# Called automatically by oscar_pipeline.sh — you don't normally
# run this by hand.
#
# Auth (tries in order):
#   1. browser-cookie3 auto-extracts from Arc, then Chrome
#   2. mj_cookies.txt  (paste your cookie header value once)
#   3. No cookies      (will 403 on protected images)
#
# Usage:
#   python3 download_images.py <pairs.json> <output_folder> [--test]
# ───────────────────────────────────────────────────────────────

import sys, os, json, urllib.request, urllib.error, pathlib

SCRIPT_DIR = pathlib.Path(__file__).parent


def full_res_url(uuid, grid):
    # Thumbnail: https://cdn.midjourney.com/{uuid}/0_{grid}_640_N.webp
    # Full-res:  drop the _640_N size suffix
    return f"https://cdn.midjourney.com/{uuid}/0_{grid}.webp"


def grid_from_thumb(thumb_url):
    # ".../0_{grid}_640_N.webp" → grid digit
    try:
        tail = (thumb_url or "").rstrip("/").split("/")[-1]  # e.g. "0_3_640_N.webp"
        return tail.split("_")[1]                             # "3"
    except Exception:
        return "0"


def get_cookies():
    # 1. Try browser-cookie3 (Arc first, then Chrome as fallback)
    try:
        import browser_cookie3
        for browser_name, browser_fn in [("Arc", browser_cookie3.arc), ("Chrome", browser_cookie3.chrome)]:
            try:
                cj = browser_fn(domain_name="midjourney.com")
                cookie_str = "; ".join(f"{c.name}={c.value}" for c in cj if c.value)
                if cookie_str:
                    print(f"[auth] using cookies from {browser_name}")
                    return cookie_str
            except Exception as e:
                print(f"[auth] {browser_name} failed ({e}), trying next...")
    except ImportError:
        pass

    # 2. Fall back to mj_cookies.txt
    cookie_file = SCRIPT_DIR / "mj_cookies.txt"
    if cookie_file.exists():
        text = cookie_file.read_text().strip()
        if text:
            print("[auth] using cookies from mj_cookies.txt")
            return text

    print("[auth] WARNING: no cookies found — requests may get 403")
    print(f"       To fix: pip install browser-cookie3")
    print(f"       Or paste your Cookie header into: {cookie_file}")
    return None


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 download_images.py <pairs.json> <output_folder> [--test]")
        sys.exit(1)

    json_path = sys.argv[1]
    out_dir   = sys.argv[2]
    test_mode = "--test" in sys.argv

    os.makedirs(out_dir, exist_ok=True)

    with open(json_path) as f:
        pairs = json.load(f)

    # Flatten pairs → list of (uuid, grid) tuples, deduplicated
    seen = set()
    images = []
    for p in pairs:
        for key in ("imageA", "imageB"):
            img = p.get(key)
            if not img or not img.get("id"):
                continue
            uuid = img["id"]
            if uuid in seen:
                continue
            seen.add(uuid)
            grid = grid_from_thumb(img.get("thumbnailUrl", ""))
            images.append((uuid, grid))

    if test_mode:
        images = images[:3]
        print(f"TEST MODE — downloading first {len(images)} images only.\n")
    else:
        print(f"Found {len(images)} unique images.\n")

    cookies = get_cookies()
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Referer": "https://www.midjourney.com/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    }
    if cookies:
        headers["Cookie"] = cookies

    ok, skipped, failed = 0, 0, []

    for i, (uuid, grid) in enumerate(images, 1):
        url  = full_res_url(uuid, grid)
        dest = os.path.join(out_dir, f"{uuid}.webp")

        if os.path.exists(dest):
            print(f"[{i}/{len(images)}] skip   {uuid}")
            skipped += 1
            continue

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(dest, "wb") as out:
                out.write(data)
            kb = len(data) // 1024
            print(f"[{i}/{len(images)}] ok     {uuid}.webp  ({kb} KB)")
            ok += 1
        except urllib.error.HTTPError as e:
            msg = f"HTTP {e.code}" + (" (forbidden — check cookies)" if e.code == 403 else "")
            print(f"[{i}/{len(images)}] FAIL   {uuid} — {msg}")
            failed.append((uuid, msg))
        except Exception as e:
            print(f"[{i}/{len(images)}] FAIL   {uuid} — {e}")
            failed.append((uuid, str(e)))

    print(f"\nDownload: {ok} ok, {skipped} skipped, {len(failed)} failed.")
    if failed:
        print("Failures:")
        for uuid, err in failed:
            print(f"  {uuid}: {err}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
