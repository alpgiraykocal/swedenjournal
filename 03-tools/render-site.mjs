// Build-time pre-render (SSG). Renders each page's header + main content + footer
// into the static HTML, plus head JSON-LD and a per-page inline hydration-data
// script. The browser runtime (site.js) then HYDRATES (binds interactivity only).
//
// All markup/JSON-LD builders are imported from the SINGLE shared source
// (01-website-ready-to-upload/assets/js/templates.mjs), which site.js also imports —
// so the pre-rendered DOM matches exactly what the runtime would build.
import fs from "node:fs";
import path from "node:path";
import {
  setContext, photos, photo, storyPhotos, sortPhotos, photoStoryMap, fullVariantDims,
  header, footer, homeMain, galleryMain, storiesMain, aboutMain, atlasMain, storyMain, legacyStoryMain, notFoundMain, photoMain, photoTitleCore,
  websiteLdObject, imageGalleryLdObject, personLdObject, articleLdObject, photoLdObject,
  breadcrumbLdObject, storiesLdObject, atlasLdObject,
} from "../01-website-ready-to-upload/assets/js/templates.mjs";

const crumbs = (...trail) => breadcrumbLdObject(data, trail);

const root = path.resolve(new URL("..", import.meta.url).pathname);
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const ld = (obj) => (obj ? `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>` : "");

const BODY_START = "<!-- ssg:body:start -->";
const BODY_END = "<!-- ssg:body:end -->";
const HEAD_START = "<!-- ssg:head:start -->";
const HEAD_END = "<!-- ssg:head:end -->";

function hydrationScript(obj) {
  if (!obj) return "";
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  return `\n  <script type="application/json" id="hydration-data">${json}</script>`;
}

