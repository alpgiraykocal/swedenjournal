// LOCAL-ONLY: enrich each photo in site-content.json with camera EXIF (camera, lens,
// ISO, aperture, shutter, focal length, capture date) read from the ORIGINAL source
// file in assets/images/photos/.
//
// Why local-only: the full-resolution sources are gitignored (~182 MB, see .gitignore),
// so they do NOT exist in the CI checkout — and sharp strips metadata from the generated
// variants. EXIF can therefore only be extracted where the sources live: on the author's
// machine. The parsed values are written into site-content.json, which IS committed, so
// the build/runtime render them with no source access. Run this before committing when
// you add photos:  node 03-tools/backfill-exif.mjs   (add --force to re-extract all).
//
// It is deliberately NOT wired into build.mjs: on CI it would find no sources and no-op,
// but keeping it out avoids implying the build depends on the raw photos.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import exifReader from "exif-reader";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const dataPath = path.join(websiteDir, "assets/data/site-content.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const force = process.argv.includes("--force");

// Shutter, unit-less: <1s as a 1/N fraction, >=1s as a whole-second count. The display
// layer appends the "s". Matches how cameras show it (1/800, 2, 30).
const fmtShutter = (t) => {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n >= 1 ? String(Math.round(n)) : `1/${Math.round(1 / n)}`;
};
// "FUJIFILM" + "X-T30 II" -> "FUJIFILM X-T30 II"; avoid duplicating the make when the
// model already leads with it (e.g. make "NIKON", model "NIKON D850").
const cameraName = (make, model) => {
  const mk = String(make || "").trim();
  const md = String(model || "").trim();
  if (!md) return mk || "";
  if (!mk || md.toLowerCase().startsWith(mk.toLowerCase())) return md;
  return `${mk} ${md}`;
};
const isoDate = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
// Drop empty/zero fields so the stored object stays minimal and the display can simply
// test truthiness.
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === null || v === undefined) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
};

// GPS [deg, min, sec] + hemisphere ref -> signed decimal degrees (6 dp, matching the
// editor's readExif rounding). Null when the triplet is absent or out of range.
function gpsDecimal(arr, ref, negRef, max) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const [d = 0, m = 0, s = 0] = arr.map(Number);
  if (![d, m, s].every(Number.isFinite)) return null;
  let val = d + m / 60 + s / 3600;
  if (String(ref).toUpperCase() === negRef) val = -val;
  if (!Number.isFinite(val) || Math.abs(val) > max) return null;
  return Math.round(val * 1e6) / 1e6;
}

function extractExif(absFile) {
  const buf = fs.statSync(absFile) && fs.readFileSync(absFile);
  // sharp exposes the raw EXIF APP1 payload; exif-reader parses it into typed fields.
  return sharp(buf).metadata().then((meta) => {
    if (!meta.exif) return null;
    let parsed;
    try { parsed = exifReader(meta.exif); } catch { return null; }
    const img = parsed.Image || {};
    const photo = parsed.Photo || {};
    const gpsInfo = parsed.GPSInfo || {};
    const lat = gpsDecimal(gpsInfo.GPSLatitude, gpsInfo.GPSLatitudeRef, "S", 90);
    const lng = gpsDecimal(gpsInfo.GPSLongitude, gpsInfo.GPSLongitudeRef, "W", 180);
    const iso = photo.ISOSpeedRatings ?? photo.PhotographicSensitivity ?? photo.ISO;
    const exif = clean({
      camera: cameraName(img.Make, img.Model),
      lens: photo.LensModel || photo.LensMake || "",
      iso: Number.isFinite(Number(iso)) ? Number(iso) : "",
      aperture: Number.isFinite(Number(photo.FNumber)) ? Number(photo.FNumber) : "",
      shutter: fmtShutter(photo.ExposureTime),
      focalLength: Number.isFinite(Number(photo.FocalLength)) ? Math.round(Number(photo.FocalLength)) : "",
      focalLength35: Number.isFinite(Number(photo.FocalLengthIn35mmFilm)) ? Math.round(Number(photo.FocalLengthIn35mmFilm)) : "",
      shotAt: isoDate(photo.DateTimeOriginal || photo.DateTimeDigitized || img.DateTime),
      // Capture location — feeds the atlas photo pins. Photos already carrying an
      // exif block keep their old shape until re-extracted with --force.
      gps: lat !== null && lng !== null && (lat || lng) ? { lat, lng } : "",
    });
    return Object.keys(exif).length ? exif : null;
  });
}

let filled = 0, skipped = 0, missing = 0;
const failures = [];
for (const photo of data.photos || []) {
  if (!photo.src) continue;
  if (photo.exif && !force) { skipped += 1; continue; }
  const absFile = path.join(websiteDir, photo.src);
  if (!fs.existsSync(absFile)) { missing += 1; continue; } // no source in this checkout
  try {
    // eslint-disable-next-line no-await-in-loop
    const exif = await extractExif(absFile);
    if (exif) { photo.exif = exif; filled += 1; }
    else skipped += 1;
  } catch (e) {
    failures.push(`${photo.id || photo.src}: ${e.message || e}`);
  }
}

if (filled) fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
if (failures.length) for (const f of failures) console.warn(`! EXIF read failed: ${f}`);
console.log(`EXIF backfill: ${filled} enriched, ${skipped} kept${missing ? `, ${missing} source(s) absent (skipped)` : ""}${failures.length ? `, ${failures.length} failed` : ""}.`);
