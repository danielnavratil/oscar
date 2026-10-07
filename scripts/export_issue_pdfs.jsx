// ───────────────────────────────────────────────────────────────
// export_issue_pdfs.jsx
// Exports the open print documents of an issue with their presets, ONE export per document:
//   MJ_NN.indd             → HEMLOCK → <issue>/HH/MJ_NN.pdf
//   MJ_NN KOPA.indd        → KOPA    → <issue>/KOPA/MJ_NN KOPA.pdf
//   MJ NN Posters.indd     → HEMLOCK → <issue>/HH/MJ NN Posters.pdf
//   MJ NN Posters KOPA.indd→ KOPA    → <issue>/KOPA/MJ NN Posters KOPA.pdf
// The HEMLOCK preset splits into one PDF per page itself, in a folder named after the file
// (HH/MJ_NN/MJ_NN_01.pdf …, numbered in document order, so 01 = back cover). Never loop pages:
// every export would make its own folder. InDesign won't overwrite an existing split folder —
// it makes "MJ_NN(1)" — so this refuses to run over existing output; move the old one out first.
// Exports what is on screen, including unsaved changes.
// Optional: $.global.OSCAR_EXPORT_PRESET = { docs: ["MJ_43.indd", …], quiet }.
// ───────────────────────────────────────────────────────────────
#target indesign
(function () {
    var preset = $.global.OSCAR_EXPORT_PRESET || {};
    var docs = [];
    if (preset.docs) for (var i = 0; i < preset.docs.length; i++) docs.push(app.documents.itemByName(preset.docs[i]));
    else for (var j = 0; j < app.documents.length; j++) if (/^MJ[_ ]\d+/.test(app.documents[j].name)) docs.push(app.documents[j]);
    var pp = app.pdfExportPreferences, savedRange = pp.pageRange, report = [];
    try {
        pp.pageRange = PageRange.ALL_PAGES;
        for (var d = 0; d < docs.length; d++) {
            var doc = docs[d]; if (!doc.isValid || !doc.saved) { report.push("skipped (not open/saved): " + preset.docs[d]); continue; }
            var name = doc.name.replace(/\.indd$/i, ""), kopa = / KOPA$/.test(name);
            var presetObj = app.pdfExportPresets.itemByName(kopa ? "KOPA" : "HEMLOCK");
            var outDir = new Folder(doc.filePath.fsName + (kopa ? "/KOPA" : "/HH")); outDir.create();
            var file = new File(outDir.fsName + "/" + name + ".pdf");
            var existing = kopa ? file : new Folder(outDir.fsName + "/" + name);
            if (existing.exists) { report.push("skipped " + name + ": " + existing.fsName + " exists (move it out first)"); continue; }
            var t = new Date();
            doc.exportFile(ExportFormat.PDF_TYPE, file, false, presetObj);
            report.push(name + " → " + (kopa ? "KOPA/" + file.name : "HH/" + name + "/") + " (" + Math.round((new Date() - t) / 1000) + "s)");
        }
    } finally { try { pp.pageRange = savedRange; } catch (e) {} }
    var msg = report.join("\n") || "No MJ documents open.";
    if (!preset.quiet) alert(msg);
    return msg;
})();
