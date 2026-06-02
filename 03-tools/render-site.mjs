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
  setContext, photos, photo, storyPhotos, sortPhotos,
  header, footer, homeMain, galleryMain, storiesMain, aboutMain, storyMain, legacyStoryMain,
  websiteLdObject, imageGalleryLdObject, personLdObject, articleLdObject,
} from "../01-website-ready-to-upload/assets/js/templates.mjs";

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
fs.writeFileSync(path.join(websiteDir, "assets/data/gallery.json"), JSON.stringify({ photos: photos(data) }));

let n = 0;
n += page("index.html", { pfx: "", active: "home", mainHtml: () => homeMain(data), headLd: ld(websiteLdObject(data)) });
n += page("gallery/index.html", { pfx: "../", active: "gallery", mainHtml: () => galleryMain(data), headLd: ld(imageGalleryLdObject(data)) });
n += page("stories/index.html", { pfx: "../", active: "stories", mainHtml: () => storiesMain(data) });
n += page("about/index.html", { pfx: "../", active: "about", mainHtml: () => aboutMain(data), headLd: ld(personLdObject(data)) });
n += page("story/index.html", { pfx: "../", active: "story", mainHtml: () => legacyStoryMain(data) });
for (const s of data.stories || []) {
  if (!s.slug) continue;
  n += page(`stories/${s.slug}/index.html`, {
    pfx: "../../", active: "story",
    mainHtml: () => storyMain(data, s),
    headLd: ld(articleLdObject(data, s, photo(data, s.heroPhotoId))),
    hydrate: { stories: [s], photos: storyPhotos(data, s) },
  });
}
console.log(`Pre-rendered ${n} page(s).`);
