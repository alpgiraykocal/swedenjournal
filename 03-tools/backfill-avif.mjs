// Backfill missing AVIF variants from the committed JPEG variants (sharp / libavif).
//
// Why this exists: the browser content editor generates thumb/medium/full JPEG + WebP
// reliably, but its AVIF path uses canvas.toBlob("image/avif"), which Safari does not
// support at all and Chrome produces inconsistently (often larger than WebP, so it gets
// dropped). Result: editor-added photos shipped without AVIF.
//
// This step runs in the build (CI) BEFORE sync-image-variants.mjs. For every photo/size
// that has no AVIF file on disk, it encodes one from the same-size JPEG variant. AVIF
// from an already-downsized JPEG is still ~50–60% smaller than the WebP, so the
// efficiency gate in sync-image-variants keeps it. Variants generated from the original
// source (generate-image-variants.sh) are left untouched — we only fill gaps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

// Match the qualities used by generate-image-variants.sh so AVIF looks consistent.
const SIZES = { thumb: 42, medium: 44, full: 46 };

const generatedDir = (size) => path.join(websiteDir, "assets/images/generated", size);
const baseName = (src) => path.basename(src, path.extname(src));

let made = 0;
let skipped = 0;
let dimsFilled = 0;
const failures = [];

// Backfill missing intrinsic width/height from the on-disk full JPEG. fullVariantDims()
// (templates.mjs) returns null without them, which would drop the og:image:width/height
// /alt tags that qa-static-checks requires on every static page — a build-breaking gap
// for any photo added via raw JSON without dims. The editor sets dims on upload; this
// closes the hand-edited path. Ratio is preserved, so the value the meta needs is exact.
async function backfillDims(photo) {
  const w = Number(photo.width), h = Number(photo.height);
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) return false;
  const fullJpeg = path.join(generatedDir("full"), `${baseName(photo.src)}.jpeg`);
  if (!fs.existsSync(fullJpeg)) return false;
  try {
    const meta = await sharp(fullJpeg).metadata();
    if (meta.width && meta.height) {
      photo.width = meta.width;
      photo.height = meta.height;
      dimsFilled += 1;
      return true;
    }
  } catch (e) {
    failures.push(`${baseName(photo.src)}/dims: ${e.message || e}`);
  }
  return false;
}

let dimsChanged = false;
for (const photo of data.photos || []) {
  if (!photo.src) continue;
  const base = baseName(photo.src);
  // eslint-disable-next-line no-await-in-loop
  if (await backfillDims(photo)) dimsChanged = true;
  for (const [size, quality] of Object.entries(SIZES)) {
    const jpegPath = path.join(generatedDir(size), `${base}.jpeg`);
    const avifPath = path.join(generatedDir(size), `${base}.avif`);
    if (fs.existsSync(avifPath)) { skipped += 1; continue; } // keep source-quality AVIF
    if (!fs.existsSync(jpegPath)) continue;                  // no base to encode from
    try {
      // eslint-disable-next-line no-await-in-loop
      await sharp(jpegPath).avif({ quality }).toFile(avifPath);
      made += 1;
    } catch (e) {
      failures.push(`${base}/${size}: ${e.message || e}`);
    }
  }
}

// Persist backfilled dims so the downstream steps (sync-image-variants, render-site)
// see them. Same 2-space + trailing-newline shape the editor and sync-image-variants
// write, so the on-disk diff stays minimal when nothing changed.
if (dimsChanged) {
  fs.writeFileSync(path.join(websiteDir, "assets/data/site-content.json"), `${JSON.stringify(data, null, 2)}\n`);
}

if (failures.length) for (const f of failures) console.warn(`! AVIF backfill failed: ${f}`);
console.log(`AVIF backfill: ${made} generated, ${skipped} already present${dimsFilled ? `, ${dimsFilled} dims backfilled` : ""}${failures.length ? `, ${failures.length} failed` : ""}.`);
