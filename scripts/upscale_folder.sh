#!/bin/bash
# ───────────────────────────────────────────────────────────────
# upscale_folder.sh
# Upscales every image in a folder 4x, replacing the originals in place.
#
#   Usage:  ./upscale_folder.sh "/path/to/folder"
# ───────────────────────────────────────────────────────────────

set -e

REALESRGAN="$HOME/tools/realesrgan/realesrgan-ncnn-vulkan"
REALESRGAN_MODELS="$HOME/tools/realesrgan/models"
MODEL="realesrgan-x4plus"
SCALE=4
TILE=256   # smaller tiles = lower memory; helps avoid segfaults

FOLDER="$1"
if [ -z "$FOLDER" ]; then
  echo "Usage: ./upscale_folder.sh \"/path/to/folder\""
  exit 1
fi
if [ ! -d "$FOLDER" ]; then
  echo "Folder not found: $FOLDER"
  exit 1
fi

TMP="$FOLDER/__upscaled_tmp"
mkdir -p "$TMP"

echo "Upscaling images in: $FOLDER"

# Process each image individually so one bad file can't kill the whole run
shopt -s nullglob nocaseglob
found=0
ok_files=()
for img in "$FOLDER"/*.png "$FOLDER"/*.jpg "$FOLDER"/*.jpeg "$FOLDER"/*.tif "$FOLDER"/*.tiff "$FOLDER"/*.webp; do
  found=1
  base="$(basename "$img")"
  name="${base%.*}"
  echo "  → $base"
  if "$REALESRGAN" -i "$img" -o "$TMP/$name.png" -n "$MODEL" -s "$SCALE" -t "$TILE" -m "$REALESRGAN_MODELS"; then
    ok_files+=("$img")
  else
    echo "    FAILED on $base (skipped, original kept)"
  fi
done
shopt -u nullglob nocaseglob

if [ "$found" -eq 0 ]; then
  echo "No images found in $FOLDER"
  rmdir "$TMP" 2>/dev/null || true
  exit 0
fi

# Replace originals with upscaled versions (only the ones that succeeded)
for img in "${ok_files[@]}"; do
  rm -f "$img"
done
mv "$TMP"/* "$FOLDER"/ 2>/dev/null || true
rmdir "$TMP" 2>/dev/null || true

echo "Done. ${#ok_files[@]} originals in $FOLDER replaced with 4x versions."
