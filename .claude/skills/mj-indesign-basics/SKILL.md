---
name: mj-indesign-basics
description: Ground rules for driving Adobe InDesign from Claude on Daniel's Mac for the Midjourney magazine (MJ_NN.indd, posters, KOPA docs) — how to run ExtendScript via osascript, presets, script units, undo steps, page names vs positions, saving, previews, stopping a runaway script. Use this before ANY InDesign scripting for the magazine, and whenever another mj-* skill says "run it in InDesign", even for a one-line read of the document.
---

# Driving InDesign for the MJ magazine

Every mj-* skill that touches an .indd follows these rules. They exist because each one was learned by breaking something in a live issue document that Daniel was working in at the same time.

## Running a script

- Write the ExtendScript to the session scratchpad (never `/tmp` for InDesign itself: ExtendScript can't write there on this Mac; use `Folder.temp` inside scripts) and run it:
  ```bash
  osascript -e 'with timeout of 900 seconds' -e 'tell application id "com.adobe.InDesign" to do script (POSIX file "/path/x.jsx") language javascript' -e 'end timeout'
  ```
  The value of the script's last expression comes back on stdout, so end with a summary string. Placement and other big runs take minutes: use a long timeout.
- The repo scripts live in `/Users/daniel/Code/oscar-v1/scripts/` (canonical). InDesign's Scripts panel runs the copies in `~/Library/Preferences/Adobe InDesign/Version 21.0/en_US/Scripts/Scripts Panel/Midjourney/`. After editing a repo script, copy it there; keep all Oscar .jsx files together (they load each other from their own folder).
- Most repo scripts accept a preset global so they run without dialogs: set `$.global.OSCAR_..._PRESET = {...}`, `$.evalFile(File(repoScript))`, then clear the global in a `finally`. Each script's header comment documents its preset.
- Target documents by name (`app.documents.itemByName("MJ_44.indd")`), not `activeDocument`: Daniel may have another doc in front.
- To read a closed document, `app.open(file, false)` (hidden) and close it with `SaveOptions.NO` when done.
- Pass data into a generated .jsx with `json.dumps(..., ensure_ascii=True)`: ExtendScript has no JSON.parse but reads `\uXXXX` escapes fine, so curly quotes and accents survive.

## Units: the 9-inch-type trap

`app.scriptPreferences.measurementUnit` persists for the whole InDesign session. A helper that sets INCHES and doesn't reset it makes the next script that writes `pointSize = 9` produce 9-inch type (this overset all 88 prompts in issue 44). So:
- In any helper that changes it, save it first and restore it in `finally`. The default is `AutoEnum.AUTO_VALUE` (`MeasurementUnits.AUTO_VALUE` does not exist).
- With scriptPreferences in inches, point sizes and leading need strings like `"9pt"`.
- Prefer measuring in inches via `app.scriptPreferences.measurementUnit` over changing the document's `viewPreferences`: view-preference changes made outside `doScript` land on Daniel's undo stack as "Set Measure Units" steps and get in the way of undoing real work.

## One undo step per action

Wrap every change in
```js
app.doScript(main, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "Readable name");
```
so Daniel can Cmd+Z it in one go. Before undoing anything yourself, check `doc.undoName` is your step; if it isn't, stop: he has edited since (a "Resize" on top means hand work you must not wipe). Only step past view-only entries (units/ruler) and only when you know they are yours.

## Pages

- `pages.itemByName()` and export `pageString` count absolute positions, and the cover pages (116, 117, 1) come first in document order. Match on `page.name` yourself; in `pageString` prefix a position with `+` (`"+8-+9"`).
- Geometry: set `rulerOrigin = PAGE_ORIGIN` inside your doScript for page-relative inches; use `SPREAD_ORIGIN` for anything on the pasteboard or moving items between the two pages of a spread. Restore the view preferences you changed.
- `entirePath` points are `[leftDir, anchor, rightDir]`, each `[x, y]`; `geometricBounds` are `[top, left, bottom, right]`.
- Setting `strokeWeight` on a text frame makes InDesign add a stroke in the last-used colour; don't.

## Saving, stopping, previews

- Never save MJ_NN.indd unless Daniel asks: it is usually open with his unsaved work. Exports include unsaved changes, so say so. `saveACopy` is fine for derived docs (KOPA).
- To show results, export JPEGs of the spreads to `Folder.temp` (`jpegExportPreferences.exportingSpread = true`, 50–110 ppi), copy them out, and look at them before reporting; send them to Daniel with SendUserFile. Stale grey wedges on screen near edited paths are redraw glitches: trust the export.
- "Stop" means stop now. Killing osascript does NOT stop an InDesign `do script`. Don't quit InDesign (unsaved work); make the job fail instead (e.g. make its output folder read-only), then restore permissions and clean up. Before any batch that writes many files, check one iteration's output first.
- Never kill any of Daniel's processes on inference. Report the evidence (`ps -o pid,ppid,lstart,command`) and let him decide.
- Dialog-driven tools launched from Claude's shell are invisible to Daniel (e.g. Asimov Prep); have him double-click them, or use their headless presets.
