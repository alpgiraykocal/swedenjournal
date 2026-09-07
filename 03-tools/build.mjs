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
// The brand for machine-readable head tags — site.ownerName ("Sweden Journal"), not
// site.siteTitle, which holds the tagline. Mirrors templates.mjs brandName().
const [BRAND, TAGLINE] = (() => {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));
    return [String(c.site?.ownerName || c.site?.siteTitle || "").trim(), String(c.site?.siteTitle || "").trim()];
  } catch { return ["", ""]; }
})();
const esc4 = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// The section pages (gallery, stories, atlas, about, 404, the legacy /story/) keep their
// titles in their committed shells, so the brand switch reached only the pages the build
// regenerates. Swap a trailing " — <tagline>" for " — <brand>" here instead, which covers
// every page from one place. The homepage is skipped: its title already leads with the
// brand and reads "Sweden Journal — Photography & Travel Notes" on purpose.
function brandSuffix(html) {
  if (!BRAND || !TAGLINE || BRAND === TAGLINE) return html;
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  if (!title || title.startsWith(BRAND) || title.startsWith(esc4(BRAND))) return html;
  for (const tail of [TAGLINE, esc4(TAGLINE)]) {
    const from = ` \u2014 ${tail}`;
    if (!title.endsWith(from)) continue;
    const branded = title.slice(0, -from.length) + ` \u2014 ${esc4(BRAND)}`;
    return html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${branded}</title>`)
      .replace(/(<meta property="og:title" content=")[^"]*(">)/, (_m, a, b) => a + branded + b)
      .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, (_m, a, b) => a + branded + b);
  }
  return html;
}

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
  // og:site_name was absent everywhere, so social cards and search results had no
  // brand line at all. Injected here rather than in each shell because that is the one
  // loop that touches every page, and it is idempotent: the tag is only added when the
  // page has an og:type to anchor to and does not already carry it.
  html = brandSuffix(html);
  if (BRAND && !html.includes('property="og:site_name"')) {
    html = html.replace(
      /(<meta property="og:type" content="[^"]*">)/,
      `$1\n  <meta property="og:site_name" content="${BRAND.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">`,
    );
  }
  fs.writeFileSync(f, html);
  pages += 1;
}

// 3b. security.txt (RFC 9116). Generated rather than checked in because Expires is
//     mandatory and a lapsed file is one clients are told to ignore — writing it here
//     keeps the date a year ahead of the most recent deploy. Contact is the address the
//     About page already publishes, so this adds no new exposure.
//
//     Written to BOTH locations on purpose. GitHub Pages serves no path whose segment
//     starts with a dot — /.nojekyll 404s too, and it has shipped for months — so the
//     RFC's /.well-known/security.txt is unreachable on this host until a Cloudflare
//     redirect rule points it at the root copy. /security.txt is the pre-RFC convention,
//     it is what Pages will actually serve today, and plenty of scanners still check it.
//     Both are listed as Canonical (RFC 9116 permits several) so whichever one a client
//     finds is one the file itself vouches for.
{
  const content = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));
  const contact = String(content.about?.contactEmail || "").trim();
  const site = String(content.site?.baseUrl || "").replace(/\/+$/, "");
  if (contact && site) {
    // Keep the existing Expires while it has real life left. Recomputing it every build
    // moved the timestamp by seconds and dirtied the working tree on every single run,
    // which is noise in every diff. Renew only inside the last sixty days, and pin the
    // time to midnight so even the renewal lands on a stable value.
    const existing = (() => {
      try {
        const prev = fs.readFileSync(path.join(websiteDir, "security.txt"), "utf8");
        const m = prev.match(/^Expires:\s*(\S+)/m);
        const at = m ? Date.parse(m[1]) : NaN;
        return Number.isFinite(at) && at - Date.now() > 60 * 24 * 60 * 60 * 1000 ? m[1] : "";
      } catch { return ""; }
    })();
    const expires = existing || `${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
    const txt = [
      `Contact: mailto:${contact}`,
      `Expires: ${expires}`,
      "Preferred-Languages: en, sv",
      `Canonical: ${site}/security.txt`,
      `Canonical: ${site}/.well-known/security.txt`,
      "",
    ].join("\n");
    for (const rel of ["security.txt", ".well-known/security.txt"]) {
      const out = path.join(websiteDir, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, txt);
    }
    console.log(`security.txt written to / and /.well-known/ (expires ${expires.slice(0, 10)}).`);
  }
}

// 4. site.js imports templates.mjs in the browser — version that import to match.
const siteJsPath = path.join(websiteDir, "assets/js/site.js");
let sjs = fs.readFileSync(siteJsPath, "utf8");
sjs = sjs.replace(/from "\.\/templates\.mjs(?:\?v=[A-Za-z0-9]+)?"/, `from "./templates.mjs?v=${V}"`);
fs.writeFileSync(siteJsPath, sjs);

console.log(`Build complete — ${pages} pages normalized, cache version ${V}. Serve: 01-website-ready-to-upload/`);
