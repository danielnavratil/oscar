// ───────────────────────────────────────────────────────────────
// place_qr_codes.jsx
// Places QR codes under the prompts whose images used image references.
// Nothing is edited per issue: the QR folder is <doc folder>/QR Codes and the
// list of prompts that get one comes from the pairs JSON in the same folder
// (every image with hasImageRefs → qr_pair<N>_<L|R>.png, keyed by username).
// For each such entry it:
//   1. finds the prompt text frame by its username first line,
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
// run non-interactively / override the auto-detected paths.
// ───────────────────────────────────────────────────────────────

#target indesign

function placeQrCodes() {
    var TEMPLATE_LINK = "editwhizkid_.png";
    var PROMPT_LABEL  = "oscar_prompt";
    var QR_LABEL      = "oscar_qr";

    var preset = $.global.OSCAR_QR_PRESET || {};
    var quiet  = preset.quiet === true;

    if (app.documents.length === 0) { alert("Open the placed document first."); return; }
    var doc = app.activeDocument;
    if (preset.docName) {
        var named = app.documents.itemByName(preset.docName);
        if (!named.isValid) { alert(preset.docName + " is not open."); return; }
        doc = named;
    }

    // ── ISSUE FOLDER: everything is relative to where the doc is saved ──
    var issueFolder = null;
    try { issueFolder = doc.saved ? doc.filePath : null; } catch (e0) {}
    if (!issueFolder && !(preset.jsonPath && preset.qrFolder)) {
        alert("Save the document inside its issue folder first (next to oscar-<N>-pairs.json)."); return;
    }

    var QR_FOLDER = preset.qrFolder || (issueFolder.fsName + "/QR Codes");

    var jsonFile = null;
    if (preset.jsonPath) jsonFile = new File(preset.jsonPath);
    else {
        var cands = issueFolder.getFiles(function (f) { return f instanceof File && /^oscar-.*pairs.*\.json$/i.test(f.name); });
        if (cands.length === 1) jsonFile = cands[0];
        else jsonFile = File.openDialog(cands.length ? "Several pairs JSONs here — pick one" : "Pairs JSON not found in " + issueFolder.fsName + " — select it", "*.json");
    }
    if (!jsonFile || !jsonFile.exists) { alert("Pairs JSON not found."); return; }
    jsonFile.encoding = "UTF-8";
    jsonFile.open("r"); var jsonText = jsonFile.read(); jsonFile.close();
    var pairs;
    // ExtendScript lacks JSON.parse; eval is safe here (our own export).
    try { pairs = eval("(" + jsonText + ")"); }
    catch (e1) { alert("Could not parse " + jsonFile.name + ":\n" + e1.message); return; }

    // username (first line of the placed prompt frame) → QR file
    var entries = [];
    for (var pi = 0; pi < pairs.length; pi++) {
        var sides = [pairs[pi].imageA, pairs[pi].imageB];
        for (var si = 0; si < sides.length; si++) {
            var im = sides[si];
            if (!im || !im.hasImageRefs) continue;
            entries.push({ user: im.username, file: "qr_pair" + pairs[pi].pair + "_" + (im.side || (si ? "R" : "L")) + ".png" });
        }
    }
    if (!entries.length) { alert("No images in " + jsonFile.name + " have image references — nothing to place."); return; }

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
        alert("Template group not found — no group is linked to " + TEMPLATE_LINK);
        return;
    }
    var tb = tmpl.geometricBounds;
    var QR_H = tb[2] - tb[0];

    // ── CLEAR PREVIOUS RUN ─────────────────────────────────────
    var removed = 0;
    for (var r = groups.length - 1; r >= 0; r--) {
        if (groups[r].label === QR_LABEL) { groups[r].remove(); removed++; }
    }

    // ── COLLECT PROMPT FRAMES BY PAGE ──────────────────────────
    var wanted = {}, errors = [];
    for (var e = 0; e < entries.length; e++) {
        var qf = new File(QR_FOLDER + "/" + entries[e].file);
        if (!qf.exists) { errors.push(entries[e].file + ": png missing on disk"); continue; }
        wanted[entries[e].user] = qf;
    }

    var byPage = {}, order = [], found = {};
    var all = doc.textFrames.everyItem().getElements();
    for (var a = 0; a < all.length; a++) {
        var tf = all[a];
        if (tf.label !== PROMPT_LABEL || !tf.parentPage) continue;
        var first = "";
        try { first = String(tf.paragraphs.item(0).contents).replace(/[\r\n]+$/, ""); } catch (err) {}
        var pid = tf.parentPage.id;
        if (!byPage[pid]) { byPage[pid] = []; order.push(pid); }
        byPage[pid].push({ tf: tf, user: first, qr: wanted[first] || null });
        if (wanted[first]) found[first] = true;
    }
    for (var u in wanted) if (!found[u]) errors.push(u + ": prompt frame not found in this document");

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
