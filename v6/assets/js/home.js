/* =========================================================================
   Home page film: Chapter 01 (Showroom, the live interactive car) and
   Chapter 02 (Unveil, the cloth lifts as you scroll).

   Scroll position is the single source of truth for Unveil: ScrollTrigger
   progress p (0..1) over a sticky stage drives the frame scrub, the title
   drop, the cross-fade to the live car and the CTA row. Scrolling back puts
   the cloth back on. Every state is reachable without motion (reduced-motion
   path: posters + a "Reveal the car" button).
   ========================================================================= */
var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var mqMobile = window.matchMedia("(max-width: 768px)");
var mobile = mqMobile.matches;
mqMobile.addEventListener("change", function () { window.location.reload(); });

// Reference frame (the Blender render) and the phone crop of it.
var REF_W = 1280, REF_H = 720;
var MOBILE_CROP = { x: 150, y: 120, w: 960, h: 600 };
var FRAMES_BASE = mobile ? "hero-frames/m/" : "hero-frames/";
var BODY_COLOR = "#d8271c";   // matched to the baked poster's paint

function $(s, r) { return (r || document).querySelector(s); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function track(name, props) { if (window.CA_TRACK) window.CA_TRACK(name, props); }
function hasWebGL() {
  try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}
function idle(fn) { if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 700); }

var live = null;            // the single live-car instance
var liveHost = "showroom";  // which chapter's rect currently holds the canvas

/* ======================================================================
   Chapter 01: Showroom
   ====================================================================== */
