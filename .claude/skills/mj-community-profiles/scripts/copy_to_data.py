#!/usr/bin/env python3
"""Approved edited-copy Markdown -> layout data JSON for build_layout.py.

    copy_to_data.py "<Issue NN>/MJNN profiles - edited copy.md" out.json [--images "<Issue NN>/Community Profiles"]

Reads each "## Name" section (header line "**City** · **Occupation**", then
"**N. Question**" blocks), drops ~~struck~~ text and **[FLAG: …]** notes,
splits answers into paragraphs, prints the questions in their short form and
turns straight quotes into curly ones. With --images, each person's `slots`
(two wide images for the template's image frames) and `extra` (the rest, for
the pasteboard) are chosen from <images>/<Name>/HH Links by orientation;
edit them in the JSON if Daniel wants a different pick.
"""
import re, json, sys, os

QTEXT = {
 1: "Tell us about a project where Midjourney did something you couldn’t have gotten any other way. What did you do?",
 2: "What’s your favorite key word to include in prompts?",
 3: "What’s your favorite Midjourney feature that you use constantly? What do you use it for?",
 4: "Show us one prompt at three stages: where it started, the version that almost worked, and the final. What was wrong with the almost?",
 5: "Describe the prompt for one of the images you uploaded. What was the process of tweaking and developing it to get to the final piece?",
 6: "How has Midjourney impacted your daily workflow?",
 7: "Is there an image you’ve been chasing for a long time (or have an idea for) but you can’t nail your vision? What’s in the way?",
 8: "Walk us through a typical creative session from idea to final image.",
 9: "What’s a tic you’ve trained yourself to edit out or avoid? How do you elevate beyond this?",
 10: "What do you spend time looking at that has nothing to do with image-making? What’s leaked into the work from it?",
}

def curly(t):
    t = re.sub(r"(\w)'(\w)", "\\1’\\2", t)
    t = re.sub(r"(^|[\s(\[—])'", "\\1‘", t)
    t = t.replace("'", "’")
    t = re.sub(r'(^|[\s(\[—])"', '\\1“', t)
    return t.replace('"', '”')

def main():
    args = sys.argv[1:]
    images = None
    if "--images" in args:
        i = args.index("--images"); images = args[i + 1]; del args[i:i + 2]
    md_path, out = args
    md = open(md_path, encoding="utf-8").read()
    people = []
    for block in re.split(r"\n## ", md)[1:]:
        name = block.split("\n", 1)[0].strip()
        city, occ = re.search(r"\*\*(.+?)\*\* · \*\*(.+?)\*\*", block).groups()
        qa = []
        for m in re.finditer(r"\*\*(\d+)\. [^\n]*\*\*\n\n(.*?)(?=\n\*\*\d+\. |\n---|\Z)", block, re.S):
            t = re.sub(r"~~.*?~~", "", m.group(2), flags=re.S)
            t = re.sub(r"\s*\*\*\[FLAG:.*?\]\*\*", "", t, flags=re.S)
            paras = [re.sub(r"[ \t]+", " ", p).strip() for p in re.split(r"\n\s*\n", t)]
            paras = [re.sub(r" +([.,;:])", r"\1", p) for p in paras if p]
            qa.append([QTEXT[int(m.group(1))], [curly(p) for p in paras]])
        first, _, last = name.partition(" ")
        p = dict(name=name, nameLines=[first, last] if last else [first], city=city, occ=occ, folder=name, qa=qa)
        if images:
            from PIL import Image; Image.MAX_IMAGE_PIXELS = None
            hh = os.path.join(images, name, "HH Links")
            if os.path.isdir(hh):
                files = sorted(f for f in os.listdir(hh) if f.lower().endswith(".jpg"))
                wide = [f for f in files if (lambda s: s[0] >= s[1])(Image.open(os.path.join(hh, f)).size)]
                tall = [f for f in files if f not in wide]
                slots = (wide + tall)[:2]
                p["slots"] = [os.path.splitext(f)[0] for f in slots]
                p["extra"] = [os.path.splitext(f)[0] for f in files if f not in slots]
        people.append(p)
    json.dump(people, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for p in people:
        print(p["name"], len(p["qa"]), "answers", sum(len(" ".join(x[1]).split()) for x in p["qa"]), "words",
              "slots", p.get("slots"), "extra", p.get("extra"))

if __name__ == "__main__":
    main()
