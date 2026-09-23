// ───────────────────────────────────────────────────────────────
// sync_qr_scale.jsx
// Copies the QR images' scale and position-within-frame from one open
// document to the other, matching each QR by its linked file name.
// Use after hand-scaling the QR codes in one edition so the other
// edition matches exactly. Frames and groups are not touched — only the
// placed image inside each frame moves/scales.
//
// Set $.global.OSCAR_QRSYNC = { from, to, quiet } (document names).
// Defaults to KOPA → HH for the issue of the active document (MJ_<N>.indd
// or "MJ_<N> KOPA.indd"; both must be open). One undoable action.
// ───────────────────────────────────────────────────────────────

#target indesign

function syncQrScale() {
    var preset = $.global.OSCAR_QRSYNC || {};
    // issue number from the active document's name, so nothing is edited per issue
    var issueNo = null;
    if (app.documents.length) {
        var m = String(app.activeDocument.name).match(/^MJ_(\d+)/);
        if (m) issueNo = m[1];
    }
    if (!(preset.from && preset.to) && !issueNo) {
        alert("Make MJ_<N>.indd or \"MJ_<N> KOPA.indd\" the active document first."); return;
    }
    var FROM  = preset.from || ("MJ_" + issueNo + " KOPA.indd");
    var TO    = preset.to   || ("MJ_" + issueNo + ".indd");
    var quiet = preset.quiet === true;
    var QR_LABEL = "oscar_qr";

    var src = app.documents.itemByName(FROM), dst = app.documents.itemByName(TO);
    if (!src.isValid) { alert(FROM + " is not open."); return; }
    if (!dst.isValid) { alert(TO + " is not open."); return; }

    function setUnits(doc) {
        var s = { h: doc.viewPreferences.horizontalMeasurementUnits,
                  v: doc.viewPreferences.verticalMeasurementUnits,
                  r: doc.viewPreferences.rulerOrigin };
        doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
        doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
        doc.viewPreferences.rulerOrigin                = RulerOrigin.SPREAD_ORIGIN;
        return s;
    }
    function restore(doc, s) {
        doc.viewPreferences.horizontalMeasurementUnits = s.h;
        doc.viewPreferences.verticalMeasurementUnits   = s.v;
        doc.viewPreferences.rulerOrigin                = s.r;
    }
    // every QR graphic in a doc, keyed by its link name
    function collect(doc) {
        var map = {}, groups = doc.groups.everyItem().getElements();
        for (var g = 0; g < groups.length; g++) {
            if (groups[g].label !== QR_LABEL || !groups[g].parentPage) continue;
            var gfx = groups[g].allGraphics;
            for (var i = 0; i < gfx.length; i++) {
                var lk = gfx[i].itemLink;
                if (!lk) continue;
                map[lk.name] = { gfx: gfx[i], frame: gfx[i].parent, page: groups[g].parentPage.name };
            }
        }
        return map;
    }

    var ss = setUnits(src), ds = setUnits(dst);
    var from = collect(src), to = collect(dst);
    var done = 0, notes = [], missing = [];

    for (var name in from) {
        if (!to[name]) { missing.push(name + " (not in " + TO + ")"); continue; }
        var sf = from[name].frame.geometricBounds, sg = from[name].gfx.geometricBounds;
        // image offsets relative to its own frame
        var dT = sg[0]-sf[0], dL = sg[1]-sf[1], dB = sg[2]-sf[2], dR = sg[3]-sf[3];
        var tf = to[name].frame.geometricBounds;
        to[name].gfx.geometricBounds = [tf[0]+dT, tf[1]+dL, tf[2]+dB, tf[3]+dR];
        notes.push("  " + name + " pg" + to[name].page +
                   ": scale " + to[name].gfx.horizontalScale.toFixed(2) +
                   " (source " + from[name].gfx.horizontalScale.toFixed(2) + ")");
        done++;
    }
    for (var n2 in to) if (!from[n2]) missing.push(n2 + " (not in " + FROM + ")");

    restore(src, ss); restore(dst, ds);
    var msg = "Synced " + done + " QR image(s): " + FROM + " → " + TO + "\n" + notes.join("\n");
    if (missing.length) msg += "\n\nUnmatched:\n  " + missing.join("\n  ");
    if (quiet) return msg;
    alert(msg);
}

var __result = app.doScript(syncQrScale, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Sync QR Scale");
__result;
