/* Home hero: a slideshow of real cars from the floor. Each picture is a cut-out of the car's own stock photo (background removed, nothing else
   changed; see tools/make_hero_cutout.py). The list is window.CA_HERO (assets/js/hero-cars.js); a car that is sold or not in the stock is
   skipped, so the hero never offers a car we no longer have. The first slide is in the page's HTML (it is the LCP image); the others are
   created and loaded only after the first has loaded, one ahead of the visitor.
   Moves by: swipe or drag, the arrows (wide screens), the dots, the Left and Right keys, or on its own about every 5.5 s. The slow autoplay
   stops at once on hover, focus, touch or a manual move, while the tab or the hero is out of view, and never starts under reduced motion;
   a pause/play button is always there. The car or the tag below it opens that car's page. */
(function () {
  "use strict";
  var root = document.getElementById("heroCar"), slidesEl = document.getElementById("heroSlides");
  if (!root || !slidesEl || typeof CARS === "undefined" || !window.ClassicAuto || !window.CA_HERO) return;
  var fmt = window.ClassicAuto, doc = document;
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $ = function (id) { return doc.getElementById(id); };
  var tag = $("heroTag"), ctrl = $("heroCtrl"), dotsEl = $("heroDots"), pauseBtn = $("heroPause"), live = $("heroLive");
  var prevBtn = $("heroPrev"), nextBtn = $("heroNext"), stage = $("heroStage");

  var byId = {};
  CARS.forEach(function (c) { byId[c.id] = c; });
  var items = window.CA_HERO.filter(function (h) { var c = byId[h.id]; return c && c.status !== "SOLD"; })
    .map(function (h) { return { h: h, c: byId[h.id] }; });
  var staticSlide = slidesEl.querySelector(".hero-slide");
  if (!items.length) { root.hidden = true; return; }

  function href(c) { return "cars/" + encodeURIComponent(c.id) + "/"; }
  function alt(c) { return fmt.carLabel(c) + ", " + String(c.colour || "").toLowerCase() + ", front three-quarter view"; }
  function name(c) { return fmt.carLabel(c); }
  function price(c) { return c.price_on_request || c.price == null ? "Ask for price" : fmt.money(c.price); }

  /* ---- slides ---- */
  var slides = items.map(function (it, i) {
    var el;
    if (i === 0 && staticSlide && staticSlide.getAttribute("data-id") === it.c.id) el = staticSlide;
    else {
      el = doc.createElement("a");
      el.className = "hero-slide";
      el.href = href(it.c);
      el.setAttribute("data-id", it.c.id);
      el.setAttribute("aria-label", name(it.c) + ": view this car");
    }
    el.setAttribute("data-i", i);
    if (el !== staticSlide) slidesEl.appendChild(el);
    return el;
  });
  if (staticSlide && slides.indexOf(staticSlide) < 0) staticSlide.remove();   // the first car is sold: its static slide goes
  function loaded(i) { return !!slides[i].querySelector("img"); }
  function load(i) {
    i = (i + slides.length) % slides.length;
    if (loaded(i)) return;
    var it = items[i], img = doc.createElement("img");
    img.src = (window.CA && window.CA.root ? window.CA.root(it.h.src) : it.h.src);
    img.width = it.h.w; img.height = it.h.h; img.alt = alt(it.c); img.decoding = "async"; img.draggable = false;
    img.addEventListener("error", function () { slides[i].setAttribute("data-broken", "1"); });
    slides[i].appendChild(img);
  }
  var firstImg = slides[0].querySelector("img");
  if (firstImg) firstImg.alt = alt(items[0].c);
  else load(0);

  var idx = 0, auto = !reduced, userStopped = false, timer = null, hoverOrFocus = false, offscreen = false, dragging = false;

  /* ---- tag + dots ---- */
  function showTag() {
    var c = items[idx].c;
    tag.href = href(c);
    tag.innerHTML = '<span class="hero-tag-name">' + name(c) + '</span><span class="hero-tag-price">' + price(c) + '</span>' +
      '<span class="hero-tag-go">View this car <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
    tag.hidden = false;
    tag.classList.remove("is-swap"); void tag.offsetWidth; tag.classList.add("is-swap");
  }
  if (slides.length > 1) {
    dotsEl.innerHTML = items.map(function (it, i) {
      return '<button type="button" class="hero-dot" data-i="' + i + '" aria-label="Show car ' + (i + 1) + " of " + items.length + ": " + name(it.c) + '"><i></i></button>';
    }).join("");
    ctrl.hidden = false; prevBtn.hidden = false; nextBtn.hidden = false;
  }
  function markDots() {
    [].forEach.call(dotsEl.children, function (d, i) { if (i === idx) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
  }

  /* ---- moving ---- */
  function setState(el, active) {
    el.setAttribute("aria-hidden", active ? "false" : "true");
    el.tabIndex = active ? 0 : -1;
  }
  slides.forEach(function (el, i) { setState(el, i === 0); });
  function go(n, dir, byUser) {
    n = (n + slides.length) % slides.length;
    if (n === idx) return;
    dir = dir || (n > idx ? 1 : -1);
    var from = slides[idx], to = slides[n];
    load(n); load(n + dir);
    slides.forEach(function (el) { el.classList.remove("is-leaving"); });
    from.style.removeProperty("transform");
    from.style.setProperty("--to", (dir > 0 ? -14 : 14) + "%");
    to.style.setProperty("--from", (dir > 0 ? 14 : -14) + "%");
    to.style.removeProperty("transform");
    void to.offsetWidth;
    from.classList.remove("is-active"); from.classList.add("is-leaving");
    to.classList.add("is-active");
    setState(from, false); setState(to, true);
    setTimeout(function () { from.classList.remove("is-leaving"); }, 900);
    idx = n; markDots(); showTag();
    if (byUser) { userStopped = true; sync(); live.textContent = "Car " + (idx + 1) + " of " + items.length + ": " + name(items[idx].c) + ", " + price(items[idx].c); }
  }

  /* ---- autoplay ---- */
  function running() { return auto && !userStopped && !hoverOrFocus && !offscreen && !doc.hidden && !dragging && slides.length > 1; }
  function sync() {
    clearTimeout(timer);
    if (pauseBtn) {
      var playing = auto && !userStopped;
      pauseBtn.setAttribute("aria-pressed", String(!playing));
      pauseBtn.setAttribute("aria-label", playing ? "Pause the slideshow" : "Play the slideshow");
      pauseBtn.classList.toggle("is-paused", !playing);
    }
    if (running()) timer = setTimeout(function () { go(idx + 1, 1, false); sync(); }, 5500);
  }
  if (pauseBtn) pauseBtn.addEventListener("click", function () {
    if (auto && !userStopped) { userStopped = true; } else { auto = true; userStopped = false; }
    sync();
  });
  root.addEventListener("mouseenter", function () { hoverOrFocus = true; sync(); });
  root.addEventListener("mouseleave", function () { hoverOrFocus = false; sync(); });
  root.addEventListener("focusin", function () { hoverOrFocus = true; sync(); });
  root.addEventListener("focusout", function () { hoverOrFocus = false; sync(); });
  doc.addEventListener("visibilitychange", sync);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { offscreen = !en[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(root);

  /* ---- controls ---- */
  prevBtn.addEventListener("click", function () { go(idx - 1, -1, true); });
  nextBtn.addEventListener("click", function () { go(idx + 1, 1, true); });
  dotsEl.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".hero-dot");
    if (b) { var n = +b.getAttribute("data-i"); go(n, n > idx ? 1 : -1, true); }
  });
  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1, 1, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1, -1, true); }
  });

  /* ---- swipe / drag (touch and mouse). Vertical movement is left to the page (touch-action: pan-y). ---- */
  var sx = 0, sy = 0, dx = 0, startT = 0, id = null, moved = false, w = 1;
  slidesEl.addEventListener("pointerdown", function (e) {
    if (e.button || slides.length < 2) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; moved = false; startT = Date.now(); w = slidesEl.clientWidth || 1;
    dragging = true; sync();
  });
  slidesEl.addEventListener("pointermove", function (e) {
    if (e.pointerId !== id) return;
    dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) {
      moved = true;
      try { slidesEl.setPointerCapture(id); } catch (err) { /* fine */ }
      slides[idx].style.transition = "none";
    }
    if (moved) {
      var el = slides[idx];
      el.style.transform = "translateX(" + dx + "px)";
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / w * 0.9));
    }
  });
  function endDrag(e) {
    if (e.pointerId !== id) return;
    id = null; dragging = false;
    var el = slides[idx];
    if (moved) {
      el.style.removeProperty("transition");
      var fast = Math.abs(dx) / Math.max(1, Date.now() - startT) > 0.45;
      el.style.removeProperty("transform"); el.style.removeProperty("opacity");
      if (Math.abs(dx) > 48 || (fast && Math.abs(dx) > 18)) go(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, true);
    }
    sync();
  }
  slidesEl.addEventListener("pointerup", endDrag);
  slidesEl.addEventListener("pointercancel", endDrag);
  slidesEl.addEventListener("click", function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
  slidesEl.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* ---- start: the first slide's picture is already in the HTML; load the next one once the page is idle ---- */
  markDots(); showTag();
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
  function warm() { idle(function () { load(1); load(slides.length - 1); sync(); }); }
  if (doc.readyState === "complete") warm(); else window.addEventListener("load", warm);
})();
