import {
  setContext, esc, photos, photo, imgPath, metaText, variant, srcset, responsiveImage,
  sortPhotos, storyPhotos, absoluteUrl, root, header, footer,
  homeMain, galleryMain, storiesMain, aboutMain, storyMain, legacyStoryMain,
  websiteLdObject, imageGalleryLdObject, personLdObject, articleLdObject,
} from "./templates.mjs?v=2f63f44aa5";

const DATA_PATH = window.__DATA_PATH__ || "assets/data/site-content.json";

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
  const src = (window.__ASSET_PREFIX__ || "") + "assets/data/gallery.json";
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
    const imageUrl = absoluteUrl(data, (variant(imagePhoto, "full", "jpeg") || imgPath(imagePhoto)).replace(/^\.\.\//,""));
    ogImage.setAttribute("content", imageUrl);
    twitterImage.setAttribute("content", imageUrl);
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
    bindLightbox(data, () => storyPhotos(data, s));
  }else if(page === "stories"){
    bindStoryFilters();
    initStoriesMap();
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
function initStoriesMap(){
  const el = document.getElementById("storiesMap");
  const dataEl = document.getElementById("stories-map-data");
  if(!el || !dataEl) return;
  let stories;
  try{ stories = JSON.parse(dataEl.textContent); }catch(e){ return; }
  if(!Array.isArray(stories) || !stories.length) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const start = () => loadLeaflet().then(L => {
    if(el._mapReady) return;
    el._mapReady = true;
    const map = L.map(el, { scrollWheelZoom:false, attributionControl:true });
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark?"dark_all":"light_all"}/{z}/{x}/{y}{r}.png`, {
      maxZoom:19, subdomains:"abcd",
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    const markers = stories.map(s => {
      const icon = L.divIcon({ className:"map-pin", html:`<img src="${esc(s.thumb)}" alt="${esc(s.alt||s.title)}">`, iconSize:[52,52], iconAnchor:[26,26] });
      const m = L.marker([s.lat, s.lng], { icon, title:s.title, alt:s.title, riseOnHover:true, keyboard:true }).addTo(map);
      m.bindTooltip(s.title, { direction:"top", offset:[0,-28] });
      m.on("click", () => { location.href = s.href; });
      return m;
    });
    if(markers.length > 1){
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25), { animate:!reduce });
    }else{
      map.setView([stories[0].lat, stories[0].lng], 9, { animate:false });
    }
  }).catch(() => {});
  if("IntersectionObserver" in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting){ start(); io.disconnect(); } });
    }, { rootMargin:"200px" });
    io.observe(el);
  }else{ start(); }
}
async function boot(){
  try{
    const page = document.body.dataset.page;
    setContext({root: window.__ROOT__ || "", prefix: window.__ASSET_PREFIX__ || "", page});
    if(document.body.dataset.prerendered === "1"){
      await hydrate(page);
      bindScrollReveal();
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
  bindLightbox(data, () => storyPhotos(data, s));
}
function bindScrollReveal(){const els=[...document.querySelectorAll(".photo-card,.story-card,.related-photos .photo-card,.story-inline-photo,.story-body > p,.story-body > h2,.story-body > blockquote")];if(typeof IntersectionObserver==="undefined"){els.forEach(el=>el.classList.add("revealed"));return;}const io=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("revealed");io.unobserve(e.target);}});},{threshold:0.08,rootMargin:"0px 0px -40px 0px"});els.forEach(el=>{if(!el.classList.contains("revealed"))io.observe(el);});}function bindStoryFilters(){
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
    if(count) count.textContent = filter === "all" ? `${visible} photographs` : `${visible} of ${list.length} photographs`;
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
