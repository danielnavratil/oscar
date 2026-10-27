#!/usr/bin/env python3
"""Daily Theme channel analysis for the Midjourney magazine.

  daily_theme.py days  <jobs.json>               per-day table: images, users, top poster + share,
                                                  top words and word pairs (the theme falls out of these)
  daily_theme.py level <jobs.json> <themes.json> per-theme counts four ways, sorted by the capped count

<jobs.json>: the month's daily-theme export, a list of jobs with enqueue_time,
prompt, user_name (and id/parent_id; upscales repeat prompts, so counts are of
jobs, which is how earlier issues were compared).
<themes.json>: [{"name": "Digital penguin", "keyword": "penguin", "from": "09-17", "to": "09-22"}, ...]
  keyword is matched case-insensitively in the prompt (URLs removed); from/to are MM-DD, inclusive.

Leveled counts: raw; the heavy poster's share; without the heavy poster; every user
capped at CAP images per day; distinct users. The heavy poster is "Sly Fox" (two
accounts, "Sly Fox Dreams in Octarine" and "SlyFox Weatherwax ...": anything whose
name starts with "slyfox" ignoring spaces/punctuation). Override with --heavy <regex>.
"""
import json, re, sys, collections

STOP = set("a an the of in with and on to by at for from is as it its this that into style very".split())
CAP = 20

def body(p):
    p = re.sub(r"https?://\S+", "", p or "")
    p = re.sub(r"--\S+(\s+[^-\s][^\s]*)*", "", p)
    return p.lower()

def days(jobs):
    by = collections.defaultdict(list)
    for j in jobs: by[j["enqueue_time"][:10]].append(j)
    for day in sorted(by):
        js = by[day]; n = len(js)
        uni, bi = collections.Counter(), collections.Counter()
        users = collections.Counter(j["user_name"] for j in js)
        for j in js:
            t = re.findall(r"[a-z][a-z'\-]+", body(j["prompt"]))
            uni.update(set(w for w in t if w not in STOP))
            bi.update(set(f"{t[i]} {t[i+1]}" for i in range(len(t) - 1) if t[i] not in STOP and t[i+1] not in STOP))
        tu, tc = users.most_common(1)[0]
        print(f"{day} n={n:5d} users={len(users):3d} top={tu} {tc*100//n}% | "
              + " | ".join(f"{w} {c*100//n}%" for w, c in uni.most_common(5)) + " || "
              + " | ".join(f"{w} {c*100//n}%" for w, c in bi.most_common(3)))

def level(jobs, themes, heavy):
    rows = []
    for th in themes:
        hits = [j for j in jobs if th["from"] <= j["enqueue_time"][5:10] <= th["to"]
                and th["keyword"].lower() in re.sub(r"https?://\S+", "", j["prompt"] or "").lower()]
        n = len(hits) or 1
        h = sum(1 for j in hits if heavy(j["user_name"]))
        per = collections.Counter((j["user_name"], j["enqueue_time"][:10]) for j in hits)
        capped = sum(min(c, CAP) for c in per.values())
        users = len(set(j["user_name"] for j in hits))
        rows.append((capped, th["name"], th["from"], th["to"], len(hits), h * 100 // n, len(hits) - h, users))
    print(f"{'Theme':34s} {'Dates':13s} {'Raw':>6s} {'Heavy%':>7s} {'NoHeavy':>8s} {'Cap'+str(CAP):>7s} {'Users':>6s}")
    for capped, name, a, b, raw, hp, nh, users in sorted(rows, reverse=True):
        print(f"{name:34s} {a}–{b:7s} {raw:6d} {hp:6d}% {nh:8d} {capped:7d} {users:6d}")

def main():
    a = sys.argv[1:]
    rx = None
    if "--heavy" in a:
        i = a.index("--heavy"); rx = re.compile(a[i + 1], re.I); del a[i:i + 2]
    heavy = (lambda u: bool(rx.search(u))) if rx else (lambda u: re.sub(r"\W", "", u.lower()).startswith("slyfox"))
    jobs = json.load(open(a[1], encoding="utf-8"))
    if a[0] == "days": days(jobs)
    elif a[0] == "level": level(jobs, json.load(open(a[2])), heavy)
    else: sys.exit(__doc__)

if __name__ == "__main__":
    main()
