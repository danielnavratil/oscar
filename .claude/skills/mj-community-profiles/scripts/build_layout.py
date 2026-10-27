#!/usr/bin/env python3
"""Layout data JSON (copy_to_data.py) -> an InDesign script that builds the profiles.

    build_layout.py data.json out.jsx --doc MJ_44.indd --template-page 92 \
        --base "/Users/daniel/Documents/Creative/Asimov/Midjourney/Issue 44/Community Profiles/"

Template: the 2-page profile spread kept from the previous issue (left page:
"COMMUNITY PROFILE" + name frame, subtitle frame "City / Occupation", a text
column above a wide image frame; right page: a full-bleed wide image on top and
a text frame below). The first person reuses the template spread, the others get
duplicates after it. Per person: header filled, the two text frames threaded
into one story (left column stops 0.3" above its image), two-column
continuation spreads (template master) added while overset, empty trailing
frames removed (leaves a blank page for extra images), images placed (HH Links,
`slots` into the two frames, `extra` on the pasteboard), questions kept with the
next line. One undo step ("Community profiles"). Run the .jsx per
mj-indesign-basics; it returns a per-person page report.
"""
import json, sys

def main():
    a = sys.argv[1:]
    def opt(k, d=None):
        if k in a:
            i = a.index(k); v = a[i + 1]; del a[i:i + 2]; return v
        return d
    doc, tpl, base = opt("--doc"), opt("--template-page"), opt("--base")
    data_path, out = a
    people = json.load(open(data_path, encoding="utf-8"))
    for p in people:
        p.setdefault("slots", []); p.setdefault("extra", [])
    jsx = r'''
var DATA = %s, DOC = %s, TPL = %s, BASE = %s;
var d = app.documents.itemByName(DOC);
if (!d.isValid) throw new Error(DOC + " is not open");
var report = [];
function main() {
  var vp = d.viewPreferences, saved = [vp.horizontalMeasurementUnits, vp.verticalMeasurementUnits, vp.rulerOrigin];
  vp.horizontalMeasurementUnits = vp.verticalMeasurementUnits = MeasurementUnits.INCHES;
  vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
  try { build(); } finally { vp.horizontalMeasurementUnits = saved[0]; vp.verticalMeasurementUnits = saved[1]; vp.rulerOrigin = saved[2]; }
}
function build() {
  var T = null;
  for (var s = 0; s < d.spreads.length; s++) if (d.spreads[s].pages[0].name == TPL) T = d.spreads[s];
  if (!T) throw new Error("template spread (page " + TPL + ") not found");
  var ok = false; for (var k = 0; k < T.textFrames.length; k++) if (T.textFrames[k].contents.indexOf("COMMUNITY PROFILE") >= 0) ok = true;
  if (!ok) throw new Error("page " + TPL + " is not a profile spread");
  var spreads = [T], last = T;
  for (var i = 1; i < DATA.length; i++) { last = T.duplicate(LocationOptions.AFTER, last); spreads.push(last); }
  var master = T.pages[0].appliedMaster;
  var qStyle = d.paragraphStyles.itemByName("Interview Question"), bStyle = d.paragraphStyles.itemByName("Interview Body Text");
  for (var i = 0; i < DATA.length; i++) fill(spreads[i], DATA[i], master, qStyle, bStyle);
}
function roles(sp) {
  var r = {}, L = sp.pages[0], R = sp.pages[1];
  for (var k = 0; k < sp.textFrames.length; k++) {
    var t = sp.textFrames[k], c = t.parentStory.contents, b = t.geometricBounds;
    if (c.indexOf("COMMUNITY PROFILE") >= 0) r.name = t;
    else if (t.parentPage == L && b[1] < 1 && b[0] > 1.5 && b[0] < 2.5) r.sub = t;
    else if (t.parentPage == L) r.left = t;
    else if (t.parentPage == R) r.right = t;
  }
  for (var k = 0; k < sp.rectangles.length; k++) {
    var o = sp.rectangles[k], b = o.geometricBounds;
    if (o.parentPage == L && b[0] > 5 && b[2] > 9) r.imgL = o;
    if (o.parentPage == R && b[0] < 0 && b[2] > 5) r.imgR = o;
  }
  if (!r.name || !r.sub || !r.left || !r.right || !r.imgL || !r.imgR) throw new Error("template roles missing on spread " + sp.index + " — has the template changed?");
  return r;
}
function fill(sp, P, master, qStyle, bStyle) {
  var r = roles(sp);
  var np = r.name.parentStory.paragraphs; np[np.length - 1].contents = P.nameLines.join("\n");
  var sb = r.sub.parentStory.paragraphs; sb[1].contents = P.occ; sb[0].contents = P.city + "\r";
  r.right.parentStory.contents = ""; r.left.parentStory.contents = "";
  var lb = r.left.geometricBounds; r.left.geometricBounds = [lb[0], lb[1], r.imgL.geometricBounds[0] - 0.3, lb[3]];
  r.left.nextTextFrame = r.right;
  var paras = [], styles = [];
  for (var q = 0; q < P.qa.length; q++) {
    if (q > 0) { paras.push(""); styles.push(bStyle); }
    paras.push(P.qa[q][0]); styles.push(qStyle); paras.push(""); styles.push(qStyle);
    for (var a = 0; a < P.qa[q][1].length; a++) {
      if (a > 0) { paras.push(""); styles.push(bStyle); }
      paras.push(P.qa[q][1][a]); styles.push(bStyle);
    }
  }
  var story = r.left.parentStory;
  story.contents = paras.join("\r");
  var ps = story.paragraphs;
  for (var k = 0; k < ps.length; k++) { ps[k].applyParagraphStyle(styles[k], true); if (styles[k] == qStyle) ps[k].keepWithNext = 2; }
  var after = sp, lastFrame = r.right, added = 0;
  while (lastFrame.overflows && added < 3) {
    var ns = d.spreads.add(LocationOptions.AFTER, after); added++;
    while (ns.pages.length < 2) ns.pages.add(LocationOptions.AT_END, ns);
    for (var pg = 0; pg < ns.pages.length; pg++) {
      var page = ns.pages[pg]; page.appliedMaster = master;
      var xs = (pg == 0) ? [[0.6675, 3.9505], [4.1172, 7.4]] : [[0.975, 4.2583], [4.425, 7.7075]];
      for (var c = 0; c < 2; c++) {
        var f = page.textFrames.add({ geometricBounds: [0.73, xs[c][0], 10.145, xs[c][1]] });
        lastFrame.nextTextFrame = f; lastFrame = f;
      }
    }
    after = ns;
  }
  for (var f = lastFrame; f && f.characters.length == 0 && f.previousTextFrame; ) { var prev = f.previousTextFrame; f.remove(); f = prev; lastFrame = prev; }
  function file(n) { return File(BASE + P.folder + "/HH Links/" + n + ".jpg"); }
  function placeIn(rect, n) {
    if (!n) return; var fl = file(n);
    if (!fl.exists) { report.push("MISSING " + fl.fsName); return; }
    rect.place(fl); rect.fillColor = "None"; rect.fit(FitOptions.FILL_PROPORTIONALLY); rect.fit(FitOptions.CENTER_CONTENT);
  }
  placeIn(r.imgL, P.slots[0]); placeIn(r.imgR, P.slots[1]);
  d.viewPreferences.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
  for (var e = 0; e < P.extra.length; e++) {
    var rect = sp.rectangles.add({ geometricBounds: [e * 5.5, 17.5, e * 5.5 + 5, 21.5] }), fl = file(P.extra[e]);
    if (fl.exists) { rect.place(fl); rect.fit(FitOptions.PROPORTIONALLY); rect.fit(FitOptions.FRAME_TO_CONTENT); }
    rect.name = P.name + " extra " + P.extra[e];
  }
  d.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
  var pn = []; for (var x = sp.index; x <= after.index; x++) for (var y = 0; y < d.spreads[x].pages.length; y++) pn.push(d.spreads[x].pages[y].name);
  report.push(P.name + ": pages " + pn[0] + "-" + pn[pn.length - 1] + " (" + pn.length + "), overset=" + lastFrame.overflows);
}
var __u = app.scriptPreferences.measurementUnit;
app.scriptPreferences.measurementUnit = AutoEnum.AUTO_VALUE;
try { app.doScript(main, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "Community profiles"); }
finally { app.scriptPreferences.measurementUnit = __u; }
report.join("\n");
''' % (json.dumps(people, ensure_ascii=True), json.dumps(doc), json.dumps(tpl), json.dumps(base))
    open(out, "w").write(jsx)
    print("wrote", out)

if __name__ == "__main__":
    main()
