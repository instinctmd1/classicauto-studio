/* =========================================================================
   Chapter 00, Ignition: a 1.7 s intro built from the Classic Auto mark's own
   shapes. The red C sweeps across at 8x with a 3px blur, pulls back as the
   three blue A bars slide in along their diagonals, CLASSIC then AUTO track
   in, SINCE 1974 rises, and the mark FLIPs into the header logo slot.

   Once per session (sessionStorage), skippable by button or Esc, never under
   prefers-reduced-motion. The hero poster paints underneath from the first
   frame, so this never delays LCP.
   ========================================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  var el = document.getElementById("intro");
  if (!el) return;
  if (!root.classList.contains("intro-on")) { el.remove(); return; }

  var gsap = window.gsap;
  var brand = document.getElementById("brandMark");
  var done = false;

  function finish(skipped) {
    if (done) return; done = true;
    document.removeEventListener("keydown", onKey);
    root.classList.remove("intro-on");
    if (el.parentNode) el.remove();
    if (brand) { brand.style.opacity = ""; brand.style.transform = ""; }
    window.__introDone = true;
    document.dispatchEvent(new CustomEvent("ca:intro-done", { detail: { skipped: !!skipped } }));
  }
  function onKey(e) { if (e.key === "Escape") skip(); }
  var tl = null;
  function skip() {
    if (done) return;
    if (tl) tl.kill();
    window.__introSkipped = true;
    if (window.CA_TRACK) window.CA_TRACK("intro_skip");
    finish(true);
  }
  document.addEventListener("keydown", onKey);
  var skipBtn = document.getElementById("introSkip");
  if (skipBtn) skipBtn.addEventListener("click", skip);

  if (!gsap) { setTimeout(function () { finish(false); }, 400); return; }

  /* SplitText measures every letter, so it must run after the web fonts are in (fallback-font widths split it wrong).
     Wait for document.fonts.ready, but never more than 300 ms: the hero poster is already painted underneath. */
  var started = false;
  function start() {
    if (started || done) return; started = true;
    var t0 = performance.now();
    var C = el.querySelector("#introC");
    var bars = el.querySelectorAll(".intro-bar");
    var markWrap = el.querySelector("#introMark");

    function split(node) {
      if (window.SplitText) { return new window.SplitText(node, { type: "chars", charsClass: "intro-char" }).chars; }
      return [node];
    }
    var cChars = split(el.querySelector("#introWord1"));
    var aChars = split(el.querySelector("#introWord2"));
    var since = el.querySelector("#introSince");

    gsap.set(el.querySelector("#introWords"), { autoAlpha: 1 });
    gsap.set(C, { svgOrigin: "390 190", scale: 8, x: -2300, opacity: 1 });
    gsap.set(el.querySelector("#introMarkSvg"), { filter: "blur(3px)" });
    gsap.set(bars[0], { x: 260, y: -520, opacity: 0 });
    gsap.set(bars[1], { x: -300, y: -520, opacity: 0 });
    gsap.set(bars[2], { x: 700, opacity: 0 });
    /* "Tracking in" is done with transforms, not letter-spacing, so nothing reflows and the intro adds no layout shift. */
    function spread(chars, em) {
      var n = chars.length, fs = parseFloat(getComputedStyle(chars[0]).fontSize) || 40;
      chars.forEach(function (ch, i) { ch.__fromX = (i - (n - 1) / 2) * em * fs; });
    }
    if (cChars[0] !== el.querySelector("#introWord1")) { spread(cChars, 0.55); spread(aChars, 0.55); }
    cChars.concat(aChars).forEach(function (ch) { gsap.set(ch, { opacity: 0, x: ch.__fromX || 0, filter: "blur(8px)" }); });
    gsap.set(since, { opacity: 0, y: 18 });

    el.classList.add("is-armed");
    tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      onComplete: function () { window.__introMs = Math.round(performance.now() - t0); finish(false); }
    });
    // 0 - 0.45  the C sweeps across the viewport
    tl.to(C, { x: 520, duration: 0.45, ease: "power2.inOut" }, 0);
    // 0.45 - 0.9  it pulls back to full size while the A bars slide in on their diagonals
    tl.to(C, { x: 0, scale: 1, duration: 0.45, ease: "expo.out" }, 0.45);
    tl.to(el.querySelector("#introMarkSvg"), { filter: "blur(0px)", duration: 0.35, ease: "power1.out" }, 0.5);
    tl.to(bars, { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", stagger: 0.06 }, 0.5);
    // 0.9 - 1.25  CLASSIC then AUTO track in
    tl.to(cChars, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.35, stagger: 0.03, ease: "expo.out" }, 0.9);
    tl.to(aChars, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.35, stagger: 0.03, ease: "expo.out" }, 1.0);
    // 1.25 - 1.4  SINCE 1974 rises
    tl.to(since, { opacity: 1, y: 0, duration: 0.25, ease: "expo.out" }, 1.2);
    // 1.4 - 1.7  hand-off: the mark flies into the header logo slot, the stage lifts away
    tl.add(function () {
      if (!brand || !markWrap) return;
      var a = markWrap.getBoundingClientRect(), b = brand.getBoundingClientRect();
      var s = Math.max(0.05, b.width / a.width);
      var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      var dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      gsap.to(markWrap, { x: dx, y: dy, scale: s, duration: 0.3, ease: "power3.inOut" });
      gsap.to(brand, { opacity: 1, duration: 0.2, delay: 0.14, ease: "power1.out" });
    }, 1.4);
    tl.to(el.querySelector("#introWords"), { opacity: 0, y: 12, duration: 0.2, ease: "power2.out" }, 1.4);
    tl.to(el.querySelector("#introSkip"), { opacity: 0, duration: 0.15 }, 1.4);
    tl.to(el, { opacity: 0, duration: 0.25, ease: "power1.out" }, 1.45);
  }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 300); })]).then(start, start);
})();
