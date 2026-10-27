// ───────────────────────────────────────────────────────────────
// scan_issue.jsx
// Pre-flight report for the active issue document (changes nothing):
// overset text, missing/modified links, images under 300 ppi, non-CMYK images on pages,
// missing fonts, pink placeholder frames, empty text frames, text left on the pasteboard,
// double spaces / space before punctuation / repeated words, pair spreads that are
// missing a prompt, prompts closer than 0.4" to an image (or printed over one), prompts
// wider than 5/9 of the margin, and pages with no master. Things it can't judge (TOC page numbers, credits, stats) still need a read.
// Optional: $.global.OSCAR_SCAN_PRESET = { docName, quiet }.
// ───────────────────────────────────────────────────────────────
#target indesign
(function () {
    var preset = $.global.OSCAR_SCAN_PRESET || {};
    var d = preset.docName ? app.documents.itemByName(preset.docName) : app.activeDocument, o = [];
    function where(it) { try { var p = it.parentPage; return p ? "p" + p.name : "pasteboard (spread " + it.parent.index + ")"; } catch (e) { return "?"; } }
    function section(title, list) { o.push(title + " (" + list.length + ")" + (list.length ? ":\n  " + list.join("\n  ") : "")); }

    var st = d.stories.everyItem().getElements(), over = [], hy = [];
    for (var i = 0; i < st.length; i++) {
        var tc = st[i].textContainers, w = tc.length ? where(tc[tc.length - 1]) : "?", c = st[i].contents, m;
        if (st[i].overflows) over.push(w + ": " + c.substr(0, 40).replace(/[\r\n]+/g, " "));
        if ((m = c.match(/[^\s] {2,}[^\s]/))) hy.push(w + " double space: …" + m[0] + "…");
        if ((m = c.match(/ [,.;:!?](?!\d)/))) hy.push(w + " space before punctuation near: " + c.substr(Math.max(0, c.indexOf(m[0]) - 15), 25).replace(/[\r\n]/g, " "));
        if ((m = c.match(/\b(\w+) \1\b/i)) && !/--/.test(m[0])) hy.push(w + " repeated word: '" + m[0] + "'");
    }
    section("OVERSET", over);

    var L = d.links.everyItem().getElements(), bad = [], low = [], rgb = [];
    for (var j = 0; j < L.length; j++) {
        var l = L[j], g = l.parent, onPage = false; try { onPage = !!g.parentPage; } catch (e) {}
        if (l.status != LinkStatus.NORMAL) bad.push(String(l.status) + " " + l.name + " @" + where(g));
        if (!onPage || /\.svg$/i.test(l.name)) continue;
        try { if (g.effectivePpi[0] < 300) low.push(Math.round(g.effectivePpi[0]) + " ppi " + l.name + " @" + where(g)); } catch (e) {}
        try { if (g.space != "CMYK" && !/^qr/i.test(l.name)) rgb.push(g.space + " " + l.name + " @" + where(g)); } catch (e) {}
    }
    section("LINK PROBLEMS", bad); section("UNDER 300 PPI", low); section("NON-CMYK IMAGES (QR codes excluded)", rgb);

    var F = d.fonts.everyItem().getElements(), mf = [];
    for (var f = 0; f < F.length; f++) if (F[f].status != FontStatus.INSTALLED) mf.push(F[f].name);
    section("FONT PROBLEMS", mf);

    var R = d.rectangles.everyItem().getElements(), pink = [];
    for (var r = 0; r < R.length; r++) if (R[r].parentPage && !R[r].allGraphics.length && R[r].fillColor.name == "C=0 M=100 Y=0 K=0") pink.push(where(R[r]) + " " + R[r].name);
    section("PINK PLACEHOLDERS", pink);

    var T = d.textFrames.everyItem().getElements(), empty = [], pb = [];
    for (var t = 0; t < T.length; t++) {
        if (T[t].parentPage && T[t].parentStory.contents.replace(/\s/g, "") == "") empty.push(where(T[t]));
        if (!T[t].parentPage && T[t].contents.length > 2) pb.push("spread " + T[t].parent.index + ": " + T[t].contents.substr(0, 45).replace(/[\r\n]+/g, " "));
    }
    section("EMPTY TEXT FRAMES", empty); section("TEXT ON PASTEBOARD", pb); section("TEXT HYGIENE", hy);

    var pairs = [];
    for (var s = 0; s < d.spreads.length; s++) {
        var items = d.spreads[s].allPageItems, prompts = 0, imgs = 0;
        for (var k = 0; k < items.length; k++) {
            if (items[k].label == "oscar_prompt") prompts++;
            try { if (items[k].itemLink && /^[0-9a-f-]{36}\.jpg$/i.test(items[k].itemLink.name)) imgs++; } catch (e) {}
        }
        if ((prompts || imgs) && prompts != imgs) pairs.push("spread " + s + " (p" + d.spreads[s].pages[0].name + "): " + imgs + " pair images, " + prompts + " prompts");
    }
    section("PAIR SPREADS WITH A MISSING PROMPT", pairs);

    // prompts must sit at least 0.4" below any image above them and be no wider than 5/9 of
    // the margin width (rag_prompts.jsx enforces both; hand edits can break them). Measured in
    // inches via the script setting (not the document's view, which would add undo steps);
    // comparisons are within one page, so the ruler origin doesn't matter.
    var su = app.scriptPreferences.measurementUnit, close = [], wide = [], noMaster = [];
    var MAX_W = (8.375 - 1) * 5 / 9;
    try {
        app.scriptPreferences.measurementUnit = MeasurementUnits.INCHES;
        for (var pg = 0; pg < d.pages.length; pg++) {
            var page = d.pages[pg], tfs = [], rs = page.rectangles, pi = page.allPageItems;
            for (var q = 0; q < pi.length; q++) if (pi[q].constructor.name == "TextFrame") tfs.push(pi[q]);   // grouped prompts too
            if (!page.appliedMaster || !page.appliedMaster.isValid) noMaster.push(page.name);
            for (var a = 0; a < tfs.length; a++) {
                if (tfs[a].label != "oscar_prompt") continue;
                var tb = tfs[a].geometricBounds, who = tfs[a].contents.split("\r")[0].substr(0, 24);
                if (tb[3] - tb[1] > MAX_W + 0.02) wide.push("p" + page.name + " " + who + ": " + Math.round((tb[3] - tb[1]) * 100) / 100 + "\" wide");
                for (var b = 0; b < rs.length; b++) {
                    if (!rs[b].allGraphics.length) continue;
                    var ib = rs[b].geometricBounds;
                    if (ib[3] <= tb[1] || ib[1] >= tb[3] || ib[0] >= tb[0]) continue;   // not above / not overlapping
                    if (ib[2] >= tb[2]) close.push("p" + page.name + " " + who + ": printed over an image");
                    else if (tb[0] - ib[2] < 0.4 - 0.015) close.push("p" + page.name + " " + who + ": " + Math.round((tb[0] - ib[2]) * 100) / 100 + "\" below the image");
                }
            }
        }
    } finally {
        app.scriptPreferences.measurementUnit = su;
    }
    section("PROMPTS WITHIN 0.4\" OF AN IMAGE", close);
    section("PROMPTS WIDER THAN 5/9 OF THE MARGIN (4.1\")", wide);
    section("PAGES WITH NO MASTER (cover, TOC and inside back are normal)", noMaster);

    var msg = "pages=" + d.pages.length + "\n" + o.join("\n");
    if (!preset.quiet) alert(msg);
    return msg;
})();
