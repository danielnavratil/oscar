// ───────────────────────────────────────────────────────────────
// place_qr_codes.jsx
// Places QR codes for images whose prompts use image references.
// For each entry below it:
//   1. finds the prompt text frame by its username first line,
//   2. duplicates the template group (the frame group on the
//      pasteboard whose image is linked to editwhizkid_.png),
//   3. moves the copy directly below that prompt frame, left-aligned,
//   4. relinks the placeholder image to the QR png, fit proportionally.
//
// QR pngs live in <issue folder>/QR Codes/ (see QR_FOLDER).
// Run on the already-placed document. One undoable action.
// ───────────────────────────────────────────────────────────────

#target indesign

function placeQrCodes() {
    var QR_FOLDER     = "/Users/daniel/Documents/Creative/Asimov/Midjourney/Issue 41/QR Codes";
    var TEMPLATE_LINK = "editwhizkid_.png";

    // username (first line of the placed prompt frame) → QR file
    var entries = [
        { user: "a_kind_of",           file: "qr_pair11_L.png" },
        { user: "u5581228313",         file: "qr_pair12_R.png" },
        { user: "u1385538514",         file: "qr_pair13_R.png" },
        { user: "mellorush",           file: "qr_pair15_R.png" },
        { user: "u3385318828",         file: "qr_pair19_L.png" },
        { user: "tsigs.",              file: "qr_pair22_L.png" },
        { user: "grrrast",             file: "qr_pair22_R.png" },
        { user: "everythingsings.art", file: "qr_pair24_R.png" },
        { user: "Bomburi",             file: "qr_pair45_L.png" },
        { user: "pershinaa",           file: "qr_pair46_L.png" },
        { user: "lalaluna",            file: "qr_pair47_R.png" }
    ];

    if (app.documents.length === 0) {
        alert("Open the placed document first.");
        return;
    }
    var doc = app.activeDocument;

    // ── UNITS: inches, spread-relative so both pages share one space ──
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

    // ── FIND TEMPLATE GROUP (contains the editwhizkid_.png link) ──
    var tmpl = null;
    var groups = doc.groups;
    for (var g = 0; g < groups.length && !tmpl; g++) {
        var gfx = groups[g].allGraphics;
        for (var i = 0; i < gfx.length; i++) {
            var lk = gfx[i].itemLink;
            if (lk && lk.name === TEMPLATE_LINK) { tmpl = groups[g]; break; }
        }
    }
    if (!tmpl) {
        restoreUnits();
        alert("Template group not found — no group in the document has an image linked to " + TEMPLATE_LINK);
        return;
    }

    // ── FIND PROMPT FRAME BY USERNAME FIRST LINE ──────────────
    function findPromptFrame(user) {
        var tfs = doc.textFrames;
        for (var i = 0; i < tfs.length; i++) {
            try {
                var st = tfs[i].parentStory;
                if (st.paragraphs.length === 0) continue;
                var first = st.paragraphs[0].contents.replace(/[\r\n]+$/, "");
                if (first === user && tfs[i].parentPage !== null) return tfs[i];
            } catch (e) {}
        }
        return null;
    }

    // ── PLACE ─────────────────────────────────────────────────
    var placed = 0, errors = [];
    for (var e = 0; e < entries.length; e++) {
        var ent = entries[e];
        var qrFile = new File(QR_FOLDER + "/" + ent.file);
        if (!qrFile.exists) { errors.push(ent.file + ": png missing on disk"); continue; }

        var tf = findPromptFrame(ent.user);
        if (!tf) { errors.push(ent.user + ": prompt frame not found"); continue; }

        try {
            var dup = tmpl.duplicate(tf.parentPage);
            // top of group flush to prompt bottom, left edges aligned
            var pb = tf.geometricBounds;   // [top, left, bottom, right]
            var db = dup.visibleBounds;
            dup.move(undefined, [pb[1] - db[1], pb[2] - db[0]]);

            // relink placeholder → QR, fit proportionally
            var relinked = false;
            var dgfx = dup.allGraphics;
            for (var i2 = 0; i2 < dgfx.length; i2++) {
                var dlk = dgfx[i2].itemLink;
                if (dlk && dlk.name === TEMPLATE_LINK) {
                    var frame = dgfx[i2].parent;
                    dlk.relink(qrFile);
                    try { dlk.update(); } catch (er) {}
                    frame.fit(FitOptions.PROPORTIONALLY);
                    relinked = true;
                    break;
                }
            }
            if (!relinked) {
                dup.remove();
                errors.push(ent.user + ": placeholder image not found in duplicated group");
                continue;
            }

            // if the group crosses the bottom margin, bump prompt + QR up together
            // by just the overshoot (prompts moved by hand can sit high enough to fit)
            var page   = tf.parentPage;
            var limit  = page.bounds[2] - page.marginPreferences.bottom;
            var over   = dup.visibleBounds[2] - limit;
            if (over > 0) {
                tf.move(undefined, [0, -over]);
                dup.move(undefined, [0, -over]);
            }
            placed++;
        } catch (err) {
            errors.push(ent.user + ": " + err.message);
        }
    }

    restoreUnits();
    var msg = "Placed " + placed + "/" + entries.length + " QR codes.";
    if (errors.length) msg += "\n\nIssues:\n" + errors.join("\n");
    alert(msg);
}

app.doScript(placeQrCodes, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Place QR Codes");
