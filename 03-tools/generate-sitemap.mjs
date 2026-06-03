// Generates sitemap.xml from content: clean URLs + <lastmod> + image entries
// (Google image sitemap) so photographs become discoverable in Google Images.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const { site, stories = [], photos = [] } = data;
const base = String(site?.baseUrl || "").replace(/\/+$/, "");
const buildDay = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const photoById = (id) => photos.find((p) => p.id === id) || null;
const machineDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : "");
const imageLoc = (p) => {
  const rel = p?.variants?.full?.jpeg || p?.variants?.medium?.jpeg || p?.src;
  return rel ? `${base}/${String(rel).replace(/^\/+/, "")}` : "";
};
function imageTags(list) {
  return [...new Set(list.filter(Boolean).map(imageLoc).filter(Boolean))]
    .map((loc) => `    <image:image><image:loc>${esc(loc)}</image:loc></image:image>`)
    .join("\n");
}
function storyPhotos(story) {
  const ids = [story.heroPhotoId, ...(story.body || []).filter((b) => b.type === "image").map((b) => b.photoId)];
  return [...new Set(ids)].map(photoById).filter(Boolean);
}

function urlEntry({ loc, lastmod, images }) {
  const parts = [`  <url>`, `    <loc>${esc(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (images) parts.push(images);
  parts.push(`  </url>`);
  return parts.join("\n");
}

const latestStory = stories
  .map((s) => machineDate(s.isoDate) || machineDate(s.date))
  .filter(Boolean)
  .sort()
  .at(-1) || buildDay;

const entries = [];
entries.push(urlEntry({ loc: `${base}/`, lastmod: latestStory }));
entries.push(urlEntry({ loc: `${base}/gallery/`, lastmod: buildDay, images: imageTags(photos) }));
entries.push(urlEntry({ loc: `${base}/stories/`, lastmod: latestStory }));
entries.push(urlEntry({ loc: `${base}/about/`, lastmod: buildDay }));
entries.push(urlEntry({ loc: `${base}/atlas/`, lastmod: buildDay }));
for (const s of stories.filter((s) => s.title && s.slug)) {
  entries.push(urlEntry({
    loc: `${base}/stories/${encodeURIComponent(s.slug)}/`,
    lastmod: machineDate(s.isoDate) || machineDate(s.date) || buildDay,
    images: imageTags(storyPhotos(s)),
  }));
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(websiteDir, "sitemap.xml"), xml);
console.log(`Sitemap written with ${entries.length} URLs → sitemap.xml`);
