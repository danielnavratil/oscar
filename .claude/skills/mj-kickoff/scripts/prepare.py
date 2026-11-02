#!/usr/bin/env python3
"""Prepare Caleb's monthly exports for Oscar.

  prepare.py <file.json|file.zip>...

Unzips any zip (and zips inside it) into a fresh temp folder, then for every JSON:
parses it exactly as Oscar's parseIssueJson does (JSON array/object map or NDJSON,
deduped by id, video jobs and base grids dropped), guesses its role from the file
name ("daily" -> daily theme, "whole_month" -> main, else unclear), and prints image count, date span and
the three group ranges as Oscar's groupByChunks splits them (sorted by enqueue_time,
ceil(n/3) per group, dates in America/New_York like the browser on Daniel's Mac).

Prints one JSON object: {"tmpdir": ..., "files": [...]}. Changes nothing.
"""
import json, math, os, sys, tempfile, zipfile
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/New_York")


def parse_issue_json(raw):
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        d = [json.loads(l) for l in (l.strip() for l in raw.split("\n")) if l]
    arr = d if isinstance(d, list) else list(d.values())
    seen, out = set(), []
    for img in arr:
        if not isinstance(img, dict):
            continue
        key = json.dumps(img.get("id"))
        if key in seen:
            continue
        seen.add(key)
        has_grid = img.get("parent_grid") is not None or img.get("grid_index") is not None
        if has_grid and (img.get("event_type") or "") != "video_diffusion":
            out.append(img)
    return len(arr), out


def parse_time(s):
    """Like JS new Date(s): offset/Z honoured, no offset = local (ET) time."""
    if not isinstance(s, str) or not s:
        return None
    t = s.strip().replace(" ", "T", 1)
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    # Python < 3.11 wants 0, 3 or 6 fractional digits.
    if "." in t:
        head, rest = t.split(".", 1)
        i = 0
        while i < len(rest) and rest[i].isdigit():
            i += 1
        frac = (rest[:i] + "000000")[:6]
        t = f"{head}.{frac}{rest[i:]}"
    try:
        dt = datetime.fromisoformat(t)
    except ValueError:
        return None
    return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt.astimezone(TZ)


def label(dt):
    return f"{dt.strftime('%B')} {dt.day}"


def groups(images, n=3):
    timed = [(parse_time(i.get("enqueue_time")), i) for i in images]
    bad = sum(1 for t, _ in timed if t is None)
    timed = sorted((p for p in timed if p[0] is not None), key=lambda p: p[0])
    if not timed:
        return [], bad
    size = math.ceil(len(timed) / n)
    out = []
    for g in range(n):
        chunk = timed[g * size:(g + 1) * size]
        if chunk:
            out.append({"group": g + 1, "images": len(chunk),
                        "from": label(chunk[0][0]), "to": label(chunk[-1][0])})
    return out, bad


def extract(zpath, dest, depth=0):
    """Extract .json members (flattened, no paths) and recurse into inner zips."""
    found = []
    with zipfile.ZipFile(zpath) as z:
        for m in z.infolist():
            name = os.path.basename(m.filename)
            if m.is_dir() or not name or name.startswith(("._", ".")) or "__MACOSX" in m.filename:
                continue
            low = name.lower()
            if not (low.endswith(".json") or (low.endswith(".zip") and depth < 2)):
                continue
            target = os.path.join(dest, name)
            stem, ext = os.path.splitext(target)
            k = 1
            while os.path.exists(target):
                target = f"{stem}-{k}{ext}"
                k += 1
            with z.open(m) as src, open(target, "wb") as dst:
                dst.write(src.read())
            if low.endswith(".zip"):
                inner = tempfile.mkdtemp(dir=dest)
                found += [(f"{os.path.basename(zpath)} > {o}", p) for o, p in extract(target, inner, depth + 1)]
            else:
                found.append((f"{os.path.basename(zpath)} > {name}", target))
    return found


def main(paths):
    if not paths:
        sys.exit(__doc__)
    tmp = tempfile.mkdtemp(prefix="mj-kickoff-")
    jsons = []
    for p in paths:
        p = os.path.expanduser(p)
        if not os.path.isfile(p):
            jsons.append((p, None))
        elif p.lower().endswith(".zip"):
            jsons += extract(p, tempfile.mkdtemp(dir=tmp))
        else:
            jsons.append((os.path.basename(p), p))

    files = []
    for origin, path in jsons:
        if path is None:
            files.append({"source": origin, "error": "not found"})
            continue
        try:
            with open(path, encoding="utf-8") as f:
                raw = f.read()
            entries, imgs = parse_issue_json(raw)
        except Exception as e:  # report and carry on with the other files
            files.append({"source": origin, "path": path, "error": f"not Oscar JSON: {e}"})
            continue
        times = sorted(t for t in (parse_time(i.get("enqueue_time")) for i in imgs) if t)
        g, bad = groups(imgs)
        name = os.path.basename(path).lower()
        files.append({
            "source": origin,
            "path": path,
            "role": "daily theme" if "daily" in name else ("main" if "whole_month" in name else "unclear"),
            "mb": round(os.path.getsize(path) / 1e6, 1),
            "entries": entries,
            "images": len(imgs),
            "first": times[0].strftime("%Y-%m-%d") if times else None,
            "last": times[-1].strftime("%Y-%m-%d") if times else None,
            "groups": g,
            "no_enqueue_time": bad,
        })
    print(json.dumps({"tmpdir": tmp, "files": files}, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
