#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/01-website-ready-to-upload"
OUTPUT_DIR="$ROOT_DIR/04-upload-package"
TMP_DIR="$ROOT_DIR/.upload-package-tmp"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Delegate to the same build CI runs, rather than re-listing its steps here. The
# hand-rolled list this replaces had drifted badly: it ran inject-head-preloads BEFORE
# render-site, and render-site rewrites the photo and collection shells from scratch, so
# the perf-head block was injected and then immediately wiped — all 46 photo pages and
# both collection pages shipped with no theme colour, no font or LCP preload and no
# speculation rules. It also skipped build.mjs's asset-normalisation pass, leaving those
# same pages pointing at the placeholder `?v=20260601` from photoShell instead of the
# real content hash, so cache-busting never fired for them. backfill-avif and
# generate-llms were missing too. One command means the package cannot drift from the
# deployed site again.
node "$ROOT_DIR/03-tools/build.mjs"

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
find "$OUTPUT_DIR" -depth \( -name '.DS_Store' -o -name '._*' \) -exec rm -rf {} +
# iCloud conflict copies only: "index 2.html", "assets 3", "site 10.css". The previous
# pattern here was '* [0-9]*', which deletes anything with a space followed by a digit
# anywhere in the name — "Chapter 2 Notes.html" would have gone too. Anchored to the end
# so it can only match the copy suffix.
find -E "$OUTPUT_DIR" -depth -regex '.*/[^/]+ [0-9]+(\.[^/.]+)?' -exec rm -rf {} +
xattr -cr "$OUTPUT_DIR" 2>/dev/null || true

printf 'Upload package created at %s\n' "$OUTPUT_DIR"
du -sh "$OUTPUT_DIR"
node "$ROOT_DIR/03-tools/qa-static-checks.mjs"
