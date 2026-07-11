#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { feedXml, sitemapXml } from "../01-website-ready-to-upload/assets/js/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const packageDir = path.join(root, "04-upload-package");
const editorHtml = path.join(root, "02-content-editor", "photo-blog-direct-editor.html");
const editorJs = path.join(root, "02-content-editor", "assets", "editor.js");

const failures = [];

function fail(message) {
  failures.push(message);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  try {
    return JSON.parse(read(filePath));
  } catch (error) {
    fail(`${path.relative(root, filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function walkFiles(dirPath) {
  const out = [];
  if (!exists(dirPath)) return out;
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(nextPath);
      else out.push(nextPath);
    }
  }
  return out;
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) fail(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function checkFile(filePath, label = path.relative(root, filePath)) {
  if (!exists(filePath)) fail(`Missing ${label}`);
}

function checkHtmlMetadata(baseDir) {
  const pages = ["index.html", "gallery/index.html", "stories/index.html", "story/index.html", "about/index.html", "404.html"];
  for (const page of pages) {
    const filePath = path.join(baseDir, page);
    checkFile(filePath);
    if (!exists(filePath)) continue;
    const html = read(filePath);
    const label = path.relative(root, filePath);
    for (const required of [
      'name="viewport"',
      'rel="canonical"',
      'property="og:title"',
      'property="og:url"',
      'property="og:image"',
      'property="og:image:width"',
      'property="og:image:alt"',
      'name="twitter:card"',
    ]) {
      if (!html.includes(required)) fail(`${label} missing ${required}`);
    }
    if (!page.endsWith("404.html") && !/assets\/js\/site\.js\?v=[a-f0-9]+/.test(html)) {
      fail(`${label} missing cache-busted site.js reference`);
    }
  }
}

function checkContent(baseDir, { requireSourcePhotos }) {
  const dataPath = path.join(baseDir, "assets", "data", "site-content.json");
  checkFile(dataPath);
  const content = exists(dataPath) ? readJson(dataPath) : null;
  if (!content) return;

  const photos = Array.isArray(content.photos) ? content.photos : [];
  const stories = Array.isArray(content.stories) ? content.stories : [];
  unique(photos.map((photo) => photo.id), "photo id");
  unique(stories.map((story) => story.slug), "story slug");

  const photoIds = new Set(photos.map((photo) => photo.id));
  const storySlugs = new Set(stories.map((story) => story.slug));
  const baseUrl = content.site?.baseUrl || "";
  if (!/^https:\/\/[^/]+/.test(baseUrl) || /example|localhost|127\.0\.0\.1/.test(baseUrl)) {
    fail(`${path.relative(root, dataPath)} has non-production site.baseUrl`);
  }

  for (const slug of content.home?.featuredStorySlugs || []) {
    if (!storySlugs.has(slug)) fail(`home.featuredStorySlugs references missing story: ${slug}`);
  }
  for (const id of content.home?.galleryPhotoIds || []) {
    if (!photoIds.has(id)) fail(`home.galleryPhotoIds references missing photo: ${id}`);
  }
  for (const story of stories) {
    if (story.heroPhotoId && !photoIds.has(story.heroPhotoId)) fail(`Story ${story.slug} references missing hero photo: ${story.heroPhotoId}`);
    for (const block of story.body || []) {
      const ids = block.type === "image" || block.type === "panorama" ? [block.photoId]
        : block.type === "image-pair" ? (block.photoIds || []) : [];
      for (const id of ids.filter(Boolean)) {
        if (!photoIds.has(id)) fail(`Story ${story.slug} ${block.type} block references missing photo: ${id}`);
      }
    }
  }

  for (const photo of photos) {
    if (!photo.id || !photo.title || !photo.src || !photo.alt) fail(`Photo ${photo.id || photo.title || "unknown"} is missing required identity fields`);
    if (requireSourcePhotos) checkFile(path.join(baseDir, photo.src), `${photo.src}`);
    for (const size of ["thumb", "medium", "full"]) {
      for (const format of ["jpeg", "webp"]) {
        const variant = photo.variants?.[size]?.[format];
        if (!variant) fail(`Photo ${photo.id} missing ${size}/${format} variant path`);
        else checkFile(path.join(baseDir, variant), `${variant}`);
      }
    }
  }

  for (const filter of content.gallery?.filters || []) {
    if (filter === "All") continue;
    const normalized = String(filter).trim().toLowerCase();
    const matches = photos.some((photo) => String(photo.category || "").trim().toLowerCase() === normalized);
    if (!matches) fail(`Gallery filter has no matching photos: ${filter}`);
  }
}

function checkSitemap(baseDir) {
  const sitemapPath = path.join(baseDir, "sitemap.xml");
  const robotsPath = path.join(baseDir, "robots.txt");
  checkFile(sitemapPath);
  checkFile(robotsPath);
  if (!exists(sitemapPath) || !exists(robotsPath)) return;
  const sitemap = read(sitemapPath);
  const robots = read(robotsPath);
  if (!/<loc>https:\/\/[^<]+\/stories\/[^/]+\/<\/loc>/.test(sitemap)) fail(`${path.relative(root, sitemapPath)} has no clean story URLs`);
  if (sitemap.includes("/story/?slug=")) fail(`${path.relative(root, sitemapPath)} still uses legacy story query URLs`);
  if (!robots.includes("Sitemap: https://sweden-journal.com/sitemap.xml")) fail(`${path.relative(root, robotsPath)} missing production sitemap URL`);
}

function checkRss(baseDir) {
  const rssPath = path.join(baseDir, "feed.xml");
  const dataPath = path.join(baseDir, "assets", "data", "site-content.json");
  checkFile(rssPath);
  const content = exists(dataPath) ? readJson(dataPath) : null;
  if (!exists(rssPath) || !content) return;
  const rss = read(rssPath);
  const baseUrl = String(content.site?.baseUrl || "").replace(/\/+$/, "");
  const stories = (content.stories || []).filter((story) => story.title && story.slug);
  const itemCount = (rss.match(/<item>/g) || []).length;
  if (itemCount !== stories.length) fail(`${path.relative(root, rssPath)} has ${itemCount} items but content has ${stories.length} stories`);
  if (rss.includes("Invalid Date")) fail(`${path.relative(root, rssPath)} contains Invalid Date`);
  if (!rss.includes(`<atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>`)) {
    fail(`${path.relative(root, rssPath)} missing canonical atom self link`);
  }
  for (const story of stories) {
    const url = `${baseUrl}/stories/${encodeURIComponent(story.slug)}/`;
    if (!rss.includes(`<link>${url}</link>`)) fail(`${path.relative(root, rssPath)} missing story link: ${story.slug}`);
    if (!rss.includes(`<guid isPermaLink="true">${url}</guid>`)) fail(`${path.relative(root, rssPath)} missing story guid: ${story.slug}`);
  }
  for (const [, value] of rss.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)) {
    if (Number.isNaN(new Date(value).getTime())) fail(`${path.relative(root, rssPath)} has invalid pubDate: ${value}`);
  }
}

function checkStoryShells(baseDir) {
  const dataPath = path.join(baseDir, "assets", "data", "site-content.json");
  const content = exists(dataPath) ? readJson(dataPath) : null;
  if (!content) return;
  for (const story of content.stories || []) {
    const storyPath = path.join(baseDir, "stories", story.slug, "index.html");
    checkFile(storyPath, `stories/${story.slug}/index.html`);
    if (!exists(storyPath)) continue;
    const html = read(storyPath);
    const label = path.relative(root, storyPath);
    if (!html.includes('href="../../assets/css/site.css')) fail(`${label} has wrong stylesheet path`);
    if (!html.includes('window.__DATA_PATH__="../../assets/data/site-content.json"')) fail(`${label} has wrong data path`);
    if (!html.includes('window.__ROOT__="../../"')) fail(`${label} has wrong root path`);
    if (!html.includes('src="../../assets/js/site.js')) fail(`${label} has wrong script path`);
  }
}

// The live host is GitHub Pages (.github/workflows/deploy.yml) behind the
// Cloudflare proxy. GH Pages serves 404.html natively at any depth and ignores
// platform files like _headers/_redirects/.htaccess — those are dead configs
// and must NOT come back (they mislead future maintenance).
function checkFallbackFiles(baseDir) {
  checkFile(path.join(baseDir, "404.html"));
  for (const dead of ["_redirects", "_headers", ".htaccess"]) {
    if (exists(path.join(baseDir, dead))) {
      fail(`${path.relative(root, path.join(baseDir, dead))} is a dead host config (site deploys to GitHub Pages) — remove it`);
    }
  }
}

function checkPhotoShells(baseDir) {
  const dataPath = path.join(baseDir, "assets", "data", "site-content.json");
  const content = exists(dataPath) ? readJson(dataPath) : null;
  if (!content) return;
  for (const photo of content.photos || []) {
    if (!photo.id || !photo.title) continue;
    const pagePath = path.join(baseDir, "photos", photo.id, "index.html");
    checkFile(pagePath, `photos/${photo.id}/index.html`);
    if (!exists(pagePath)) continue;
    const html = read(pagePath);
    const label = path.relative(root, pagePath);
    if (!html.includes('href="../../assets/css/site.css')) fail(`${label} has wrong stylesheet path`);
    if (!html.includes('window.__DATA_PATH__="../../assets/data/site-content.json"')) fail(`${label} has wrong data path`);
    if (!html.includes('data-page="photo"')) fail(`${label} missing data-page="photo"`);
    if (!html.includes(`rel="canonical" href="https://sweden-journal.com/photos/${encodeURIComponent(photo.id)}/"`)) fail(`${label} has wrong canonical`);
    if (!html.includes('"@type":"ImageObject"')) fail(`${label} missing ImageObject JSON-LD`);
    // Photo page <title> must carry the "· Photograph" qualifier so it never collides
    // with the same-named story's title (GSC duplicate title tags).
    if (!/<title>[^<]*· Photograph[^<]*<\/title>/.test(html)) fail(`${label} <title> missing "· Photograph" qualifier`);
    // Google "Image Metadata" recommended fields (GSC flags these when missing).
    for (const field of ['"creditText"', '"license"', '"acquireLicensePage"']) {
      if (!html.includes(field)) fail(`${label} ImageObject JSON-LD missing ${field}`);
    }
  }
  // Gallery ImageGallery JSON-LD carries the same rights fields on its ImageObject items.
  const galleryPage = path.join(baseDir, "gallery", "index.html");
  if (exists(galleryPage) && (content.photos || []).length) {
    const gh = read(galleryPage);
    for (const field of ['"creditText"', '"license"', '"acquireLicensePage"']) {
      if (!gh.includes(field)) fail(`gallery/index.html ImageGallery JSON-LD missing ${field}`);
    }
  }
}

// Byte-level parity: the sitemap/feed on disk must be exactly what the canonical
// builders in templates.mjs produce for the current content. The editor mirrors
// those builders by hand — this check is what makes that mirror trustworthy.
// The volatile inputs (sitemap buildDay, feed lastBuildDate) are read back from
// the file on disk so a same-content regeneration compares byte-for-byte.
function checkGeneratedXmlParity(baseDir) {
  const dataPath = path.join(baseDir, "assets", "data", "site-content.json");
  const content = exists(dataPath) ? readJson(dataPath) : null;
  if (!content) return;
  const sitemapPath = path.join(baseDir, "sitemap.xml");
  if (exists(sitemapPath)) {
    const disk = read(sitemapPath);
    const day = disk.match(/<loc>[^<]*\/gallery\/<\/loc>\n\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
    const expected = sitemapXml(content, day || undefined);
    if (disk !== expected) fail(`${path.relative(root, sitemapPath)} does not match the canonical templates.mjs sitemapXml() output — regenerate (npm run build) or fix the writer that produced it`);
  }
  const rssPath = path.join(baseDir, "feed.xml");
  if (exists(rssPath)) {
    const disk = read(rssPath);
    const now = disk.match(/<lastBuildDate>([^<]*)<\/lastBuildDate>/)?.[1];
    const expected = feedXml(content, now || undefined);
    if (disk !== expected) fail(`${path.relative(root, rssPath)} does not match the canonical templates.mjs feedXml() output — regenerate (npm run build) or fix the writer that produced it`);
  }
}

function checkUploadPackagePrivacy() {
  const sourceDir = path.join(packageDir, "assets", "images", "photos");
  if (exists(sourceDir)) fail("04-upload-package includes raw source photos");
}

function checkSourcePhotoGuard() {
  const guardPath = path.join(websiteDir, "assets", "images", "photos", ".htaccess");
  checkFile(guardPath, "assets/images/photos/.htaccess");
  if (exists(guardPath) && !read(guardPath).includes("Require all denied")) {
    fail("assets/images/photos/.htaccess should deny direct source photo access");
  }
}

function checkAvifEfficiency(baseDir) {
  const generatedDir = path.join(baseDir, "assets", "images", "generated");
  for (const avifPath of walkFiles(generatedDir).filter((filePath) => filePath.endsWith(".avif"))) {
    const parsed = path.parse(avifPath);
    const jpegPath = path.join(parsed.dir, `${parsed.name}.jpeg`);
    const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);
    const avifSize = fileSize(avifPath);
    const rasterSizes = [fileSize(jpegPath), fileSize(webpPath)].filter(Number.isFinite);
    if (!rasterSizes.length || !Number.isFinite(avifSize)) continue;
    const bestRaster = Math.min(...rasterSizes);
    if (avifSize > bestRaster * 1.1) {
      fail(`Oversized AVIF variant: ${path.relative(root, avifPath)} (${avifSize} bytes vs best raster ${bestRaster} bytes)`);
    }
  }
}

function checkLegacyStoryShell(baseDir) {
  const legacyPath = path.join(baseDir, "story", "index.html");
  checkFile(legacyPath);
  if (!exists(legacyPath)) return;
  const html = read(legacyPath);
  if (!html.includes('name="robots" content="noindex,follow"')) {
    fail(`${path.relative(root, legacyPath)} should be noindex,follow because clean story URLs live under /stories/:slug/`);
  }
  if (!html.includes('rel="canonical" href="https://sweden-journal.com/stories/"')) {
    fail(`${path.relative(root, legacyPath)} should canonicalize to /stories/`);
  }
  if (html.includes('rel="canonical" href="https://sweden-journal.com/story/"')) {
    fail(`${path.relative(root, legacyPath)} still canonicalizes to legacy /story/`);
  }
}

function checkNoDuplicateCopyArtifacts(baseDir) {
  const stack = [baseDir];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue; // 04-upload-package is optional/gitignored
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (/ [0-9]+$/.test(entry.name)) fail(`Duplicate copy artifact found: ${path.relative(root, nextPath)}`);
      if (entry.isDirectory()) stack.push(nextPath);
    }
  }
}

function checkRootCleanliness() {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && /^(04-upload-package|\.upload-package-tmp) [0-9]+$/.test(entry.name)) {
      fail(`Duplicate root package artifact found: ${entry.name}`);
    }
  }
}

function checkWorkspaceCleanliness() {
  const disposableNames = new Set([".DS_Store", "Thumbs.db", ".codex-ui-review", ".upload-package-tmp"]);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      const label = path.relative(root, nextPath);
      if (
        disposableNames.has(entry.name) ||
        entry.name.startsWith("._") ||
        /\.(log|tmp|temp|swp)$/.test(entry.name) ||
        entry.name.endsWith("~")
      ) {
        fail(`Disposable workspace artifact found: ${label}`);
      }
      if (entry.isDirectory()) {
        if (/^(04-upload-package|\.upload-package-tmp) [0-9]+$/.test(entry.name)) {
          fail(`Duplicate root package artifact found: ${label}`);
        }
        stack.push(nextPath);
      }
    }
  }
}

function checkEditor() {
  checkFile(editorHtml);
  checkFile(editorJs);
  if (!exists(editorHtml) || !exists(editorJs)) return;
  const html = read(editorHtml);
  const js = read(editorJs);
  if (!html.includes('name="robots" content="noindex,nofollow"')) fail("Editor is missing noindex,nofollow");
  if (js.includes("image/svg+xml")) fail("Editor still accepts SVG uploads");
  if (!js.includes("25*1024*1024")) fail("Editor upload size guard is missing");
  if (!js.includes("storyPublicPath")) fail("Editor story URL builder should use clean story paths");
  if (js.includes("story/?slug=")) fail("Editor still emits legacy story query URLs");
  if (!js.includes("function rssXml") || !js.includes('"feed.xml"')) fail("Editor save/package flow should regenerate feed.xml");
  if (!js.includes("removeWebsiteFile") || !js.includes("bestRaster*1.1")) fail("Editor should prune oversized browser-generated AVIF variants");
  if (/function imageDimensions\(url\).*URL\.revokeObjectURL\(url\)/s.test(js)) fail("Editor imageDimensions should not revoke caller-owned preview URLs");
}

function checkPublicRuntime(baseDir) {
  const publicJs = path.join(baseDir, "assets", "js", "site.js");
  checkFile(publicJs);
  if (!exists(publicJs)) return;
  // The public runtime now spans site.js (binding/runtime) + templates.mjs (shared
  // markup/JSON-LD builders, also used by the build-time pre-renderer). Read both so
  // the function-presence checks below match wherever the code lives.
  const templatesJs = path.join(baseDir, "assets", "js", "templates.mjs");
  const js = read(publicJs) + (exists(templatesJs) ? "\n" + read(templatesJs) : "");
  if (js.includes("story/index.html?slug=") || js.includes("story/?slug=")) fail("Public story links should use clean /stories/:slug/ paths");
  if (js.includes('cache:"no-store"') || js.includes('cache: "no-store"')) fail("Public content fetch should not force no-store caching");
  if (!js.includes("function currentStorySlug")) fail("Public runtime should resolve clean story paths and legacy ?slug fallback");
  if (!js.includes("function isLegacyStoryShell")) fail("Public runtime should keep the bare legacy /story/ shell noindex");
  if (!js.includes("function viewTransitionStyle")) fail("Public runtime should sanitize view-transition names");
  if (!js.includes("image/avif") || !js.includes("image/webp")) fail("Public runtime preloads should match the picture source format preference");
  if (!js.includes("function jsonLdImageGallery")) fail("Public runtime is missing gallery JSON-LD function");
  if (!js.includes("function jsonLdPerson")) fail("Public runtime is missing person JSON-LD function");
  if (!js.includes("machineDate(story.isoDate)") || js.includes('"datePublished":story.isoDate||story.date')) {
    fail("Public Article JSON-LD should only publish machine-readable ISO dates");
  }
  if (!js.includes("setBackgroundInert")) fail("Lightbox should inert/aria-hide background content while open");
  if (!js.includes('robots:"noindex,follow"')) fail("Missing story-not-found noindex,follow metadata guard");
  if (!js.includes('path:"stories/"')) fail("Missing story-not-found canonical fallback to stories/");
  if (!js.includes("twitter:title") || !js.includes("twitter:image")) {
    fail("Public runtime should update Twitter/X card metadata with dynamic page metadata");
  }
}

checkRootCleanliness();
checkWorkspaceCleanliness();
checkContent(websiteDir, { requireSourcePhotos: true });
checkHtmlMetadata(websiteDir);
checkSitemap(websiteDir);
checkRss(websiteDir);
checkStoryShells(websiteDir);
checkPhotoShells(websiteDir);
checkGeneratedXmlParity(websiteDir);
checkFallbackFiles(websiteDir);
checkLegacyStoryShell(websiteDir);
checkSourcePhotoGuard();
checkAvifEfficiency(websiteDir);
checkNoDuplicateCopyArtifacts(websiteDir);
checkEditor();
checkPublicRuntime(websiteDir);

// 04-upload-package is an optional, gitignored local artifact produced by
// `npm run build:package`. The deployed site is 01-website-ready-to-upload
// (see .github/workflows/deploy.yml), so only validate the package when it
// actually exists — otherwise QA would flood false "missing" failures.
if (fs.existsSync(packageDir)) {
  checkContent(packageDir, { requireSourcePhotos: false });
  checkHtmlMetadata(packageDir);
  checkSitemap(packageDir);
  checkRss(packageDir);
  checkStoryShells(packageDir);
  checkPhotoShells(packageDir);
  checkGeneratedXmlParity(packageDir);
  checkFallbackFiles(packageDir);
  checkLegacyStoryShell(packageDir);
  checkUploadPackagePrivacy();
  checkAvifEfficiency(packageDir);
  checkNoDuplicateCopyArtifacts(packageDir);
  checkPublicRuntime(packageDir);
}

if (failures.length) {
  console.error("Static QA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Static QA passed");
