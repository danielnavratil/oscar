#!/bin/bash
# ───────────────────────────────────────────────────────────────
# oscar_pipeline.sh
# Full image pipeline in one command:
#   1. Download full-res images from Midjourney CDN
#   2. Upscale 4x with Real-ESRGAN
#   3. Convert to two CMYK profiles via Photoshop
#
# Usage:
#   ./oscar_pipeline.sh oscar-issue-38-pairs.json
#   ./oscar_pipeline.sh oscar-issue-38-pairs.json --test   (3 images only)
#
# Output (next to the JSON file):
#   <name>-output/downloads   → full-res .webp from CDN
#   <name>-output/upscaled    → 4x sRGB PNGs
#   <name>-output/HH Links    → U.S. Web Coated (SWOP) v2 CMYK JPEGs
#   <name>-output/KOPA Links  → PSO Coated v3 CMYK JPEGs
# ───────────────────────────────────────────────────────────────

set -e

# ── CONFIG ────────────────────────────────────────────────────
REALESRGAN="$HOME/tools/realesrgan/realesrgan-ncnn-vulkan"
REALESRGAN_MODELS="$HOME/tools/realesrgan/models"
MODEL="realesrgan-x4plus"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JSX="$SCRIPT_DIR/convert_both.jsx"
DOWNLOAD_PY="$SCRIPT_DIR/download_images.py"

# ── ARGS ──────────────────────────────────────────────────────
PAIRS_JSON="$1"
TEST_FLAG=""
if [[ "$*" == *"--test"* ]]; then TEST_FLAG="--test"; fi

if [ -z "$PAIRS_JSON" ]; then
  echo "Usage: ./oscar_pipeline.sh <pairs.json> [--test]"
  exit 1
fi
if [ ! -f "$PAIRS_JSON" ]; then
  echo "File not found: $PAIRS_JSON"
  exit 1
fi
if [ ! -x "$REALESRGAN" ]; then
  echo "Real-ESRGAN not found at: $REALESRGAN"
  echo "Edit the REALESRGAN path at the top of this script."
  exit 1
fi

# ── OUTPUT PATHS (sibling of the JSON file) ───────────────────
JSON_DIR="$(cd "$(dirname "$PAIRS_JSON")" && pwd)"
JSON_BASE="$(basename "$PAIRS_JSON" .json)"
OUTDIR="$JSON_DIR/${JSON_BASE}-output"
DOWNLOADS="$OUTDIR/downloads"
UPSCALED="$OUTDIR/upscaled"
mkdir -p "$DOWNLOADS" "$UPSCALED"
LOG="$OUTDIR/pipeline.log"

# Tee all output to log file
exec > >(tee "$LOG") 2>&1

echo "────────────────────────────────────────"
echo "Oscar Pipeline"
echo "Input:  $PAIRS_JSON"
echo "Output: $OUTDIR"
echo "Log:    $LOG"
echo "────────────────────────────────────────"
echo ""
echo "  Watch progress: tail -f \"$LOG\""
echo ""

# ── 1. DOWNLOAD ───────────────────────────────────────────────
echo "[1/3] Downloading images from Midjourney CDN..."
python3 "$DOWNLOAD_PY" "$PAIRS_JSON" "$DOWNLOADS" $TEST_FLAG
echo ""

# ── 2. UPSCALE ────────────────────────────────────────────────
echo "[2/3] Upscaling 4x with Real-ESRGAN..."
shopt -s nullglob nocaseglob
WEBP_FILES=("$DOWNLOADS"/*.webp)
shopt -u nullglob nocaseglob
TOTAL=${#WEBP_FILES[@]}
DONE=0
SKIPPED=0
for IMG in "${WEBP_FILES[@]}"; do
  BASE="$(basename "$IMG" .webp)"
  OUT="$UPSCALED/$BASE.png"
  DONE=$((DONE + 1))
  PCT=$(( DONE * 100 / TOTAL ))
  if [ -f "$OUT" ]; then
    echo "[$DONE/$TOTAL] ($PCT%) skip   $BASE"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  # already fully converted in a previous run (upscaled/ may have been cleaned up)
  if [ -f "$OUTDIR/HH Links/$BASE.jpg" ] && [ -f "$OUTDIR/KOPA Links/$BASE.jpg" ]; then
    echo "[$DONE/$TOTAL] ($PCT%) skip   $BASE (already converted)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  echo -n "[$DONE/$TOTAL] ($PCT%) upscaling $BASE... "
  "$REALESRGAN" -i "$IMG" -o "$OUT" -n "$MODEL" -s 4 -m "$REALESRGAN_MODELS" > /dev/null 2>&1
  echo "done"
done
echo "Upscale complete: $((TOTAL - SKIPPED)) processed, $SKIPPED skipped."
echo ""

# ── 3. CMYK CONVERSION ───────────────────────────────────────
echo "[3/3] Converting to CMYK via Photoshop..."
echo "$UPSCALED" > /tmp/oscar_convert_folder.txt

# Launch Photoshop and wait until it is ready before sending the script
osascript <<END
tell application id "com.adobe.Photoshop"
    activate
end tell
END

echo "    Waiting for Photoshop to be ready..."
sleep 10

osascript <<END
with timeout of 3600 seconds
    tell application id "com.adobe.Photoshop"
        do javascript (alias (POSIX file "$JSX" as text))
    end tell
end timeout
END

# ── CLEANUP: drop upscaled intermediates (~6GB/issue) once conversion is
# verified complete — both Links folders must hold a JPEG per downloaded image.
# Kept on any mismatch so a partial run can resume without re-upscaling.
HH_COUNT=$(ls "$OUTDIR/HH Links"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
KOPA_COUNT=$(ls "$OUTDIR/KOPA Links"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
UPSCALED_NOTE="4x sRGB PNGs"
if [ "$TOTAL" -gt 0 ] && [ "$HH_COUNT" -eq "$TOTAL" ] && [ "$KOPA_COUNT" -eq "$TOTAL" ]; then
  rm -rf "$UPSCALED"
  UPSCALED_NOTE="deleted (conversion complete: $TOTAL/$TOTAL in both Links folders)"
else
  echo ""
  echo "NOTE: keeping upscaled/ — conversion incomplete (HH $HH_COUNT, KOPA $KOPA_COUNT of $TOTAL)."
  echo "      Fix the errors above, then re-run this script: it resumes where it left off."
fi

echo ""
echo "────────────────────────────────────────"
echo "Done. Output in: $OUTDIR"
echo "  downloads   → full-res .webp from CDN"
echo "  upscaled    → $UPSCALED_NOTE"
echo "  HH Links    → SWOP CMYK JPEGs (US press)"
echo "  KOPA Links  → PSO CMYK JPEGs (Euro press)"
echo "────────────────────────────────────────"
