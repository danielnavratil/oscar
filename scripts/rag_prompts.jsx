// ───────────────────────────────────────────────────────────────
// rag_prompts.jsx
// Automated ragging pass for placed prompt frames. For each prompt:
//   1. searches frame widths (min 2", max the margin width) for the
//      most even ragged line endings — Balance Ragged Lines on, body
//      paragraph scored, username line never counted. Among widths
//      whose rag is nearly as good as the best, the one closest to
//      half a page width wins — go wide only when the rag demands it,
//   2. nudges per-line tracking ±10 toward the mean line ending
//      (body + params), backing off any change that reflows lines,
//   3. tightens the frame to the text and anchors the block to the
//      bottom outer corner of the page margins.
// Two prompts on one page are optimized jointly: widths split the
// available width (0.1667" gap, order never swapped), tops share one
// y, the taller frame's bottom sits on the bottom margin, the pair
// is flush to the outer margin.
// Frames are found by the "oscar_prompt" script label (placement now
// tags them); untagged docs fall back to geometry detection of the
// as-placed frames and tag them for re-runs.
// Run AFTER place_oscar_pairs.jsx and BEFORE place_qr_codes.jsx.
// One undoable action. Set $.global.OSCAR_RAG_QUIET = true to get the
// report as the script result instead of an alert; set
// $.global.OSCAR_RAG_PAGES = ["12","13"] to touch up only those pages.
// ───────────────────────────────────────────────────────────────

#target indesign

