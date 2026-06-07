// Single source of truth for page markup + JSON-LD, shared by the build-time
// pre-renderer (03-tools/render-site.mjs) and the browser runtime (site.js).
// Pure string/object builders only — no DOM, no window. Ambient root/prefix/page
// come from a tiny context set by each consumer; content `data` is passed explicitly.

let CTX = { root: "", prefix: "", page: "home" };
export function setContext(c) { CTX = { ...CTX, ...c }; }
export const root = () => CTX.root || "";
export const prefix = () => CTX.prefix || "";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
export const photos = (data) => (Array.isArray(data.photos) ? data.photos : []);
export const photo = (data, id) => photos(data).find((p) => p.id === id) || photos(data)[0] || null;
export const imgPath = (p) => (p ? prefix() + p.src : "");
export const metaText = (parts) => parts.filter(Boolean).join(" · ");
const IMAGE_WIDTHS = { thumb: 480, medium: 1200, full: 2200 };
export function variant(p, size, format) {
  const value = p?.variants?.[size]?.[format];
  return value ? prefix() + value : "";
}
export function srcset(p, format) {
  return ["thumb", "medium", "full"].map((size) => {
    const value = variant(p, size, format);
    const width = p?.variants?.[size]?.width || IMAGE_WIDTHS[size];
    return value ? `${value} ${width}w` : "";
  }).filter(Boolean).join(", ");
}
export function viewTransitionStyle(value) {
  const id = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!id) return "";
  const safe = /^[a-zA-Z_]/.test(id) ? id : `vt-${id}`;
  return ` style="view-transition-name:${esc(safe)}"`;
}
export function responsiveImage(p, opts = {}) {
  if (!p) return "";
  const className = opts.className ? ` class="${esc(opts.className)}"` : "";
  const size = p.width && p.height ? ` width="${esc(p.width)}" height="${esc(p.height)}"` : "";
  const loading = opts.priority ? ` loading="eager" fetchpriority="high"` : opts.eager ? ` loading="eager"` : ` loading="lazy"`;
  const vt = viewTransitionStyle(opts.viewTransitionName);
  const sizes = esc(opts.sizes || "100vw");
  const alt = opts.alt === undefined ? p.alt : opts.alt;
  const jpegSet = srcset(p, "jpeg");
  const webpSet = srcset(p, "webp");
  const avifSet = srcset(p, "avif");
  const fallback = variant(p, opts.fallbackSize || "medium", "jpeg") || imgPath(p);
  return `<picture>${avifSet ? `<source type="image/avif" srcset="${esc(avifSet)}" sizes="${sizes}">` : ""}${webpSet ? `<source type="image/webp" srcset="${esc(webpSet)}" sizes="${sizes}">` : ""}<img${className} src="${esc(fallback)}"${jpegSet ? ` srcset="${esc(jpegSet)}" sizes="${sizes}"` : ""} alt="${esc(alt)}"${loading} decoding="async"${size}${vt}></picture>`;
}
export const storyMeta = (s) => metaText([s.location, s.date, s.readingTime]);
export const storyCardMeta = (s) => metaText([s.location, s.date]);
export const storyHref = (slug) => `${root()}stories/${encodeURIComponent(slug)}/`;
export function absoluteUrl(data, path = "") {
  const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
  if (base) return `${base}/${String(path).replace(/^\/+/, "")}`;
  if (typeof location !== "undefined") return new URL(path ? root() + String(path).replace(/^\/+/, "") : location.pathname + location.search, location.href).href;
  return "/" + String(path).replace(/^\/+/, "");
}
export const storyCategory = (story) => story?.category || String(story?.theme || "").split(/[,/]/).map((x) => x.trim()).filter(Boolean)[0] || "Travel Notes";
export const storyMetaChips = (s) => [s.location, s.date, s.readingTime, storyCategory(s)].filter(Boolean).map((item) => `<span>${esc(item)}</span>`).join("");
export function storyPhotos(data, story) {
  const ids = [story.heroPhotoId, ...(story.body || []).filter((b) => b.type === "image").map((b) => b.photoId)];
  return [...new Set(ids)].map((id) => photo(data, id)).filter(Boolean);
}
export function storyShareUrl(data, story) {
  const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
  if (base) return `${base}/stories/${encodeURIComponent(story.slug)}/`;
  if (typeof location !== "undefined") return new URL(`${root()}stories/${encodeURIComponent(story.slug)}/`, location.href).href;
  return `/stories/${encodeURIComponent(story.slug)}/`;
}
export function sortPhotos(list) {
  return [...list].sort((a, b) => {
    const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
    const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
    if (ao !== bo) return ao - bo;
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}
export const mediaRatioStyle = (p) => (p?.width && p?.height ? ` style="aspect-ratio:${esc(p.width)} / ${esc(p.height)}"` : "");
export function header(data) {
  const page = CTX.page;
  const activePage = page === "story" ? "stories" : page;
  const item = (id, href, label) => `<a href="${href}" ${activePage === id ? `aria-current="page"` : ""}>${label}</a>`;
  return `<a class="skip-link" href="#app">Skip to content</a><header class="site-header"><div class="container nav"><a class="brand" href="${root()}index.html" aria-label="${esc(data.site.ownerName)} — home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" focusable="false"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg></span><span class="brand-text">${esc(data.site.ownerName)}<span class="brand-tagline">${esc(data.site.siteTitle || "")}</span></span></a><nav class="nav-links" aria-label="Primary navigation">
  ${item("home", `${root()}index.html`, "Home")}${item("stories", `${root()}stories/index.html`, "Stories")}${item("atlas", `${root()}atlas/index.html`, "Atlas")}${item("gallery", `${root()}gallery/index.html`, "Gallery")}${item("about", `${root()}about/index.html`, "About")}<a href="${esc(data.site.instagramUrl)}" target="_blank" rel="noopener" aria-label="Instagram: ${esc(data.site.instagramLabel || "@sweden_journal")}" class="ig-nav-link"><svg class="ig-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a></nav></div></header>`;
}
export const footer = (data) => `<footer class="site-footer"><div class="container footer-row"><span>${esc(data.site.ownerName)} — ${esc(data.site.footerText)}</span><span class="footer-follow"><span class="footer-follow-label">Follow the journal</span><a class="footer-rss" href="${root()}feed.xml"><svg class="rss-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 4.44V7a13 13 0 0 1 13 13h2.56A15.56 15.56 0 0 0 4 4.44zm0 5.66v2.56A6.34 6.34 0 0 1 10.34 19H12.9A8.9 8.9 0 0 0 4 10.1zM5.92 16.1a1.92 1.92 0 1 0 0 3.84 1.92 1.92 0 0 0 0-3.84z"/></svg>RSS</a>${data.site.instagramUrl ? `<a class="footer-ig ig-footer-link" href="${esc(data.site.instagramUrl)}" target="_blank" rel="noopener" aria-label="Instagram: ${esc(data.site.instagramLabel || "@sweden_journal")}"><svg class="ig-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>Instagram</a>` : ""}</span></div></footer>`;
export function storyCard(data, s) {
  const sequence = storyPhotos(data, s);
  const p = sequence[0];
  const tags = (s.tags || []).slice(0, 3);
  const strip = sequence.slice(0, 3).map((item) => `<span>${responsiveImage(item, { className: "story-strip-img", sizes: "96px", fallbackSize: "thumb", alt: "" })}</span>`).join("");
  return `<a class="card story-card" href="${storyHref(s.slug)}" data-story-card data-category="${esc(storyCategory(s))}"><div class="story-card-media"${mediaRatioStyle(p)}>${responsiveImage(p, { className: "story-card-img", sizes: "(max-width: 850px) calc(100vw - 28px), 48vw", viewTransitionName: s.slug ? `story-${s.slug}` : undefined })}</div><div class="story-card-copy"><span class="meta">${esc(storyCardMeta(s))}</span><h3>${esc(s.title)}</h3><p class="muted">${esc(s.summary)}</p>${strip ? `<span class="story-strip" aria-label="Story photographs">${strip}</span>` : ""}${tags.length ? `<span class="story-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>` : ""}<span class="story-link">Read story${s.readingTime ? ` · ${esc(s.readingTime)}` : ""}</span></div></a>`;
}
export function featuredStoryBlock(data, story) {
  const p = storyPhotos(data, story)[0];
  return `<a class="featured-story" href="${storyHref(story.slug)}"><div class="featured-story-media"${mediaRatioStyle(p)}>${responsiveImage(p, { className: "story-card-img", priority: true, sizes: "(max-width: 850px) calc(100vw - 28px), 620px", viewTransitionName: story.slug ? `story-${story.slug}` : undefined })}</div><div class="featured-story-copy"><span class="meta">${esc(storyCardMeta(story))}</span><h3>${esc(story.title)}</h3><p class="muted">${esc(story.summary)}</p><span class="story-link">Read featured${story.readingTime ? ` · ${esc(story.readingTime)}` : ""}</span></div></a>`;
}
export function photoFigure(p, options = {}) {
  const opts = typeof options === "object" ? options : {};
  const button = opts.interactive ? `<button class="photo-open" type="button" data-open-photo="${esc(p.id)}" aria-label="Open ${esc(p.title)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5"/></svg></button>` : "";
  return `<figure class="photo-card ${p.featured ? "featured" : ""}" data-photo-id="${esc(p.id)}" data-category="${esc(p.category || "")}" data-tags="${esc((p.tags || []).join("|"))}" data-theme="${esc(p.theme || "")}"><div class="photo-media"${mediaRatioStyle(p)}>${responsiveImage(p, { priority: opts.priority, eager: opts.eager, sizes: opts.sizes || "(max-width: 560px) calc(100vw - 24px), (max-width: 900px) 50vw, 380px" })}${button}</div><figcaption><strong>${esc(p.title)}</strong>${p.location ? ` — ${esc(p.location)}` : ""}${p.caption ? `<br>${esc(p.caption)}` : ""}</figcaption></figure>`;
}
export function blockHtmlInteractive(data, block) {
  if (!block) return "";
  if (block.type === "image") {
    const p = photo(data, block.photoId);
    return p ? `<figure class="story-inline-photo">${responsiveImage(p, { className: "story-inline-img", sizes: "(max-width: 920px) calc(100vw - 40px), 840px", fallbackSize: "full" })}<figcaption>${esc(block.caption || p.caption || "")}<button class="photo-open" type="button" data-open-photo="${esc(p.id)}" aria-label="Open ${esc(p.title)}" style="position:relative;right:auto;bottom:auto;opacity:1;transform:none;margin-left:10px;display:inline-flex;vertical-align:middle">View</button></figcaption></figure>` : "";
  }
  if (block.type === "quote") return `<blockquote>${esc(block.text)}</blockquote>`;
  if (block.type === "heading") return `<h2>${esc(block.text)}</h2>`;
  return `<p>${esc(block.text || "")}</p>`;
}
export function sharePanel(data, story) {
  const url = storyShareUrl(data, story);
  const subject = encodeURIComponent(story.title || data.site?.siteTitle || "Photo story");
  const body = encodeURIComponent(`${story.summary || story.title}\n\n${url}`);
  return `<aside class="share-panel container" aria-labelledby="share-title">
    <div class="share-copy">
      <p class="eyebrow">Share</p>
      <h2 id="share-title" class="share-title">Share this story</h2>
      <p class="muted">Send it to someone who would enjoy this place, light, or walk.</p>
    </div>
    <div class="share-actions" role="group" aria-label="Share options">
      <button class="share-action" type="button" data-native-share data-share-url="${esc(url)}" data-share-title="${esc(story.title)}" data-share-text="${esc(story.summary || "")}">Share</button>
      <button class="share-action" type="button" data-copy-link data-share-url="${esc(url)}" data-default-label="Copy link">Copy link</button>
      <a class="share-action" href="mailto:?subject=${subject}&body=${body}">Email</a>
    </div>
    <p class="share-status" aria-live="polite"></p>
  </aside>`;
}
export function relatedPanel(data, story) {
  const storyTags = new Set((story.tags || []).map((x) => x.toLowerCase()));
  const relatedStories = (data.stories || []).filter((item) => item.slug !== story.slug).map((item) => {
    const score = (item.tags || []).filter((tag) => storyTags.has(String(tag).toLowerCase())).length + (storyCategory(item) === storyCategory(story) ? 2 : 0);
    return { item, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.item);
  const usedPhotos = new Set([story.heroPhotoId, ...(story.body || []).filter((b) => b.type === "image").map((b) => b.photoId)]);
  const relatedPhotos = sortPhotos(photos(data)).map((item) => {
    const score = (item.tags || []).filter((tag) => storyTags.has(String(tag).toLowerCase())).length + (item.theme && story.theme && story.theme.includes(item.theme) ? 2 : 0);
    return { item, score };
  }).filter((x) => x.score > 0 && !usedPhotos.has(x.item.id)).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.item);
  if (!relatedStories.length && !relatedPhotos.length) return "";
  return `<section class="section related-section"><div class="container related-container"><div class="section-head"><div><p class="eyebrow">Continue exploring</p><h2>Related notes and photographs</h2></div></div>${relatedStories.length ? `<div class="related-stories">${relatedStories.map((s) => storyCard(data, s)).join("")}</div>` : ""}${relatedPhotos.length ? `<div class="gallery-grid selected-grid related-photos">${relatedPhotos.map((p, i) => photoFigure(p, { priority: i === 0, sizes: "(max-width: 560px) calc(100vw - 24px), 280px" })).join("")}</div>` : ""}</div></section>`;
}

export function storyNav(data, story) {
  const list = (data.stories || []).filter((s) => s.slug);
  const idx = list.findIndex((s) => s.slug === story.slug);
  if (idx < 0) return "";
  const prev = list[idx - 1];
  const next = list[idx + 1];
  if (!prev && !next) return "";
  const link = (s, dir, label) => s
    ? `<a class="story-walk-link story-walk-${dir}" href="${storyHref(s.slug)}"><span class="story-walk-dir">${label}</span><span class="story-walk-title">${esc(s.title)}</span></a>`
    : `<span class="story-walk-link is-empty" aria-hidden="true"></span>`;
  return `<nav class="story-walk container" aria-label="More from the journal"><p class="eyebrow story-walk-eyebrow">Continue the walk</p><div class="story-walk-row">${link(prev, "prev", "Previous")}${link(next, "next", "Next")}</div></nav>`;
}

// ---- page main content ----
export function homeMain(data) {
  const h = data.home || {}, hp = photo(data, h.heroPhotoId);
  const storyList = (h.featuredStorySlugs || []).map((slug) => (data.stories || []).find((s) => s.slug === slug)).filter(Boolean);
  const photoList = (h.galleryPhotoIds || []).map((id) => photo(data, id)).filter(Boolean);
  return `<main><section class="hero container"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">${esc(h.eyebrow)}</p><h1 class="headline">${esc(h.headline)}</h1><p class="intro">${esc(h.intro)}</p></div>${responsiveImage(hp, { className: "hero-img", priority: true, sizes: "(max-width: 850px) calc(100vw - 28px), 620px", fallbackSize: "full", viewTransitionName: "hero-photo" })}</div></section>
  <section class="section"><div class="container"><div class="section-head"><div><p class="eyebrow">Stories</p><h2>Featured stories</h2></div><a class="text-link" href="stories/index.html">View all stories</a></div><div class="grid-2">${storyList.map((s) => storyCard(data, s)).join("")}</div></div></section>
  <section class="section selected-section"><div class="container"><div class="section-head"><div><p class="eyebrow">A small edit</p><h2>Selected photographs</h2></div><a class="text-link" href="gallery/index.html">Open full gallery</a></div><div class="gallery-grid selected-grid">${photoList.map((p, i) => photoFigure(p, { priority: i < 2, sizes: "(max-width: 560px) calc(100vw - 24px), (max-width: 850px) 50vw, 560px" })).join("")}</div></div></section>
  <section class="section"><div class="container closing-panel"><h2>${esc(h.closingTitle)}</h2><p class="intro">${esc(h.closingText)}</p><div class="closing-links"><a class="text-link" href="stories/index.html">Read stories</a><a class="text-link" href="gallery/index.html">Open gallery</a></div></div></section></main>`;
}
export function galleryMain(data) {
  const g = data.gallery || {};
  const list = sortPhotos(photos(data));
  return `<main><section class="hero container"><p class="eyebrow">${esc(g.eyebrow)}</p><h1 class="headline">${esc(g.headline)}</h1><p class="intro">${esc(g.intro)}</p></section>
  <section class="section"><div class="container"><div class="gallery-toolbar"><div><div class="filters" role="group" aria-label="Gallery filters">${(g.filters || ["All"]).map((f, i) => `<button class="filter ${i === 0 ? "active" : ""}" data-filter="${esc(f)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(f)}</button>`).join("")}</div><p class="gallery-count" id="galleryCount" aria-live="polite">${list.length} photographs</p></div><button class="filter-reset" type="button">Reset</button></div><div class="gallery-empty" id="galleryEmpty" hidden><h2>No photographs found.</h2><p class="muted">Reset the filters to return to the full edit.</p></div><div class="gallery-grid" id="galleryGrid">${list.map((p, i) => photoFigure(p, { priority: i < 2, eager: i < 12, interactive: true })).join("")}</div></div></section><div id="lightboxRoot"></div></main>`;
}
export function storiesMain(data) {
  const sp = data.storiesPage || {};
  const stories = [...(data.stories || [])].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const featured = stories.find((s) => s.featured) || stories[0];
  const categories = ["All", ...new Set(stories.map(storyCategory))];
  const mapStories = stories.filter((s) => s.coordinates && Number.isFinite(Number(s.coordinates.lat)) && Number.isFinite(Number(s.coordinates.lng))).map((s) => {
    const hero = photo(data, s.heroPhotoId);
    return { slug: s.slug, title: s.title, lat: Number(s.coordinates.lat), lng: Number(s.coordinates.lng), href: storyHref(s.slug), thumb: variant(hero, "thumb", "jpeg") || imgPath(hero), alt: (hero && hero.alt) || s.title };
  });
  const mapSection = mapStories.length ? `<section class="section stories-map-cta"><div class="container"><a class="atlas-cta" href="${root()}atlas/index.html"><span class="atlas-cta-copy"><p class="eyebrow">Explore by place</p><h2>Open the atlas</h2><p class="muted">See every story mapped to where it happened — wander the journal geographically.</p></span><span class="atlas-cta-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a></div></section>` : "";
  return `<main><section class="hero container"><p class="eyebrow">${esc(sp.eyebrow)}</p><h1 class="headline">${esc(sp.headline)}</h1><p class="intro">${esc(sp.intro)}</p></section>${featured ? `<section class="section featured-story-section"><div class="container"><div class="section-head"><div><p class="eyebrow">${esc(sp.featuredLabel || "Featured story")}</p><h2>${esc(featured.title)}</h2></div><a class="text-link" href="${storyHref(featured.slug)}">Read featured</a></div>${featuredStoryBlock(data, featured)}</div></section>` : ""}${mapSection}<section class="section stories-section"><div class="container"><div class="gallery-toolbar story-toolbar"><div><p class="eyebrow">${esc(sp.categoryLabel || "Browse by category")}</p><div class="filters" role="group" aria-label="Story categories">${categories.map((category, i) => `<button class="filter story-filter ${i === 0 ? "active" : ""}" data-story-filter="${esc(category)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(category)}</button>`).join("")}</div><p class="gallery-count" id="storyCount" aria-live="polite">${stories.length} stories</p></div><button class="filter-reset story-reset" type="button">Reset</button></div><div class="story-list">${stories.map((s) => storyCard(data, s)).join("")}</div><div class="gallery-empty story-empty" id="storyEmpty" hidden><h2>No stories found.</h2><p class="muted">Reset the category filter to return to the archive.</p></div></div></section></main>`;
}
export function atlasMain(data) {
  const ap = data.atlasPage || {};
  const mapStories = (data.stories || [])
    .filter((s) => s.coordinates && Number.isFinite(Number(s.coordinates.lat)) && Number.isFinite(Number(s.coordinates.lng)))
    .map((s) => {
      const hero = photo(data, s.heroPhotoId);
      return { slug: s.slug, title: s.title, location: s.location || "", date: s.date || "", summary: s.summary || "", lat: Number(s.coordinates.lat), lng: Number(s.coordinates.lng), href: storyHref(s.slug), thumb: variant(hero, "thumb", "jpeg") || imgPath(hero), alt: (hero && hero.alt) || s.title };
    });
  const places = mapStories.map((s) => `<li><a class="atlas-place" href="${s.href}" data-place-slug="${esc(s.slug)}"><span class="atlas-place-thumb">${s.thumb ? `<img src="${esc(s.thumb)}" alt="" loading="lazy">` : ""}</span><span class="atlas-place-copy"><span class="atlas-place-title">${esc(s.title)}</span>${metaText([s.location, s.date]) ? `<span class="meta">${esc(metaText([s.location, s.date]))}</span>` : ""}${s.summary ? `<span class="atlas-place-snippet">${esc(s.summary)}</span>` : ""}</span></a></li>`).join("");
  const mapData = JSON.stringify(mapStories).replace(/</g, "\\u003c");
  return `<main><section class="hero container atlas-hero"><p class="eyebrow">${esc(ap.eyebrow || "Explore by place")}</p><h1 class="headline">${esc(ap.headline || "An atlas of quiet places")}</h1><p class="intro">${esc(ap.intro || "Every story mapped to where it happened. Wander the journal geographically — or browse the places below.")}</p></section>
  <section class="section atlas-section"><div class="container atlas-layout"><div class="atlas-map-wrap"><div id="atlasMap" class="stories-map atlas-map" role="region" aria-label="Map of story locations"></div><script type="application/json" id="atlas-map-data">${mapData}</script></div><nav class="atlas-places" aria-label="Places in the journal"><p class="eyebrow">${mapStories.length} ${mapStories.length === 1 ? "place" : "places"}</p><ul>${places}</ul></nav></div></section></main>`;
}
export function aboutMain(data) {
  const a = data.about || {}, p = photo(data, a.portraitPhotoId);
  return `<main><section class="hero container about-grid">${responsiveImage(p, { className: "about-img", priority: true, sizes: "(max-width: 850px) calc(100vw - 28px), 520px" })}<div><p class="eyebrow">${esc(a.eyebrow)}</p><h1 class="headline">${esc(a.headline)}</h1><div class="prose">${(a.paragraphs || []).map((x) => `<p>${esc(x)}</p>`).join("")}</div>${data.site.ownerName ? `<p class="about-signature">${esc(data.site.ownerName)}</p>` : ""}${a.contactEmail ? `<div class="about-contact"><span class="eyebrow">Get in touch</span><a href="mailto:${esc(a.contactEmail)}">${esc(a.contactEmail)}</a></div>` : ""}</div></section></main>`;
}
export function storyMain(data, s) {
  const hasGeo = s.coordinates && Number.isFinite(Number(s.coordinates.lat)) && Number.isFinite(Number(s.coordinates.lng));
  const mapLink = hasGeo ? `<a class="story-map-link" href="${root()}atlas/index.html?place=${encodeURIComponent(s.slug)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>View on the map</a>` : "";
  return `<main><section class="story-hero container"><div class="story-meta" role="group" aria-label="Story details">${storyMetaChips(s)}</div><h1 class="headline">${esc(s.title)}</h1><p class="intro">${esc(s.summary)}</p>${mapLink}${responsiveImage(photo(data, s.heroPhotoId), { priority: true, sizes: "(max-width: 1220px) calc(100vw - 40px), 1180px", fallbackSize: "full", viewTransitionName: s.slug ? `story-${s.slug}` : "hero-photo" })}</section><article class="story-body">${(s.body || []).map((b) => blockHtmlInteractive(data, b)).join("")}</article>${relatedPanel(data, s)}${sharePanel(data, s)}${storyNav(data, s)}</main><div id="lightboxRoot"></div>`;
}
export function legacyStoryMain(data) {
  return `<main class="container section"><p class="eyebrow">Stories</p><h1 class="headline">${esc(data.storiesPage?.headline || "Stories")}</h1><p class="intro">${esc(data.storiesPage?.intro || data.site?.description || "")}</p><p><a class="text-link" href="${root()}stories/index.html">Return to stories</a></p></main>`;
}

export function notFoundMain(data) {
  return `<main><section class="hero container"><p class="eyebrow">Page not found</p><h1 class="headline">This page is not available.</h1><p class="intro">The link may be outdated, or the page may have moved. Return to the archive and continue from there.</p><div class="closing-links" style="margin-top:32px"><a class="text-link" href="${root()}index.html">Return home</a><a class="text-link" href="${root()}stories/index.html">Read stories</a><a class="text-link" href="${root()}atlas/index.html">Explore the atlas</a></div></section></main>`;
}

// ---- JSON-LD object builders (pure) ----
export const machineDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : undefined);
export const jsonLdImageUrl = (data, p) => (p ? absoluteUrl(data, (variant(p, "full", "jpeg") || imgPath(p)).replace(/^(?:\.\.\/)+/, "")) : undefined);
export function websiteLdObject(data) {
  const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
  if (!base) return null;
  return { "@context": "https://schema.org", "@type": "WebSite", name: data.site?.siteTitle || data.site?.ownerName || "", url: base + "/", author: { "@type": "Person", name: data.site?.ownerName || "" } };
}
export function imageGalleryLdObject(data, list) {
  list = list || sortPhotos(photos(data));
  return { "@context": "https://schema.org", "@type": "ImageGallery", name: data.gallery?.headline || "Gallery", description: data.gallery?.intro || data.site?.description || "", url: absoluteUrl(data, "gallery/"), image: (list || []).slice(0, 24).map((p) => ({ "@type": "ImageObject", name: p.title || "", caption: p.caption || "", contentUrl: jsonLdImageUrl(data, p), thumbnailUrl: variant(p, "thumb", "jpeg") ? absoluteUrl(data, variant(p, "thumb", "jpeg").replace(/^(?:\.\.\/)+/, "")) : undefined })) };
}
export function personLdObject(data) {
  const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
  const portrait = photo(data, data.about?.portraitPhotoId);
  return { "@context": "https://schema.org", "@type": "Person", name: data.site?.ownerName || "", url: base || absoluteUrl(data, "about/"), sameAs: data.site?.instagramUrl ? [data.site.instagramUrl] : undefined, image: jsonLdImageUrl(data, portrait), description: (data.about?.paragraphs || [])[0] || data.site?.description || "" };
}
export function articleLdObject(data, story, heroPhoto) {
  const base = String(data.site?.baseUrl || "").replace(/\/+$/, "");
  return { "@context": "https://schema.org", "@type": "Article", headline: story.title || "", description: story.summary || data.site?.description || "", image: jsonLdImageUrl(data, heroPhoto), datePublished: machineDate(story.isoDate) || machineDate(story.date), author: { "@type": "Person", name: data.site?.ownerName || "", url: base || undefined }, publisher: { "@type": "Organization", name: data.site?.siteTitle || data.site?.ownerName || "", logo: { "@type": "ImageObject", url: (base || "") + "/icon-512.png" } }, url: absoluteUrl(data, "stories/" + encodeURIComponent(story.slug) + "/") };
}
export function breadcrumbLdObject(data, trail) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: (trail || []).map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: absoluteUrl(data, t.path) })) };
}
export function storiesLdObject(data) {
  const stories = (data.stories || []).filter((s) => s.slug && s.title);
  return { "@context": "https://schema.org", "@type": "CollectionPage", name: data.storiesPage?.headline || "Stories", description: data.storiesPage?.intro || data.site?.description || "", url: absoluteUrl(data, "stories/"), mainEntity: { "@type": "ItemList", itemListElement: stories.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.title, url: absoluteUrl(data, "stories/" + encodeURIComponent(s.slug) + "/") })) } };
}
export function atlasLdObject(data) {
  const placed = (data.stories || []).filter((s) => s.coordinates && Number.isFinite(Number(s.coordinates.lat)) && Number.isFinite(Number(s.coordinates.lng)));
  return { "@context": "https://schema.org", "@type": "CollectionPage", name: data.atlasPage?.headline || "Atlas", description: data.atlasPage?.intro || data.site?.description || "", url: absoluteUrl(data, "atlas/"), mainEntity: { "@type": "ItemList", itemListElement: placed.map((s, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Place", name: s.title, url: absoluteUrl(data, "stories/" + encodeURIComponent(s.slug) + "/"), geo: { "@type": "GeoCoordinates", latitude: Number(s.coordinates.lat), longitude: Number(s.coordinates.lng) } } })) } };
}
