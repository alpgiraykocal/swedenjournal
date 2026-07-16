import {
  setContext, esc, photos, photo, imgPath, metaText, variant, srcset, responsiveImage,
  sortPhotos, storyPhotos, storyHref, photoHref, absoluteUrl, root, header, footer,
  homeMain, galleryMain, storiesMain, aboutMain, atlasMain, storyMain, legacyStoryMain, photoMain, photoTitleCore,
  collections, collectionPhotos, collectionsMain, collectionMain, collectionHref, photoExifChips,
  photoStory, photoCollection,
  websiteLdObject, imageGalleryLdObject, personLdObject, articleLdObject, photoLdObject, collectionsLdObject, collectionLdObject, fullVariantDims,
} from "./templates.mjs?v=81fe67c714";

// Cache-bust the runtime content fetches. /assets/data/*.json is served with a long
// edge cache (the host ignores _headers), so without a content-versioned URL a freshly
// published edit (e.g. a new gallery photo) stays invisible until the CDN cache expires.
// build.mjs injects window.__DATA_VERSION__ (a hash of the JSON) into the short-cached
// HTML, so each content change yields a new fetch URL that bypasses the stale cache.
const DATA_VERSION = window.__DATA_VERSION__ ? ("?v=" + window.__DATA_VERSION__) : "";
const DATA_PATH = (window.__DATA_PATH__ || "assets/data/site-content.json") + DATA_VERSION;
// Signal that the runtime module loaded & executed. The inline <head> failsafe
// removes `.js-reveal` if this is still false after a timeout, so a module that
// fails to load can never leave the pre-rendered content hidden at opacity:0.
window.__siteBooted = true;

