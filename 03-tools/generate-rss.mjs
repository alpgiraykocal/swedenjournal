import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const websiteDir = path.join(root, "01-website-ready-to-upload");
const dataPath = path.join(websiteDir, "assets/data/site-content.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const { site, stories = [] } = data;
const base = String(site?.baseUrl || "").replace(/\/+$/, "");
const now = new Date().toUTCString();

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function machineDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : raw;
}

function rssDate(story) {
  const raw = machineDate(story?.isoDate) || machineDate(story?.date);
  return raw ? new Date(`${raw}T00:00:00Z`).toUTCString() : "";
}

const items = stories
  .filter(s => s.title && s.slug)
  .map(s => {
    const pubDate = rssDate(s);
    return `  <item>
    <title>${esc(s.title)}</title>
    <link>${base}/stories/${encodeURIComponent(s.slug)}/</link>
    <guid isPermaLink="true">${base}/stories/${encodeURIComponent(s.slug)}/</guid>
    <description>${esc(s.summary || "")}</description>
${pubDate ? `    <pubDate>${esc(pubDate)}</pubDate>\n` : ""}    <category>${esc(s.category || s.theme || "Travel Notes")}</category>
  </item>`;
  })
  .join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site?.siteTitle || site?.ownerName || "Photo Blog")}</title>
    <link>${base}/</link>
    <description>${esc(site?.description || "")}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

fs.writeFileSync(path.join(websiteDir, "feed.xml"), feed);
console.log(`RSS feed written with ${(items.match(/<item>/g) || []).length} items → feed.xml`);
