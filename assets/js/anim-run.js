/* =========================================================================
   Classic Auto — animation runner. Loaded LAST, deferred, after the GSAP
   CDN tags and after every content-rendering script has already painted
   the page. This file's only job is to decide whether the animation
   functions queued onto window.__anim (by main.js / inventory.js /
   car-detail.js) should run at all.

   Content is never gated on this file: everything is already visible and
   fully styled by the time this executes, so if GSAP failed to load, was
   blocked, or simply hasn't arrived yet, we just do nothing and the page
   stays exactly as it already rendered.
   ========================================================================= */
(function () {
  "use strict";

  var queue = window.__anim || [];
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!window.gsap || prefersReducedMotion) return;

  // Late-arrival guard: if this script is only running long after the page
  // began loading (e.g. a slow/black-holed CDN that eventually resolved),
  // the page has already painted its final content. Re-hiding it now via
  // entrance/hero/reveal animations would just cause the "flash" defect
  // this refactor fixes — so skip them entirely once we're this late. This
  // site has no separate hover/press GSAP affordances (hover states are
  // plain CSS and always work), so there is nothing else left to register.
  var isLate = performance.now() > 2500;
  if (isLate) return;

  if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

  queue.forEach(function (fn) {
    try {
      fn();
    } catch (e) {
      // An animation failure should never break the page.
    }
  });
})();