function inlineData(){
  const el = document.getElementById("hydration-data");
  if(!el) return null;
  try{ return JSON.parse(el.textContent); }catch(e){ return null; }
}
async function loadContent(){
  const inline = inlineData();
  if(inline) return inline;
  const res = await fetch(DATA_PATH);
  if(!res.ok) throw new Error("Could not load assets/data/site-content.json");
  return res.json();
}
async function loadGalleryData(){
  const src = (window.__ASSET_PREFIX__ || "") + "assets/data/gallery.json" + DATA_VERSION;
  const res = await fetch(src);
  if(!res.ok) throw new Error("Could not load gallery data");
  return res.json();
}
function $(s, r=document){ return r.querySelector(s); }
function currentPage(){ return document.body.dataset.page || "home"; }
const query = () => new URLSearchParams(location.search);
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
    const imageUrl = absoluteUrl(data, (variant(imagePhoto, "full", "jpeg") || imgPath(imagePhoto)).replace(/^(?:\.\.\/)+/,""));
    ogImage.setAttribute("content", imageUrl);
    twitterImage.setAttribute("content", imageUrl);
    // Width/height/alt let scrapers reserve the correct card aspect ratio before
    // fetching the image — mirrors what the build writes into the static head.
    const dims = fullVariantDims(imagePhoto);
    if(dims){
      ensureMeta('meta[property="og:image:width"]', "meta", {property:"og:image:width"}).setAttribute("content", String(dims.width));
      ensureMeta('meta[property="og:image:height"]', "meta", {property:"og:image:height"}).setAttribute("content", String(dims.height));
    }
    if(imagePhoto.alt){
      ensureMeta('meta[property="og:image:alt"]', "meta", {property:"og:image:alt"}).setAttribute("content", imagePhoto.alt);
      ensureMeta('meta[name="twitter:image:alt"]', "meta", {name:"twitter:image:alt"}).setAttribute("content", imagePhoto.alt);
    }
  }
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
function injectJsonLd(obj){
  const s=document.createElement("script");
  s.type="application/ld+json";
  s.textContent=JSON.stringify(obj);
  document.head.appendChild(s);
}
function jsonLdArticle(data,story,heroPhoto){ injectJsonLd(articleLdObject(data,story,heroPhoto)); }
function jsonLdWebSite(data){ const o=websiteLdObject(data); if(o) injectJsonLd(o); }
function jsonLdImageGallery(data, list){ injectJsonLd(imageGalleryLdObject(data, list)); }
function jsonLdPerson(data){ injectJsonLd(personLdObject(data)); }
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
function currentPhotoId(){
  const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const last = parts.at(-1);
  const slug = last === "index.html" ? parts.at(-2) : last;
  return slug && slug !== "photos" ? decodeURIComponent(slug) : null;
}
function currentCollectionSlug(){
  const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const last = parts.at(-1);
  const slug = last === "index.html" ? parts.at(-2) : last;
  return slug && slug !== "series" ? decodeURIComponent(slug) : null;
}
// The lightbox links a photo back to its story / series. gallery.json ships those
// pre-enriched (render-site), but the story and series pages load raw site-content —
// so attach them here, skipping a link that points at the page you are already on.
function withContext(data, list, { currentStory = null, currentSeries = null } = {}){
  return list.map(p => {
    const st = photoStory(data, p.id);
    const cl = photoCollection(data, p.id);
    const story = st && st.slug !== currentStory ? { slug: st.slug, title: st.title } : null;
    const series = cl && cl.slug !== currentSeries ? { slug: cl.slug, title: cl.title } : null;
    if(!story && !series) return p;
    const out = { ...p };
    if(story) out.story = story;
    if(series) out.series = series;
    return out;
  });
}
async function hydrate(page){
  // Content is already pre-rendered into the HTML; only bind interactivity.
  if(page === "gallery"){
    const data = inlineData() || await loadGalleryData();
    bindGalleryControls(data, sortPhotos(photos(data)));
  }else if(page === "story"){
    if(isLegacyStoryShell()) return;
    const data = await loadContent();
    const slug = currentStorySlug() || data.stories?.[0]?.slug;
    const s = (data.stories||[]).find(x => x.slug === slug) || data.stories?.[0];
    if(!s) return;
    bindShareControls();
    bindLightbox(data, () => withContext(data, storyPhotos(data, s), { currentStory: s.slug }));
  }else if(page === "stories"){
    bindStoryFilters();
  }else if(page === "atlas"){
    initMap("atlasMap", "atlas-map-data");
  }else if(page === "photo"){
    bindShareControls();
  }else if(page === "collection"){
    const data = await loadContent();
    const col = (data.collections||[]).find(c => c.slug === currentCollectionSlug());
    if(col) bindLightbox(data, () => withContext(data, collectionPhotos(data, col), { currentSeries: col.slug }));
  }
}
function loadLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(window.__leafletPromise) return window.__leafletPromise;
  const base = window.__ASSET_PREFIX__ || "";
  window.__leafletPromise = new Promise((resolve, reject) => {
    if(!document.querySelector('link[data-leaflet]')){
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = base + "assets/vendor/leaflet.css"; css.setAttribute("data-leaflet","");
      document.head.appendChild(css);
    }
    const js = document.createElement("script");
    js.src = base + "assets/vendor/leaflet.js"; js.async = true;
    js.onload = () => resolve(window.L);
    js.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(js);
  });
  return window.__leafletPromise;
}
function placePopupHtml(s){
  const meta = metaText([s.location, s.date]);
  const cta = s.kind === "photo" ? "View photograph" : "Read story";
  return `<a class="map-popup" href="${esc(s.href)}">`
    + (s.thumb ? `<img src="${esc(s.thumb)}" alt="" loading="lazy">` : "")
    + `<span class="map-popup-body"><strong>${esc(s.title)}</strong>`
    + (meta ? `<span class="map-popup-meta">${esc(meta)}</span>` : "")
    + (s.summary ? `<span class="map-popup-snippet">${esc(s.summary)}</span>` : "")
    + `<span class="map-popup-cta">${cta} &rarr;</span></span></a>`;
}
function initMap(elId, dataId){
  const el = document.getElementById(elId);
  const dataEl = document.getElementById(dataId);
  if(!el || !dataEl) return;
  let stories;
  try{ stories = JSON.parse(dataEl.textContent); }catch(e){ return; }
  if(!Array.isArray(stories) || !stories.length) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const themeDark = () => (document.documentElement.getAttribute("data-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  const cards = Array.from(document.querySelectorAll(".atlas-place[data-place-slug]"));
  const start = () => loadLeaflet().then(L => {
    if(el._mapReady) return;
    el._mapReady = true;
    const map = L.map(el, { scrollWheelZoom:false, attributionControl:true });
    const tileUrl = d => `https://{s}.basemaps.cartocdn.com/${d?"dark_all":"light_all"}/{z}/{x}/{y}{r}.png`;
    const tiles = L.tileLayer(tileUrl(themeDark()), {
      maxZoom:19, subdomains:"abcd",
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    // Match the basemap to the active theme, and swap it live when the user toggles.
    window.addEventListener("themechange", () => tiles.setUrl(tileUrl(themeDark())));
    const bySlug = new Map();
    const markers = stories.map(s => {
      // Photograph pins (kind:"photo") render smaller and sit under story pins, so the
      // essays stay the map's visual anchors even where shots cluster around them.
      const isPhoto = s.kind === "photo";
      const size = isPhoto ? 34 : 52;
      const icon = L.divIcon({ className:`map-pin${isPhoto ? " map-pin--photo" : ""}`, html:`<img src="${esc(s.thumb)}" alt="${esc(s.alt||s.title)}">`, iconSize:[size,size], iconAnchor:[size/2,size/2] });
      const m = L.marker([s.lat, s.lng], { icon, title:s.title, alt:s.title, riseOnHover:true, keyboard:true, zIndexOffset:isPhoto ? 0 : 200 }).addTo(map);
      m._slug = s.slug;
      m._baseZ = isPhoto ? 0 : 200;
      m.bindTooltip(s.title, { direction:"top", offset:[0,-(size/2 + 2)] });
      m.bindPopup(placePopupHtml(s), { className:"map-popup-wrap", minWidth:230, maxWidth:260, autoPanPadding:[28,28] });
      if(s.slug) bySlug.set(s.slug, m);
      return m;
    });
    const fitAll = () => {
      if(markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25), { animate:!reduce });
      else map.setView([stories[0].lat, stories[0].lng], 9, { animate:false });
    };
    // Deep-link focus: /atlas/?place=<slug> (from a story's "View on the map").
    let focused = null;
    try{ focused = new URLSearchParams(location.search).get("place"); }catch(e){}
    const focusTarget = focused && bySlug.has(focused) ? bySlug.get(focused) : null;
    const applyView = () => {
      if(focusTarget) map.setView(focusTarget.getLatLng(), 8, { animate:!reduce });
      else fitAll();
    };
    // A lazily-initialised map inside a flex / limited-height column can start with a
    // stale container size, so Leaflet's pixel origin is wrong and the markers get
    // positioned outside the clipped map pane — they silently "disappear". Recompute
    // the size before fitting, and again after layout settles, so pins always show.
    map.invalidateSize(false);
    applyView();
    if(focusTarget){ if(reduce) focusTarget.openPopup(); else setTimeout(() => focusTarget.openPopup(), 380); }
    const settle = () => { map.invalidateSize(false); applyView(); };
    requestAnimationFrame(settle);
    setTimeout(settle, 400);
    window.addEventListener("resize", () => map.invalidateSize(false));
    // Recenter control — refit every marker into view.
    const Recenter = L.Control.extend({ options:{ position:"topleft" }, onAdd:function(){
      const b = L.DomUtil.create("button", "map-recenter");
      b.type = "button"; b.title = "Show all places"; b.setAttribute("aria-label", "Show all places"); b.innerHTML = "&#9974;";
      L.DomEvent.on(b, "click", L.DomEvent.stop).on(b, "click", fitAll);
      return b;
    }});
    map.addControl(new Recenter());
    // Scroll-wheel zoom stays off so the map never hijacks page scrolling. Enable it
    // only once the user deliberately clicks (or keyboard-focuses) the map, and turn it
    // back off when the pointer leaves. A small hint makes the affordance discoverable.
    const hint = L.DomUtil.create("div", "map-hint", el);
    hint.textContent = "Click the map to zoom";
    hint.setAttribute("aria-hidden", "true");
    const enableWheel = () => { map.scrollWheelZoom.enable(); el.classList.add("map-zoom-on"); };
    const disableWheel = () => { map.scrollWheelZoom.disable(); el.classList.remove("map-zoom-on"); };
    map.on("click", enableWheel);
    el.addEventListener("focusin", enableWheel);
    el.addEventListener("mouseleave", disableWheel);
    el.addEventListener("focusout", e => { if(!el.contains(e.relatedTarget)) disableWheel(); });
    // Two-way highlight between the place list and the map pins.
    const setActive = (slug) => {
      cards.forEach(c => c.classList.toggle("is-active", !!slug && c.dataset.placeSlug === slug));
      markers.forEach(m => {
        const ic = m.getElement && m.getElement(), on = !!slug && m._slug === slug;
        if(ic) ic.classList.toggle("map-pin--active", on);
        if(m.setZIndexOffset) m.setZIndexOffset(on ? 1000 : (m._baseZ || 0)); // lift the active pin; restore the story-over-photo stacking after
      });
    };
    cards.forEach(card => {
      const slug = card.dataset.placeSlug, m = bySlug.get(slug);
      card.addEventListener("mouseenter", () => setActive(slug));
      card.addEventListener("mouseleave", () => setActive(null));
      card.addEventListener("focus", () => { setActive(slug); if(m) map.panTo(m.getLatLng(), { animate:!reduce }); });
      card.addEventListener("blur", () => setActive(null));
    });
    markers.forEach(m => {
      m.on("mouseover", () => setActive(m._slug));
      m.on("mouseout", () => setActive(null));
      m.on("popupopen", () => {
        setActive(m._slug);
        const card = cards.find(c => c.dataset.placeSlug === m._slug);
        if(card && card.scrollIntoView) card.scrollIntoView({ block:"nearest", behavior: reduce ? "auto" : "smooth" });
      });
      m.on("popupclose", () => setActive(null));
    });
  }).catch(() => {});
  if("IntersectionObserver" in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting){ start(); io.disconnect(); } });
    }, { rootMargin:"200px" });
    io.observe(el);
  }else{ start(); }
}
function initThemeToggle(){
  const root = document.documentElement;
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const effective = () => root.getAttribute("data-theme") || (mq && mq.matches ? "dark" : "light");
  const buttons = [...document.querySelectorAll("[data-theme-toggle]")];
  if(!buttons.length) return;
  const sync = () => {
    const dark = effective() === "dark";
    buttons.forEach(btn => {
      btn.dataset.mode = dark ? "dark" : "light";
      btn.setAttribute("aria-pressed", String(dark));
      btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    });
    window.dispatchEvent(new Event("themechange"));
  };
  buttons.forEach(btn => btn.addEventListener("click", () => {
    const next = effective() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try{ localStorage.setItem("theme", next); }catch(e){}
    sync();
  }));
  // If the user hasn't made an explicit choice, follow OS changes live.
  if(mq) mq.addEventListener("change", () => { let saved; try{ saved = localStorage.getItem("theme"); }catch(e){} if(!saved) sync(); });
  sync();
}
async function boot(){
  try{
    const page = document.body.dataset.page;
    setContext({root: window.__ROOT__ || "", prefix: window.__ASSET_PREFIX__ || "", page});
    initThemeToggle();
    if(document.body.dataset.prerendered === "1"){
      await hydrate(page);
      bindScrollReveal();
      bindImageLoadFade();
      initGalleryMasonry();
      return;
    }
    const data = await loadContent();
    document.title = data.site.siteTitle || data.site.ownerName || "Photo Blog";
    const app = $("#app");
    app.insertAdjacentHTML("beforebegin", header(data));
    $("#footer").innerHTML = footer(data);
    const preloadMap = {
      home: photo(data, data.home?.heroPhotoId),
      gallery: sortPhotos(photos(data))[0],
      stories: storyPhotos(data, [...(data.stories || [])].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)))[0] || {})[0],
      about: photo(data, data.about?.portraitPhotoId),
      atlas: null,
      story: photo(data, ((data.stories || []).find(x => x.slug===currentStorySlug()) || data.stories?.[0])?.heroPhotoId),
      photo: photos(data).find(x => x.id === currentPhotoId()) || null,
      series: collectionPhotos(data, collections(data)[0] || {})[0] || null,
      collection: collectionPhotos(data, (data.collections||[]).find(c => c.slug===currentCollectionSlug()) || {})[0] || null
    };
    injectPreload(preloadMap[page], "(max-width: 850px) calc(100vw - 28px), 1180px", "medium");
    if(page === "home") renderHome(data);
    if(page === "gallery") renderGallery(data);
    if(page === "stories") renderStories(data);
    if(page === "about") renderAbout(data);
    if(page === "atlas") renderAtlas(data);
    if(page === "story") renderStory(data);
    if(page === "photo") renderPhoto(data);
    if(page === "series") renderCollections(data);
    if(page === "collection") renderCollection(data);
    bindScrollReveal();
    bindImageLoadFade();
    initGalleryMasonry();
  }catch(e){
    $("#app").innerHTML = `<main class="container section"><h1 class="headline">Content could not be loaded.</h1><p class="intro">${esc(e.message)}</p></main>`;
  }
}
function renderHome(data){
  const hp = photo(data, data.home?.heroPhotoId);
  updateMeta(data, {title:data.site?.siteTitle, description:data.site?.description, path:"", imagePhoto:hp});
  jsonLdWebSite(data);
  $("#app").innerHTML = homeMain(data);
}
function renderGallery(data){
  const g = data.gallery || {};
  const list = sortPhotos(photos(data));
  updateMeta(data, {title:"Gallery", description:g.intro || data.site?.description, path:"gallery/", imagePhoto:list[0]});
  jsonLdImageGallery(data, list);
  $("#app").innerHTML = galleryMain(data);
  bindGalleryControls(data, list);
}
function renderStories(data){
  const sp = data.storiesPage || {};
  const stories = [...(data.stories||[])].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const featured = stories.find(s => s.featured) || stories[0];
  updateMeta(data, {title:"Stories", description:sp.intro || data.site?.description, path:"stories/", imagePhoto:featured ? storyPhotos(data, featured)[0] : null});
  $("#app").innerHTML = storiesMain(data);
  bindStoryFilters();
}
function renderAbout(data){
  const a = data.about || {}, p = photo(data,a.portraitPhotoId);
  updateMeta(data, {title:"About", description:(a.paragraphs||[])[0] || data.site?.description, path:"about/", imagePhoto:p});
  jsonLdPerson(data);
  $("#app").innerHTML = aboutMain(data);
}
function renderAtlas(data){
  const ap = data.atlasPage || {};
  const firstPlaced = (data.stories||[]).find(s => s.coordinates && Number.isFinite(Number(s.coordinates.lat)));
  const hp = firstPlaced ? photo(data, firstPlaced.heroPhotoId) : null;
  updateMeta(data, {title: ap.headline || "Atlas", description: ap.intro || data.site?.description, path:"atlas/", imagePhoto:hp});
  $("#app").innerHTML = atlasMain(data);
  initMap("atlasMap", "atlas-map-data");
}
function renderCollections(data){
  const cp = data.collectionsPage || {};
  const list = collections(data).filter(c => c.slug && c.title);
  const cover = list[0] ? photos(data).find(p => p.id === list[0].photoIds?.[0]) : null;
  updateMeta(data, {title: cp.headline || "Series", description: cp.intro || data.site?.description, path:"series/", imagePhoto: cover});
  injectJsonLd(collectionsLdObject(data));
  $("#app").innerHTML = collectionsMain(data);
}
function renderCollection(data){
  const col = (data.collections||[]).find(c => c.slug === currentCollectionSlug());
  if(!col){
    updateMeta(data, {title:"Series not found", description:"The requested series is not available.", path:"series/", robots:"noindex,follow"});
    $("#app").innerHTML = `<main class="container section"><p class="eyebrow">Series not found</p><h1 class="headline">This series is not available.</h1><p class="intro">The link may be outdated or the series may have been removed.</p><p><a class="text-link" href="${root()}series/index.html">Back to series</a></p></main>`;
    return;
  }
  const cover = collectionPhotos(data, col)[0];
  updateMeta(data, {title: col.title, description: col.description || data.site?.description, path:`series/${encodeURIComponent(col.slug)}/`, imagePhoto: cover});
  injectJsonLd(collectionLdObject(data, col));
  $("#app").innerHTML = collectionMain(data, col);
  bindLightbox(data, () => withContext(data, collectionPhotos(data, col), { currentSeries: col.slug }));
}
function renderPhoto(data){
  const p = photos(data).find(x => x.id === currentPhotoId());
  if(!p){
    updateMeta(data, {title:"Photograph not found", description:"The requested photograph is not available.", path:"gallery/", robots:"noindex,follow"});
    $("#app").innerHTML = `<main class="container section"><p class="eyebrow">Photograph not found</p><h1 class="headline">This photograph is not available.</h1><p class="intro">The link may be outdated or the photograph may have been removed.</p><p><a class="text-link" href="${root()}gallery/index.html">Return to the gallery</a></p></main>`;
    return;
  }
  updateMeta(data, {title:photoTitleCore(p), description:p.caption || p.alt || data.site?.description, path:`photos/${encodeURIComponent(p.id)}/`, imagePhoto:p});
  injectJsonLd(photoLdObject(data, p));
  $("#app").innerHTML = photoMain(data, p);
  bindShareControls();
}
function renderStory(data){
  if(isLegacyStoryShell()){
    const featured = data.stories?.find(s => s.featured) || data.stories?.[0];
    updateMeta(data, {title:"Stories", description:data.storiesPage?.intro || data.site?.description, path:"stories/", imagePhoto:featured ? storyPhotos(data, featured)[0] : null, robots:"noindex,follow"});
    $("#app").innerHTML = legacyStoryMain(data);
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
  $("#app").innerHTML = storyMain(data, s);
  bindShareControls();
  bindLightbox(data, () => withContext(data, storyPhotos(data, s), { currentStory: s.slug }));
}
function bindScrollReveal(){const els=[...document.querySelectorAll(".photo-card,.story-card,.related-photos .photo-card,.story-inline-photo,.story-body > p,.story-body > h2,.story-body > blockquote")];if(typeof IntersectionObserver==="undefined"){els.forEach(el=>el.classList.add("revealed"));return;}const io=new IntersectionObserver((entries)=>{let i=0;entries.forEach(e=>{if(!e.isIntersecting)return;const el=e.target;const delay=Math.min(i,6)*55;i++;if(delay){el.style.transitionDelay=delay+"ms";setTimeout(()=>{el.style.transitionDelay="";},delay+650);}el.classList.add("revealed");io.unobserve(el);});},{threshold:0.08,rootMargin:"0px 0px -40px 0px"});els.forEach(el=>{if(!el.classList.contains("revealed"))io.observe(el);});}
function bindImageLoadFade(){const sel=".photo-media img,.story-card-media img,.featured-story-media img,.story-inline-img,.hero-img,.about-img,.story-hero img";document.querySelectorAll(sel).forEach(img=>{if(img.complete&&img.naturalWidth){img.classList.add("img-loaded");return;}img.classList.add("img-loading");const done=()=>{img.classList.remove("img-loading");img.classList.add("img-loaded");};img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true});});}
// Photo masonry via CSS Grid row-span. Each card is given a --masonry-span so
// it occupies ceil((height + gap) / rowUnit) fine grid rows; with align-items:start
// the columns then stack independently (true masonry) without CSS multi-column,
// which paints unreliably (blank tiles) in Chromium. Native lazy-loading and hover
// filters work normally on a plain grid. Any grid marked [data-masonry] opts in
// (gallery + series pages); no-op when none is present and on the single-column
// mobile layout (grid-auto-rows:auto → rowUnit 0).
function layoutGalleryMasonry(){
  document.querySelectorAll("[data-masonry]").forEach(grid => {
    const cs = getComputedStyle(grid);
    const rowUnit = parseFloat(cs.gridAutoRows) || 0;
    const gap = parseFloat(cs.columnGap) || 0;
    const cards = grid.querySelectorAll(".photo-card");
    if(rowUnit <= 0){ cards.forEach(c => c.style.removeProperty("--masonry-span")); return; }
    cards.forEach(card => {
      if(card.hidden) return;
      const span = Math.max(1, Math.ceil((card.getBoundingClientRect().height + gap) / rowUnit));
      card.style.setProperty("--masonry-span", span);
    });
  });
}
function initGalleryMasonry(){
  if(!document.querySelector("[data-masonry]")) return;
  layoutGalleryMasonry();
  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layoutGalleryMasonry); };
  window.addEventListener("resize", relayout);
  // aspect-ratio reserves height up front, but a late image decode or font/caption
  // reflow can change it — recompute as each not-yet-loaded image settles.
  document.querySelectorAll("[data-masonry] .photo-card img").forEach(img => {
    if(!(img.complete && img.naturalWidth)) img.addEventListener("load", relayout, {once:true});
  });
}
// Public search: word-AND match against a card's visible text plus its data attributes
// (tags/category live there, not in the text). Empty query matches everything.
function cardMatchesQuery(card, queryText){
  if(!queryText) return true;
  const hay = (card.textContent + " " + (card.dataset.tags || "") + " " + (card.dataset.category || "")).toLowerCase();
  return queryText.split(/\s+/).filter(Boolean).every(word => hay.includes(word));
}
function bindSearchInput(input, onQuery){
  if(!input) return;
  let t = 0;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => onQuery(input.value), 120);
  });
  // The native clear (x) fires "search" without a trailing input event in some engines.
  input.addEventListener("search", () => onQuery(input.value));
}
function bindStoryFilters(){
  const scope = $(".stories-section") || document;
  const cards = [...scope.querySelectorAll("[data-story-card]")];
  const count = $("#storyCount");
  const empty = $("#storyEmpty");
  const normalize = value => String(value || "").trim().toLowerCase();
  const reset = $(".story-reset");
  const featuredSection = $(".featured-story-section");
  const searchInput = $("#storySearch");
  let activeCategory = "All";
  let activeQuery = "";
  const apply = (category, syncUrl=true) => {
    activeCategory = category || "All";
    const active = normalize(activeCategory);
    let visible = 0;
    cards.forEach(card => {
      const show = (active === "all" || normalize(card.dataset.category) === active) && cardMatchesQuery(card, activeQuery);
      card.hidden = !show;
      if(show) visible += 1;
    });
    if(count) count.textContent = `${visible} of ${cards.length} stories`;
    if(empty) empty.hidden = visible !== 0;
    if(reset) reset.disabled = active === "all" && !activeQuery;
    // The "Featured story" highlight only makes sense in the browse-all view —
    // hide it when a category or a search query is active so the result is clean.
    if(featuredSection) featuredSection.hidden = active !== "all" || !!activeQuery;
    document.querySelectorAll("[data-story-filter]").forEach(btn => {
      const selected = normalize(btn.dataset.storyFilter) === active;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    if(syncUrl){ setUrlParam("category", activeCategory); setUrlParam("q", activeQuery || null); }
  };
  // Filtering shows/hides the tall featured block ABOVE the toolbar, which would
  // yank the results up (or down) and out of view. Keep the toolbar visually
  // anchored by compensating scroll for the height change it causes.
  const withToolbarAnchor = fn => {
    const tb = $(".story-toolbar");
    const before = tb ? tb.getBoundingClientRect().top : 0;
    fn();
    if(tb) window.scrollBy({ top: tb.getBoundingClientRect().top - before, behavior: "instant" });
  };
  document.querySelectorAll("[data-story-filter]").forEach(btn => btn.addEventListener("click", () => withToolbarAnchor(() => apply(btn.dataset.storyFilter))));
  bindFilterKeyboard(scope.querySelector(".filters"));
  bindSearchInput(searchInput, value => { activeQuery = normalize(value); withToolbarAnchor(() => apply(activeCategory)); });
  reset?.addEventListener("click", () => {
    activeQuery = "";
    if(searchInput) searchInput.value = "";
    withToolbarAnchor(() => apply("All"));
    $("[data-story-filter]")?.focus();
  });
  // Sort toggle: reorder the story cards by their [data-date] (newest default).
  const list = $(".story-list");
  const sortStories = order => {
    if(!list) return;
    const items = [...list.querySelectorAll("[data-story-card]")];
    items.sort((a, b) => {
      const av = a.dataset.date || "", bv = b.dataset.date || "";
      return order === "oldest" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    items.forEach(el => list.appendChild(el));
  };
  const applySort = (order, syncUrl = true) => {
    const o = order === "oldest" ? "oldest" : "newest";
    sortStories(o);
    document.querySelectorAll("[data-story-sort]").forEach(btn => {
      const selected = btn.dataset.storySort === o;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    if(syncUrl) setUrlParam("sort", o === "newest" ? null : o);
  };
  document.querySelectorAll("[data-story-sort]").forEach(btn => btn.addEventListener("click", () => applySort(btn.dataset.storySort)));
  bindFilterKeyboard(scope.querySelector(".story-sort"));
  applySort(query().get("sort") === "oldest" ? "oldest" : "newest", false);
  const initialQuery = query().get("q") || "";
  if(initialQuery && searchInput){ searchInput.value = initialQuery; activeQuery = normalize(initialQuery); }
  const initialCategory = query().get("category") || "All";
  const hasInitialCategory = [...document.querySelectorAll("[data-story-filter]")].some(btn => normalize(btn.dataset.storyFilter) === normalize(initialCategory));
  apply(hasInitialCategory ? initialCategory : "All", !hasInitialCategory);
}
function bindGalleryControls(data, list){
  const count = $("#galleryCount");
  const empty = $("#galleryEmpty");
  const reset = $(".filter-reset");
  const cards = [...document.querySelectorAll(".photo-card")];
  const normalize = value => String(value || "").trim().toLowerCase();
  const searchInput = $("#gallerySearch");
  let activeFilter = "All";
  let activeQuery = "";
  const visiblePhotos = () => cards.filter(card => !card.hidden).map(card => photos(data).find(item => item.id === card.dataset.photoId)).filter(Boolean);
  const update = (active, syncUrl=true) => {
    activeFilter = active || "All";
    const filter = normalize(active);
    let visible = 0;
    cards.forEach(card => {
      const show = (filter === "all" || normalize(card.dataset.category) === filter) && cardMatchesQuery(card, activeQuery);
      card.hidden = !show;
      if(show) visible += 1;
    });
    if(count) count.textContent = filter === "all" && !activeQuery ? `${visible} photographs` : `${visible} of ${list.length} photographs`;
    if(empty) empty.hidden = visible !== 0;
    if(reset) reset.disabled = filter === "all" && !activeQuery;
    document.querySelectorAll(".filter").forEach(btn => {
      const selected = normalize(btn.dataset.filter) === filter;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    if(syncUrl){ setUrlParam("filter", activeFilter); setUrlParam("q", activeQuery || null); }
    layoutGalleryMasonry();
  };
  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    update(btn.dataset.filter || "All");
  }));
  bindFilterKeyboard(document.querySelector(".gallery-toolbar .filters"));
  bindSearchInput(searchInput, value => { activeQuery = normalize(value); update(activeFilter); });
  reset?.addEventListener("click", () => {
    const first = $(".filter");
    activeQuery = "";
    if(searchInput) searchInput.value = "";
    update("All");
    first?.focus();
  });
  bindLightbox(data, visiblePhotos);
  const initialQuery = query().get("q") || "";
  if(initialQuery && searchInput){ searchInput.value = initialQuery; activeQuery = normalize(initialQuery); }
  const initialFilter = query().get("filter") || "All";
  const hasInitialFilter = [...document.querySelectorAll(".filter")].some(btn => normalize(btn.dataset.filter) === normalize(initialFilter));
  update(hasInitialFilter ? initialFilter : "All", !hasInitialFilter);
}
function bindLightbox(data, getVisiblePhotos){
  const rootEl = $("#lightboxRoot");
  if(!rootEl) return;
  rootEl.innerHTML = `<div class="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightboxTitle" hidden><button class="lightbox-close" type="button" aria-label="Close photo">×</button><button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous photo">‹</button><button class="lightbox-nav lightbox-next" type="button" aria-label="Next photo">›</button><div class="lightbox-media"></div><div class="lightbox-copy"><p class="eyebrow lightbox-meta"></p><h2 id="lightboxTitle"></h2><p class="muted lightbox-caption"></p><p class="lightbox-exif photo-page-tags photo-exif" hidden></p><a class="lightbox-story-link" hidden></a><a class="lightbox-series-link" hidden></a><a class="lightbox-page-link" hidden></a><p class="lightbox-position" aria-live="polite"></p><div class="share-actions lightbox-actions"><button class="share-action" type="button" data-lightbox-share>Share</button><button class="share-action" type="button" data-lightbox-copy data-default-label="Copy link">Copy link</button></div><p class="share-status" aria-live="polite"></p></div></div>`;
  const box = $(".lightbox", rootEl);
  const media = $(".lightbox-media", rootEl);
  const title = $("#lightboxTitle", rootEl);
  const meta = $(".lightbox-meta", rootEl);
  const caption = $(".lightbox-caption", rootEl);
  const storyLink = $(".lightbox-story-link", rootEl);
  const seriesLink = $(".lightbox-series-link", rootEl);
  const exifEl = $(".lightbox-exif", rootEl);
  const pageLink = $(".lightbox-page-link", rootEl);
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
  // Always resolve a photo through getVisiblePhotos() first: that list is the enriched
  // one (story/series attached), while photos(data) is raw on the story and series pages.
  // Falling back to photos(data) covers a deep-link to a photo the current filter hides.
  const findPhoto = id => (getVisiblePhotos?.() || []).find(item => item.id === id) || photos(data).find(item => item.id === id);
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
    // Only capture the origin element when opening from a closed state. step()
    // re-opens with mode "replace"; capturing there would overwrite lastFocus
    // with the (soon-hidden) close button and break focus restoration on close.
    if(box.hidden) lastFocus = document.activeElement;
    current = p;
    media.innerHTML = responsiveImage(p,{className:"lightbox-img is-loading",priority:true,sizes:"(max-width: 850px) 100vw, 1200px",fallbackSize:"full"});
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
    if(exifEl){
      const chips = photoExifChips(p);
      exifEl.innerHTML = chips;
      exifEl.hidden = !chips;
    }
    if(storyLink){
      if(p.story && p.story.slug){
        storyLink.href = storyHref(p.story.slug);
        storyLink.innerHTML = `From the story: ${esc(p.story.title)} <span aria-hidden="true">→</span>`;
        storyLink.hidden = false;
      }else{
        storyLink.hidden = true;
        storyLink.removeAttribute("href");
      }
    }
    if(seriesLink){
      if(p.series && p.series.slug){
        seriesLink.href = collectionHref(p.series.slug);
        seriesLink.innerHTML = `In series: ${esc(p.series.title)} <span aria-hidden="true">→</span>`;
        seriesLink.hidden = false;
      }else{
        seriesLink.hidden = true;
        seriesLink.removeAttribute("href");
      }
    }
    if(pageLink){
      pageLink.href = photoHref(p.id);
      pageLink.innerHTML = `Open photo page <span aria-hidden="true">→</span>`;
      pageLink.hidden = false;
    }
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
    const p = findPhoto(btn.dataset.openPhoto);
    if(p) open(p);
  }));
  document.querySelectorAll(".photo-media").forEach(m => m.addEventListener("click", e => {
    if(e.target.closest("[data-open-photo]")) return;
    m.querySelector("[data-open-photo]")?.click();
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
  // The share button is hidden entirely when the Web Share API is unavailable;
  // the separate "Copy link" button covers that case.
  if(!navigator.share) share.hidden = true;
  share.addEventListener("click", async () => {
    if(!current) return;
    const url = urlFor(current);
    try{ await navigator.share({title:current.title, text:current.caption || current.title, url}); setStatus("Shared."); }
    catch(e){ if(e.name !== "AbortError") setStatus("Sharing was not available."); }
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
  const p = initialPhoto ? findPhoto(initialPhoto) : null;
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