(function showroom() {
  var stage = $("#showroom");
  if (!stage) return;
  var rect = $("#showroomRect");
  var poster = $("#showroomPoster");
  var hint = $("#scrollHint");
  var tiltBtn = $("#tiltBtn");
  var hostEl = rect;

  // First scroll removes the hint.
  var hintGone = false;
  window.addEventListener("scroll", function () {
    if (!hintGone && window.scrollY > 24 && hint) { hintGone = true; hint.classList.add("is-gone"); }
  }, { passive: true });

  if (!hasWebGL()) { stage.classList.add("no-webgl"); document.dispatchEvent(new CustomEvent("ca:live-ready")); return; }

  function boot() {
    import("./live3d.js").then(function (mod) {
      live = mod.createLiveCar({ mobile: mobile, reducedMotion: reduced, bodyColor: BODY_COLOR });
      live.mount(hostEl, mobile ? MOBILE_CROP : null);
      window.__live = live;
      return live.load().then(function () {
        live.canvas.classList.add("is-ready");
        stage.classList.add("is-live");
        document.dispatchEvent(new CustomEvent("ca:live-ready"));
        // keyboard orbit (visible focus ring on the rect)
        rect.addEventListener("keydown", function (e) {
          if (e.key === "ArrowLeft") { live.nudge(-0.18); e.preventDefault(); }
          if (e.key === "ArrowRight") { live.nudge(0.18); e.preventDefault(); }
        });
        if (tiltBtn && live.needsTiltPermission() && window.matchMedia("(pointer: coarse)").matches) {
          tiltBtn.hidden = false;
          tiltBtn.addEventListener("click", function () {
            live.requestTilt().then(function (ok) { if (ok) tiltBtn.hidden = true; });
          });
        }
        var io = new IntersectionObserver(function (en) {
          var showroomVisible = en[0].isIntersecting;
          if (liveHost === "showroom") live.setVisible(showroomVisible);
        }, { threshold: 0.05 });
        io.observe(stage);
        live.setVisible(true);
        document.addEventListener("ca:live-lost", function () { stage.classList.remove("is-live"); });
        document.addEventListener("ca:live-restored", function () { stage.classList.add("is-live"); });
        /* phones: pause the 3D frames while the page is being swiped (they resume 160 ms after the last scroll event) */
        if (mobile) window.addEventListener("scroll", function () { live.hold(160); }, { passive: true });
      });
    }).catch(function (err) {
      document.dispatchEvent(new CustomEvent("ca:live-ready"));
      if (window.console) console.warn("[showroom] live 3D unavailable, keeping the poster:", err && err.message);
    });
  }
  // after first paint, on idle (never competes with LCP), and after the intro when there is one
  function afterIntro(fn) {
    if (!document.documentElement.classList.contains("intro-on")) return fn();
    var fired = false; function go() { if (!fired) { fired = true; fn(); } }
    document.addEventListener("ca:intro-done", go, { once: true }); setTimeout(go, 4000);
  }
  /* On a phone or with Data Saver on, the 3 MB car waits for the first touch, scroll or key (or 6 s): the poster is the same
     pose, so nothing looks missing, and a visitor who only glances never pays for it. */
  var lean = mobile || !!(navigator.connection && navigator.connection.saveData);
  function whenInteracted(fn) {
    var done = false, evs = ["pointerdown", "touchstart", "scroll", "keydown"];
    function go() { if (done) return; done = true; evs.forEach(function (e) { window.removeEventListener(e, go); }); fn(); }
    evs.forEach(function (e) { window.addEventListener(e, go, { passive: true, once: true }); });
    setTimeout(go, 6000);
  }
  /* Phones: the model parse and shader compile are main-thread work, so they wait for a pause in scrolling (250 ms without a
     scroll event, at most 2.5 s) instead of landing in the middle of a swipe through the Unveil. */
  function whenScrollIdle(fn) {
    var t = 0, done = false, cap = setTimeout(go, 2500);
    function go() { if (done) return; done = true; clearTimeout(cap); clearTimeout(t); window.removeEventListener("scroll", onS); fn(); }
    function onS() { clearTimeout(t); t = setTimeout(go, 250); }
    window.addEventListener("scroll", onS, { passive: true });
    t = setTimeout(go, 250);
  }
  function start() { afterIntro(function () { if (lean) whenInteracted(function () { whenScrollIdle(function () { idle(boot); }); }); else idle(boot); }); }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();

/* ======================================================================
   Chapter 02: Unveil
   ====================================================================== */
(function unveil() {
  var section = $("#unveil");
  if (!section) return;
  var stageEl = $(".unveil-stage", section);
  var rect = $("#unveilRect");
  var canvas = $("#framesCanvas");
  var ctx = canvas.getContext("2d");
  var wipe = $("#unveilWipe");
  var titleEl = $("#unveilTitle");
  var sinceEl = $("#unveilSince");
  var ctaRow = $("#unveilCta");
  var handle = $("#dragHandle");
  var dragWrap = $("#dragReveal");
  var arcFill = $("#dragArcFill");
  var revealBtn = $("#revealBtn");

  function staticMode() {
    section.classList.add("is-static");
    if (revealBtn) {
      revealBtn.addEventListener("click", function () {
        var on = !section.classList.contains("is-revealed");
        section.classList.toggle("is-revealed", on);
        revealBtn.textContent = on ? "Cover the car" : "Reveal the car";
        revealBtn.setAttribute("aria-pressed", String(on));
        track("hero_reveal", { stage: on ? "done" : "start", "in": "tap" });
      });
    }
  }

  var M = window.CA_MOTION || {};
  function start() {
    if (reduced || !window.gsap || !window.ScrollTrigger || !M.gsap) { staticMode(); return; }
    animated(window.gsap, window.ScrollTrigger);
  }
  if (reduced) { staticMode(); return; }
  if (M.ready) start(); else document.addEventListener("ca:motion-ready", start, { once: true });
  // if motion never becomes ready, fall back after a moment
  setTimeout(function () { if (!M.ready && !section.classList.contains("is-static") && !section.__animated) staticMode(); }, 4500);

  function animated(gsap, ScrollTrigger) {
    if (section.__animated) return; section.__animated = true;
    section.classList.add("is-animated");

    /* ---- frame sequence ---- */
    var meta = { count: 46, width: mobile ? 720 : 1280, height: mobile ? 450 : 720 };
    var images = [], loaded = 0, drawn = -1, target = 0, preloading = false, progress = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    var maxBacking = mobile ? 900 : 2400;

    function frameUrl(i) { var n = String(i); while (n.length < 3) n = "0" + n; return FRAMES_BASE + "f_" + n + ".webp"; }

    function sizeCanvas() {
      var w = rect.clientWidth, h = rect.clientHeight;
      if (!w || !h) return;
      var bw = Math.min(Math.round(w * dpr), maxBacking), eff = bw / w, bh = Math.round(h * eff);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      drawn = -1; draw();
    }
    function coverSource(img) {
      // desktop frames are the full 16:9 render: crop to the rect aspect (cover). Phone frames are pre-cropped.
      var iw = img.naturalWidth, ih = img.naturalHeight;
      if (mobile) return { x: 0, y: 0, w: iw, h: ih };
      var a = canvas.width / canvas.height, ia = iw / ih;
      if (a < ia) { var w = ih * a; return { x: (iw - w) / 2, y: 0, w: w, h: ih }; }
      var h = iw / a; return { x: 0, y: (ih - h) / 2, w: iw, h: h };
    }
    function best(i) {
      i = clamp(i, 0, meta.count - 1);
      for (var a = i; a >= 0; a--) if (images[a] && images[a].__ok) return a;
      for (var b = i; b < meta.count; b++) if (images[b] && images[b].__ok) return b;
      return -1;
    }
    function draw() {
      var idx = best(target);
      if (idx < 0 || idx === drawn) return;
      drawn = idx;
      if (!section.classList.contains("frames-ready")) section.classList.add("frames-ready");   // frames now cover the draped poster
      var img = images[idx], s = coverSource(img);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, s.x, s.y, s.w, s.h, 0, 0, canvas.width, canvas.height);
      publish();
    }
    function preload() {
      if (preloading) return; preloading = true;
      fetch(FRAMES_BASE + "index.json").then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (m) {
        if (m && m.count) { meta.count = m.count; meta.width = m.width; meta.height = m.height; }
        sizeCanvas();
        for (var i = 0; i < meta.count; i++) (function (i) {
          var img = new Image(); img.decoding = "async";
          /* decode off the main thread before the frame is used, so the first scrub across it never stalls on a decode */
          img.onload = function () {
            var ok = function () { img.__ok = true; loaded++; draw(); publish(); };
            if (img.decode) img.decode().then(ok, ok); else ok();
          };
          img.onerror = function () { if (window.console) console.error("[unveil] frame failed:", frameUrl(i)); };
          img.src = frameUrl(i); images[i] = img;
        })(i);
      });
    }
    /* Frames start loading once the Unveil is within one viewport (rootMargin 100%), but never in the way of the first
       screen: wait for the live car (or 4.5 s after load), then an idle moment. Entering the chapter itself loads at once. */
    var near = false, liveSettled = false, loadDone = document.readyState === "complete";
    function maybePreload() { if (near && liveSettled && loadDone) { if ("requestIdleCallback" in window) requestIdleCallback(preload, { timeout: 1500 }); else setTimeout(preload, 200); } }
    document.addEventListener("ca:live-ready", function () { liveSettled = true; maybePreload(); }, { once: true });
    function onLoad() { loadDone = true; setTimeout(function () { liveSettled = true; maybePreload(); }, 4500); maybePreload(); }
    if (loadDone) onLoad(); else window.addEventListener("load", onLoad, { once: true });
    var preIO = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { near = true; maybePreload(); } }, { rootMargin: "100% 0px" });
    preIO.observe(section);
    var enterIO = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { preload(); enterIO.disconnect(); preIO.disconnect(); } }, { rootMargin: "0px" });
    enterIO.observe(section);
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe(rect);

    function publish() {
      window.__heroFrameState = { targetFrame: target, drawnIndex: drawn, framesLoaded: loaded, count: meta.count, progress: progress, crossfade: crossfade, host: liveHost };
    }
    var crossfade = 0;

    /* ---- title: CLASSIC AUTO lands on top of the car ---- */
    /* Built once the web fonts are in: SplitText measures each letter, and fallback-font widths would split it wrong. */
    var titleTl = null;
    function buildTitle() {
      if (titleTl) return;
      var chars = [];
      if (window.SplitText) { chars = new window.SplitText(titleEl, { type: "chars", charsClass: "u-char" }).chars; }
      else chars = [titleEl];
      titleTl = gsap.timeline({ paused: true });
      titleTl.fromTo(chars, { yPercent: -120, rotation: function (i) { return i % 2 ? 8 : -8; }, opacity: 0 },
        { yPercent: 0, rotation: 0, opacity: 1, ease: "back.out(1.7)", duration: 0.6, stagger: 0.04 }, 0);
      titleTl.fromTo(sinceEl, { opacity: 0, y: 24, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: "expo.out" }, ">-0.15");
      titleTl.progress(clamp((progress - 0.88) / 0.1, 0, 1));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildTitle, buildTitle); else buildTitle();

    /* ---- hand the canvas between chapters for the final cross-fade ---- */
    function hostTo(which) {
      if (!live || liveHost === which) return;
      liveHost = which;
      var el = which === "unveil" ? rect : $("#showroomRect");
      live.mount(el, mobile ? MOBILE_CROP : null);
      /* In the Unveil the canvas opacity is scrubbed by scroll, so the 700 ms CSS fade must be off (it made the live car lag the
         frames: a blink at the end and a double image on the way back). Back in the Showroom the CSS owns opacity again. */
      if (which === "unveil") { live.canvas.style.transition = "none"; live.resetPose(); live.setVisible(true); }
      else { live.canvas.style.transition = ""; live.canvas.style.opacity = ""; }
    }

    var milestone = { start: false, half: false, done: false };
    var inputKind = "scroll";

    function setProgress(p) {
      progress = p;
      // 0.00 - 0.08: the navy colour cut wipes away
      var w = 1 - smooth(0, 0.08, p);
      wipe.style.transform = "scaleX(" + w + ")";
      // 0.08 - 0.88: scrub frames (weighty ease)
      var t = clamp((p - 0.08) / 0.8, 0, 1);
      target = Math.round(Math.pow(t, 1.35) * (meta.count - 1));
      draw();
      // 0.88 - 0.98: the title lands, then "since 1974."
      if (titleTl) titleTl.progress(clamp((p - 0.88) / 0.1, 0, 1));
      // 0.90 - 1.00: cross-fade frames -> live car; CTA row
      /* The frames hand over to the live car only once it has loaded: a phone that has not finished the download keeps the last
         baked frame (the clean car) instead of fading to an empty stage. */
      var liveOk = !!(live && live.state && live.state.loaded);
      crossfade = liveOk ? smooth(0.9, 1.0, p) : 0;
      if (live) {
        if (crossfade > 0 && liveHost !== "unveil") hostTo("unveil");
        if (crossfade <= 0 && liveHost !== "showroom") hostTo("showroom");
        if (liveHost === "unveil") live.setOpacity(crossfade);
      }
      /* The live car dissolves in ON TOP of the last baked frame, which stays fully opaque until the live car is fully in: fading
         both at once let the navy show through a half-transparent car (a double exposure). */
      canvas.style.opacity = crossfade >= 0.999 ? "0" : "1";
      var c = smooth(0.92, 1.0, p);
      ctaRow.style.opacity = String(c);
      ctaRow.style.transform = "translateY(" + ((1 - c) * 16).toFixed(1) + "px)";
      ctaRow.classList.toggle("is-on", c >= 0.5);
      ctaRow.inert = !(c >= 0.5);       // invisible buttons must not be tab stops
      // handle
      var rt = clamp((p - 0.08) / 0.92, 0, 1);
      setHandle(rt);
      /* phones: the dial sits where the CTA row lands, so it bows out before the buttons arrive (desktop keeps 0.97) */
      dragWrap.classList.toggle("is-done", p > (mobile ? 0.9 : 0.97));
      // milestones
      if (!milestone.start && p > 0.1) { milestone.start = true; track("hero_reveal", { stage: "start", "in": inputKind }); }
      if (!milestone.half && p > 0.5) { milestone.half = true; track("hero_reveal", { stage: "half", "in": inputKind }); }
      if (!milestone.done && p > 0.96) { milestone.done = true; track("hero_reveal", { stage: "done", "in": inputKind }); }
      publish();
    }

    var st = ScrollTrigger.create({
      trigger: section, start: "top top", end: "bottom bottom",
      onUpdate: function (self) { setProgress(self.progress); },
      onRefresh: function (self) { setProgress(self.progress); }
    });
    // live-car visibility when the stage is on screen at the end
    ScrollTrigger.create({
      trigger: section, start: "top bottom", end: "bottom top",
      onToggle: function (self) { if (live && liveHost === "unveil") live.setVisible(self.isActive); }
    });
    setProgress(st.progress || 0);

    function scrollToProgress(p, immediate) {
      var y = st.start + clamp(p, 0, 1) * (st.end - st.start);
      if (M.lenis) M.lenis.scrollTo(y, { immediate: !!immediate, duration: 0.8, force: true });
      else window.scrollTo({ top: y, behavior: immediate ? "auto" : "smooth" });
    }

    /* QA / deep-link hook: jump to progress t and resolve once the needed frame is drawn. */
    window.__heroDragTo = function (t) {
      var p = clamp(t, 0, 1);
      var y = st.start + p * (st.end - st.start);
      if (M.lenis) M.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
      setProgress(clamp((window.scrollY - st.start) / (st.end - st.start), 0, 1));
      var need = Math.round(Math.pow(clamp((p - 0.08) / 0.8, 0, 1), 1.35) * (meta.count - 1));
      return new Promise(function (resolve) {
        var tries = 0;
        (function wait() {
          if ((images[need] && images[need].__ok) || tries++ > 160) { drawn = -1; draw(); resolve(); } else setTimeout(wait, 30);
        })();
      });
    };

    /* ---- drag-to-reveal handle (second input; scroll stays the truth) ---- */
    var startAngle = -155 * Math.PI / 180, endAngle = -25 * Math.PI / 180;
    var CIRC = arcFill ? 2 * Math.PI * parseFloat(arcFill.getAttribute("r") || 82) : 0;
    function pivot() { var r = dragWrap.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2, w: r.width, h: r.height, left: r.left, top: r.top }; }
    /* setHandle runs on every scroll frame: it reads cached sizes (refreshed on resize) so it never forces a layout mid-scroll */
    var dial = null;
    function measureDial() { var pv = pivot(); dial = { x: pv.x, y: pv.y, w: pv.w, h: pv.h, hw: handle.offsetWidth, hh: handle.offsetHeight }; }
    function setHandle(t) {
      if (!dial || !dial.w) measureDial();
      var pv = dial, r = Math.min(pv.w, pv.h) / 2 - 24, a = startAngle + (endAngle - startAngle) * t;
      handle.style.transform = "translate3d(" + (pv.x + r * Math.cos(a) - pv.hw / 2).toFixed(1) + "px," + (pv.y + r * Math.sin(a) - pv.hh / 2).toFixed(1) + "px,0)";
      if (arcFill) arcFill.style.strokeDashoffset = String(CIRC * (1 - t));
      handle.setAttribute("aria-valuenow", String(Math.round(t * 100)));
    }
    function tFromPointer(x, y) {
      var pv = pivot();
      var ang = Math.atan2(y - (pv.top + pv.y), x - (pv.left + pv.x));
      var span = endAngle - startAngle, t = (ang - startAngle) / span;
      if (t < -0.5) t += 2 * Math.PI / span;
      if (t > 1.5) t -= 2 * Math.PI / span;
      return clamp(t, 0, 1);
    }
    var dragging = false;
    handle.addEventListener("pointerdown", function (e) {
      dragging = true; inputKind = "drag"; handle.setPointerCapture(e.pointerId); handle.classList.add("is-dragging");
      /* Grabbed before the stage has pinned: the dial still moves with the page, so pin it first (the angle is read from
         where the dial sits afterwards, never from where it was). */
      if (window.scrollY < st.start) scrollToProgress(0, true);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      scrollToProgress(0.08 + 0.92 * tFromPointer(e.clientX, e.clientY), true);
    });
    function endDrag(e) { dragging = false; handle.classList.remove("is-dragging"); try { handle.releasePointerCapture(e.pointerId); } catch (x) {} inputKind = "scroll"; }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", function (e) {
      var cur = clamp((progress - 0.08) / 0.92, 0, 1), next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + 0.08;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - 0.08;
      if (e.key === "PageUp") next = cur + 0.25;
      if (e.key === "PageDown") next = cur - 0.25;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = 1;
      if (next === null) return;
      e.preventDefault(); inputKind = "key";            // Home / End move the dial, not the whole page
      scrollToProgress(0.08 + 0.92 * clamp(next, 0, 1), false);
    });
    window.addEventListener("resize", function () { dial = null; setHandle(clamp((progress - 0.08) / 0.92, 0, 1)); });
    /* the live car finished loading while the visitor sits at the end of the reveal: hand over now */
    document.addEventListener("ca:live-ready", function () { setProgress(progress); });
  }
})();
