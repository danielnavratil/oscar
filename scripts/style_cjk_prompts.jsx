// ───────────────────────────────────────────────────────────────
// style_cjk_prompts.jsx
// Styles CJK runs inside placed prompt frames (label "oscar_prompt"):
//   • Korean (Hangul)        → Noto Sans KR Regular, 9pt / 10.8 leading
//   • Chinese (ideographs)   → Hiragino Sans GB W3,  9pt / 10.8 leading
// Latin text is untouched. place_oscar_pairs.jsx now applies the same
// styling at placement time — this standalone covers already-placed
// docs. Re-rag affected pages afterwards (fonts change line widths).
// Set $.global.OSCAR_CJK_QUIET = true to return the report (with the
// affected page list) instead of alerting.
// ───────────────────────────────────────────────────────────────

#target indesign

function styleCjkPrompts() {
    // \u escapes only — ExtendScript misreads literal CJK in unmarked source files
    var KO_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
    var ZH_RE = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF01-\uFF60]/; // ideographs + kana + CJK punct
    var quiet = $.global.OSCAR_CJK_QUIET === true;

    if (app.documents.length === 0) { alert("Open the placed document first."); return; }
    var doc = app.activeDocument;

    function getFont(family, style) {
        var f = app.fonts.itemByName(family + "\t" + style);
        return f.isValid ? f : null;
    }
    var fontKO = getFont("Noto Sans KR", "Regular");
    var fontZH = getFont("Hiragino Sans GB", "W3");
    var missing = [];
    if (!fontKO) missing.push("Noto Sans KR Regular");
    if (!fontZH) missing.push("Hiragino Sans GB W3");
    if (missing.length === 2) { alert("CJK fonts not installed:\n" + missing.join("\n")); return; }

    function styleRuns(tf, re, font) {
        if (!font) return 0;
        var story = tf.parentStory;
        var txt = story.contents;
        var n = txt.length, start = -1, runs = 0;
        for (var i = 0; i <= n; i++) {
            var m = i < n && re.test(txt.charAt(i));
            if (m && start < 0) start = i;
            if (!m && start >= 0) {
                var range = story.characters.itemByRange(start, i - 1);
                range.appliedFont = font;
                range.pointSize = 9;
                range.leading = 10.8;
                runs++;
                start = -1;
            }
        }
        return runs;
    }

    var all = doc.textFrames.everyItem().getElements();
    var frames = 0, pages = {}, pageList = [];
    for (var i = 0; i < all.length; i++) {
        var tf = all[i];
        if (tf.label !== "oscar_prompt" || !tf.parentPage) continue;
        var touched = styleRuns(tf, KO_RE, fontKO) + styleRuns(tf, ZH_RE, fontZH);
        if (touched > 0) {
            frames++;
            var pn = tf.parentPage.name;
            if (!pages[pn]) { pages[pn] = true; pageList.push(pn); }
        }
    }

    var msg = "Styled CJK text in " + frames + " prompt frame(s).";
    if (pageList.length) msg += "\npages:" + pageList.join(",");
    if (missing.length) msg += "\nMissing font skipped: " + missing.join(", ");
    if (quiet) return msg;
    alert(msg);
}

var __result = app.doScript(styleCjkPrompts, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Style CJK Prompts");
__result;
