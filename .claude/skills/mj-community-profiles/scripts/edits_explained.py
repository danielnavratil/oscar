#!/usr/bin/env python3
"""Side-by-side "what I changed and why" page for the profile copy edits.

    edits_explained.py --csv submissions.csv --md "MJNN profiles - edited copy.md" \
        --out "MJNN profiles - edits explained.html" [--last 3] [--notes notes.json]

Shows every submitted answer with word-level changes (red removed, green added;
~~struck~~ cuts in the Markdown count as removals, [FLAG] notes are dropped) and,
under each answer, the reasons from notes.json:
    {"Vigo Zhao|5": ["Cut: … repeats Q1", "…"], "DVK|6": ["…"]}
People are matched between the CSV ("First name" + "Last name") and the
Markdown "## Name" headings by their first word, case-insensitively.
"""
import csv, re, html, difflib, sys, json

def arg(k, d=None):
    a = sys.argv
    return a[a.index(k) + 1] if k in a else d

CSV, MD, OUT = arg("--csv"), arg("--md"), arg("--out")
LAST, NOTES = int(arg("--last", 3)), json.load(open(arg("--notes"))) if arg("--notes") else {}

rows = sorted(csv.DictReader(open(CSV, encoding="utf-8-sig")), key=lambda r: r["Submitted at"])[-LAST:]
cols = list(rows[0].keys())
qcols = [c for c in cols if re.match(r"\d+\. ", c)]
city_c = next(c for c in cols if "city" in c.lower())
occ_c = next(c for c in cols if "occupation" in c.lower())
key = lambda s: s.strip().split()[0].lower()
orig = {key(r["First name"]): r for r in rows}

md = open(MD, encoding="utf-8").read()
people = []
for block in re.split(r"\n## ", md)[1:]:
    name = block.split("\n", 1)[0].strip()
    hdr = re.search(r"\*\*(.+?)\*\* · \*\*(.+?)\*\*", block).groups()
    qs = {int(m.group(1)): m.group(2).strip() for m in
          re.finditer(r"\*\*(\d+)\. [^\n]*\*\*\n\n(.*?)(?=\n\*\*\d+\. |\n---|\Z)", block, re.S)}
    people.append((name, hdr, qs))

def render(o, e):
    e = re.sub(r"\s*\*\*\[FLAG:.*?\]\*\*", "", e, flags=re.S)
    e = re.sub(r"~~(.*?)~~", "", e, flags=re.S)
    ow, ew = re.findall(r"\S+|\n+", o), re.findall(r"\S+|\n+", e)
    j = lambda ws: " ".join("<br><br>" if "\n" in w else html.escape(w) for w in ws).replace(" <br><br> ", "<br><br>")
    out = []
    for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, ow, ew, autojunk=False).get_opcodes():
        if op == "equal": out.append(j(ow[a1:a2]))
        if op in ("delete", "replace"): out.append("<del>" + j(ow[a1:a2]) + "</del>")
        if op in ("insert", "replace"): out.append("<ins>" + j(ew[b1:b2]) + "</ins>")
    return " ".join(out)

parts = []
for name, hdr, qs in people:
    r = orig.get(key(name))
    if not r: parts.append(f"<p>No submission matched {html.escape(name)}.</p>"); continue
    parts.append(f"<section><h2>{html.escape(name)}</h2><p class='hdr'><b>Submitted:</b> "
                 f"{html.escape(r['First name'] + ' ' + r['Last name'])} · {html.escape(r[city_c])} · {html.escape(r[occ_c])}"
                 f"<br><b>Printed as:</b> {html.escape(name)} · {html.escape(' · '.join(hdr))}</p>")
    blank = []
    for i, c in enumerate(qcols, 1):
        if not r[c].strip(): blank.append(str(i)); continue
        parts.append(f"<div class='qa'><h3>{html.escape(c)}</h3><div class='diff'>{render(r[c].strip(), qs.get(i, ''))}</div>")
        notes = NOTES.get(f"{name}|{i}", [])
        if notes: parts.append("<ul class='why'>" + "".join(f"<li>{html.escape(n)}</li>" for n in notes) + "</ul>")
        parts.append("</div>")
    if blank: parts.append(f"<p class='skip'>Left blank: Q{', Q'.join(blank)}</p>")
    parts.append("</section>")

css = """:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--del:#fde2e1;--delfg:#a3231d;--ins:#dcf3e2;--insfg:#17663a;--rule:#e5e5e5;--card:#fafafa}
@media (prefers-color-scheme:dark){:root{--bg:#151515;--fg:#eee;--mut:#aaa;--del:#4a1f1d;--delfg:#ffb3ad;--ins:#173b26;--insfg:#9fe3b7;--rule:#333;--card:#1d1d1d}}
body{background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,system-ui,sans-serif;max-width:860px;margin:0 auto;padding:24px 16px 80px}
h2{font-size:20px;margin:40px 0 6px;border-top:2px solid var(--fg);padding-top:14px}h3{font-size:14px;margin:0 0 8px;color:var(--mut)}
.hdr,.skip,.legend{color:var(--mut);font-size:13px}.qa{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:14px 16px;margin:14px 0}
del{background:var(--del);color:var(--delfg)}ins{background:var(--ins);color:var(--insfg);text-decoration:none}
.why{margin:10px 0 0;padding:8px 0 0 18px;font-size:13px;color:var(--mut);border-top:1px dashed var(--rule)}"""
open(OUT, "w", encoding="utf-8").write(
    f"<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    f"<title>Profile Edits</title><style>{css}</style></head><body><h1>Profile edits</h1>"
    f"<p class='legend'>Each answer as submitted, with edits marked: <del>removed</del> <ins>added</ins>. Notes say why.</p>"
    + "".join(parts) + "</body></html>")
print("wrote", OUT)
