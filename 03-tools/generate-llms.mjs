// Generates llms.txt — a concise, AI-crawler-friendly map of the site
// (llmstxt.org convention). Regenerated every build so it stays in sync with content.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const base = String(data.site?.baseUrl || "https://sweden-journal.com").replace(/\/+$/, "");
const owner = data.site?.ownerName || "Sweden Journal";
const desc = (data.site?.description || "").replace(/\s+/g, " ").trim();
const stories = (data.stories || []).filter((s) => s.slug && s.title);
// Same "live" rule as the build (render-site liveCollectionSlugs): a collection whose
// photoIds all point at deleted photos gets no page, so it must not be linked here.
const photoIds = new Set((data.photos || []).map((p) => p.id));
const collections = (data.collections || []).filter((c) => c.slug && c.title && (c.photoIds || []).some((id) => photoIds.has(id)));

const line = (label, url, note) => `- [${label}](${url})${note ? `: ${note}` : ""}`;
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, t.lastIndexOf(" ", n)) + "…" : t; };

const out = `# ${owner}

> ${desc}

## Main pages
${line("Home", base + "/", "Featured stories and a curated edit of photographs.")}
${line("Stories", base + "/stories/", "Long-form visual essays built around place, light, and movement.")}
${line("Series", base + "/series/", "Curated groups of photographs — a subject or place followed across the journal.")}
${line("Atlas", base + "/atlas/", "Every story mapped to where it happened — explore the journal geographically.")}
${line("Gallery", base + "/gallery/", "A curated, image-first archive of photographs.")}
${line("About", base + "/about/", "About the photographer and the project.")}

## Stories
${stories.map((s) => line(s.title, `${base}/stories/${encodeURIComponent(s.slug)}/`, clip(s.summary, 120))).join("\n")}
${collections.length ? `
## Series
${collections.map((c) => line(c.title, `${base}/series/${encodeURIComponent(c.slug)}/`, clip(c.description, 120))).join("\n")}
` : ""}
## More
${line("RSS feed", base + "/feed.xml")}
${line("Sitemap", base + "/sitemap.xml")}
`;

fs.writeFileSync(path.join(websiteDir, "llms.txt"), out);
console.log(`llms.txt written (${stories.length} stories).`);
