import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const dataPath = path.join(websiteDir, "assets/data/site-content.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function variantPath(src, size, ext){
  const base = path.basename(src, path.extname(src));
  return `assets/images/generated/${size}/${base}.${ext}`;
}

function absoluteVariant(src, size, ext){
  return path.join(websiteDir, variantPath(src, size, ext));
}

function fileSize(filePath){
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

let removedAvif = 0;

function efficientAvifExists(src, size){
  const avifPath = absoluteVariant(src, size, "avif");
  const avifSize = fileSize(avifPath);
  if (!avifSize) return false;
  const jpegSize = fileSize(absoluteVariant(src, size, "jpeg"));
  const webpSize = fileSize(absoluteVariant(src, size, "webp"));
  const bestRaster = Math.min(...[jpegSize, webpSize].filter(Number.isFinite));
  if (Number.isFinite(bestRaster) && avifSize > bestRaster * 1.1) {
    fs.rmSync(avifPath, { force: true });
    removedAvif += 1;
    return false;
  }
  return true;
}

for (const photo of data.photos || []) {
  const sizes = {
    thumb:  { width: 480 },
    medium: { width: 1200 },
    full:   { width: 2200 },
  };
  // Declared srcset width = the target cap, but never wider than the source itself.
  // generate-image-variants.sh resizes with no enlargement, so a small/portrait source
  // yields a variant narrower than the cap; advertising the cap as its `w` descriptor
  // would make the browser overrate the candidate. Clamp to the real pixel width.
  const sourceWidth = Number(photo.width);
  photo.variants = {};
  for (const [size, meta] of Object.entries(sizes)) {
    photo.variants[size] = {
      jpeg: variantPath(photo.src, size, "jpeg"),
      webp: variantPath(photo.src, size, "webp"),
      width: Number.isFinite(sourceWidth) && sourceWidth > 0 ? Math.min(meta.width, sourceWidth) : meta.width,
    };
    if (efficientAvifExists(photo.src, size)) {
      photo.variants[size].avif = variantPath(photo.src, size, "avif");
    }
  }
}

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Synced variants for ${data.photos?.length ?? 0} photos (removed ${removedAvif} oversized AVIF files).`);
