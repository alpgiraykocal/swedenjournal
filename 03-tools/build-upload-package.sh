#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/01-website-ready-to-upload"
OUTPUT_DIR="$ROOT_DIR/04-upload-package"
TMP_DIR="$ROOT_DIR/.upload-package-tmp"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

node "$ROOT_DIR/03-tools/sync-image-variants.mjs"
node "$ROOT_DIR/03-tools/generate-rss.mjs"
node "$ROOT_DIR/03-tools/generate-sitemap.mjs"
node "$ROOT_DIR/03-tools/inject-head-preloads.mjs"
node "$ROOT_DIR/03-tools/render-site.mjs"

rsync -a \
  --exclude 'assets/images/photos/' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '* 2' \
  "$SOURCE_DIR"/ "$TMP_DIR"/

find "$TMP_DIR" -depth \( -name '.DS_Store' -o -name '._*' -o -name '* 2' \) -exec rm -rf {} +

rm -rf "$OUTPUT_DIR"
mv "$TMP_DIR" "$OUTPUT_DIR"
find "$ROOT_DIR" -maxdepth 1 -type d \( -name '04-upload-package [0-9]*' -o -name '.upload-package-tmp [0-9]*' \) -exec rm -rf {} +
find "$ROOT_DIR" -maxdepth 3 \( -name '.DS_Store' -o -name '._*' \) -delete
find "$OUTPUT_DIR" -depth \( -name '.DS_Store' -o -name '._*' -o -name '* [0-9]*' \) -exec rm -rf {} +
xattr -cr "$OUTPUT_DIR" 2>/dev/null || true

printf 'Upload package created at %s\n' "$OUTPUT_DIR"
du -sh "$OUTPUT_DIR"
node "$ROOT_DIR/03-tools/qa-static-checks.mjs"
