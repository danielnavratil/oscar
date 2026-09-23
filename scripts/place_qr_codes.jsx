// ───────────────────────────────────────────────────────────────
// place_qr_codes.jsx
// Creates, links and places QR codes under the prompts whose images used
// image references. Nothing is edited per issue: the QR folder is
// <doc folder>/QR Codes and the list of prompts that get one comes from the
// pairs JSON in the same folder (every image with hasImageRefs →
// qr_pair<N>_<L|R>.png encoding the image's Midjourney job link).
// place_oscar_pairs.jsx runs this automatically after placing and ragging;
// run it by hand to redo the QR codes on an already-placed document.
//
// Creating: the PNGs are made with Python's qrcode library (medium error
// correction, 1800 px, 4-module quiet zone, grayscale — same as Issue 42),
// called through a shell. A file is only rewritten when it is missing or its
// link changed (QR Codes/.qr_manifest.json remembers what each one encodes).
// Needs `pip3 install qrcode pillow` for /usr/local/bin/python3 or similar.
//
// For each entry it then:
//   1. finds the prompt text frame by the image id placement stored on it
//      (older docs without that tag: by the username on its first line),
//   2. duplicates the template group (the group on the pasteboard whose
//      image is linked to editwhizkid_.png),
//   3. sits the copy flush under that prompt frame, left edges aligned
//      (no gap — matches Issue 41),
//   4. relinks the placeholder image to the QR png, fit proportionally.
//
// Geometry, per page: a prompt's "unit" is its frame height plus the QR
// group height when it gets one. The page's prompts share one top edge at
// (bottom margin − tallest unit), so the tops stay aligned, nothing crosses
// the bottom margin, and the tallest unit lands exactly on it. A QR under
// the shorter prompt of a pair therefore floats above the margin — its
// partner is what touches it.
//
// Re-running is safe: previously placed QR groups (label "oscar_qr") are
// removed first, and the layout math is idempotent.
//
// Run on the already-placed, already-ragged document (saved inside its issue
// folder next to oscar-<N>-pairs.json). One undoable action.
// Set $.global.OSCAR_QR_PRESET = { docName, jsonPath, qrFolder, quiet } to
// run non-interactively / override the auto-detected paths; with quiet the
// report (and any reason it stopped) is returned instead of alerted.
// ───────────────────────────────────────────────────────────────

#target indesign

