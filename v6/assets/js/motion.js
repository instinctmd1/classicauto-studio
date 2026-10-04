/* =========================================================================
   Classic Auto v6: the smooth-motion system for every page.
   Lenis (desktop wheel only, never under reduced motion) drives GSAP
   ScrollTrigger. Animates transform + opacity only. Touch keeps native
   scrolling (syncTouch: false). Content is visible by default; hiding for
   reveals is applied by CSS only while `html.motion` is set, and a safety
   timer releases it if this script never finishes (rule N8).
   ========================================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var M = window.CA_MOTION = { reduced: reduced, lenis: null, ready: false, gsap: null };

  function fail() { root.classList.remove("motion"); root.classList.add("motion-off"); }

  if (reduced || !window.gsap || !window.ScrollTrigger) { fail(); finish(); return; }

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  var plugins = [ScrollTrigger];
  if (window.SplitText) plugins.push(window.SplitText);
  if (window.Flip) plugins.push(window.Flip);
  gsap.registerPlugin.apply(gsap, plugins);
  M.gsap = gsap;

  /* ---- Lenis + ScrollTrigger (desktop wheel) ---- */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  /* Phones: the address bar showing or hiding changes only the height; never re-measure every trigger for that (a visible
     hitch mid-swipe). */
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (window.Lenis && finePointer) {
    var lenis = new window.Lenis({
      duration: 1.1,
      easing: function (t) { return 1 - Math.pow(1 - t, 4); },
      smoothWheel: true,
      syncTouch: false
    });
    M.lenis = window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function headerOffset() { var h = document.getElementById("siteHeader"); return h ? -(h.offsetHeight + 8) : 0; }
  M.scrollTo = function (target, opts) {
    opts = opts || {};
    if (M.lenis) { M.lenis.scrollTo(target, { offset: opts.offset != null ? opts.offset : headerOffset(), immediate: !!opts.immediate, duration: opts.duration }); return; }
    var y = typeof target === "number" ? target : (target.getBoundingClientRect().top + window.scrollY + (opts.offset != null ? opts.offset : headerOffset()));
    window.scrollTo({ top: y, behavior: opts.immediate ? "auto" : "smooth" });
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    M.scrollTo(el);
    history.replaceState(null, "", id);
    if (el.tabIndex < 0) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  });

  /* ---- Reveals ---- */
  var EASE = "expo.out";
  /* Touch screens: a shorter travel and a slightly quicker settle read as smooth at thumb-scroll speed (a long, far rise lags the
     finger); a touch more stagger so a list still reads as a sequence. Desktop values are unchanged (24 px, 0.7 s, 0.05 s). */
  var RISE = finePointer ? 24 : 16, DUR = finePointer ? 0.7 : 0.6, STAG = finePointer ? 0.05 : 0.07;
  function reveal(el) {
    gsap.fromTo(el, { y: RISE, opacity: 0 }, {
      y: 0, opacity: 1, duration: DUR, ease: EASE, clearProps: "transform",
      scrollTrigger: { trigger: el, start: "top 90%", once: true }
    });
  }
  function revealGroup(group) {
    var items = group.querySelectorAll("[data-reveal-item]");
    if (!items.length) return;
    gsap.fromTo(items, { y: RISE, opacity: 0 }, {
      y: 0, opacity: 1, duration: DUR, ease: EASE, stagger: STAG, clearProps: "transform",
      scrollTrigger: { trigger: group, start: "top 88%", once: true }
    });
  }

  /* Radial stagger from the centre for a grid of cards. */
  M.revealGrid = function (grid) {
    if (!grid) return;
    var items = grid.querySelectorAll(".car-card");
    if (!items.length) return;
    if (grid.__rg) { if (grid.__rg.scrollTrigger) grid.__rg.scrollTrigger.kill(); grid.__rg.kill(); }
    grid.__rg = gsap.fromTo(items, { y: finePointer ? 28 : 18, opacity: 0, scale: 0.97 }, {
      y: 0, opacity: 1, scale: 1, duration: DUR, ease: EASE, clearProps: "transform",
      stagger: { grid: "auto", from: "center", amount: 0.5 },
      scrollTrigger: { trigger: grid, start: "top 92%", once: true }
    });
    M.glints(grid);
  };

  /* One 700 ms price glint, the first time a price enters the viewport. */
  M.glints = function (scope) {
    var els = (scope || document).querySelectorAll("[data-glint]:not(.is-glinted)");
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-glinted"); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  };

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var obj = { v: 0 };
    var fmt = function (v) { return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals); };
    el.textContent = "0";
    gsap.to(obj, {
      v: target, duration: 1.4, ease: "power3.out",
      onUpdate: function () { el.textContent = String(fmt(obj.v)); },
      onComplete: function () { el.textContent = String(target); },
      scrollTrigger: { trigger: el, start: "top 92%", once: true }
    });
  }

  /* ---- Scroll-progress rail ---- */
  var rail = document.querySelector(".progress-rail > i");
  if (rail) {
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: function (self) { rail.style.transform = "scaleY(" + self.progress.toFixed(4) + ")"; }
    });
  }

  /* ---- Chapter label (home): decodes into place ---- */
  var label = document.getElementById("chapterLabel");
  var GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  function decode(el, text) {
    var o = { t: 0 };
    gsap.killTweensOf(o);
    gsap.to(o, {
      t: 1, duration: 0.45, ease: "none",
      onUpdate: function () {
        var k = Math.floor(o.t * text.length), out = text.slice(0, k);
        for (var i = k; i < text.length; i++) out += (text[i] === " " || text[i] === "/") ? text[i] : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        el.textContent = out;
      },
      onComplete: function () { el.textContent = text; }
    });
  }
  function chapters() {
    if (!label) return;
    var current = label.textContent.trim();
    document.querySelectorAll("[data-chapter]").forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onToggle: function (self) {
          if (!self.isActive) return;
          var txt = sec.getAttribute("data-chapter");
          if (txt === current) return;
          current = txt;
          decode(label, txt);
        }
      });
    });
  }

  function init() {
    document.querySelectorAll("[data-reveal]").forEach(reveal);
    document.querySelectorAll("[data-reveal-group]").forEach(revealGroup);
    document.querySelectorAll("[data-count]").forEach(countUp);
    chapters();
    M.glints(document);
    M.ready = true;
    document.dispatchEvent(new CustomEvent("ca:motion-ready"));
    ScrollTrigger.refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });

  function finish() { /* nothing else to release */ }
  finish();
})();
