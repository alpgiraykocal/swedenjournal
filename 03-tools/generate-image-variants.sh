#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PHOTO_DIR="$ROOT_DIR/01-website-ready-to-upload/assets/images/photos"
OUTPUT_DIR="$ROOT_DIR/01-website-ready-to-upload/assets/images/generated"

# Use local node_modules if available (after npm install), otherwise download via npx.
# Run `npm install` in the project root to pin the version from package.json.
if [ -x "$ROOT_DIR/node_modules/.bin/sharp" ]; then
  SHARP_CMD="$ROOT_DIR/node_modules/.bin/sharp"
else
  SHARP_CMD="npx --yes sharp-cli"
fi

mkdir -p "$OUTPUT_DIR/thumb" "$OUTPUT_DIR/medium" "$OUTPUT_DIR/full"

# Process all supported source formats (not just .jpeg)
shopt -s nullglob
images=("$PHOTO_DIR"/*.jpeg "$PHOTO_DIR"/*.jpg "$PHOTO_DIR"/*.png "$PHOTO_DIR"/*.webp "$PHOTO_DIR"/*.avif)
shopt -u nullglob

if [ ${#images[@]} -eq 0 ]; then
  echo "No source images found in $PHOTO_DIR"
  exit 0
fi

for image in "${images[@]}"; do
  name="$(basename "$image")"
  base="${name%.*}"

  # thumb (480px) — consistent -p flag across all formats
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/thumb/$base.jpeg" -f jpeg -q 78 -p resize 480
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/thumb/$base.webp"  -f webp  -q 72 -p resize 480
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/thumb/$base.avif"  -f avif  -q 42 -p resize 480

  # medium (1200px)
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/medium/$base.jpeg" -f jpeg -q 82 -p resize 1200
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/medium/$base.webp"  -f webp  -q 76 -p resize 1200
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/medium/$base.avif"  -f avif  -q 44 -p resize 1200

  # full (2200px)
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/full/$base.jpeg"   -f jpeg -q 84 -p resize 2200
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/full/$base.webp"    -f webp  -q 78 -p resize 2200
  $SHARP_CMD -i "$image" -o "$OUTPUT_DIR/full/$base.avif"    -f avif  -q 46 -p resize 2200

  echo "Generated variants for: $name"
done

node "$ROOT_DIR/03-tools/sync-image-variants.mjs"
echo "Done. Variants generated and site-content.json variant paths synced."