function placeQrCodes() {
    var TEMPLATE_LINK = "editwhizkid_.png";
    var PROMPT_LABEL  = "oscar_prompt";
    var QR_LABEL      = "oscar_qr";

    var preset = $.global.OSCAR_QR_PRESET || {};
    var quiet  = preset.quiet === true;
    function stop(m) { if (!quiet) alert(m); return m; }

    if (app.documents.length === 0) return stop("Open the placed document first.");
    var doc = app.activeDocument;
    if (preset.docName) {
        var named = app.documents.itemByName(preset.docName);
        if (!named.isValid) return stop(preset.docName + " is not open.");
        doc = named;
    }

    // ── ISSUE FOLDER: everything is relative to where the doc is saved ──
    var issueFolder = null;
    try { issueFolder = doc.saved ? doc.filePath : null; } catch (e0) {}
    if (!issueFolder && !(preset.jsonPath && preset.qrFolder)) {
        return stop("Save the document inside its issue folder first (next to oscar-<N>-pairs.json), then run place_qr_codes.jsx.");
    }

    var QR_FOLDER = preset.qrFolder || (issueFolder.fsName + "/QR Codes");

    var jsonFile = null;
    if (preset.jsonPath) jsonFile = new File(preset.jsonPath);
    else {
        var cands = issueFolder.getFiles(function (f) { return f instanceof File && /^oscar-.*pairs.*\.json$/i.test(f.name); });
        if (cands.length === 1) jsonFile = cands[0];
        else jsonFile = File.openDialog(cands.length ? "Several pairs JSONs here — pick one" : "Pairs JSON not found in " + issueFolder.fsName + " — select it", "*.json");
    }
    if (!jsonFile || !jsonFile.exists) return stop("Pairs JSON not found.");
    jsonFile.encoding = "UTF-8";
    jsonFile.open("r"); var jsonText = jsonFile.read(); jsonFile.close();
    var pairs;
    // ExtendScript lacks JSON.parse; eval is safe here (our own export).
    try { pairs = eval("(" + jsonText + ")"); }
    catch (e1) { return stop("Could not parse " + jsonFile.name + ":\n" + e1.message); }

    // every image with references → its QR file and what it encodes
    var entries = [];
    for (var pi = 0; pi < pairs.length; pi++) {
        var sides = [pairs[pi].imageA, pairs[pi].imageB];
        for (var si = 0; si < sides.length; si++) {
            var im = sides[si];
            if (!im || !im.hasImageRefs) continue;
            entries.push({
                id:   im.id,
                user: String(im.username || "").replace(/^@+/, ""),
                url:  im.mjUrl || ("https://www.midjourney.com/jobs/" + im.id + "?index=0"),
                file: "qr_pair" + pairs[pi].pair + "_" + (im.side || (si ? "R" : "L")) + ".png"
            });
        }
    }
    if (!entries.length) return stop("No images in " + jsonFile.name + " have image references — nothing to place.");

    // ── CREATE the QR PNGs (Python qrcode via the shell) ───────
    function writeText(path, text) {
        var f = new File(path); f.encoding = "UTF-8"; f.lineFeed = "Unix";
        if (!f.open("w")) throw new Error("cannot write " + path);
        f.write(text); f.close();
    }
    function makeQrPngs() {
        // InDesign's scripting can't write to /tmp on this Mac; its own temp folder works
        var work = new Folder(Folder.temp.fsName + "/oscar_qr");
        if (!work.exists) work.create();
        var W = work.fsName;
        if (/['"\\]/.test(W)) throw new Error("unusable temp folder path: " + W);
        var PY = [
            "import sys, os, json",
            "import qrcode",
            "from qrcode.constants import ERROR_CORRECT_M",
            "lines = open(sys.argv[1], encoding='utf-8').read().split('\\n')",
            "folder = lines[0]",
            "os.makedirs(folder, exist_ok=True)",
            "man_path = os.path.join(folder, '.qr_manifest.json')",
            "try:",
            "    man = json.load(open(man_path))",
            "except Exception:",
            "    man = {}",
            "made = kept = 0",
            "for line in lines[1:]:",
            "    if not line: continue",
            "    name, url = line.split('\\t', 1)",
            "    path = os.path.join(folder, name)",
            "    if os.path.exists(path) and man.get(name) == url:",
            "        kept += 1; continue",
            "    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=40, border=4)",
            "    qr.add_data(url); qr.make(fit=True)",
            "    qr.make_image(fill_color='black', back_color='white').convert('L').save(path)",
            "    man[name] = url; made += 1",
            "json.dump(man, open(man_path, 'w'), indent=1)",
            "print('OK %d %d' % (made, kept))"
        ].join("\n") + "\n";
        // first python3 that has qrcode + Pillow wins; the shell's PATH is minimal
        var SH = [
            "for p in /usr/local/bin/python3 /opt/homebrew/bin/python3 /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /usr/bin/python3; do",
            "  if [ -x \"$p\" ] && \"$p\" -c 'import qrcode, PIL' 2>/dev/null; then",
            "    exec \"$p\" \"$1/make_qr.py\" \"$1/jobs.txt\"",
            "  fi",
            "done",
            "echo NO_QRCODE"
        ].join("\n") + "\n";
        var jobs = [QR_FOLDER];
        for (var j = 0; j < entries.length; j++) jobs.push(entries[j].file + "\t" + entries[j].url);
        writeText(W + "/make_qr.py", PY);
        writeText(W + "/run.sh", SH);
        writeText(W + "/jobs.txt", jobs.join("\n") + "\n");
        var out = String(app.doScript("do shell script \"/bin/bash '" + W + "/run.sh' '" + W + "' 2>&1\"", ScriptLanguage.APPLESCRIPT_LANGUAGE));
        var m = out.match(/OK (\d+) (\d+)/);
        if (m) return { ok: true, made: +m[1], kept: +m[2] };
        if (/NO_QRCODE/.test(out)) return { ok: false, why: "no python3 with the qrcode library (run: pip3 install qrcode pillow)" };
        return { ok: false, why: out };
    }
    var made = null, makeErr = null;
    try {
        var r = makeQrPngs();
        if (r.ok) made = r; else makeErr = r.why;
    } catch (eMk) { makeErr = eMk.message; }

    // ── UNITS: spread-relative inches ──────────────────────────
    // Spread origin, not page origin: a freshly duplicated group and a prompt
    // frame only share one coordinate space per spread. With PAGE_ORIGIN the
    // delta below is short by a page width for right-hand pages, which throws
    // the QR onto the facing page.
    var saved = {
        h: doc.viewPreferences.horizontalMeasurementUnits,
        v: doc.viewPreferences.verticalMeasurementUnits,
        r: doc.viewPreferences.rulerOrigin
    };
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin                = RulerOrigin.SPREAD_ORIGIN;
    function restoreUnits() {
        doc.viewPreferences.horizontalMeasurementUnits = saved.h;
        doc.viewPreferences.verticalMeasurementUnits   = saved.v;
        doc.viewPreferences.rulerOrigin                = saved.r;
    }

    // ── TEMPLATE GROUP (holds the editwhizkid_.png placeholder) ─
    var tmpl = null, groups = doc.groups.everyItem().getElements();
    for (var g = 0; g < groups.length && !tmpl; g++) {
        if (groups[g].label === QR_LABEL) continue;
        var gfx = groups[g].allGraphics;
        for (var i = 0; i < gfx.length; i++) {
            var lk = gfx[i].itemLink;
            if (lk && lk.name === TEMPLATE_LINK) { tmpl = groups[g]; break; }
        }
    }
    if (!tmpl) {
        restoreUnits();
        return stop("Template group not found — no group is linked to " + TEMPLATE_LINK + " (it lives on the pasteboard).");
    }
    var tb = tmpl.geometricBounds;
    var QR_H = tb[2] - tb[0];

    // ── CLEAR PREVIOUS RUN ─────────────────────────────────────
    var removed = 0;
    for (var r = groups.length - 1; r >= 0; r--) {
        if (groups[r].label === QR_LABEL) { groups[r].remove(); removed++; }
    }

    // ── COLLECT PROMPT FRAMES BY PAGE ──────────────────────────
    // Match by the image id placement stored on the frame; untagged frames
    // (docs placed before the tag existed) fall back to the username line,
    // but only for usernames that appear once among the QR entries.
    var byId = {}, byUser = {}, userCount = {}, errors = [];
    for (var e = 0; e < entries.length; e++) userCount[entries[e].user] = (userCount[entries[e].user] || 0) + 1;
    for (e = 0; e < entries.length; e++) {
        var qf = new File(QR_FOLDER + "/" + entries[e].file);
        if (!qf.exists) { errors.push(entries[e].file + " (" + entries[e].user + "): png missing on disk"); continue; }
        var w = { entry: entries[e], file: qf };
        byId[entries[e].id] = w;
        if (userCount[entries[e].user] === 1) byUser[entries[e].user] = w;
    }

    var byPage = {}, order = [], found = {};
    var all = doc.textFrames.everyItem().getElements();
    for (var a = 0; a < all.length; a++) {
        var tf = all[a];
        if (tf.label !== PROMPT_LABEL || !tf.parentPage) continue;
        var fid = "";
        try { fid = tf.extractLabel("oscar_image_id"); } catch (errL) {}
        var first = "";
        try { first = String(tf.paragraphs.item(0).contents).replace(/[\r\n]+$/, ""); } catch (err) {}
        var hit = fid ? (byId[fid] || null) : (byUser[first] || null);
        var pid = tf.parentPage.id;
        if (!byPage[pid]) { byPage[pid] = []; order.push(pid); }
        byPage[pid].push({ tf: tf, user: first, qr: hit ? hit.file : null });
        if (hit) found[hit.entry.id] = true;
    }
    for (var u in byId) if (!found[u]) errors.push(byId[u].entry.file + " (" + byId[u].entry.user + "): prompt frame not found in this document");

    // ── LAYOUT + PLACE ─────────────────────────────────────────
    var placed = 0, movedPages = [], floats = [];
    for (var o = 0; o < order.length; o++) {
        var grp = byPage[order[o]];
        var hasAny = false;
        for (var k = 0; k < grp.length; k++) if (grp[k].qr) hasAny = true;
        if (!hasAny) continue;

        var page  = grp[0].tf.parentPage;
        var limit = page.bounds[2] - page.marginPreferences.bottom;

        // tallest unit on the page sets the shared top edge
        var maxUnit = 0, curTop = null;
        for (k = 0; k < grp.length; k++) {
            var b = grp[k].tf.geometricBounds;
            var unit = (b[2] - b[0]) + (grp[k].qr ? QR_H : 0);
            if (unit > maxUnit) maxUnit = unit;
            if (curTop === null || b[0] < curTop) curTop = b[0];
        }
        var wantTop = limit - maxUnit;
        var dy = wantTop - curTop;
        if (Math.abs(dy) > 0.0005) {
            for (k = 0; k < grp.length; k++) grp[k].tf.move(undefined, [0, dy]);
            movedPages.push(page.name + " (" + (dy < 0 ? "up " : "down ") + Math.abs(dy).toFixed(3) + '")');
        }

        // QR flush under its own prompt, left edges aligned
        for (k = 0; k < grp.length; k++) {
            if (!grp[k].qr) continue;
            try {
                var dup = tmpl.duplicate(page);
                dup.label = QR_LABEL;
                var relinked = false, dgfx = dup.allGraphics;
                for (var i2 = 0; i2 < dgfx.length; i2++) {
                    var dlk = dgfx[i2].itemLink;
                    if (dlk && dlk.name === TEMPLATE_LINK) {
                        var frame = dgfx[i2].parent;
                        dlk.relink(grp[k].qr);
                        try { dlk.update(); } catch (er) {}
                        frame.fit(FitOptions.PROPORTIONALLY);
                        relinked = true;
                        break;
                    }
                }
                if (!relinked) { dup.remove(); errors.push(grp[k].user + ": placeholder not found in copy"); continue; }

                var pb = grp[k].tf.geometricBounds;
                var db = dup.geometricBounds;
                dup.move(undefined, [pb[1] - db[1], pb[2] - db[0]]);

                var gapBelow = limit - dup.geometricBounds[2];
                if (gapBelow > 0.005) floats.push(grp[k].user + " pg" + page.name + " " + gapBelow.toFixed(2) + '" above margin');
                placed++;
            } catch (err2) {
                errors.push(grp[k].user + ": " + err2.message);
            }
        }
    }

    restoreUnits();
    var msg = "Placed " + placed + "/" + entries.length + " QR codes from " + jsonFile.name + ".";
    if (made)    msg += "\nQR PNGs in " + QR_FOLDER + ": " + made.made + " created, " + made.kept + " already up to date.";
    if (makeErr) msg += "\nCould not create QR PNGs: " + makeErr;
    if (removed)          msg += "\nRemoved " + removed + " QR group(s) from a previous run.";
    if (movedPages.length) msg += "\n\nPages re-seated (" + movedPages.length + "): " + movedPages.join(", ");
    if (floats.length)    msg += "\n\nQR above the bottom margin (partner prompt is the flush one):\n  " + floats.join("\n  ");
    if (errors.length)    msg += "\n\nSkipped:\n  " + errors.join("\n  ");
    if (quiet) return msg;
    alert(msg);
}

var __result = app.doScript(placeQrCodes, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Place QR Codes");
__result;
