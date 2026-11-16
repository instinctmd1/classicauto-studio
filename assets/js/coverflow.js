/* Home: "Featured cars". A coverflow of the cars' studio covers (the car's real photo stood in the Classic Auto showroom) with a spec strip under
   it: brand logo | model year + model | big variant | transmission + kms. Motion is transform + opacity only; the layout of every slide comes from
   its data-o (offset from the centre) in draft.css. Drag / swipe sideways, arrows, dots and arrow keys all move it; a vertical swipe still scrolls
   the page (touch-action: pan-y). Autoplay runs only while the band is on screen, stops for good on the first touch or key press, has a pause
   button, and is off with prefers-reduced-motion (the slides then change with no travel). Which cars feature is one list: CA_FEATURED_IDS. */
(function () {
  "use strict";
  var stage = document.getElementById("cfStage");
  if (!stage || typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;
  var root = function (u) { return window.CA && window.CA.root ? window.CA.root(u) : u; };
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function slug(m) { return String(m).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  var IDS = window.CA_FEATURED_IDS || [
    "mercedes-benz-maybach-gls-2025", "mercedes-benz-s-class-2025", "land-rover-defender-2023", "bmw-7-series-2024",
    "land-rover-range-rover-velar-2024", "tesla-model-y-2026", "audi-rs5-2021"
  ];
  var byId = {};
  CARS.forEach(function (c) { byId[c.id] = c; });
  var cars = IDS.map(function (id) { return byId[id]; }).filter(function (c) { return c && c.status !== "SOLD" && c.photos && c.photos.length; });
  var sec = document.getElementById("featured");
  if (cars.length < 3) { if (sec) sec.hidden = true; return; }

  var cf = document.getElementById("cf"), specEl = document.getElementById("cfSpec"), ctrl = document.getElementById("cfCtrl"), dotsEl = document.getElementById("cfDots");
  var prev = document.getElementById("cfPrev"), next = document.getElementById("cfNext"), pauseBtn = document.getElementById("cfPause");
  var n = cars.length, half = Math.floor(n / 2), active = 0, slides = [];

  function cover(c) { return "assets/photos/cars/" + c.id + "/studio.webp"; }
  function href(c) { return root("cars/" + encodeURIComponent(c.id) + "/"); }
  function label(c) { return fmt.carLabel(c); }

  /* ---- slides ---- */
  stage.innerHTML = cars.map(function (c, i) {
    return '<a class="cf-slide" href="' + href(c) + '" data-i="' + i + '" data-cta="see_car" data-at="featured" aria-label="' + (i + 1) + ' of ' + n + ': ' + esc(label(c)) + '">' +
      '<img src="' + root(cover(c)) + '" alt="' + esc(label(c) + ", " + c.colour.toLowerCase() + ", in the Classic Auto showroom") + '" width="1200" height="900" ' +
      (i === 0 ? 'fetchpriority="auto"' : 'loading="lazy"') + ' decoding="async" draggable="false"><span class="cf-shade" aria-hidden="true"></span></a>';
  }).join("");
  slides = [].slice.call(stage.querySelectorAll(".cf-slide"));
  prev.hidden = next.hidden = false;
  ctrl.hidden = false;
  dotsEl.innerHTML = cars.map(function (c, i) { return '<button type="button" data-i="' + i + '" aria-label="Show car ' + (i + 1) + ' of ' + n + ': ' + esc(label(c)) + '"></button>'; }).join("");
  var dots = [].slice.call(dotsEl.querySelectorAll("button"));
  var live = document.createElement("p"); live.className = "sr-only"; live.setAttribute("aria-live", "polite"); cf.appendChild(live);

  function off(i) { var d = (i - active) % n; if (d > half) d -= n; if (d < -half) d += n; return d; }

  /* ---- spec strip ---- */
  function specHTML(c) {
    var km = c.kms == null ? "Ask us" : Number(c.kms).toLocaleString("en-IN");
    var price = c.price_on_request || c.price == null ? "Ask for price" : fmt.money(c.price);
    return '<div class="spec-row">' +
      '<div class="spec-cell spec-id"><span class="spec-logo"><img src="' + root("assets/brands/" + slug(c.make) + ".webp") + '" alt="' + esc(c.make) + '" width="64" height="48" decoding="async"></span>' +
        '<span class="spec-txt"><span class="spec-k">Model year ' + esc(c.year) + '</span><b>' + esc(c.model) + '</b></span></div>' +
      '<div class="spec-cell spec-variant"><h3>' + esc(c.variant) + '</h3></div>' +
      '<div class="spec-cell spec-meta"><span class="spec-line"><span class="spec-k">Transmission</span><b>' + esc(c.trans) + '</b></span>' +
        '<span class="spec-line"><span class="spec-k">Kms</span><b class="tnum">' + km + '</b></span></div>' +
    '</div>' +
    '<div class="spec-foot"><span class="spec-price tnum">' + price + '</span><a class="btn btn-primary" href="' + href(c) + '" data-cta="see_car" data-at="featured_strip">View this car <span class="sr-only">: ' + esc(label(c)) + '</span></a></div>';
  }
  function setSpec(c) {
    specEl.innerHTML = specHTML(c);
    var img = specEl.querySelector(".spec-logo img");
    if (img) img.addEventListener("error", function () { var w = document.createElement("span"); w.className = "spec-logo-word"; w.textContent = c.make; img.replaceWith(w); });
    if (reduced) return;
    specEl.classList.remove("is-in"); void specEl.offsetWidth; specEl.classList.add("is-in");   // re-runs the 3-step rise
  }

  /* ---- state ---- */
  function apply(announce) {
    slides.forEach(function (s, i) {
      var o = off(i);
      s.setAttribute("data-o", String(o));
      var on = o === 0;
      s.setAttribute("aria-current", on ? "true" : "false");
      if (on) { s.removeAttribute("aria-hidden"); s.removeAttribute("tabindex"); } else { s.setAttribute("aria-hidden", "true"); s.setAttribute("tabindex", "-1"); }
    });
    dots.forEach(function (d, i) { d.setAttribute("aria-current", i === active ? "true" : "false"); });
    setSpec(cars[active]);
    if (announce) live.textContent = "Car " + (active + 1) + " of " + n + ": " + label(cars[active]);
  }
  function goTo(i, user) { active = ((i % n) + n) % n; if (user) stopAuto(true); apply(!!user); }
  function go(d, user) { goTo(active + d, user); }

  prev.addEventListener("click", function () { go(-1, true); });
  next.addEventListener("click", function () { go(1, true); });
  dotsEl.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("button"); if (b) goTo(+b.getAttribute("data-i"), true); });
  cf.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1, true); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1, true); }
  });

  /* ---- drag / swipe: horizontal only, with a threshold, so a vertical swipe still scrolls the page ---- */
  var sx = 0, sy = 0, pid = null, dragging = false, moved = false;
  stage.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragging = false; moved = false;
  });
  stage.addEventListener("pointermove", function (e) {
    if (e.pointerId !== pid) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = moved = true; stage.classList.add("is-drag"); try { stage.setPointerCapture(pid); } catch (x) {} }
      else return;
    }
    stage.style.setProperty("--drag", Math.round(dx * 0.55) + "px");
  });
  function endDrag(e) {
    if (e.pointerId !== pid) return;
    var dx = e.clientX - sx;
    if (dragging) {
      stage.classList.remove("is-drag"); stage.style.setProperty("--drag", "0px");
      if (e.type === "pointerup" && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1, true);
    }
    pid = null; dragging = false;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("click", function (e) {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
    var a = e.target.closest && e.target.closest(".cf-slide");
    if (a && a.getAttribute("data-o") !== "0") { e.preventDefault(); goTo(+a.getAttribute("data-i"), true); }   // a neighbour comes to the middle; the middle car opens
  }, true);

  /* ---- autoplay: only on screen, only until the visitor touches it, pausable, never under reduced motion ---- */
  var timer = 0, inView = false, stopped = reduced, hover = false;
  function tick() { clearTimeout(timer); if (stopped || !inView || hover || document.hidden) return; timer = setTimeout(function () { go(1, false); tick(); }, 5200); }
  function stopAuto(forGood) { if (forGood) { stopped = true; pauseBtn.setAttribute("aria-pressed", "true"); pauseBtn.setAttribute("aria-label", "Play the slideshow"); } clearTimeout(timer); }
  pauseBtn.addEventListener("click", function () {
    var pressed = pauseBtn.getAttribute("aria-pressed") === "true";
    stopped = !pressed;
    pauseBtn.setAttribute("aria-pressed", String(stopped));
    pauseBtn.setAttribute("aria-label", stopped ? "Play the slideshow" : "Pause the slideshow");
    if (stopped) clearTimeout(timer); else tick();
  });
  if (reduced) pauseBtn.hidden = true;
  cf.addEventListener("mouseenter", function () { hover = true; clearTimeout(timer); });
  cf.addEventListener("mouseleave", function () { hover = false; tick(); });
  document.addEventListener("visibilitychange", tick);

  /* ---- first view: the cars fan out from the middle once, when the band is reached ---- */
  var first = true;
  if (!reduced) cf.classList.add("is-pre");
  apply(false);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        inView = en.isIntersecting;
        if (inView && first) {
          first = false;
          slides.forEach(function (s) { s.style.transitionDelay = Math.abs(+s.getAttribute("data-o")) * 90 + "ms"; });
          cf.classList.remove("is-pre");
          setTimeout(function () { slides.forEach(function (s) { s.style.transitionDelay = ""; }); }, 1100);
        }
        if (inView) tick(); else clearTimeout(timer);
      });
    }, { threshold: 0.35 }).observe(cf);
  } else { inView = true; cf.classList.remove("is-pre"); tick(); }
})();
