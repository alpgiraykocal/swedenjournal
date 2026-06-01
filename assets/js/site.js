const DATA_PATH = window.__DATA_PATH__ || "assets/data/site-content.json";

async function loadContent(){
  const res = await fetch(DATA_PATH);
  if(!res.ok) throw new Error("Could not load assets/data/site-content.json");
  return res.json();
}
function $(s, r=document){ return r.querySelector(s); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function root(){ return window.__ROOT__ || ""; }
function prefix(){ return window.__ASSET_PREFIX__ || ""; }
function photos(data){ return Array.isArray(data.photos) ? data.photos : []; }
function photo(data,id){ return photos(data).find(p => p.id === id) || photos(data)[0] || null; }
function imgPath(p){ return p ? prefix() + p.src : ""; }
function currentPage(){ return document.body.dataset.page || "home"; }
function metaText(parts){ return parts.filter(Boolean).join(" · "); }
const IMAGE_WIDTHS = {thumb:480, medium:1200, full:2200};
const query = () => new URLSearchParams(location.search);
function variant(p, size, format){
  const value = p?.variants?.[size]?.[format];
  return value ? prefix() + value : "";
}
function srcset(p, format){
  return ["thumb","medium","full"].map(size => {
    const value = variant(p, size, format);
    const width = p?.variants?.[size]?.width || IMAGE_WIDTHS[size];
    return value ? `${value} ${width}w` : "";
  }).filter(Boolean).join(", ");
}
function viewTransitionStyle(value){
  const id = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  if(!id) return "";
  const safe = /^[a-zA-Z_]/.test(id) ? id : `vt-${id}`;
  return ` style="view-transition-name:${esc(safe)}"`;
}
function responsiveImage(p, opts={}){
  if(!p) return "";
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
  return `<picture>${avifSet?`<source type="image/avif" srcset="${esc(avifSet)}" sizes="${sizes}">`:""}${webpSet?`<source type="image/webp" srcset="${esc(webpSet)}" sizes="${sizes}">`:""}<img${className} src="${esc(fallback)}"${jpegSet?` srcset="${esc(jpegSet)}" sizes="${sizes}"`:""} alt="${esc(alt)}"${loading} decoding="async"${size}${vt}></picture>`;
}
function storyMeta(s){ return metaText([s.location, s.date, s.readingTime]); }
function storyCardMeta(s){ return metaText([s.location, s.date]); }
function storyHref(slug){ return `${root()}stories/${encodeURIComponent(slug)}/`; }
function absoluteUrl(data, path=""){
  const base = String(data.site?.baseUrl || "").replace(/\/+$/,"");
  if(base) return `${base}/${String(path).replace(/^\/+/,"")}`;
  return new URL(path ? root() + String(path).replace(/^\/+/,"") : location.pathname + location.search, location.href).href;
}
function ensureMeta(selector, tagName, attrs){
  let node = document.head.querySelector(selector);
  if(!node){
    node = document.createElement(tagName);
    Object.entries(attrs || {}).forEach(([key,value]) => node.setAttribute(key, value));
    document.head.appendChild(node);
  }
  return node;
}
function updateMeta(data, {title, description, path="", imagePhoto=null, robots=""}={}){
  const siteTitle = data.site?.siteTitle || data.site?.ownerName || "Photo Blog";
  const fullTitle = title && title !== siteTitle ? `${title} — ${siteTitle}` : siteTitle;
  const desc = description || data.site?.description || "";
  document.title = fullTitle;
  const metaDesc = ensureMeta('meta[name="description"]', "meta", {name:"description"});
  metaDesc.setAttribute("content", desc);
  const canonical = ensureMeta('link[rel="canonical"]', "link", {rel:"canonical"});
  canonical.setAttribute("href", absoluteUrl(data, path || location.pathname.replace(/^\//,"") + location.search));
  const robotsMeta = document.head.querySelector('meta[name="robots"]');
  if(robots){
    const node = robotsMeta || ensureMeta('meta[name="robots"]', "meta", {name:"robots"});
    node.setAttribute("content", robots);
  }else if(robotsMeta){
    robotsMeta.remove();
  }
  const ogTitle = ensureMeta('meta[property="og:title"]', "meta", {property:"og:title"});
  const ogDesc = ensureMeta('meta[property="og:description"]', "meta", {property:"og:description"});
  const ogType = ensureMeta('meta[property="og:type"]', "meta", {property:"og:type"});
  const ogUrl = ensureMeta('meta[property="og:url"]', "meta", {property:"og:url"});
  const twitterCard = ensureMeta('meta[name="twitter:card"]', "meta", {name:"twitter:card"});
  const twitterTitle = ensureMeta('meta[name="twitter:title"]', "meta", {name:"twitter:title"});
  const twitterDesc = ensureMeta('meta[name="twitter:description"]', "meta", {name:"twitter:description"});
  ogTitle.setAttribute("content", fullTitle);
  ogDesc.setAttribute("content", desc);
  ogType.setAttribute("content", currentPage() === "story" ? "article" : "website");
  ogUrl.setAttribute("content", canonical.href);
  twitterCard.setAttribute("content", "summary_large_image");
  twitterTitle.setAttribute("content", fullTitle);
  twitterDesc.setAttribute("content", desc);
  if(imagePhoto){
    const ogImage = ensureMeta('meta[property="og:image"]', "meta", {property:"og:image"});
    const twitterImage = ensureMeta('meta[name="twitter:image"]', "meta", {name:"twitter:image"});
    const imageUrl = absoluteUrl(data, (variant(imagePhoto, "full", "jpeg") || imgPath(imagePhoto)).replace(/^\.\.\//,""));
    ogImage.setAttribute("content", imageUrl);
    twitterImage.setAttribute("content", imageUrl);
  }
}
function storyCategory(story){
  return story?.category || String(story?.theme || "").split(/[,/]/).map(x => x.trim()).filter(Boolean)[0] || "Travel Notes";
}
function storyMetaChips(s){
  return [s.location, s.date, s.readingTime, storyCategory(s)].filter(Boolean).map(item => `<span>${esc(item)}</span>`).join("");
}
function storyPhotos(data, story){
  const ids = [story.heroPhotoId, ...(story.body || []).filter(block => block.type === "image").map(block => block.photoId)];
  return [...new Set(ids)].map(id => photo(data, id)).filter(Boolean);
}
function storyShareUrl(data, story){
  const base = String(data.site?.baseUrl || "").replace(/\/+$/,"");
  if(base) return `${base}/stories/${encodeURIComponent(story.slug)}/`;
  return new URL(`${root()}stories/${encodeURIComponent(story.slug)}/`, location.href).href;
}
function setUrlParam(key, value, mode="replace"){
  const url = new URL(location.href);
  if(value === null || value === undefined || value === "" || value === "All") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}
function bindFilterKeyboard(container){
  if(!container) return;
  container.addEventListener("keydown", e => {
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
    const buttons = [...container.querySelectorAll("button:not([disabled])")];
    const index = buttons.indexOf(document.activeElement);
    if(index < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  });
}
function cssEscape(value){
  return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}
function injectPreload(p, sizes, fallbackSize="medium"){
  if(!p || document.head.querySelector(`[data-preload-photo="${cssEscape(p.id)}"]`)) return;
  const preferred = [["avif","image/avif"],["webp","image/webp"],["jpeg","image/jpeg"]].find(([format]) => variant(p, fallbackSize, format) || srcset(p, format));
  if(!preferred) return;
  const [format, type] = preferred;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = variant(p, fallbackSize, format) || imgPath(p);
  link.type = type;
  link.setAttribute("data-preload-photo", p.id);
  const set = srcset(p, format);
  if(set) link.setAttribute("imagesrcset", set);
  if(sizes) link.setAttribute("imagesizes", sizes);
  document.head.appendChild(link);
}
function sortPhotos(list){ return [...list].sort((a,b)=>{
  const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
  const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
  if(ao !== bo) return ao - bo;
  if(Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
  return String(a.title||"").localeCompare(String(b.title||""));
}); }
function header(data){
  const page = currentPage();
  const activePage = page === "story" ? "stories" : page;
  const item = (id, href, label) => `<a href="${href}" ${activePage===id ? `aria-current="page"` : ""}>${label}</a>`;
  return `<a class="skip-link" href="#app">Skip to content</a><header class="site-header"><div class="container nav"><a class="brand" href="${root()}index.html">${esc(data.site.ownerName)}<span class="brand-tagline">${esc(data.site.siteTitle || "")}</span></a><nav class="nav-links" aria-label="Primary navigation">
  ${item("home",`${root()}index.html`,"Home")}${item("stories",`${root()}stories/index.html`,"Stories")}${item("gallery",`${root()}gallery/index.html`,"Gallery")}${item("about",`${root()}about/index.html`,"About")}<a href="${esc(data.site.instagramUrl)}" target="_blank" rel="noopener">${esc(data.site.instagramLabel||"Instagram")}</a></nav></div></header>`;
}
function footer(data){ return `<footer class="site-footer"><div class="container footer-row"><span>${esc(data.site.ownerName)} — ${esc(data.site.footerText)}</span><a href="${esc(data.site.instagramUrl)}" target="_blank" rel="noopener">${esc(data.site.instagramLabel||"Instagram")}</a></div></footer>`; }
function storyCard(data,s){
  const sequence = storyPhotos(data, s);
  const p = sequence[0];
  const tags = (s.tags || []).slice(0,3);
  const strip = sequence.slice(0,3).map(item => `<span>${responsiveImage(item,{className:"story-strip-img",sizes:"96px",fallbackSize:"thumb",alt:""})}</span>`).join("");
  return `<a class="card story-card" href="${storyHref(s.slug)}" data-story-card data-category="${esc(storyCategory(s))}"><div class="story-card-media"${mediaRatioStyle(p)}>${responsiveImage(p,{className:"story-card-img",sizes:"(max-width: 850px) calc(100vw - 28px), 48vw",viewTransitionName:s.slug?`story-${s.slug}`:undefined})}</div><div class="story-card-copy"><span class="meta">${esc(storyCardMeta(s))}</span><h3>${esc(s.title)}</h3><p class="muted">${esc(s.summary)}</p>${strip?`<span class="story-strip" aria-label="Story photographs">${strip}</span>`:""}${tags.length?`<span class="story-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join("")}</span>`:""}<span class="story-link">Read story${s.readingTime?` · ${esc(s.readingTime)}`:""}</span></div></a>`;
}
function featuredStoryBlock(data, story){
  const p = storyPhotos(data, story)[0];
  return `<a class="featured-story" href="${storyHref(story.slug)}"><div class="featured-story-media"${mediaRatioStyle(p)}>${responsiveImage(p,{className:"story-card-img",priority:true,sizes:"(max-width: 850px) calc(100vw - 28px), 620px",viewTransitionName:story.slug?`story-${story.slug}`:undefined})}</div><div class="featured-story-copy"><span class="meta">${esc(storyCardMeta(story))}</span><h3>${esc(story.title)}</h3><p class="muted">${esc(story.summary)}</p><span class="story-link">Read featured${story.readingTime?` · ${esc(story.readingTime)}`:""}</span></div></a>`;
}
function mediaRatioStyle(p){
  return p?.width && p?.height ? ` style="aspect-ratio:${esc(p.width)} / ${esc(p.height)}"` : "";
}
function photoFigure(p, options={}){
  const opts = typeof options === "object" ? options : {};
  const button = opts.interactive ? `<button class="photo-open" type="button" data-open-photo="${esc(p.id)}" aria-label="Open ${esc(p.title)}">View</button>` : "";
  return `<figure class="photo-card ${p.featured ? "featured" : ""}" data-photo-id="${esc(p.id)}" data-category="${esc(p.category||"")}" data-tags="${esc((p.tags||[]).join('|'))}" data-theme="${esc(p.theme||"")}"><div class="photo-media"${mediaRatioStyle(p)}>${responsiveImage(p,{priority:opts.priority,eager:opts.eager,sizes:opts.sizes || "(max-width: 560px) calc(100vw - 24px), (max-width: 900px) 50vw, 380px"})}${button}</div><figcaption><strong>${esc(p.title)}</strong>${p.location?` — ${esc(p.location)}`:""}${p.caption?`<br>${esc(p.caption)}`:""}</figcaption></figure>`;
}
function blockHtml(data, block, interactive=false){
  if(!block) return "";
  if(block.type === "image"){
    const p = photo(data, block.photoId);
    if(!p) return "";
    const btn = interactive ? `<button class="photo-open" type="button" data-open-photo="${esc(p.id)}" aria-label="Open ${esc(p.title)}">View</button>` : "";
    return `<figure class="story-inline-photo"><div class="photo-media story-inline-media">${responsiveImage(p,{className:"story-inline-img",sizes:"(max-width: 920px) calc(100vw - 40px), 840px",fallbackSize:"full"})}${btn}</div><figcaption>${esc(block.caption || p.caption || "")}</figcaption></figure>`;
  }
  if(block.type === "quote") return `<blockquote>${esc(block.text)}</blockquote>`;
  if(block.type === "heading") return `<h2>${esc(block.text)}</h2>`;
  return `<p>${esc(block.text || "")}</p>`;
}
function sharePanel(data, story){
  const url = storyShareUrl(data, story);
  const subject = encodeURIComponent(story.title || data.site?.siteTitle || "Photo story");
  const body = encodeURIComponent(`${story.summary || story.title}\n\n${url}`);
  return `<aside class="share-panel container" aria-labelledby="share-title">
    <div class="share-copy">
      <p class="eyebrow">Share</p>
      <h2 id="share-title" class="share-title">Share this story</h2>
      <p class="muted">Send it to someone who would enjoy this place, light, or walk.</p>
    </div>
    <div class="share-actions" aria-label="Share options">
      <button class="share-action" type="button" data-native-share data-share-url="${esc(url)}" data-share-title="${esc(story.title)}" data-share-text="${esc(story.summary || "")}">Share</button>
      <button class="share-action" type="button" data-copy-link data-share-url="${esc(url)}" data-default-label="Copy link">Copy link</button>
      <a class="share-action" href="mailto:?subject=${subject}&body=${body}">Email</a>
    </div>
    <p class="share-status" aria-live="polite"></p>
  </aside>`;
}
function injectJsonLd(obj){
  const s=document.createElement("script");
  s.type="application/ld+json";
  s.textContent=JSON.stringify(obj);
  document.head.appendChild(s);
}
function jsonLdImageUrl(data, p){
  return p ? absoluteUrl(data, (variant(p, "full", "jpeg") || imgPath(p)).replace(/^\.\.\//, "")) : undefined;
}
function machineDate(value){
  const raw = String(value || "").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : raw;
}
function jsonLdArticle(data,story,heroPhoto){
  const base=String(data.site?.baseUrl||"").replace(/\/+$/,"");
  injectJsonLd({"@context":"https://schema.org","@type":"Article","headline":story.title||"","description":story.summary||data.site?.description||"","image":jsonLdImageUrl(data,heroPhoto),"datePublished":machineDate(story.isoDate)||machineDate(story.date),"author":{"@type":"Person","name":data.site?.ownerName||"","url":base||undefined},"publisher":{"@type":"Person","name":data.site?.ownerName||""},"url":absoluteUrl(data,"stories/"+encodeURIComponent(story.slug)+"/")});
}
function jsonLdWebSite(data){
  const base=String(data.site?.baseUrl||"").replace(/\/+$/,"");
  if(!base)return;
  injectJsonLd({"@context":"https://schema.org","@type":"WebSite","name":data.site?.siteTitle||data.site?.ownerName||"","url":base+"/","author":{"@type":"Person","name":data.site?.ownerName||""}});
}
function jsonLdImageGallery(data, list){
  injectJsonLd({"@context":"https://schema.org","@type":"ImageGallery","name":data.gallery?.headline||"Gallery","description":data.gallery?.intro||data.site?.description||"","url":absoluteUrl(data,"gallery/"),"image":(list||[]).slice(0,24).map(p=>({"@type":"ImageObject","name":p.title||"","caption":p.caption||"","contentUrl":jsonLdImageUrl(data,p),"thumbnailUrl":variant(p,"thumb","jpeg")?absoluteUrl(data,variant(p,"thumb","jpeg").replace(/^\.\.\//,"")):undefined}))});
}
function jsonLdPerson(data){
  const base=String(data.site?.baseUrl||"").replace(/\/+$/,"");
  const portrait=photo(data,data.about?.portraitPhotoId);
  injectJsonLd({"@context":"https://schema.org","@type":"Person","name":data.site?.ownerName||"","url":base||absoluteUrl(data,"about/"),"sameAs":data.site?.instagramUrl?[data.site.instagramUrl]:undefined,"image":jsonLdImageUrl(data,portrait),"description":(data.about?.paragraphs||[])[0]||data.site?.description||""});
}
function currentStorySlug(){
  const querySlug = query().get("slug");
  if(querySlug) return querySlug;
  const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const last = parts.at(-1);
  if(last === "index.html"){
    const parent = parts.at(-2);
    return parent && !["story","stories"].includes(parent) ? decodeURIComponent(parent) : null;
  }
  return last && !["story","stories"].includes(last) ? decodeURIComponent(last) : null;
}
function isLegacyStoryShell(){
  if(query().get("slug")) return false;
  const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const last = parts.at(-1);
  const parent = parts.at(-2);
  return last === "story" || (last === "index.html" && parent === "story");
}
async function boot(){
  try{
    const data = await loadContent();
    document.title = data.site.siteTitle || data.site.ownerName || "Photo Blog";
    const app = $("#app");
    app.insertAdjacentHTML("beforebegin", header(data));
    $("#footer").innerHTML = footer(data);
    const page = document.body.dataset.page;
    const preloadMap = {
      home: photo(data, data.home?.heroPhotoId),
      gallery: sortPhotos(photos(data))[0],
      stories: storyPhotos(data, [...(data.stories || [])].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)))[0] || {})[0],
      about: photo(data, data.about?.portraitPhotoId),
      story: photo(data, ((data.stories || []).find(x => x.slug===currentStorySlug()) || data.stories?.[0])?.heroPhotoId)
    };
    injectPreload(preloadMap[page], "(max-width: 850px) calc(100vw - 28px), 1180px", "medium");
    if(page === "home") renderHome(data);
    if(page === "gallery") renderGallery(data);
    if(page === "stories") renderStories(data);
    if(page === "about") renderAbout(data);
    if(page === "story") renderStory(data);
    bindScrollReveal();
  }catch(e){
    $("#app").innerHTML = `<main class="container section"><h1 class="headline">Content could not be loaded.</h1><p class="intro">${esc(e.message)}</p></main>`;
  }
}
function renderHome(data){
  const h = data.home || {}, hp = photo(data,h.heroPhotoId);
  updateMeta(data, {title:data.site?.siteTitle, description:data.site?.description, path:"", imagePhoto:hp});
  jsonLdWebSite(data);
  const storyList = (h.featuredStorySlugs||[]).map(slug=>(data.stories||[]).find(s=>s.slug===slug)).filter(Boolean);
  const photoList = (h.galleryPhotoIds||[]).map(id => photo(data,id)).filter(Boolean);
  $("#app").innerHTML = `<main><section class="hero container"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">${esc(h.eyebrow)}</p><h1 class="headline">${esc(h.headline)}</h1><p class="intro">${esc(h.intro)}</p></div>${responsiveImage(hp,{className:"hero-img",priority:true,sizes:"(max-width: 850px) calc(100vw - 28px), 620px",fallbackSize:"full",viewTransitionName:"hero-photo"})}</div></section>
  <section class="section"><div class="container"><div class="section-head"><h2>Featured stories</h2><a class="text-link" href="stories/index.html">View all stories</a></div><div class="grid-2">${storyList.map(s=>storyCard(data,s)).join("")}</div></div></section>
  <section class="section selected-section"><div class="container"><div class="section-head"><div><p class="eyebrow">A small edit</p><h2>Selected photographs</h2></div><a class="text-link" href="gallery/index.html">Open full gallery</a></div><div class="gallery-grid selected-grid">${photoList.map((p,i)=>photoFigure(p,{priority:i<2,sizes:"(max-width: 560px) calc(100vw - 24px), (max-width: 850px) 50vw, 560px"})).join("")}</div></div></section>
  <section class="section"><div class="container closing-panel"><h2>${esc(h.closingTitle)}</h2><p class="intro">${esc(h.closingText)}</p></div></section></main>`;
}
function renderGallery(data){
  const g = data.gallery || {};
  const list = sortPhotos(photos(data));
  updateMeta(data, {title:"Gallery", description:g.intro || data.site?.description, path:"gallery/", imagePhoto:list[0]});
  jsonLdImageGallery(data, list);
  $("#app").innerHTML = `<main><section class="hero container"><p class="eyebrow">${esc(g.eyebrow)}</p><h1 class="headline">${esc(g.headline)}</h1><p class="intro">${esc(g.intro)}</p></section>
  <section class="section"><div class="container"><div class="gallery-toolbar"><div><div class="filters" aria-label="Gallery filters">${(g.filters||["All"]).map((f,i)=>`<button class="filter ${i===0?"active":""}" data-filter="${esc(f)}" aria-pressed="${i===0?"true":"false"}">${esc(f)}</button>`).join("")}</div><p class="gallery-count" id="galleryCount" aria-live="polite">${list.length} photographs</p></div><button class="filter-reset" type="button">Reset</button></div><div class="gallery-empty" id="galleryEmpty" hidden><h2>No photographs found.</h2><p class="muted">Reset the filters to return to the full edit.</p></div><div class="gallery-grid" id="galleryGrid">${list.map((p,i)=>photoFigure(p,{priority:i<2,eager:i<12,interactive:true})).join("")}</div></div></section><div id="lightboxRoot"></div></main>`;
  bindGalleryControls(data, list);
}
function renderStories(data){
  const sp = data.storiesPage || {};
  const stories = [...(data.stories||[])].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const featured = stories.find(s => s.featured) || stories[0];
  const categories = ["All", ...new Set(stories.map(storyCategory))];
  updateMeta(data, {title:"Stories", description:sp.intro || data.site?.description, path:"stories/", imagePhoto:featured ? storyPhotos(data, featured)[0] : null});
  $("#app").innerHTML = `<main><section class="hero container"><p class="eyebrow">${esc(sp.eyebrow)}</p><h1 class="headline">${esc(sp.headline)}</h1><p class="intro">${esc(sp.intro)}</p></section>${featured?`<section class="section featured-story-section"><div class="container"><div class="section-head"><div><p class="eyebrow">${esc(sp.featuredLabel || "Featured story")}</p><h2>${esc(featured.title)}</h2></div><a class="text-link" href="${storyHref(featured.slug)}">Read featured</a></div>${featuredStoryBlock(data, featured)}</div></section>`:""}<section class="section stories-section"><div class="container"><div class="gallery-toolbar story-toolbar"><div><p class="eyebrow">${esc(sp.categoryLabel || "Browse by category")}</p><div class="filters" aria-label="Story categories">${categories.map((category,i)=>`<button class="filter story-filter ${i===0?"active":""}" data-story-filter="${esc(category)}" aria-pressed="${i===0?"true":"false"}">${esc(category)}</button>`).join("")}</div><p class="gallery-count" id="storyCount" aria-live="polite">${stories.length} stories</p></div><button class="filter-reset story-reset" type="button">Reset</button></div><div class="story-list">${stories.map(s=>storyCard(data,s)).join("")}</div><div class="gallery-empty story-empty" id="storyEmpty" hidden><h2>No stories found.</h2><p class="muted">Reset the category filter to return to the archive.</p></div></div></section></main>`;
  bindStoryFilters();
}
function renderAbout(data){
  const a = data.about || {}, p = photo(data,a.portraitPhotoId);
  updateMeta(data, {title:"About", description:(a.paragraphs||[])[0] || data.site?.description, path:"about/", imagePhoto:p});
  jsonLdPerson(data);
  $("#app").innerHTML = `<main><section class="hero container about-grid">${responsiveImage(p,{className:"about-img",priority:true,sizes:"(max-width: 850px) calc(100vw - 28px), 520px"})}<div><p class="eyebrow">${esc(a.eyebrow)}</p><h1 class="headline">${esc(a.headline)}</h1><div class="prose">${(a.paragraphs||[]).map(x=>`<p>${esc(x)}</p>`).join("")}</div></div></section></main>`;
}
function renderStory(data){
  if(isLegacyStoryShell()){
    const featured = data.stories?.find(s => s.featured) || data.stories?.[0];
    updateMeta(data, {title:"Stories", description:data.storiesPage?.intro || data.site?.description, path:"stories/", imagePhoto:featured ? storyPhotos(data, featured)[0] : null, robots:"noindex,follow"});
    $("#app").innerHTML = `<main class="container section"><p class="eyebrow">Stories</p><h1 class="headline">${esc(data.storiesPage?.headline || "Stories")}</h1><p class="intro">${esc(data.storiesPage?.intro || data.site?.description || "")}</p><p><a class="text-link" href="${root()}stories/index.html">Return to stories</a></p></main>`;
    return;
  }
  const requestedSlug = currentStorySlug();
  const fallbackSlug = data.stories?.[0]?.slug;
  const slug = requestedSlug || fallbackSlug;
  const s = (data.stories||[]).find(x=>x.slug===slug);
  if(!s){
    updateMeta(data, {title:"Story not found", description:"The requested story is not available.", path:"stories/", robots:"noindex,follow"});
    $("#app").innerHTML = `<main class="container section"><p class="eyebrow">Story not found</p><h1 class="headline">This story is not available.</h1><p class="intro">The link may be outdated or the story may have been removed.</p><p><a class="text-link" href="${root()}stories/index.html">Return to stories</a></p></main>`;
    return;
  }
  const p = photo(data,s.heroPhotoId);
  updateMeta(data, {title:s.title, description:s.summary || data.site?.description, path:`stories/${encodeURIComponent(s.slug)}/`, imagePhoto:p});
  jsonLdArticle(data, s, p);
  $("#app").innerHTML = `<main><section class="story-hero container"><div class="story-meta" aria-label="Story details">${storyMetaChips(s)}</div><h1 class="headline">${esc(s.title)}</h1><p class="intro">${esc(s.summary)}</p>${responsiveImage(p,{priority:true,sizes:"(max-width: 1220px) calc(100vw - 40px), 1180px",fallbackSize:"full",viewTransitionName:s.slug?`story-${s.slug}`:"hero-photo"})}</section><article class="story-body">${(s.body||[]).map(block=>blockHtmlInteractive(data,block)).join("")}</article>${relatedPanel(data,s)}${sharePanel(data,s)}</main><div id="lightboxRoot"></div>`;
  bindShareControls();
  bindLightbox(data, () => storyPhotos(data, s));
}
function bindScrollReveal(){const els=[...document.querySelectorAll(".photo-card,.story-card,.related-photos .photo-card,.story-inline-photo,.story-body > p,.story-body > h2,.story-body > blockquote")];if(typeof IntersectionObserver==="undefined"){els.forEach(el=>el.classList.add("revealed"));return;}const io=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("revealed");io.unobserve(e.target);}});},{threshold:0.08,rootMargin:"0px 0px -40px 0px"});els.forEach(el=>{if(!el.classList.contains("revealed"))io.observe(el);});}function blockHtmlInteractive(data,block){if(!block)return "";if(block.type==="image"){const p=photo(data,block.photoId);return p?`<figure class="story-inline-photo">${responsiveImage(p,{className:"story-inline-img",sizes:"(max-width: 920px) calc(100vw - 40px), 840px",fallbackSize:"full"})}<figcaption>${esc(block.caption||p.caption||"")}<button class="photo-open" type="button" data-open-photo="${esc(p.id)}" aria-label="Open ${esc(p.title)}" style="position:relative;right:auto;bottom:auto;opacity:1;transform:none;margin-left:10px;display:inline-flex;vertical-align:middle">View</button></figcaption></figure>`:"";
}
if(block.type==="quote")return `<blockquote>${esc(block.text)}</blockquote>`;
if(block.type==="heading")return `<h2>${esc(block.text)}</h2>`;
return `<p>${esc(block.text||"")}</p>`;
}
function bindStoryFilters(){
  const scope = $(".stories-section") || document;
  const cards = [...scope.querySelectorAll("[data-story-card]")];
  const count = $("#storyCount");
  const empty = $("#storyEmpty");
  const normalize = value => String(value || "").trim().toLowerCase();
  const reset = $(".story-reset");
  const apply = (category, syncUrl=true) => {
    const active = normalize(category || "All");
    let visible = 0;
    cards.forEach(card => {
      const show = active === "all" || normalize(card.dataset.category) === active;
      card.hidden = !show;
      if(show) visible += 1;
    });
    if(count) count.textContent = `${visible} of ${cards.length} stories`;
    if(empty) empty.hidden = visible !== 0;
    if(reset) reset.disabled = active === "all";
    document.querySelectorAll("[data-story-filter]").forEach(btn => {
      const selected = normalize(btn.dataset.storyFilter) === active;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    if(syncUrl) setUrlParam("category", category || "All");
  };
  document.querySelectorAll("[data-story-filter]").forEach(btn => btn.addEventListener("click", () => apply(btn.dataset.storyFilter)));
  bindFilterKeyboard(scope.querySelector(".filters"));
  reset?.addEventListener("click", () => {
    apply("All");
    $("[data-story-filter]")?.focus();
  });
  const initialCategory = query().get("category") || "All";
  const hasInitialCategory = [...document.querySelectorAll("[data-story-filter]")].some(btn => normalize(btn.dataset.storyFilter) === normalize(initialCategory));
  apply(hasInitialCategory ? initialCategory : "All", !hasInitialCategory);
}
function relatedPanel(data, story){
  const storyTags = new Set((story.tags || []).map(x => x.toLowerCase()));
  const relatedStories = (data.stories || []).filter(item => item.slug !== story.slug).map(item => {
    const score = (item.tags || []).filter(tag => storyTags.has(String(tag).toLowerCase())).length + (storyCategory(item) === storyCategory(story) ? 2 : 0);
    return {item, score};
  }).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).slice(0,2).map(x => x.item);
  const usedPhotos = new Set([story.heroPhotoId, ...(story.body || []).filter(block => block.type === "image").map(block => block.photoId)]);
  const relatedPhotos = sortPhotos(photos(data)).map(item => {
    const score = (item.tags || []).filter(tag => storyTags.has(String(tag).toLowerCase())).length + (item.theme && story.theme && story.theme.includes(item.theme) ? 2 : 0);
    return {item, score};
  }).filter(x => x.score > 0 && !usedPhotos.has(x.item.id)).sort((a,b)=>b.score-a.score).slice(0,3).map(x => x.item);
  if(!relatedStories.length && !relatedPhotos.length) return "";
  return `<section class="section related-section"><div class="container related-container"><div class="section-head"><div><p class="eyebrow">Continue exploring</p><h2>Related notes and photographs</h2></div></div>${relatedStories.length?`<div class="related-stories">${relatedStories.map(s=>storyCard(data,s)).join("")}</div>`:""}${relatedPhotos.length?`<div class="gallery-grid selected-grid related-photos">${relatedPhotos.map((p,i)=>photoFigure(p,{priority:i===0,sizes:"(max-width: 560px) calc(100vw - 24px), 280px"})).join("")}</div>`:""}</div></section>`;
}
function bindGalleryControls(data, list){
  const count = $("#galleryCount");
  const empty = $("#galleryEmpty");
  const reset = $(".filter-reset");
  const cards = [...document.querySelectorAll(".photo-card")];
  const normalize = value => String(value || "").trim().toLowerCase();
  let activeFilter = "All";
  const visiblePhotos = () => cards.filter(card => !card.hidden).map(card => photos(data).find(item => item.id === card.dataset.photoId)).filter(Boolean);
  const update = (active, syncUrl=true) => {
    activeFilter = active || "All";
    const filter = normalize(active);
    let visible = 0;
    cards.forEach(card => {
      const show = filter === "all" || normalize(card.dataset.category) === filter;
      card.hidden = !show;
      if(show) visible += 1;
    });
    if(count) count.textContent = `${visible} of ${list.length} photographs`;
    if(empty) empty.hidden = visible !== 0;
    if(reset) reset.disabled = filter === "all";
    document.querySelectorAll(".filter").forEach(btn => {
      const selected = normalize(btn.dataset.filter) === filter;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    if(syncUrl) setUrlParam("filter", activeFilter);
  };
  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    update(btn.dataset.filter || "All");
  }));
  bindFilterKeyboard(document.querySelector(".gallery-toolbar .filters"));
  reset?.addEventListener("click", () => {
    const first = $(".filter");
    update("All");
    first?.focus();
  });
  bindLightbox(data, visiblePhotos);
  const initialFilter = query().get("filter") || "All";
  const hasInitialFilter = [...document.querySelectorAll(".filter")].some(btn => normalize(btn.dataset.filter) === normalize(initialFilter));
  update(hasInitialFilter ? initialFilter : "All", !hasInitialFilter);
}
function bindLightbox(data, getVisiblePhotos){
  const rootEl = $("#lightboxRoot");
  if(!rootEl) return;
  rootEl.innerHTML = `<div class="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightboxTitle" hidden><button class="lightbox-close" type="button" aria-label="Close photo">×</button><button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous photo">‹</button><button class="lightbox-nav lightbox-next" type="button" aria-label="Next photo">›</button><div class="lightbox-media"></div><div class="lightbox-copy"><p class="eyebrow lightbox-meta"></p><h2 id="lightboxTitle"></h2><p class="muted lightbox-caption"></p><p class="lightbox-position" aria-live="polite"></p><div class="share-actions lightbox-actions"><button class="share-action" type="button" data-lightbox-share>Share</button><button class="share-action" type="button" data-lightbox-copy data-default-label="Copy link">Copy link</button></div><p class="share-status" aria-live="polite"></p></div></div>`;
  const box = $(".lightbox", rootEl);
  const media = $(".lightbox-media", rootEl);
  const title = $("#lightboxTitle", rootEl);
  const meta = $(".lightbox-meta", rootEl);
  const caption = $(".lightbox-caption", rootEl);
  const status = $(".share-status", rootEl);
  const share = $("[data-lightbox-share]", rootEl);
  const copy = $("[data-lightbox-copy]", rootEl);
  const close = $(".lightbox-close", rootEl);
  const prev = $(".lightbox-prev", rootEl);
  const next = $(".lightbox-next", rootEl);
  const position = $(".lightbox-position", rootEl);
  const focusableSelector = "a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex='-1'])";
  let current = null;
  let lastFocus = null;
  let hiddenBackground = [];
  const setBackgroundInert = hidden => {
    if(hidden){
      const siblings = rootEl.parentElement ? [...rootEl.parentElement.children].filter(node => node !== rootEl) : [];
      hiddenBackground = [$(".site-header"), $("#footer"), ...siblings].filter(Boolean);
      hiddenBackground.forEach(node => {
        if(!node.dataset.lightboxAriaHidden) node.dataset.lightboxAriaHidden = node.getAttribute("aria-hidden") || "";
        node.setAttribute("aria-hidden", "true");
        if("inert" in node) node.inert = true;
      });
      return;
    }
    hiddenBackground.forEach(node => {
      const previous = node.dataset.lightboxAriaHidden;
      if(previous) node.setAttribute("aria-hidden", previous);
      else node.removeAttribute("aria-hidden");
      delete node.dataset.lightboxAriaHidden;
      if("inert" in node) node.inert = false;
    });
    hiddenBackground = [];
  };
  const urlFor = p => {
    const url = new URL(location.href);
    url.searchParams.set("photo", p.id);
    return url.href;
  };
  const setStatus = msg => { if(status) status.textContent = msg; };
  const currentList = () => {
    const visible = getVisiblePhotos?.() || [];
    if(!current) return visible.length ? visible : photos(data);
    return visible.some(item => item.id === current.id) ? visible : photos(data);
  };
  const open = (p, mode="push") => {
    current = p;
    lastFocus = document.activeElement;
    media.innerHTML = responsiveImage(p,{className:"lightbox-img is-loading",priority:true,sizes:"1200px",fallbackSize:"full"});
    const fullImg = media.querySelector(".lightbox-img");
    if(fullImg){
      const thumbUrl = variant(p,"thumb","avif") || variant(p,"thumb","webp") || variant(p,"thumb","jpeg") || imgPath(p);
      if(thumbUrl) fullImg.style.backgroundImage = `url("${thumbUrl}")`;
      const reveal = () => { fullImg.classList.remove("is-loading"); fullImg.style.backgroundImage = ""; };
      if(fullImg.complete && fullImg.naturalWidth) reveal();
      else fullImg.addEventListener("load", reveal, {once:true});
    }
    title.textContent = p.title || "";
    meta.textContent = metaText([p.location,p.date,p.theme]);
    caption.textContent = p.caption || "";
    const visible = currentList();
    const currentIndex = visible.findIndex(item => item.id === p.id);
    if(position) position.textContent = currentIndex >= 0 ? `${currentIndex + 1} of ${visible.length}` : "";
    setStatus("");
    setBackgroundInert(true);
    box.hidden = false;
    document.body.classList.add("has-lightbox");
    setUrlParam("photo", p.id, mode);
    close.focus();
  };
  const hide = () => {
    box.hidden = true;
    current = null;
    document.body.classList.remove("has-lightbox");
    setBackgroundInert(false);
    setUrlParam("photo", null);
    lastFocus?.focus?.();
  };
  const step = direction => {
    if(!current) return;
    const visible = currentList();
    const index = visible.findIndex(item => item.id === current.id);
    if(index < 0 || !visible.length) return;
    const nextIndex = (index + direction + visible.length) % visible.length;
    open(visible[nextIndex], "replace");
  };
  document.querySelectorAll("[data-open-photo]").forEach(btn => btn.addEventListener("click", () => {
    const p = photos(data).find(item => item.id === btn.dataset.openPhoto);
    if(p) open(p);
  }));
  close.addEventListener("click", hide);
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  box.addEventListener("click", e => { if(e.target === box) hide(); });
  document.addEventListener("keydown", e => {
    if(box.hidden) return;
    if(e.key === "Escape") hide();
    if(e.key === "ArrowLeft") step(-1);
    if(e.key === "ArrowRight") step(1);
    if(e.key !== "Tab") return;
    const items = [...box.querySelectorAll(focusableSelector)].filter(el => el.offsetParent !== null);
    if(!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    }else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    }
  });
  let touchStartX = 0;
  let touchStartY = 0;
  box.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0]?.clientX || 0;
    touchStartY = e.changedTouches[0]?.clientY || 0;
  }, {passive:true});
  box.addEventListener("touchend", e => {
    const touch = e.changedTouches[0];
    if(!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if(Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  }, {passive:true});
  share.addEventListener("click", async () => {
    if(!current) return;
    const url = urlFor(current);
    if(navigator.share){
      try{ await navigator.share({title:current.title, text:current.caption || current.title, url}); setStatus("Shared."); }
      catch(e){ if(e.name !== "AbortError") setStatus("Sharing was not available."); }
    }else{
      await copyText(url) ? setStatus("Link copied.") : setStatus("Copy failed.");
    }
  });
  copy.addEventListener("click", async () => {
    if(!current) return;
    if(await copyText(urlFor(current))){
      setStatus("Link copied.");
      copy.textContent = "Copied";
      setTimeout(() => { copy.textContent = copy.dataset.defaultLabel || "Copy link"; }, 1800);
    }else{
      setStatus("Copy failed.");
    }
  });
  const initialPhoto = new URLSearchParams(location.search).get("photo");
  const p = photos(data).find(item => item.id === initialPhoto);
  if(p) open(p, "replace");
  window.addEventListener("popstate", () => {
    if(box.hidden) return;
    const photoParam = new URLSearchParams(location.search).get("photo");
    if(!photoParam) {
      box.hidden = true;
      current = null;
      document.body.classList.remove("has-lightbox");
      setBackgroundInert(false);
      lastFocus?.focus?.();
    }
  });
}
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch(e){
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly","");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
function bindShareControls(){
  const status = $(".share-status");
  const setStatus = msg => { if(status) status.textContent = msg; };
  document.querySelectorAll("[data-native-share]").forEach(btn => {
    if(!navigator.share) btn.hidden = true;
    btn.addEventListener("click", async () => {
      try{
        await navigator.share({title:btn.dataset.shareTitle, text:btn.dataset.shareText, url:btn.dataset.shareUrl});
        setStatus("Shared.");
      }catch(e){
        if(e.name !== "AbortError") setStatus("Sharing was not available.");
      }
    });
  });
  document.querySelectorAll("[data-copy-link]").forEach(btn => btn.addEventListener("click", async () => {
    if(await copyText(btn.dataset.shareUrl)){
      setStatus("Link copied.");
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = btn.dataset.defaultLabel || "Copy link"; }, 1800);
    }else{
      setStatus(`Copy failed. Link: ${btn.dataset.shareUrl}`);
    }
  }));
}
boot();
