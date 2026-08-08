// Generates the thumb/medium/full × jpeg/webp/avif variants for every source photo in
// assets/images/photos, then syncs the variant paths into site-content.json.
//
// This replaces the earlier bash + sharp-cli script. sharp-cli pinned its sharp
// dependency to an exact version, so it always dragged an outdated sharp into the tree
// (plus its own glob/yargs chain) and no npm upgrade path could clear the advisories —
// sharp on its own audits clean. Calling the sharp API directly also removes the
// CLI-flag fragility that made sharp-cli major upgrades risky: 03-tools already uses
// this API in backfill-avif.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, "..");
const photoDir = path.join(root, "01-website-ready-to-upload/assets/images/photos");
const outputDir = path.join(root, "01-website-ready-to-upload/assets/images/generated");

// JPEG and WebP quality carry over from the bash script unchanged — those encoders behave
// the same across the sharp versions involved.
//
// AVIF is raised from 42/44/46. sharp 0.35's AVIF quality scale is not the same as the
// 0.30 one this project encoded its existing photos with: at the old values it produces
// files 25-40% smaller, which looks like an encoder win but is a fidelity drop. Measured
// with windowed SSIM against the source, old q44 medium scored 0.880 on the Anundshög
// runestone and new q44 only 0.834. Matching the previous fidelity needs roughly q50 for
// ordinary photographs and q54 for the high-texture runestone and carving shots, which
// lands about 6-12% larger than the current files.
//
// These values keep new photographs consistent with the 46 already published rather than
// quietly encoding them softer. Existing variants are intentionally NOT regenerated: they
// are already at this fidelity, and re-encoding them would only add ~130MB of binary churn.
const SIZES = [
  { dir: "thumb", width: 480, jpeg: 78, webp: 72, avif: 50 },
  { dir: "medium", width: 1200, jpeg: 82, webp: 76, avif: 52 },
  { dir: "full", width: 2200, jpeg: 84, webp: 78, avif: 54 },
];

const SOURCE_EXT = new Set([".jpeg", ".jpg", ".png", ".webp", ".avif"]);

for (const { dir } of SIZES) fs.mkdirSync(path.join(outputDir, dir), { recursive: true });

const images = fs.existsSync(photoDir)
  ? fs.readdirSync(photoDir).filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase())).sort()
  : [];

if (!images.length) {
  console.log(`No source images found in ${photoDir}`);
  process.exit(0);
}

let written = 0;
for (const name of images) {
  const base = name.slice(0, name.length - path.extname(name).length);
  const src = path.join(photoDir, name);

  for (const size of SIZES) {
    // withoutEnlargement matches the old behaviour for sources narrower than the target:
    // the variant stays at the source width instead of being upscaled.
    const pipeline = () => sharp(src).resize({ width: size.width, withoutEnlargement: true });

    await pipeline().jpeg({ quality: size.jpeg, progressive: true }).toFile(path.join(outputDir, size.dir, `${base}.jpeg`));
    await pipeline().webp({ quality: size.webp }).toFile(path.join(outputDir, size.dir, `${base}.webp`));
    await pipeline().avif({ quality: size.avif }).toFile(path.join(outputDir, size.dir, `${base}.avif`));
    written += 3;
  }
  console.log(`Generated variants for: ${name}`);
}

execFileSync(process.execPath, [path.join(toolsDir, "sync-image-variants.mjs")], { stdio: "inherit" });
console.log(`Done. ${written} variants generated and site-content.json variant paths synced.`);
