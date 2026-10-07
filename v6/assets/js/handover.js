/* =========================================================================
   Classic Auto v6: chapter 05 / THE KEYS (home), and the orbit-line motif.

   - .orbit motifs (thin rings turning at different speeds) run only while on
     screen; reduced motion keeps them still (CSS).
   - The 3D key (key3d.js) is created when the chapter comes near and torn
     down when it is far away, so the showroom car keeps the page's main WebGL
     context. Without WebGL the line drawing of the key stays in its place.
   Nothing here touches the Showroom, the cloth reveal or the Studio.
   ========================================================================= */
var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var mobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;

function hasWebGL() {
  try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}

(function orbits() {
  var els = document.querySelectorAll(".orbit");
  if (!els.length || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-running"); }); return; }
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { e.target.classList.toggle("is-running", e.isIntersecting); });
  }, { rootMargin: "10% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();

(function handover() {
  var sec = document.getElementById("handoverChapter");
  var stage = document.getElementById("handoverStage");
  if (!sec || !stage) return;
  if (!hasWebGL() || !("IntersectionObserver" in window)) { stage.classList.add("no-webgl"); return; }

  var scene = null, wantScene = false, onScreen = false, loading = false;

  function create() {
    if (scene || loading) return;
    loading = true;
    import("./key3d.js").then(function (mod) {
      loading = false;
      if (!wantScene || scene) return;
      scene = mod.createKeyScene(stage, {
        mobile: mobile, reducedMotion: reduced,
        onSettle: function (on) { sec.classList.toggle("is-settled", on); }
      });
      stage.classList.add("is-live");
      scene.setVisible(onScreen);
      if (reduced) sec.classList.add("is-settled");
    }).catch(function (err) {
      loading = false;
      stage.classList.add("no-webgl");
      if (window.console) console.warn("[handover] 3D key unavailable, keeping the drawing:", err && err.message);
    });
  }
  function destroy() {
    if (!scene) return;
    scene.destroy(); scene = null;
    stage.classList.remove("is-live");
  }

  new IntersectionObserver(function (en) {
    wantScene = en[0].isIntersecting;
    if (wantScene) create(); else destroy();
  }, { rootMargin: "80% 0px" }).observe(stage);

  new IntersectionObserver(function (en) {
    onScreen = en[0].isIntersecting;
    if (scene) scene.setVisible(onScreen);
  }, { rootMargin: "0px" }).observe(stage);

  document.addEventListener("visibilitychange", function () { if (scene) scene.setVisible(onScreen && !document.hidden); });
})();
