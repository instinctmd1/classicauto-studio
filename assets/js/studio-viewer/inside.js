/* =========================================================================
   Classic Auto v6 - Studio "Step inside": a seat-height look around the cabin, shown only when a cabin model (.glb) or a
   360 cabin photo (equirectangular .jpg / .webp) exists for the car (models.js, interior_src). Otherwise the Studio's
   "Inside" tab shows the car's own cabin photos.
   Drag looks around; as in the 3D view, a finger's up-and-down move scrolls the page unless the Studio is full screen
   (then it tilts the view). Pinch, ctrl + wheel or +/- zooms the view. Arrow keys look around.
   Its own canvas and renderer, created on first use and rendered on demand.
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

export function initInside(canvas, host, model, mobile) {
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));    // fixed: WebKit blanks on a later change
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1.6, 0.01, 200);
  scene.background = new THREE.Color(0x07090d);
  var look = { yaw: 0, pitch: -0.08, fov: 70 }, raf = 0, on = false, spinOn = false;

  function render() { raf = 0; if (!on) return; camera.fov = look.fov; camera.updateProjectionMatrix(); camera.rotation.set(look.pitch, look.yaw, 0, "YXZ"); renderer.render(scene, camera); }
  function invalidate() { if (!raf && on) raf = requestAnimationFrame(render); }
  function resize() {
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    camera.aspect = w / h; renderer.setSize(w, h, false); invalidate();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);

  var ready;
  if (model.interiorKind === "pano") {
    ready = new Promise(function (res, rej) {
      new THREE.TextureLoader().load(model.interior, function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace; tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = tex; renderer.toneMapping = THREE.NoToneMapping; res(true);
      }, undefined, rej);
    });
  } else {
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.6));
    var draco = new DRACOLoader(); draco.setDecoderPath("assets/vendor/three/examples/jsm/libs/draco/gltf/");
    var loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    ready = new Promise(function (res, rej) {
      loader.load(model.interior, function (g) {
        var root = g.scene, box = new THREE.Box3().setFromObject(root), c = new THREE.Vector3(), s = new THREE.Vector3();
        box.getCenter(c); box.getSize(s);
        root.position.sub(c);                                                  // the camera sits at the cabin's centre, a little up
        camera.position.set(0, s.y * 0.12, 0);
        scene.add(root); draco.dispose(); res(true);
      }, undefined, rej);
    });
  }

  var pts = {}, last = null, pinch = 0;
  canvas.addEventListener("pointerdown", function (e) {
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ks = Object.keys(pts);
    if (ks.length === 2) { var a = pts[ks[0]], b = pts[ks[1]]; pinch = Math.hypot(a.x - b.x, a.y - b.y); last = null; return; }
    last = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== "mouse" };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ks = Object.keys(pts);
    if (ks.length === 2 && pinch) { var a = pts[ks[0]], b = pts[ks[1]], d = Math.hypot(a.x - b.x, a.y - b.y); look.fov = clamp(look.fov * pinch / d, 35, 95); pinch = d; invalidate(); return; }
    if (!last || last.id !== e.pointerId) return;
    var k = (look.fov / 70) * 0.0045;
    look.yaw += (e.clientX - last.x) * k;
    if (!last.touch || host.closest(".is-full")) look.pitch = clamp(look.pitch + (e.clientY - last.y) * k, -1.2, 1.2);
    last.x = e.clientX; last.y = e.clientY; invalidate();
  });
  function end(e) { delete pts[e.pointerId]; pinch = 0; if (last && last.id === e.pointerId) last = null; }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { canvas.addEventListener(n, end); });
  canvas.addEventListener("wheel", function (e) { if (!e.ctrlKey && !e.metaKey && !host.closest(".is-full")) return; e.preventDefault(); look.fov = clamp(look.fov * Math.exp(e.deltaY * 0.001), 35, 95); invalidate(); }, { passive: false });
  canvas.addEventListener("keydown", function (e) {
    var used = true;
    if (e.key === "ArrowLeft") look.yaw += 0.12; else if (e.key === "ArrowRight") look.yaw -= 0.12;
    else if (e.key === "ArrowUp") look.pitch = clamp(look.pitch + 0.08, -1.2, 1.2); else if (e.key === "ArrowDown") look.pitch = clamp(look.pitch - 0.08, -1.2, 1.2);
    else if (e.key === "+" || e.key === "=") look.fov = clamp(look.fov * 0.9, 35, 95); else if (e.key === "-") look.fov = clamp(look.fov * 1.1, 35, 95);
    else used = false;
    if (used) { e.preventDefault(); invalidate(); }
  });

  return {
    ready: ready,
    setActive: function (v) { on = !!v; if (on) { resize(); invalidate(); } },
    spin: function (v) { spinOn = !!v; var t = function () { if (!spinOn || !on) return; look.yaw += 0.01; render(); requestAnimationFrame(t); }; if (spinOn) requestAnimationFrame(t); }
  };
}
