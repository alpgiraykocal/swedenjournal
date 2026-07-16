// SSG build (pure Node — no bash/rsync). Run by GitHub Actions
// (.github/workflows/deploy.yml) on every push: it pre-renders
// 01-website-ready-to-upload in place so the editor only has to update content;
// everything SSG (markup, JSON-LD, sitemap, RSS, head preloads, gallery data,
// cache-busting) is regenerated here and the result deploys to GitHub Pages
// (served behind the Cloudflare proxy for sweden-journal.com).
//
// It is robust to whatever the browser editor writes: the asset-normalization pass
// forces the correct <script type="module"> + content-hashed ?v= on every page,
// regardless of the (possibly stale) tags the editor emits.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");

// 1. Generators + pre-render — each writes into 01-website-ready-to-upload in place.
// render-site MUST run before inject-head-preloads: render-site regenerates the
// photo permalink pages from scratch (photoShell), so the perf-head block (theme
// colour, font/hero preload, speculation rules) has to be injected afterwards or it
// would be wiped on every build. Static pages keep their perf-head either way.
for (const step of [
  "backfill-avif.mjs",
  "sync-image-variants.mjs",
  "generate-rss.mjs",
  "generate-sitemap.mjs",
  "generate-llms.mjs",
  "render-site.mjs",
  "inject-head-preloads.mjs",
]) {
  execSync(`node ${JSON.stringify(path.join(toolsDir, step))}`, { stdio: "inherit" });
}

// 2. Content-hash cache version from the code assets (existing ?v= ignored so it is
//    stable across rebuilds when the code is unchanged — returning visitors keep cache).
function hashOf(...files) {
  const h = crypto.createHash("sha256");
  for (const f of files) {
    if (fs.existsSync(f)) h.update(fs.readFileSync(f, "utf8").replace(/\?v=[A-Za-z0-9]+/g, ""));
  }
  return h.digest("hex").slice(0, 10);
}
const V = hashOf(
  path.join(websiteDir, "assets/js/site.js"),
  path.join(websiteDir, "assets/js/templates.mjs"),
  path.join(websiteDir, "assets/css/site.css"),
);

// Content-data version: hash of the runtime-fetched JSON. The runtime appends this as
// ?v= to the gallery.json / site-content.json fetches (via window.__DATA_VERSION__,
// injected below). The JSON is long-cached at the CDN and _headers is ignored by the
// host, so this content-versioned URL is what makes a published edit actually appear.
const DV = hashOf(
  path.join(websiteDir, "assets/data/site-content.json"),
  path.join(websiteDir, "assets/data/gallery.json"),
);

// 3. Normalize every HTML: site.js MUST be type="module" (it imports templates.mjs),
//    and both site.js + site.css get the content-hashed ?v=. Fixes anything the editor
//    wrote (non-module tag, stale version).
function walkHtml(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkHtml(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
let pages = 0;
for (const f of walkHtml(websiteDir)) {
  let html = fs.readFileSync(f, "utf8");
  html = html.replace(
    // Accepts a root-absolute "/" prefix as well as "../" — 404.html is served at any
    // depth and so links its assets from the root (same shape as the site.css rule below).
    /<script\s+(?:type="module"\s+)?src="((?:(?:\.\.\/)*|\/)assets\/js\/site\.js)(?:\?v=[A-Za-z0-9]+)?"\s*>/g,
    (_m, src) => `<script type="module" src="${src}?v=${V}">`,
  );
  html = html.replace(
    /<link rel="stylesheet" href="((?:(?:\.\.\/)*|\/)assets\/css\/site\.css)(?:\?v=[A-Za-z0-9]+)?">/g,
    (_m, href) => `<link rel="stylesheet" href="${href}?v=${V}">`,
  );
  // Inject the content-data version right after the asset-prefix bootstrap so the runtime
  // can cache-bust its JSON fetches. Idempotent: replaces any prior __DATA_VERSION__.
  html = html.replace(
    /(window\.__ASSET_PREFIX__="[^"]*";)(window\.__DATA_VERSION__="[^"]*";)?/,
    `$1window.__DATA_VERSION__="${DV}";`,
  );
  fs.writeFileSync(f, html);
  pages += 1;
}

// 4. site.js imports templates.mjs in the browser — version that import to match.
const siteJsPath = path.join(websiteDir, "assets/js/site.js");
let sjs = fs.readFileSync(siteJsPath, "utf8");
sjs = sjs.replace(/from "\.\/templates\.mjs(?:\?v=[A-Za-z0-9]+)?"/, `from "./templates.mjs?v=${V}"`);
fs.writeFileSync(siteJsPath, sjs);

console.log(`Build complete — ${pages} pages normalized, cache version ${V}. Serve: 01-website-ready-to-upload/`);
