// ───────────────────────────────────────────────────────────────
// place_oscar_pairs.jsx
// Reads the Oscar pairs JSON and the CMYK image folder, then
// places every paired image and prompt into the active InDesign
// document. Start page is computed dynamically as doc.pages.length - 3,
// leaving the last 3 pages for the inside back cover spread.
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
    var DISPLACE_AT     = PROMPT_TOP;   // displace only when image actually overlaps prompt area

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

    // ── PRECONDITIONS ──────────────────────────────────────────
    if (app.documents.length === 0) {
        alert("Open the InDesign template document first.");
        return;
    }
    var doc = app.activeDocument;
    var START_PAGE = doc.pages.length - 3;  // leave last 3 pages for inside back cover spread

    var jsonFile = File.openDialog("Select Oscar pairs JSON", "*.json");
    if (!jsonFile) return;
    var imagesFolder = Folder.selectDialog("Select folder of CMYK JPEGs (filenames are UUIDs)");
    if (!imagesFolder) return;

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

    // ── CONFIRM ────────────────────────────────────────────────
    var totalImages = 0;
    for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].imageA) totalImages++;
        if (pairs[i].imageB) totalImages++;
    }
    if (!confirm("Place " + totalImages + " images across " + pairs.length +
                 " spreads starting at page " + START_PAGE + "?")) return;

    // ── ENSURE ENOUGH PAGES ────────────────────────────────────
    var lastPageNeeded = START_PAGE + (pairs.length - 1) * 2 + 1;
    while (doc.pages.length < lastPageNeeded) {
        doc.pages.add(LocationOptions.AT_END);
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

    function imageBounds(side, size, aspect) {
        var t, l, b, r, W, H;
        if (size === "full bleed") {
            if (aspect >= PAGE_ASPECT) {
                // landscape/square: extend to spine, bottom calculated
                W = PAGE_BLEED_W; H = W / aspect;
                t = TOP_BLEED; b = t + H;
                if (side === "L") { l = OUTER_BLEED_L; r = SPINE_L; }
                else              { l = SPINE_R;       r = OUTER_BLEED_R; }
            } else {
                // portrait: extend to bottom bleed, right edge calculated
                H = PAGE_BLEED_H; W = H * aspect;
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
        tf.textFramePreferences.autoSizingType = AutoSizingTypeEnum.HEIGHT_ONLY;
        tf.textFramePreferences.autoSizingReferencePoint = AutoSizingReferenceEnum.TOP_LEFT_POINT;
        var bodyText = (body || "").replace(/\n/g, "\r");
        tf.contents = (username || "").replace(/^@+/, "") + "\r" + bodyText;
        if (tf.paragraphs.length > 0) {
            tf.paragraphs[0].appliedFont   = fontHeavy;
            tf.paragraphs[0].pointSize     = 10;
            tf.paragraphs[0].leading       = 16;
            tf.paragraphs[0].justification = Justification.LEFT_ALIGN;
        }
        for (var pi = 1; pi < tf.paragraphs.length; pi++) {
            tf.paragraphs[pi].appliedFont   = fontRegular;
            tf.paragraphs[pi].pointSize     = 9;
            tf.paragraphs[pi].leading       = 10.8;
            tf.paragraphs[pi].justification = Justification.LEFT_ALIGN;
            tf.paragraphs[pi].hyphenation   = false;
        }
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
    alert(msg);
}

// Run as one undoable action so Cmd+Z reverts everything
app.doScript(placeOscarPairs, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Place Oscar Pairs");
