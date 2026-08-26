// ───────────────────────────────────────────────────────────────
// place_oscar_pairs.jsx
// Reads the Oscar pairs JSON and the CMYK image folder, then
// places every paired image and prompt into the active InDesign
// document. Asks which page to insert after; new pages are spliced
// in there, so the closing spread stays intact at the end.
//
// Run via File → Scripts → Browse on the open template document.
// The entire run is one undoable action (Cmd+Z reverts it all).
// ───────────────────────────────────────────────────────────────

#target indesign

function placeOscarPairs() {
    // ── CONFIG ─────────────────────────────────────────────────
    var PAGE_W          = 8.375;
    var PAGE_H          = 10.875;
    var MARGIN          = 0.5;
    var BLEED           = 0.125;
    var PROMPT_W        = 3.5;
    var PROMPT_H        = 2.0;
    var GAP             = 0.1667;      // gap between side-by-side prompts

    // Derived
    var TOP_BLEED       = -BLEED;
    var BOTTOM_BLEED    = PAGE_H + BLEED;            // 11.0
    var OUTER_BLEED_L   = -BLEED;                    // left page outer-bleed x
    var OUTER_BLEED_R   = PAGE_W + BLEED;            // right page outer-bleed x (page-rel)
    var SPINE_L         = PAGE_W;                    // spine x on left page (page-rel)
    var SPINE_R         = 0;                         // spine x on right page (page-rel)
    var OUTER_MARGIN    = PAGE_W - MARGIN;           // 7.875
    var INTER_MARGIN_W  = PAGE_W - 2 * MARGIN;       // 7.375
    var INSET_SMALL_W   = 0.6 * INTER_MARGIN_W;      // 4.425
    var PAGE_BLEED_W    = PAGE_W + BLEED;            // 8.5
    var PAGE_BLEED_H    = PAGE_H + 2 * BLEED;        // 11.125
    var PAGE_ASPECT     = PAGE_BLEED_W / PAGE_BLEED_H; // ≈0.764
    var PROMPT_TOP      = 8.375;
    var PROMPT_BOTTOM   = PROMPT_TOP + PROMPT_H;     // 10.375
    var DISPLACE_AT     = PROMPT_TOP;  // displace only when image actually overlaps prompt area
                                       // (must be defined AFTER PROMPT_TOP — var hoisting made this undefined before)

    // ── PRECONDITIONS ──────────────────────────────────────────
    if (app.documents.length === 0) {
        alert("Open the InDesign template document first.");
        return;
    }
    var doc = app.activeDocument;

    // Optional preset for automation (set via $.global.OSCAR_PRESET before eval):
    // { jsonPath, imagesFolder, afterPage, autoConfirm, quiet } — skips the matching dialogs.
    var preset = $.global.OSCAR_PRESET || {};

    var jsonFile = preset.jsonPath ? new File(preset.jsonPath)
                                   : File.openDialog("Select Oscar pairs JSON", "*.json");
    if (!jsonFile) return;
    if (!jsonFile.exists) { alert("JSON not found:\n" + jsonFile.fsName); return; }
    var imagesFolder = preset.imagesFolder ? new Folder(preset.imagesFolder)
                                           : Folder.selectDialog("Select folder of CMYK JPEGs (filenames are UUIDs)");
    if (!imagesFolder) return;
    if (!imagesFolder.exists) { alert("Folder not found:\n" + imagesFolder.fsName); return; }

    jsonFile.encoding = "UTF-8";
    jsonFile.open("r"); var jsonText = jsonFile.read(); jsonFile.close();
    var pairs;
    // ExtendScript lacks JSON.parse; eval is safe here (our own export).
    try { pairs = eval("(" + jsonText + ")"); }
    catch (e) { alert("Could not parse JSON:\n" + e.message); return; }
    if (!(pairs instanceof Array) || pairs.length === 0) {
        alert("JSON has no pairs."); return;
    }

    // ── HELPERS ────────────────────────────────────────────────
    function aspectOf(s) {
        if (!s) return 1;
        var parts = s.split(":");
        if (parts.length !== 2) return 1;
        var w = parseFloat(parts[0]), h = parseFloat(parts[1]);
        return (w && h) ? (w / h) : 1;
    }
    function findImageFile(uuid) {
        var exts = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];
        for (var e = 0; e < exts.length; e++) {
            var f = new File(imagesFolder.fsName + "/" + uuid + exts[e]);
            if (f.exists) return f;
        }
        return null;
    }

    // ── PRE-CHECK: every image exists ──────────────────────────
    var missing = [];
    for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var keys = ["imageA", "imageB"];
        for (var k = 0; k < keys.length; k++) {
            var img = p[keys[k]];
            if (img && img.id && !findImageFile(img.id)) {
                missing.push("Pair " + p.pair + " " + keys[k] + ": " + img.id);
            }
        }
    }
    if (missing.length) {
        alert("Missing image files (nothing was placed):\n\n" + missing.join("\n"));
        return;
    }

    // ── FONTS ──────────────────────────────────────────────────
    function getFont(family, style) {
        var f = app.fonts.itemByName(family + "\t" + style);
        return f.isValid ? f : null;
    }
    var fontHeavy   = getFont("ABC Diatype", "Heavy");
    var fontRegular = getFont("ABC Diatype", "Regular");
    if (!fontHeavy || !fontRegular) {
        alert("Required fonts not found:\n• ABC Diatype Heavy\n• ABC Diatype Regular\n\nVerify they're installed and try again.");
        return;
    }
    // CJK runs get their own faces (9pt / 10.8 like the body); missing fonts are reported per frame
    var fontKO = getFont("Noto Sans KR", "Regular");
    var fontZH = getFont("Hiragino Sans GB", "W3");
    // \u escapes only — ExtendScript misreads literal CJK in unmarked source files
    var KO_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
    var ZH_RE = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF01-\uFF60]/; // ideographs + kana + CJK punct
    function styleCjkRuns(tf) {
        var story = tf.parentStory;
        var txt = story.contents;
        var jobs = [[KO_RE, fontKO, "Noto Sans KR Regular"], [ZH_RE, fontZH, "Hiragino Sans GB W3"]];
        for (var j = 0; j < jobs.length; j++) {
            if (!jobs[j][0].test(txt)) continue;
            if (!jobs[j][1]) { errors.push("CJK text needs missing font " + jobs[j][2]); continue; }
            var start = -1;
            for (var i = 0; i <= txt.length; i++) {
                var m = i < txt.length && jobs[j][0].test(txt.charAt(i));
                if (m && start < 0) start = i;
                if (!m && start >= 0) {
                    var range = story.characters.itemByRange(start, i - 1);
                    range.appliedFont = jobs[j][1];
                    range.pointSize = 9;
                    range.leading = 10.8;
                    start = -1;
                }
            }
        }
    }

    // ── CONFIRM ────────────────────────────────────────────────
    var totalImages = 0;
    for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].imageA) totalImages++;
        if (pairs[i].imageB) totalImages++;
    }
    // ── WHERE TO INSERT ────────────────────────────────────────
    // New pages are spliced in after the chosen page, so everything after it
    // (the closing spread) slides back untouched instead of being placed over.
    var defaultAfter = doc.pages.length - 3; // default keeps the last 3 pages (inside back cover spread)
    var input = preset.afterPage != null ? String(preset.afterPage)
              : prompt("Insert pair spreads AFTER page:\n(everything after that page moves back unchanged)", String(defaultAfter));
    if (input === null) return;
    var afterPage = parseInt(input, 10);
    if (isNaN(afterPage) || afterPage < 1 || afterPage > doc.pages.length) {
        alert("Page must be between 1 and " + doc.pages.length + "."); return;
    }
    var START_PAGE = afterPage + 1;
    var newPages = pairs.length * 2;

    if (!preset.autoConfirm && !confirm("Place " + totalImages + " images across " + pairs.length + " spreads?\n\n" +
                 newPages + " pages will be inserted after page " + afterPage +
                 " (pages " + START_PAGE + "–" + (afterPage + newPages) + "); the " +
                 (doc.pages.length - afterPage) + " page(s) after that move back unchanged.")) return;

    // ── INSERT PAGES (spliced in, not appended at the end) ─────
    var anchor = doc.pages.item(afterPage - 1);
    for (var n = 0; n < newPages; n++) {
        anchor = doc.pages.add(LocationOptions.AFTER, anchor);
    }
    // Each pair assumes its spread starts on a left-hand page
    if (doc.pages.item(START_PAGE - 1).side !== PageSideOptions.LEFT_HAND) {
        alert("Page " + START_PAGE + " is not a left-hand page, so every pair would straddle two spreads.\n" +
              "Cmd+Z to undo the inserted pages, then re-run and insert after page " +
              (afterPage - 1) + " or " + (afterPage + 1) + " instead.");
        return;
    }

    // ── UNITS: page-relative inches ────────────────────────────
    var saved = {
        h: doc.viewPreferences.horizontalMeasurementUnits,
        v: doc.viewPreferences.verticalMeasurementUnits,
        r: doc.viewPreferences.rulerOrigin
    };
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin                = RulerOrigin.PAGE_ORIGIN;

    // ── GEOMETRY ───────────────────────────────────────────────
    // All bounds returned as {top, left, bottom, right} in page-relative inches.

    // Full-bleed images whose aspect leaves less than this much uncovered get
    // snapped to full bleed on all sides (fill-proportional crops the excess):
    // 3:4, 4:5, 2:3 all snap; 9:16 and wider/taller keep their computed edge.
    var FULL_BLEED_SNAP = 1.5;
    function imageBounds(side, size, aspect) {
        var t, l, b, r, W, H;
        if (size === "full bleed") {
            if (aspect >= PAGE_ASPECT) {
                // landscape/square: extend to spine, bottom calculated
                W = PAGE_BLEED_W; H = W / aspect;
                if (PAGE_BLEED_H - H <= FULL_BLEED_SNAP) H = PAGE_BLEED_H;  // snap: no band above the bottom trim
                t = TOP_BLEED; b = t + H;
                if (side === "L") { l = OUTER_BLEED_L; r = SPINE_L; }
                else              { l = SPINE_R;       r = OUTER_BLEED_R; }
            } else {
                // portrait: extend to bottom bleed, right edge calculated
                H = PAGE_BLEED_H; W = H * aspect;
                if (PAGE_BLEED_W - W <= FULL_BLEED_SNAP) W = PAGE_BLEED_W;  // snap: no sliver at the spine
                t = TOP_BLEED; b = BOTTOM_BLEED;
                if (side === "L") { l = OUTER_BLEED_L;     r = l + W; }
                else              { r = OUTER_BLEED_R;     l = r - W; }
            }
        } else if (size === "inset large") {
            W = INTER_MARGIN_W; H = W / aspect;
            // Cap so image bottom doesn't extend below y=8
            var INSET_LARGE_MAX_BOTTOM = 8.0;
            if (MARGIN + H > INSET_LARGE_MAX_BOTTOM) {
                H = INSET_LARGE_MAX_BOTTOM - MARGIN; // 7.5
                W = H * aspect;
            }
            t = MARGIN; b = t + H;
            if (side === "L") { l = MARGIN;       r = l + W; }
            else              { r = OUTER_MARGIN; l = r - W; }
        } else { // "inset small" — mirrored: top-left on left page, top-right on right page
            W = INSET_SMALL_W; H = W / aspect;
            t = MARGIN; b = t + H;
            if (side === "L") { l = MARGIN;       r = l + W; }
            else              { r = OUTER_MARGIN; l = r - W; }
        }
        return { top: t, left: l, bottom: b, right: r };
    }

    // Native prompt: outer-margin anchored, 3.5" wide, bottom at inner margin
    function nativePromptBounds(side) {
        var l, r;
        if (side === "L") { l = MARGIN; r = l + PROMPT_W; }                 // [0.5, 4.0]
        else              { r = OUTER_MARGIN; l = r - PROMPT_W; }            // [4.375, 7.875]
        return { top: PROMPT_TOP, left: l, bottom: PROMPT_BOTTOM, right: r };
    }
    // Displaced prompt: sits beside the receiving page's native prompt,
    // toward the spine, 0.1667" gap, top-aligned.
    function displacedPromptBounds(receivingSide) {
        var l, r;
        if (receivingSide === "L") {
            // Native is at [0.5, 4.0] → displaced sits to its right
            l = MARGIN + PROMPT_W + GAP;
            r = l + PROMPT_W;
        } else {
            // Native is at [4.375, 7.875] → displaced sits to its left
            r = OUTER_MARGIN - PROMPT_W - GAP;
            l = r - PROMPT_W;
        }
        return { top: PROMPT_TOP, left: l, bottom: PROMPT_BOTTOM, right: r };
    }

    // ── PLACEMENT FUNCTIONS ────────────────────────────────────
    function placeImage(page, side, data) {
        var b = imageBounds(side, data.size, aspectOf(data.aspect));
        var rect = page.rectangles.add({
            geometricBounds: [b.top, b.left, b.bottom, b.right]
        });
        rect.place(findImageFile(data.id));
        rect.fit(FitOptions.FILL_PROPORTIONALLY);
        return b;
    }

    function placeText(page, bounds, username, body) {
        var tf = page.textFrames.add({
            geometricBounds: [bounds.top, bounds.left, bounds.bottom, bounds.right]
        });
        tf.label = "oscar_prompt";   // rag_prompts.jsx finds frames by this
        tf.textFramePreferences.autoSizingType = AutoSizingTypeEnum.HEIGHT_ONLY;
        // anchor at the bottom: frames grow upward, so every prompt's bottom edge stays on PROMPT_BOTTOM
        tf.textFramePreferences.autoSizingReferencePoint = AutoSizingReferenceEnum.BOTTOM_LEFT_POINT;
        tf.textFramePreferences.verticalJustification = VerticalJustification.BOTTOM_ALIGN;
        var bodyText = (body || "").replace(/\n/g, "\r");
        tf.contents = (username || "").replace(/^@+/, "") + "\r" + bodyText;
        // style via the story, not the frame: tf.paragraphs misses overset text,
        // which left the tail of long prompts in the default font
        var paras = tf.parentStory.paragraphs;
        if (paras.length > 0) {
            paras[0].appliedFont   = fontHeavy;
            paras[0].pointSize     = 10;
            paras[0].leading       = 16;
            paras[0].justification = Justification.LEFT_ALIGN;
        }
        for (var pi = 1; pi < paras.length; pi++) {
            paras[pi].appliedFont   = fontRegular;
            paras[pi].pointSize     = 9;
            paras[pi].leading       = 10.8;
            paras[pi].justification = Justification.LEFT_ALIGN;
            paras[pi].hyphenation   = false;
        }
        styleCjkRuns(tf);
        return tf;
    }

    // ── MAIN LOOP ──────────────────────────────────────────────
    var placed = 0;
    var errors = [];

    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        var idx1 = START_PAGE - 1 + i * 2;
        var p1 = doc.pages.item(idx1);
        var p2 = doc.pages.item(idx1 + 1);

        // Resolve actual L/R pages regardless of doc starting-side convention
        var leftPage, rightPage;
        if (p1.side === PageSideOptions.LEFT_HAND) { leftPage = p1; rightPage = p2; }
        else                                       { leftPage = p2; rightPage = p1; }

        // Place each image; track bounds and page for prompt placement
        var info = {}; // info.L, info.R = { data, bounds, page }
        var keys = ["imageA", "imageB"];
        for (var k = 0; k < keys.length; k++) {
            var data = pair[keys[k]];
            if (!data || !data.id || !data.side) continue;
            var page = (data.side === "L") ? leftPage : rightPage;
            try {
                var b = placeImage(page, data.side, data);
                info[data.side] = { data: data, bounds: b, page: page };
                placed++;
            } catch (e) {
                errors.push("Pair " + pair.pair + " " + keys[k] + " image: " + e.message);
            }
        }

        // Place prompts. Each image's prompt either stays (native) or moves to the
        // opposite page (displaced), based on whether the image overlaps the prompt area.
        var sides = ["L", "R"];
        for (var s = 0; s < sides.length; s++) {
            var side = sides[s];
            var d = info[side];
            if (!d) continue;
            var displaced = d.bounds.bottom > DISPLACE_AT;
            try {
                if (displaced) {
                    var oppSide = (side === "L") ? "R" : "L";
                    var oppPage = (side === "L") ? rightPage : leftPage;
                    placeText(oppPage, displacedPromptBounds(oppSide),
                              d.data.username, d.data.cleanedPrompt || d.data.rawPrompt);
                } else {
                    placeText(d.page, nativePromptBounds(side),
                              d.data.username, d.data.cleanedPrompt || d.data.rawPrompt);
                }
            } catch (e) {
                errors.push("Pair " + pair.pair + " " + side + " prompt: " + e.message);
            }
        }
    }

    // ── RESTORE UNITS ──────────────────────────────────────────
    doc.viewPreferences.horizontalMeasurementUnits = saved.h;
    doc.viewPreferences.verticalMeasurementUnits   = saved.v;
    doc.viewPreferences.rulerOrigin                = saved.r;

    // ── REPORT ─────────────────────────────────────────────────
    var msg = "Placed " + placed + " images across " + pairs.length + " spreads.";
    if (errors.length) msg += "\n\nErrors (" + errors.length + "):\n" + errors.join("\n");
    if (preset.quiet) return msg;
    alert(msg);
}

// Run as one undoable action so Cmd+Z reverts everything
var __result = app.doScript(placeOscarPairs, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Place Oscar Pairs");
__result;
