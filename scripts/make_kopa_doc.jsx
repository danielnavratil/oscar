// ───────────────────────────────────────────────────────────────
// make_kopa_doc.jsx
// Makes the KOPA (PSO) print version of the active document:
//   1. saves a copy next to it as "<name> KOPA.indd" (the open doc is not saved or changed),
//   2. opens the copy and runs swap_print_profile.jsx (same folder) toward KOPA,
//   3. swaps the Hemlock inside-back ad for "KOPA Inside Back*.jpg" from <issue>/Links/
//      (copy it in from the previous issue's Links folder first),
//   4. reports anything still linked to an HH file, then saves the copy.
// Works for the issue (MJ_NN.indd) and the posters (MJ NN Posters.indd).
// Optional preset: $.global.OSCAR_KOPA_PRESET = { docName, quiet }.
// ───────────────────────────────────────────────────────────────
#target indesign
(function () {
    var preset = $.global.OSCAR_KOPA_PRESET || {};
    var src = preset.docName ? app.documents.itemByName(preset.docName) : app.activeDocument;
    if (!src.isValid || !src.saved) { alert("Open and save the HH document first."); return; }
    var dir = src.filePath.fsName, base = src.name.replace(/\.indd$/i, "");
    var out = new File(dir + "/" + base + " KOPA.indd");
    if (out.exists) { alert(out.name + " already exists. Delete or rename it first."); return; }
    var report = [];
    src.saveACopy(out);
    var k = app.open(out, true);

    var swap = new File(File($.fileName).parent.fsName + "/swap_print_profile.jsx");
    $.global.OSCAR_SWAP_PRESET = { docName: k.name, toKopa: true, quiet: true };
    try { report.push(String($.evalFile(swap))); } finally { $.global.OSCAR_SWAP_PRESET = undefined; }

    var ads = Folder(dir + "/Links").getFiles("KOPA Inside Back*.jpg");
    var old = app.scriptPreferences.measurementUnit;
    app.scriptPreferences.measurementUnit = MeasurementUnits.INCHES;
    try {
        var L = k.links.everyItem().getElements();
        for (var i = 0; i < L.length; i++) if (/^Hemlock Inside Back/.test(L[i].name)) {
            if (!ads.length) { report.push("No KOPA Inside Back*.jpg in " + dir + "/Links — inside back is still the Hemlock ad."); break; }
            var g = L[i].parent, gb = g.geometricBounds;
            L[i].relink(ads[0]);
            k.links.everyItem().getElements()[i].parent.geometricBounds = gb;   // keep crop
            report.push("Inside back → " + ads[0].name);
        }
    } finally { app.scriptPreferences.measurementUnit = old; }

    var hh = [], bad = [];
    var L2 = k.links.everyItem().getElements();
    for (var j = 0; j < L2.length; j++) {
        if (/HH Links|_HH\.|Hemlock/.test(L2[j].filePath)) hh.push(L2[j].name);
        if (L2[j].status != LinkStatus.NORMAL) bad.push(L2[j].name);
    }
    report.push("Still HH: " + (hh.join(", ") || "none"));
    report.push("Link problems: " + (bad.join(", ") || "none"));
    k.save();
    report.push("Saved " + out.name);
    var msg = report.join("\n");
    if (!preset.quiet) alert(msg);
    return msg;
})();
