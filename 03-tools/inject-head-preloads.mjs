#!/usr/bin/env node
// Injects a data-driven, idempotent <head> performance block into every page:
//   - theme-color meta (light + dark)
//   - preload of the two critical fonts (Fraunces headline, Inter body)
//   - preload of each page's hero / LCP image, matching the runtime <picture> source
// The block is marked so re-running (e.g. on every build) keeps it fresh — no staleness.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const START = "<!-- perf-head:start -->";
const END = "<!-- perf-head:end -->";
const THEME_LIGHT = "#f3efe7";
const THEME_DARK = "#1a1815";

// Speculation Rules: prerender same-origin document links on hover / pointer-down
// ("moderate" eagerness — not on page load, so no wasted prerenders). Excludes query
// strings (gallery ?photo=, ?filter=… client state) and .xml (feed/sitemap). Chromium
// makes these navigations instant; other browsers ignore the block. Origin-relative
// patterns → identical on every page regardless of asset prefix.
const SPECULATION_RULES = JSON.stringify({
  prerender: [{
    eagerness: "moderate",
    where: { and: [
      { href_matches: "/*" },
      { not: { href_matches: "/*\\?*" } },
      { not: { href_matches: "/*.xml" } },
    ] },
  }],
});
const speculationLine = `  <script type="speculationrules">${SPECULATION_RULES}</script>`;

// Per-page hero `sizes`, matching exactly what the runtime <picture> renders so the
// preload scanner selects the same candidate (no wasted / duplicate download).
const SIZES_STORY = "(max-width: 1220px) calc(100vw - 40px), 1180px";
const sizesFor = {
  "index.html": "(max-width: 850px) calc(100vw - 28px), 620px",
  "gallery/index.html": "(max-width: 560px) calc(100vw - 24px), (max-width: 900px) 50vw, 380px",
  "stories/index.html": "(max-width: 850px) calc(100vw - 28px), 620px",
  "about/index.html": "(max-width: 850px) calc(100vw - 28px), 520px",
};

const photos = Array.isArray(data.photos) ? data.photos : [];
const photoById = (id) => photos.find((p) => p.id === id) || null;
const variant = (p, size, format) => p?.variants?.[size]?.[format] || "";
function srcset(p, format) {
  return ["thumb", "medium", "full"].map((size) => {
    const value = variant(p, size, format);
    const width = p?.variants?.[size]?.width;
    return value && width ? `${value} ${width}w` : value ? value : "";
  }).filter(Boolean).join(", ");
}
function preferredFormat(p) {
  return [["avif", "image/avif"], ["webp", "image/webp"], ["jpeg", "image/jpeg"]]
    .find(([fmt]) => variant(p, "medium", fmt) || srcset(p, fmt)) || ["jpeg", "image/jpeg"];
}
function featuredStoryHeroId() {
  const stories = [...(data.stories || [])].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  return (stories.find((s) => s.featured) || stories[0])?.heroPhotoId || null;
}

// page file -> hero photo id (null = no hero, fonts + theme-color only)
const heroFor = {
  "index.html": data.home?.heroPhotoId || null,
  // No hero preload for the gallery: it's a grid with no single dominant LCP, and the
  // first grid images already render eager + fetchpriority="high". Preloading one thumb
  // made the scanner fetch a `thumb` candidate the render never used (medium), wasting
  // bandwidth + emitting a "preloaded but not used" console warning.
  "gallery/index.html": null,
  "stories/index.html": featuredStoryHeroId(),
  "about/index.html": data.about?.portraitPhotoId || null,
  "atlas/index.html": null,
  "404.html": null,
  "story/index.html": null,
};
for (const s of data.stories || []) {
  if (s.slug) heroFor[`stories/${s.slug}/index.html`] = s.heroPhotoId || null;
}
// Series pages are card / gallery grids with no single dominant LCP (same reasoning as
// the gallery) — no hero preload, but they still need the perf-head block (theme, fonts,
// speculation rules), so register them with a null hero.
heroFor["series/index.html"] = null;
for (const col of data.collections || []) {
  if (col.slug) heroFor[`series/${col.slug}/index.html`] = null;
}
// Photo permalink pages: the page IS the photo — preload it as the LCP.
for (const p of photos) {
  if (p.id && p.title) heroFor[`photos/${p.id}/index.html`] = p.id;
}

// Optional privacy-friendly analytics: set site.cloudflareAnalyticsToken in
// site-content.json (Cloudflare dashboard → Web Analytics → JS snippet token)
// and every page gets the beacon. Empty/absent token → no script, no tracking.
const cfToken = String(data.site?.cloudflareAnalyticsToken || "").trim();
const analyticsLine = /^[A-Za-z0-9]+$/.test(cfToken)
  ? `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${cfToken}"}'></script>`
  : null;

function heroPreloadLine(prefix, heroId, sizes) {
  const p = photoById(heroId);
  if (!p) return null;
  const [fmt, mime] = preferredFormat(p);
  const href = variant(p, "medium", fmt) || variant(p, "full", fmt) || p.src;
  if (!href) return null;
  const set = srcset(p, fmt);
  const attrs = [
    `rel="preload"`, `as="image"`, `href="${prefix}${href}"`,
    set ? `imagesrcset="${set.split(", ").map((s) => prefix + s).join(", ")}"` : "",
    set ? `imagesizes="${sizes}"` : "",
    `type="${mime}"`, `fetchpriority="high"`, `data-preload-photo="${p.id}"`,
  ].filter(Boolean);
  return `  <link ${attrs.join(" ")}>`;
}

function buildBlock(prefix, heroId, sizes) {
  const lines = [
    `  ${START}`,
    `  <script>(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})();document.documentElement.classList.add('js-reveal');setTimeout(function(){if(!window.__siteBooted){document.documentElement.classList.remove('js-reveal')}},2500)</script>`,
    `  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">`,
    `  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">`,
    `  <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">`,
    `  <link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png">`,
    `  <link rel="manifest" href="${prefix}site.webmanifest">`,
    `  <link rel="preload" href="${prefix}assets/fonts/fraunces-latin-standard-normal.woff2" as="font" type="font/woff2" crossorigin>`,
    `  <link rel="preload" href="${prefix}assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`,
  ];
  const hero = heroPreloadLine(prefix, heroId, sizes);
  if (hero) lines.push(hero);
  lines.push(speculationLine);
  if (analyticsLine) lines.push(analyticsLine);
  lines.push(`  ${END}`);
  return lines.join("\n");
}

let changed = 0;
for (const [rel, heroId] of Object.entries(heroFor)) {
  const file = path.join(websiteDir, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  const styleMatch = html.match(/(\s*)<link rel="stylesheet" href="((?:\.\.\/)*|\/)assets\/css\/site\.css/);
  if (!styleMatch) { console.warn(`! no stylesheet anchor in ${rel}, skipped`); continue; }
  const prefix = styleMatch[2]; // "", "../", "../../", or "/" (404 catch-all → root-absolute)
  const sizes = sizesFor[rel] || SIZES_STORY;
  const block = buildBlock(prefix, heroId, sizes);
  const between = new RegExp(`[ \\t]*${START}[\\s\\S]*?${END}\\n?`);
  if (between.test(html)) {
    html = html.replace(between, block + "\n");
  } else {
    html = html.replace(/(\s*)(<link rel="stylesheet" href=)/, `\n${block}$1$2`);
  }
  fs.writeFileSync(file, html);
  changed += 1;
}
console.log(`Head preloads injected into ${changed} page(s).`);
