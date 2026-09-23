// ───────────────────────────────────────────────────────────────
// rag_selected.jsx
// Re-rags only the selected frame(s): select a prompt frame, or click into
// its text, then run this from the Scripts panel. Uses rag_prompts.jsx
// (same folder) in selection mode, so the ragging rules are identical:
//   • a prompt alone on its page gets the full width search and is
//     re-anchored to the bottom outer corner,
//   • one prompt of a pair: the other prompt keeps its width and line
//     breaks and only moves so the pair stays laid out correctly,
//   • QR codes under those prompts move with them,
//   • any other text frame is ragged in place (left and bottom edges kept).
// One undoable action.
// ───────────────────────────────────────────────────────────────

#target indesign

(function () {
    if (app.documents.length === 0) { alert("Open a document first."); return; }

    // $.global.OSCAR_RAG_SELECTION overrides app.selection (automated tests)
    var sel = $.global.OSCAR_RAG_SELECTION || app.selection;
    var frames = [], seen = {};
    for (var i = 0; i < sel.length; i++) {
        var it = sel[i], tf = null;
        try {
            if (it.constructor.name === "TextFrame") tf = it;
            else if (it.parentTextFrames && it.parentTextFrames.length) tf = it.parentTextFrames[0];
        } catch (e) {}
        if (tf && tf.isValid && !seen[tf.id]) { seen[tf.id] = true; frames.push(tf); }
    }
    if (!frames.length) {
        alert("Select a prompt frame, or click into its text, then run this again.");
        return;
    }

    var rag = new File(File($.fileName).parent.fsName + "/rag_prompts.jsx");
    if (!rag.exists) { alert("rag_prompts.jsx must be in the same folder as rag_selected.jsx."); return; }

    $.global.OSCAR_RAG_FRAMES = frames;
    try {
        return $.evalFile(rag);   // the report (rag_prompts alerts it unless quiet)
    } finally {
        $.global.OSCAR_RAG_FRAMES = undefined;
    }
})();
