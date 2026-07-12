// Thin wrapper: the canonical sitemap builder lives in the shared templates module
// (01-website-ready-to-upload/assets/js/templates.mjs) so the build, the editor and
// qa-static-checks all produce/verify the exact same bytes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sitemapXml } from "../01-website-ready-to-upload/assets/js/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const xml = sitemapXml(data);
fs.writeFileSync(path.join(websiteDir, "sitemap.xml"), xml);
console.log(`Sitemap written with ${(xml.match(/<url>/g) || []).length} URLs → sitemap.xml`);
