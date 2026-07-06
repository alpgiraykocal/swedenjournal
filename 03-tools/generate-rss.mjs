// Thin wrapper: the canonical feed builder lives in the shared templates module
// (01-website-ready-to-upload/assets/js/templates.mjs) so the build, the editor and
// qa-static-checks all produce/verify the exact same bytes.
import fs from "node:fs";
import path from "node:path";
import { feedXml } from "../01-website-ready-to-upload/assets/js/templates.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const websiteDir = path.join(root, "01-website-ready-to-upload");
const data = JSON.parse(fs.readFileSync(path.join(websiteDir, "assets/data/site-content.json"), "utf8"));

const feed = feedXml(data);
fs.writeFileSync(path.join(websiteDir, "feed.xml"), feed);
console.log(`RSS feed written with ${(feed.match(/<item>/g) || []).length} items → feed.xml`);
