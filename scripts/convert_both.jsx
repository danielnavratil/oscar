// ───────────────────────────────────────────────────────────────
// convert_both.jsx
// Converts every image in the upscaled folder to TWO CMYK profiles:
//   • U.S. Web Coated (SWOP) v2  → "HH Links"   (US press)
//   • PSO Coated v3              → "KOPA Links"  (Euro press)
// Saves JPEG quality 12. Uses doc.convertProfile() (the method that works in 27.7).
// Reads the source folder path from /tmp/oscar_convert_folder.txt
// Launched automatically by oscar_pipeline.sh — not run by hand.
// ───────────────────────────────────────────────────────────────

#target photoshop

(function () {
    function readConfig() {
        var f = File("/tmp/oscar_convert_folder.txt");
        if (!f.exists) { alert("Config missing: /tmp/oscar_convert_folder.txt"); return null; }
        f.open("r"); var p = f.read(); f.close();
        return p.replace(/[\r\n]+$/, "");
    }

    var saved = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    var upscaledPath = readConfig();
    if (!upscaledPath) { app.displayDialogs = saved; return; }

    var inFolder = new Folder(upscaledPath);
    if (!inFolder.exists) { app.displayDialogs = saved; alert("Folder not found:\n" + upscaledPath); return; }

    // Output folders as siblings of /upscaled
    var parent = inFolder.parent;
    var profiles = [
        { name: "U.S. Web Coated (SWOP) v2", out: new Folder(parent.fsName + "/HH Links") },
        { name: "PSO Coated v3",             out: new Folder(parent.fsName + "/KOPA Links") }
    ];
    for (var p = 0; p < profiles.length; p++) {
        if (!profiles[p].out.exists) profiles[p].out.create();
    }

    var files = inFolder.getFiles(/\.(png|jpg|jpeg|tif|tiff)$/i);
    if (!files.length) { app.displayDialogs = saved; alert("No images in:\n" + upscaledPath); return; }

    var done = 0, skipped = 0, errors = [];

    for (var i = 0; i < files.length; i++) {
        var baseName = files[i].name.replace(/\.[^\.]+$/, "");

        for (var p = 0; p < profiles.length; p++) {
            var outFile = new File(profiles[p].out.fsName + "/" + baseName + ".jpg");
            if (outFile.exists) { skipped++; continue; } // skip already-converted (re-run safe)

            var doc = null;
            try {
                doc = app.open(files[i]);

                // Each conversion starts from the original RGB — no cumulative double-conversion.
                doc.flatten();
                if (doc.bitsPerChannel !== BitsPerChannelType.EIGHT) doc.bitsPerChannel = BitsPerChannelType.EIGHT;

                doc.convertProfile(profiles[p].name, Intent.RELATIVECOLORIMETRIC, true, false);

                var opts = new JPEGSaveOptions();
                opts.quality = 12;
                opts.embedColorProfile = true;
                opts.formatOptions = FormatOptions.STANDARDBASELINE;
                doc.saveAs(outFile, opts, true, Extension.LOWERCASE);

                doc.close(SaveOptions.DONOTSAVECHANGES);
                doc = null;
                done++;
            } catch (e) {
                errors.push(files[i].name + " [" + profiles[p].name + "] → " + e.message);
                if (doc) { try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {} }
            }
        }
    }

    app.displayDialogs = saved;

    var msg = "Done.\n\nConverted: " + done + "\nSkipped (already existed): " + skipped +
              "\n\nHH Links:   " + profiles[0].out.fsName +
              "\nKOPA Links: " + profiles[1].out.fsName;
    if (errors.length) msg += "\n\nErrors (" + errors.length + "):\n" + errors.join("\n");
    alert(msg);
})();
