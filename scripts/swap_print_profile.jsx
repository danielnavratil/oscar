// ───────────────────────────────────────────────────────────────
// swap_print_profile.jsx
// Relinks every image in the active document between the HH (SWOP)
// and KOPA (PSO) versions, in either direction. Two naming schemes:
//   • asimov-prep "Both" output:  name_HH.jpg ↔ name_KOPA.jpg  (same folder)
//   • oscar pipeline output:      "HH Links" ↔ "KOPA Links"    (same filename)
// Links matching neither scheme (logos, ads, …) are left alone.
// Run via File → Scripts on the open document. One undo reverts all.
// ───────────────────────────────────────────────────────────────

function swapPrintProfile() {
    if (!app.documents.length) { alert("Open a document first."); return; }
    var doc = app.activeDocument;

    // ── direction dialog ──────────────────────────────────────
    var dlg = app.dialogs.add({ name: "Swap Print Profile", canCancel: true });
    var col = dlg.dialogColumns.add();
    col.staticTexts.add({ staticLabel: "Relink all images to which version?" });
    var rbg = col.radiobuttonGroups.add();
    rbg.radiobuttonControls.add({ staticLabel: "KOPA (PSO Coated v3)", checkedState: true });
    rbg.radiobuttonControls.add({ staticLabel: "HH (SWOP v2)" });
    var ok = dlg.show();
    var toKopa = rbg.selectedButton === 0;
    dlg.destroy();
    if (!ok) return;

    var FROM = toKopa ? "HH" : "KOPA";
    var TO   = toKopa ? "KOPA" : "HH";

    // Map a link's POSIX path to its counterpart, or null if no rule applies.
    function counterpartPath(posix) {
        var out = posix;
        var hit = false;
        // folder scheme: .../HH Links/uuid.jpg → .../KOPA Links/uuid.jpg
        var seg = "/" + FROM + " Links/";
        if (out.indexOf(seg) !== -1) {
            out = out.replace(seg, "/" + TO + " Links/");
            hit = true;
        }
        // suffix scheme: name_HH.jpg → name_KOPA.jpg (suffix on the basename only)
        var re = new RegExp("_" + FROM + "(\\.[^./]+)$");
        if (re.test(out)) {
            out = out.replace(re, "_" + TO + "$1");
            hit = true;
        }
        return hit ? out : null;
    }

    var swapped = 0, untouched = 0, embedded = 0, missing = [];

    // Descending: relink replaces link objects in the collection.
    for (var i = doc.links.length - 1; i >= 0; i--) {
        var link = doc.links[i];
        if (link.status === LinkStatus.LINK_EMBEDDED) { embedded++; continue; }

        var target = counterpartPath(File(link.filePath).fsName);
        if (!target) { untouched++; continue; }

        var f = File(target);
        if (!f.exists) { missing.push(File(target).name); continue; }

        try {
            link.relink(f);
            try { doc.links[i].update(); } catch (e) {}
            swapped++;
        } catch (e) {
            missing.push(File(target).name + " — " + e.message);
        }
    }

    var msg = "Relinked to " + TO + ": " + swapped +
              "\nLeft alone (no " + FROM + " marker): " + untouched;
    if (embedded) msg += "\nEmbedded (can't relink): " + embedded;
    if (missing.length) {
        msg += "\n\nMISSING " + TO + " files (" + missing.length + "), links unchanged:\n" +
               missing.slice(0, 15).join("\n");
        if (missing.length > 15) msg += "\n… and " + (missing.length - 15) + " more";
    }
    alert(msg);
}

app.doScript(swapPrintProfile, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Swap Print Profile");
