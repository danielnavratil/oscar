// ───────────────────────────────────────────────────────────────
// scan_issue.jsx
// Pre-flight report for the active issue document (changes nothing):
// overset text, missing/modified links, images under 300 ppi, non-CMYK images on pages,
// missing fonts, pink placeholder frames, empty text frames, text left on the pasteboard,
// double spaces / space before punctuation / repeated words, and pair spreads that are
// missing a prompt. Things it can't judge (TOC page numbers, credits, stats) still need a read.
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

    var msg = "pages=" + d.pages.length + "\n" + o.join("\n");
    if (!preset.quiet) alert(msg);
    return msg;
})();