// SEO: clamp <meta name="description"> to ~155 chars at a word boundary so Google
// does not truncate the SERP snippet mid-word. og:/twitter: descriptions keep the
// full text (those platforms allow more). Runs every build → always in sync.
const encAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const decAttr = (s) => String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function clampDescription(html) {
  return html.replace(/<meta name="description" content="([^"]*)">/, (m, c) => {
    const dec = decAttr(c);
    if (dec.length <= 160) return m;
    let cut = dec.slice(0, 157);
    const sp = cut.lastIndexOf(" ");
    cut = (sp > 90 ? cut.slice(0, sp) : cut).replace(/[\s.,;:—–-]+$/, "") + "…";
    return `<meta name="description" content="${encAttr(cut)}">`;
  });
}
// SEO: og:image:width/height/alt (+ twitter:image:alt) so scrapers can reserve the
// correct card aspect ratio before fetching the image. Idempotent: replaces the tag
// when present, otherwise inserts it right after the matching og:image line.
function injectOgImageMeta(html, p) {
  if (!p) return html;
  const dims = fullVariantDims(p);
  const upsert = (h, pattern, tag, anchorRe) => {
    if (pattern.test(h)) return h.replace(pattern, tag);
    return h.replace(anchorRe, (m) => `${m}\n  ${tag}`);
  };
  const ogImageRe = /<meta property="og:image" content="[^"]*">/;
  const twImageRe = /<meta name="twitter:image" content="[^"]*">/;
  if (!ogImageRe.test(html)) return html;
  if (dims) {
    html = upsert(html, /<meta property="og:image:width" content="[^"]*">/, `<meta property="og:image:width" content="${dims.width}">`, ogImageRe);
    html = upsert(html, /<meta property="og:image:height" content="[^"]*">/, `<meta property="og:image:height" content="${dims.height}">`, /<meta property="og:image:width" content="[^"]*">/);
  }
  if (p.alt) {
    html = upsert(html, /<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${encAttr(p.alt)}">`, dims ? /<meta property="og:image:height" content="[^"]*">/ : ogImageRe);
    if (twImageRe.test(html)) {
      html = upsert(html, /<meta name="twitter:image:alt" content="[^"]*">/, `<meta name="twitter:image:alt" content="${encAttr(p.alt)}">`, twImageRe);
    }
  }
  return html;
}
// SEO: lead the homepage <title> (and social titles) with the brand name.
function brandHomeTitle(html, d) {
  const st = String(d.site?.siteTitle || "").trim();
  const own = String(d.site?.ownerName || "").trim();
  if (!st || !own || own === st) return html;
  const branded = encAttr(`${own} — ${st}`);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${branded}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${branded}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${branded}$2`);
}

// Resolve the photo behind a page's current og:image URL, so the injected
// width/height/alt always describe the image the page actually advertises —
// no matter whether the build or the editor wrote the og:image tag.
function resolvePhotoByOgImage(html) {
  const m = html.match(/<meta property="og:image" content="([^"]*)">/);
  if (!m || !m[1]) return null;
  const rel = decAttr(m[1]).replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
  for (const p of photos(data)) {
    for (const candidate of [p.variants?.full?.jpeg, p.variants?.medium?.jpeg, p.src]) {
      if (candidate && String(candidate).replace(/^\/+/, "") === rel) return p;
    }
  }
  return null;
}

function renderInto(rel, { pfx, active, main, headLd = "", hydrate = null }) {
  const file = path.join(websiteDir, rel);
  if (!fs.existsSync(file)) { console.warn(`! missing ${rel}`); return false; }
  let html = fs.readFileSync(file, "utf8");

  const bodyBlock = `${BODY_START}\n  ${main.header}\n  <div id="app" tabindex="-1">${main.app}</div>\n  <div id="footer">${main.footer}</div>${hydrationScript(hydrate)}\n  ${BODY_END}`;
  const bodyRe = new RegExp(`${BODY_START}[\\s\\S]*?${BODY_END}`);
  if (bodyRe.test(html)) {
    html = html.replace(bodyRe, bodyBlock);
  } else {
    html = html.replace(/<div id="app" tabindex="-1">[\s\S]*?<\/div>\s*<div id="footer">[\s\S]*?<\/div>/, bodyBlock);
  }
  html = html.replace(/<body([^>]*?)(\sdata-prerendered="1")?>/, (m, attrs) => `<body${attrs} data-prerendered="1">`);

  const headBlock = headLd ? `${HEAD_START}\n  ${headLd}\n  ${HEAD_END}` : `${HEAD_START}${HEAD_END}`;
  const headRe = new RegExp(`\\s*${HEAD_START}[\\s\\S]*?${HEAD_END}`);
  html = headRe.test(html) ? html.replace(headRe, `\n  ${headBlock}`) : html.replace(/<\/head>/, `  ${headBlock}\n</head>`);

  html = clampDescription(html);
  html = injectOgImageMeta(html, resolvePhotoByOgImage(html));
  if (rel === "index.html") html = brandHomeTitle(html, data);

  fs.writeFileSync(file, html);
  return true;
}

// Render one page: set the ambient context, then build header/main/footer from the shared templates.
function page(rel, { pfx, active, mainHtml, headLd = "", hydrate = null }) {
  setContext({ root: pfx, prefix: pfx, page: active });
  return renderInto(rel, { pfx, active, main: { header: header(data), app: mainHtml(), footer: footer(data) }, headLd, hydrate });
}

// Gallery hydration data is large (all photos) and only needed for the lightbox
// (user-triggered) — write it to a separate cacheable file fetched lazily instead
// of inlining ~40KB into the document. Story pages keep tiny inline data.
// Enrich each gallery photo with the story it belongs to (if any) so the
// lightbox can offer a "From the story: …" link without loading site-content.
const photoStories = photoStoryMap(data);
const galleryPhotos = photos(data).map((p) => {
  const st = photoStories.get(p.id);
  return st ? { ...p, story: { slug: st.slug, title: st.title } } : p;
});
fs.writeFileSync(path.join(websiteDir, "assets/data/gallery.json"), JSON.stringify({ photos: galleryPhotos }));

let n = 0;
n += page("index.html", { pfx: "", active: "home", mainHtml: () => homeMain(data), headLd: ld(websiteLdObject(data)) });
n += page("gallery/index.html", { pfx: "../", active: "gallery", mainHtml: () => galleryMain(data), headLd: ld(imageGalleryLdObject(data)) + ld(crumbs({ name: "Home", path: "" }, { name: "Gallery", path: "gallery/" })) });
n += page("stories/index.html", { pfx: "../", active: "stories", mainHtml: () => storiesMain(data), headLd: ld(storiesLdObject(data)) + ld(crumbs({ name: "Home", path: "" }, { name: "Stories", path: "stories/" })) });
n += page("about/index.html", { pfx: "../", active: "about", mainHtml: () => aboutMain(data), headLd: ld(personLdObject(data)) + ld(crumbs({ name: "Home", path: "" }, { name: "About", path: "about/" })) });
n += page("atlas/index.html", { pfx: "../", active: "atlas", mainHtml: () => atlasMain(data), headLd: ld(atlasLdObject(data)) + ld(crumbs({ name: "Home", path: "" }, { name: "Atlas", path: "atlas/" })) });
// 404 is served by the host at ANY URL depth (catch-all). Its links/assets must be
// root-absolute ("/…") so they resolve the same from "/" and "/deep/missing/path/".
n += page("404.html", { pfx: "/", active: "", mainHtml: () => notFoundMain(data) });
n += page("story/index.html", { pfx: "../", active: "story", mainHtml: () => legacyStoryMain(data) });
const liveSlugs = new Set();
for (const s of data.stories || []) {
  if (!s.slug) continue;
  liveSlugs.add(s.slug);
  n += page(`stories/${s.slug}/index.html`, {
    pfx: "../../", active: "story",
    mainHtml: () => storyMain(data, s),
    headLd: ld(articleLdObject(data, s, photo(data, s.heroPhotoId))) + ld(crumbs({ name: "Home", path: "" }, { name: "Stories", path: "stories/" }, { name: s.title || s.slug, path: `stories/${encodeURIComponent(s.slug)}/` })),
    hydrate: { stories: [s], photos: storyPhotos(data, s) },
  });
}

// Photo permalink pages (photos/<id>/) — one indexable page per photograph so
// Google Images has a real landing page instead of gallery/?photo=… fragments.
// The shell (head metadata) is rewritten from content on every build, so a photo
// title/caption/alt edit is always reflected; renderInto then injects the body.
const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
function photoShell(p) {
  const siteTitle = encAttr(data.site?.siteTitle || "Photography & Travel Notes");
  const title = encAttr(`${photoTitleCore(p)} — ${data.site?.siteTitle || data.site?.ownerName || "Photo Blog"}`);
  const desc = encAttr(p.caption || p.alt || data.site?.description || "");
  const url = encAttr(`${base}/photos/${encodeURIComponent(p.id)}/`);
  const image = encAttr(`${base}/${String(p.variants?.full?.jpeg || p.src || "").replace(/^\/+/, "")}`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <link rel="stylesheet" href="../../assets/css/site.css?v=20260601">
  <link rel="alternate" type="application/rss+xml" title="${siteTitle} — Stories" href="/feed.xml">
</head>
<body data-page="photo">
  <div id="app" tabindex="-1"></div>
  <div id="footer"></div>
  <script>window.__DATA_PATH__="../../assets/data/site-content.json";window.__ROOT__="../../";window.__ASSET_PREFIX__="../../";</script>
  <script type="module" src="../../assets/js/site.js?v=20260601"></script>
</body>
</html>
`;
}
const livePhotoIds = new Set();
for (const p of photos(data)) {
  if (!p.id || !p.title) continue;
  livePhotoIds.add(p.id);
  const rel = `photos/${p.id}/index.html`;
  const file = path.join(websiteDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, photoShell(p));
  n += page(rel, {
    pfx: "../../", active: "photo",
    mainHtml: () => photoMain(data, p),
    headLd: ld(photoLdObject(data, p)) + ld(crumbs({ name: "Home", path: "" }, { name: "Gallery", path: "gallery/" }, { name: p.title || p.id, path: `photos/${encodeURIComponent(p.id)}/` })),
  });
}

// Prune orphaned story pages: a story deleted in the editor leaves its
// stories/<slug>/ folder behind. Remove any story folder no longer in the
// content so deleted stories disappear from the published site.
let pruned = 0;
const storiesDir = path.join(websiteDir, "stories");
if (fs.existsSync(storiesDir)) {
  for (const entry of fs.readdirSync(storiesDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !liveSlugs.has(entry.name)) {
      fs.rmSync(path.join(storiesDir, entry.name), { recursive: true, force: true });
      pruned += 1;
    }
  }
}
// Same pruning for photo pages: a photo removed from the content loses its page.
const photosPagesDir = path.join(websiteDir, "photos");
if (fs.existsSync(photosPagesDir)) {
  for (const entry of fs.readdirSync(photosPagesDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !livePhotoIds.has(entry.name)) {
      fs.rmSync(path.join(photosPagesDir, entry.name), { recursive: true, force: true });
      pruned += 1;
    }
  }
}
console.log(`Pre-rendered ${n} page(s)${pruned ? `, pruned ${pruned} orphaned folder(s)` : ""}.`);
