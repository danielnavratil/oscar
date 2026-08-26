// ───────────────────────────────────────────────────────────────
// snap_full_bleeds.jsx
// Finds placed full-bleed images that stop just short of covering the
// page — the sliver at the spine (portrait aspects) or the band above
// the bottom trim (4:5 etc.) — and snaps them to full bleed on all
// sides, refitting the image (fill proportionally, so the sliver is
// cropped instead of white). Shortfalls up to SNAP (1.5") are snapped;
// anything larger (9:16 …) is a deliberate partial and left alone.
// Only frames already touching the other three bleed/spine edges
// qualify, and only within the COB page range.
// Set $.global.OSCAR_SNAP_PRESET = { startOffset, endOffset, quiet }
// (0-based page offsets) to run non-interactively.
// ───────────────────────────────────────────────────────────────

#target indesign

function snapFullBleeds() {
    var PAGE_W = 8.375, PAGE_H = 10.875, BLEED = 0.125;
    var SNAP = 1.5, EDGE = 0.01;
    var TOP = -BLEED, BOT = PAGE_H + BLEED, OUT_L = -BLEED, OUT_R = PAGE_W + BLEED;

    if (app.documents.length === 0) { alert("Open the placed document first."); return; }
    var doc = app.activeDocument;
    var preset = $.global.OSCAR_SNAP_PRESET || {};
    var startOff = preset.startOffset != null ? preset.startOffset : 0;
    var endOff   = preset.endOffset   != null ? preset.endOffset   : doc.pages.length - 1;

    var saved = {
        h: doc.viewPreferences.horizontalMeasurementUnits,
        v: doc.viewPreferences.verticalMeasurementUnits,
        r: doc.viewPreferences.rulerOrigin
    };
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin                = RulerOrigin.PAGE_ORIGIN;

    var rects = doc.rectangles.everyItem().getElements();
    var fixed = 0, pages = [];
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var pg = r.parentPage;
        if (!pg || pg.documentOffset < startOff || pg.documentOffset > endOff) continue;
        if (r.allGraphics.length === 0) continue;
        var isLeft = pg.side === PageSideOptions.LEFT_HAND;
        var outer = isLeft ? OUT_L : OUT_R;
        var spine = isLeft ? PAGE_W : 0;
        var b = r.geometricBounds; // [top, left, bottom, right]
        var topOk    = Math.abs(b[0] - TOP) <= EDGE;
        var botOk    = Math.abs(b[2] - BOT) <= EDGE;
        var outerOk  = isLeft ? Math.abs(b[1] - outer) <= EDGE : Math.abs(b[3] - outer) <= EDGE;
        var spineCur = isLeft ? b[3] : b[1];
        var spineGap = isLeft ? spine - spineCur : spineCur - spine;
        var changed = false;
        if (topOk && botOk && outerOk && spineGap > 0.005 && spineGap <= SNAP) {
            // portrait sliver at the spine
            if (isLeft) b[3] = spine; else b[1] = spine;
            changed = true;
        } else if (topOk && outerOk && Math.abs(spineGap) <= EDGE &&
                   (BOT - b[2]) > 0.005 && (BOT - b[2]) <= SNAP) {
            // band above the bottom trim
            b[2] = BOT;
            changed = true;
        }
        if (changed) {
            r.geometricBounds = b;
            r.fit(FitOptions.FILL_PROPORTIONALLY);
            fixed++;
            pages.push(pg.name);
        }
    }

    doc.viewPreferences.horizontalMeasurementUnits = saved.h;
    doc.viewPreferences.verticalMeasurementUnits   = saved.v;
    doc.viewPreferences.rulerOrigin                = saved.r;

    var msg = "Snapped " + fixed + " full-bleed image(s).";
    if (pages.length) msg += "\npages:" + pages.join(",");
    if (preset.quiet) return msg;
    alert(msg);
}

var __result = app.doScript(snapFullBleeds, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Snap Full Bleeds");
__result;