function ragPrompts() {
    // ── CONFIG ─────────────────────────────────────────────────
    var PAGE_W  = 8.375, PAGE_H = 10.875, MARGIN = 0.5;
    var GAP     = 0.1667;
    var MIN_W   = 2.0;
    var AVAIL   = PAGE_W - 2 * MARGIN;      // 7.375
    var OUTER_M = PAGE_W - MARGIN;          // 7.875
    var BOTTOM  = PAGE_H - MARGIN;          // 10.375
    var STEP    = 0.0625;                   // width search increment
    var BAND    = 0.15;                     // rag scores within this of the best count as "still good"
    var TARGET  = PAGE_W / 2;               // ideal prompt width (~4.19")
    var TARGET2 = (AVAIL - GAP) / 2;        // ideal per-frame width in a pair (~3.6")
    var TRACK   = 10;                       // tracking nudge cap
    var TOL     = 0.02;                     // line-end distance from mean before nudging
    var LABEL   = "oscar_prompt";
    var quiet   = $.global.OSCAR_RAG_QUIET === true;
    var pagesFilter = null;
    if ($.global.OSCAR_RAG_PAGES instanceof Array) {
        pagesFilter = {};
        for (var pf = 0; pf < $.global.OSCAR_RAG_PAGES.length; pf++)
            pagesFilter[String($.global.OSCAR_RAG_PAGES[pf])] = true;
    }

    if (app.documents.length === 0) { alert("Open the placed document first."); return; }
    var doc = app.activeDocument;

    // ── UNITS: page-relative inches ────────────────────────────
    var saved = {
        h: doc.viewPreferences.horizontalMeasurementUnits,
        v: doc.viewPreferences.verticalMeasurementUnits,
        r: doc.viewPreferences.rulerOrigin
    };
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin                = RulerOrigin.PAGE_ORIGIN;
    function restoreUnits() {
        doc.viewPreferences.horizontalMeasurementUnits = saved.h;
        doc.viewPreferences.verticalMeasurementUnits   = saved.v;
        doc.viewPreferences.rulerOrigin                = saved.r;
    }

    // ── FIND PROMPT FRAMES ─────────────────────────────────────
    var all = doc.textFrames.everyItem().getElements();
    var frames = [], i, tf;
    for (i = 0; i < all.length; i++) {
        if (all[i].label === LABEL && all[i].parentPage) frames.push(all[i]);
    }
    if (frames.length === 0) {
        // as-placed geometry: 3.5" wide, bottom on the bottom margin, auto-height
        for (i = 0; i < all.length; i++) {
            tf = all[i];
            if (!tf.parentPage) continue;
            var b = tf.geometricBounds;
            if (Math.abs(b[2] - BOTTOM) > 0.02) continue;
            if (Math.abs((b[3] - b[1]) - 3.5) > 0.05) continue;
            if (tf.paragraphs.length < 2) continue;
            if (tf.textFramePreferences.autoSizingType !== AutoSizingTypeEnum.HEIGHT_ONLY) continue;
            tf.label = LABEL;   // tag for re-runs
            frames.push(tf);
        }
    }
    if (frames.length === 0) { restoreUnits(); alert("No prompt frames found."); return; }

    // ── GROUP BY PAGE ──────────────────────────────────────────
    var byPage = {}, order = [];
    for (i = 0; i < frames.length; i++) {
        var pid = frames[i].parentPage.id;
        if (!byPage[pid]) { byPage[pid] = []; order.push(pid); }
        byPage[pid].push(frames[i]);
    }

    // ── MEASUREMENT HELPERS ────────────────────────────────────
    function lineEnd(line) {
        var chars = line.characters, n = chars.length;
        for (var c = n - 1; c >= 0; c--) {
            var ch = chars.item(c);
            var s = ch.contents;
            if (s !== " " && s !== "\t" && s !== "\r") return ch.endHorizontalOffset;
        }
        return line.endHorizontalOffset;
    }
    function ragScore(tf) { // {s: summed line-end spread of every wrapped paragraph, n: total lines}
        // params/ref paragraphs count too once they wrap — a width that orphans
        // "--hd" onto its own short line scores worse than one that balances it.
        // A paragraph's LAST line may end short of the pack for free, but ending
        // beyond the longest non-final line (the long-last-line look) is penalized.
        var ps = tf.paragraphs, s = 0, n = 0;
        var packMax = null, finals = [];
        for (var p = 1; p < ps.length; p++) {
            var ls = ps.item(p).lines, L = ls.length;
            n += L;
            for (var li = 0; li < L; li++) {
                var e = lineEnd(ls.item(li));
                if (li === L - 1) finals.push(e);
                else if (packMax === null || e > packMax) packMax = e;
            }
            if (L < 2) continue;
            var mn = null, mx = null;
            for (li = 0; li < L; li++) {
                var e2 = lineEnd(ls.item(li));
                if (mn === null || e2 < mn) mn = e2;
                if (mx === null || e2 > mx) mx = e2;
            }
            s += mx - mn;
        }
        if (packMax !== null) {
            for (var f = 0; f < finals.length; f++) {
                if (finals[f] > packMax) s += (finals[f] - packMax) * 2;
            }
        }
        return { s: s, n: n };
    }
    function setWidth(tf, w) { // scoring position: parked at the left margin
        var b = tf.geometricBounds;
        tf.geometricBounds = [b[0], MARGIN, b[2], MARGIN + w];
    }
    function buildCurve(tf, minW, maxW) {
        var samples = [];
        for (var w = minW; w <= maxW + 1e-6; w += STEP) {
            setWidth(tf, w);
            var r = ragScore(tf);
            samples.push({ w: w, s: r.s, n: r.n });
        }
        return samples;
    }
    function bestSolo(curve) { // best rag; among still-good widths, closest to half a page
        var min = null, k;
        for (k = 0; k < curve.length; k++) if (min === null || curve[k].s < min) min = curve[k].s;
        var pick = null, bd = null;
        for (k = 0; k < curve.length; k++) {
            if (curve[k].s > min + BAND) continue;
            var d = Math.abs(curve[k].w - TARGET);
            if (pick === null || d < bd - 1e-9 ||
                (Math.abs(d - bd) <= 1e-9 && curve[k].w > pick.w)) { pick = curve[k]; bd = d; }
        }
        return pick;
    }

    // ── TRACKING PASS ──────────────────────────────────────────
    function storySig(tf) {
        var sig = [], ps = tf.paragraphs;
        for (var p = 0; p < ps.length; p++) {
            var ls = ps.item(p).lines;
            for (var l = 0; l < ls.length; l++) sig.push(ls.item(l).characters.length);
        }
        return sig.join(",");
    }
    function trackParagraph(tf, pi) {
        for (var pass = 0; pass < 2; pass++) {
            var para = tf.paragraphs.item(pi);
            var L = para.lines.length;
            if (L < 2) return;
            var ends = [], li;
            for (li = 0; li < L; li++) ends.push(lineEnd(para.lines.item(li)));
            var mean = 0;
            for (li = 0; li < L; li++) mean += ends[li];
            mean /= L;
            var changed = false;
            for (li = 0; li < L; li++) {
                para = tf.paragraphs.item(pi);
                if (li >= para.lines.length) break;
                var line = para.lines.item(li);
                if (line.characters.length === 0) continue;
                var e = lineEnd(line);
                var cur = line.characters.item(0).tracking;
                var want = cur;
                if (e < mean - TOL) want = TRACK;
                else if (e > mean + TOL) want = -TRACK;
                else continue;
                if (want === cur) continue;
                var c0 = line.characters.item(0).index;
                var c1 = line.characters.item(-1).index;
                var before = storySig(tf);
                tf.parentStory.characters.itemByRange(c0, c1).tracking = want;
                if (storySig(tf) !== before) {
                    tf.parentStory.characters.itemByRange(c0, c1).tracking = cur; // reflowed — back off
                } else changed = true;
            }
            if (!changed) return;
        }
    }
    function trackFrame(tf) { // body + params (+ ref line, harmless when single-line)
        for (var p = 1; p < tf.paragraphs.length; p++) trackParagraph(tf, p);
    }

    // ── TIGHTEN: shrink width to the longest line, no reflow ───
    function tighten(tf) {
        var b = tf.geometricBounds, left = b[1], maxE = null;
        var ps = tf.paragraphs;
        for (var p = 0; p < ps.length; p++) {
            var ls = ps.item(p).lines;
            for (var l = 0; l < ls.length; l++) {
                var e = lineEnd(ls.item(l));
                if (maxE === null || e > maxE) maxE = e;
            }
        }
        if (maxE === null) return;
        var wTight = (maxE - left) + 0.01;
        var wCur = b[3] - b[1];
        if (wTight >= wCur - 0.005) return;
        var before = storySig(tf);
        setWidth(tf, wTight);
        if (storySig(tf) !== before) setWidth(tf, wCur); // reflowed — keep chosen width
    }

    // ── FINAL GEOMETRY ─────────────────────────────────────────
    function frameH(tf) { var b = tf.geometricBounds; return b[2] - b[0]; }
    function placeSolo(tf) {
        var b = tf.geometricBounds, w = b[3] - b[1], h = frameH(tf);
        var isLeft = tf.parentPage.side === PageSideOptions.LEFT_HAND;
        var l = isLeft ? MARGIN : OUTER_M - w;
        tf.geometricBounds = [BOTTOM - h, l, BOTTOM, l + w];
    }
    function placePair(tfL, tfR) {
        var wL = tfL.geometricBounds[3] - tfL.geometricBounds[1];
        var wR = tfR.geometricBounds[3] - tfR.geometricBounds[1];
        var hL = frameH(tfL), hR = frameH(tfR);
        var top = BOTTOM - Math.max(hL, hR);
        var isLeft = tfL.parentPage.side === PageSideOptions.LEFT_HAND;
        var xL = isLeft ? MARGIN : OUTER_M - wR - GAP - wL;
        var xR = xL + wL + GAP;
        tfL.geometricBounds = [top, xL, top + hL, xL + wL];
        tfR.geometricBounds = [top, xR, top + hR, xR + wR];
    }

    // ── MAIN ───────────────────────────────────────────────────
    var soloCount = 0, pairCount = 0, skipped = [];

    for (i = 0; i < order.length; i++) {
        var group = byPage[order[i]];
        if (pagesFilter && !pagesFilter[group[0].parentPage.name]) continue;
        // fixed left-right order from current positions — never swapped
        group.sort(function (a, b2) { return a.geometricBounds[1] - b2.geometricBounds[1]; });

        var g;
        for (g = 0; g < group.length; g++) {
            group[g].texts.item(0).tracking = 0;   // clean slate so re-runs don't score stale tracking
            var ps0 = group[g].paragraphs;
            for (var bi = 1; bi < ps0.length; bi++) ps0.item(bi).balanceRaggedLines = true;
        }

        if (group.length === 1) {
            tf = group[0];
            var pick = bestSolo(buildCurve(tf, MIN_W, AVAIL));
            setWidth(tf, pick.w);
            trackFrame(tf);
            tighten(tf);
            placeSolo(tf);
            soloCount++;
        } else if (group.length === 2) {
            var tfL = group[0], tfR = group[1];
            var maxW = AVAIL - GAP - MIN_W;
            var curveL = buildCurve(tfL, MIN_W, maxW);
            var curveR = buildCurve(tfR, MIN_W, maxW);
            // joint split: best combined spread; among still-good splits, the one
            // with both widths closest to the per-frame ideal wins
            var minTot = null, a, c;
            for (a = 0; a < curveL.length; a++) {
                for (c = 0; c < curveR.length; c++) {
                    if (curveL[a].w + curveR[c].w + GAP > AVAIL + 1e-6) break;
                    var t = curveL[a].s + curveR[c].s;
                    if (minTot === null || t < minTot) minTot = t;
                }
            }
            // among still-good splits: shortest tallest-frame first (no towering
            // narrow prompts), then widths closest to the per-frame ideal
            var best = null, bestMaxN = null, bestDev = null;
            for (a = 0; a < curveL.length; a++) {
                for (c = 0; c < curveR.length; c++) {
                    if (curveL[a].w + curveR[c].w + GAP > AVAIL + 1e-6) break;
                    if (curveL[a].s + curveR[c].s > minTot + BAND) continue;
                    var mN = Math.max(curveL[a].n, curveR[c].n);
                    var dev = Math.abs(curveL[a].w - TARGET2) + Math.abs(curveR[c].w - TARGET2);
                    if (best === null || mN < bestMaxN ||
                        (mN === bestMaxN && dev < bestDev - 1e-9)) {
                        best = { L: curveL[a], R: curveR[c] }; bestMaxN = mN; bestDev = dev;
                    }
                }
            }
            setWidth(tfL, best.L.w);
            setWidth(tfR, best.R.w);
            trackFrame(tfL); trackFrame(tfR);
            tighten(tfL); tighten(tfR);
            placePair(tfL, tfR);
            pairCount++;
        } else {
            skipped.push("page " + group[0].parentPage.name + ": " + group.length + " prompt frames");
        }
    }

    restoreUnits();
    var msg = "Ragged " + soloCount + " solo prompts and " + pairCount + " pairs.";
    if (skipped.length) msg += "\n\nSkipped (more than 2 frames on page):\n" + skipped.join("\n");
    if (quiet) return msg;
    alert(msg);
}

var __result = app.doScript(ragPrompts, ScriptLanguage.JAVASCRIPT, undefined,
             UndoModes.ENTIRE_SCRIPT, "Rag Prompts");
__result;
