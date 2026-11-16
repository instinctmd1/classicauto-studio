/* Car page: full-screen photo viewer. A tap on the big photo (or the Full screen button) opens every photo of the car as large as the screen
   allows: arrows, a swipe, the arrow keys, a filmstrip, Esc or the close button to leave. Focus goes to the close button and comes back to where it was.
   Reads the car from window.CA_CAR_CURRENT (set by car-page.js, which loads first). Static markup is built on first open. */
(function () {
  "use strict";
  var car = window.CA_CAR_CURRENT;
  if (!car || !car.photos || !car.photos.length) return;
  var fmt = window.ClassicAuto, photos = car.photos, N = photos.length;
  var root = function (u) { return window.CA && window.CA.root ? window.CA.root(u) : u; };
  var hero = document.querySelector('[data-f="hero"]'), track = document.querySelector('[data-f="track"]');
  if (!hero || !track) return;
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var lb = null, imgEl, countEl, strip, current = 0, opener = null;

  var EXPAND = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var CLOSE = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var PREV = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var NEXT = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function alt(i) { return fmt.carLabel(car) + ", " + String(car.colour || "").toLowerCase() + ", photo " + (i + 1) + " of " + N; }

  function build() {
    lb = document.createElement("div");
    lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photos of " + fmt.carLabel(car)); lb.setAttribute("data-lenis-prevent", "");
    lb.innerHTML =
      '<div class="lb-bar"><span class="lb-title">' + esc(fmt.carLabel(car)) + '</span><span class="lb-count" aria-live="polite"></span>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close photos">' + CLOSE + '</button></div>' +
      '<div class="lb-stage"><img class="lb-img" alt="" draggable="false">' +
      (N > 1 ? '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">' + PREV + '</button><button type="button" class="lb-btn lb-next" aria-label="Next photo">' + NEXT + '</button>' : "") +
      '</div>' +
      '<div class="lb-strip" role="group" aria-label="All photos">' + (N > 1 ? photos.map(function (p, i) {
        return '<button type="button" data-i="' + i + '" aria-label="Photo ' + (i + 1) + ' of ' + N + '"><img src="' + esc(root(p)) + '" alt="" width="76" height="54" loading="lazy" decoding="async"></button>';
      }).join("") : "") + '</div>';
    document.body.appendChild(lb);
    imgEl = lb.querySelector(".lb-img"); countEl = lb.querySelector(".lb-count"); strip = lb.querySelector(".lb-strip");
    lb.querySelector(".lb-close").addEventListener("click", close);
    if (N > 1) {
      lb.querySelector(".lb-prev").addEventListener("click", function () { show(current - 1); });
      lb.querySelector(".lb-next").addEventListener("click", function () { show(current + 1); });
      strip.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("button"); if (b) show(+b.getAttribute("data-i")); });
    } else strip.hidden = true;
    lb.addEventListener("keydown", onKey);
    lb.querySelector(".lb-stage").addEventListener("click", function (e) { if (e.target === e.currentTarget) close(); });
    var sx = 0, sy = 0, tracking = false;                       // swipe: horizontal only, so the page behind never scrolls
    var st = lb.querySelector(".lb-stage");
    st.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; tracking = true; sx = e.clientX; sy = e.clientY; });
    st.addEventListener("pointerup", function (e) {
      if (!tracking) return; tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(current + (dx < 0 ? 1 : -1));
    });
    st.addEventListener("pointercancel", function () { tracking = false; });
  }

  function show(i) {
    i = ((i % N) + N) % N;
    var apply = function () {
      current = i;
      imgEl.src = root(photos[i]); imgEl.alt = alt(i);
      countEl.textContent = (i + 1) + " / " + N;
      [].forEach.call(strip.querySelectorAll("button"), function (b, k) {
        var on = k === i; b.setAttribute("aria-current", on ? "true" : "false");
        if (on) { var l = b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2; strip.scrollLeft = l; }
      });
      imgEl.classList.remove("is-swap");
    };
    if (reduced || !lb.classList.contains("is-open")) { apply(); return; }
    imgEl.classList.add("is-swap");
    setTimeout(apply, 140);
    if (N > 1) { var nx = new Image(); nx.src = root(photos[(i + 1) % N]); }   // the next one is ready when asked for
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft" && N > 1) { e.preventDefault(); show(current - 1); }
    else if (e.key === "ArrowRight" && N > 1) { e.preventDefault(); show(current + 1); }
    else if (e.key === "Tab") {                                  // keep focus inside the dialog
      var f = [].filter.call(lb.querySelectorAll("button"), function (b) { return !b.hidden && b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open(i, from) {
    if (!lb) build();
    opener = from || document.activeElement;
    show(i);
    document.body.classList.add("lb-lock");
    if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
    lb.classList.add("is-open");
    lb.querySelector(".lb-close").focus({ preventScroll: true });
  }
  function close() {
    if (!lb) return;
    lb.classList.remove("is-open");
    document.body.classList.remove("lb-lock");
    if (window.__lenis && window.__lenis.start) window.__lenis.start();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    var track2 = document.querySelector('[data-f="track"]');          // the page's own gallery lands on the photo the visitor ended on
    if (track2) { var sl = track2.querySelectorAll(".gx-slide")[current]; if (sl) { try { track2.scrollTo({ left: sl.offsetLeft - (track2.clientWidth - sl.offsetWidth) / 2, behavior: "auto" }); } catch (x) {} } }
  }

  /* the button, and a tap on the photo in the middle */
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "gallery-expand"; btn.setAttribute("aria-label", "View the photos full screen");
  btn.innerHTML = EXPAND + "<span>Full screen</span>";
  hero.appendChild(btn);
  btn.addEventListener("click", function () {
    var act = track.querySelector(".gx-slide.is-active");
    open(act ? +act.getAttribute("data-i") : 0, btn);
  });
  track.addEventListener("click", function (e) {
    var sl = e.target.closest && e.target.closest(".gx-slide");
    if (sl && sl.classList.contains("is-active")) open(+sl.getAttribute("data-i"), track);
  });
})();
