/* =========================================================================
   Classic Auto v6 - Studio 3D: a per-car model in a private showroom bay (loaded only when a model exists for the car;
   see models.js. Without one the Studio shows the car's own photos and three.js is never downloaded).

   Showroom: an infinity cove (a curved backdrop the floor lightens into, with no horizon line and a soft glow on the wall
              behind the car from wherever you look), a dark glossy floor with the car's reflection in it, a soft light
              pool and contact shadow under the car, a thin Classic Auto ring set into the floor, and car-paint
              reflections from soft-box strips (a small light-former scene, not a photo). Four moods: Studio, Day (a real
              sky in the reflections, CC0 HDRI fetched on first use), Evening (warm, low side light) and Night (one overhead
              pool and cool rim strips). Every mood keeps the same light count and environment size, so a switch never
              recompiles shaders; a short fade hides it.
   Input:     one finger or mouse orbits through a One Euro filter; a vertical swipe scrolls the page (touch-action: pan-y)
              except in full screen; pinch, ctrl + wheel and +/- zoom; arrow keys orbit; any input cancels a camera move.
   Rendering: on demand. The loop stops once the camera settles and wakes on input, a tween, the tour or the turntable.
   Phones:    1.5x pixel ratio at most, no shadow-map pass. Android may step the resolution down when frames run long;
              WebKit (Safari, every iPhone browser) never does: changing the pixel ratio after the first frame blanked the
              canvas there (commit 85afa8a).
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OneEuro } from "../oneEuro.js";

var HDRI = { daylight: "assets/hdri/daylight.hdr" };
var SKY_JPG = { daylight: "assets/hdri/daylight_sky_1k.jpg" };    // phones: the same sky as an 8-bit JPEG (44 KB, not 1.4 MB)
var DEG = Math.PI / 180;
var CAR_LEN = 3.2;                       // the model is scaled so its longest side is this many units
var TWEEN_MS = 800;
var TOUR_STEP = 2.5;                     // seconds per tour stop; 8 stops = 20 s

var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
function expoInOut(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; }
function shortAngle(from, to) { var d = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return from + d; }

/* ---- the four moods. Colours are sRGB hex; intensities are three.js units.
   Bay colours: top / wall / glow paint the curved backdrop (dark above, lit low where it bends into the floor, a soft glow
   on the wall behind the car); floor / floorFar are the floor next to the car and a few car lengths out, after which it
   lightens into the wall colour (also the backdrop's colour below the horizon, so floor and wall meet without a line);
   pool is the light pool under the car; reflect is how much of the car's reflection shows through the floor next to it. ---- */
var MOODS = {
  studio:   { top: "#07080c", wall: "#1d212b", glow: "#6c7894", floor: "#14171d", floorFar: "#0b0c10", pool: "#c9d6ff", poolK: 0.2, reflect: 0.3,
              ring: 0.55, env: 1.0, envScene: { base: "#0a0c10", panels: [[0, 7, 0, 9, 2.4, 1.9, "#ffffff"], [-6, 3, 0, 1.2, 4, 1.3, "#dfe8ff"], [6, 3, 0, 1.2, 4, 1.3, "#fff1e0"], [0, 3, -7, 6, 1.4, 0.9, "#ffffff"]] },
              hemi: 0.35, hemiSky: "#a9b9d8", hemiGround: "#0b0d11", key: 2.1, keyCol: "#fff3e2", keyPos: [3.4, 6, 3.2], rimA: 0.35, rimACol: "#e11b22", rimB: 0.7, rimBCol: "#9cb8ff", exposure: 1.0 },
  daylight: { top: "#9aa3af", wall: "#c9ced5", glow: "#9aa3ad", floor: "#aeb3ba", floorFar: "#bfc3c9", pool: "#ffffff", poolK: 0.1, reflect: 0.2,
              ring: 0.4, env: 1.0, hdri: true,
              hemi: 0.5, hemiSky: "#cfe0f5", hemiGround: "#8a8f96", key: 2.6, keyCol: "#fff6e8", keyPos: [3.4, 6.2, 3.0], rimA: 0, rimACol: "#e11b22", rimB: 0.2, rimBCol: "#cfe0ff", exposure: 1.0 },
  evening:  { top: "#0b070d", wall: "#3a211d", glow: "#e08a4c", floor: "#1b110e", floorFar: "#0f0907", pool: "#ffb27a", poolK: 0.22, reflect: 0.32,
              ring: 0.5, env: 1.1, envScene: { base: "#120a0c", panels: [[-7, 1.6, -2, 1.6, 2.2, 6, "#ffad66"], [0, 7, 0, 7, 1.6, 1.1, "#ffe1c2"], [6, 2.5, 3, 1, 3, 0.35, "#7f8cff"]] },
              hemi: 0.28, hemiSky: "#f0a070", hemiGround: "#120a0a", key: 2.3, keyCol: "#ffa766", keyPos: [-5.5, 2.0, -2.6], rimA: 0, rimACol: "#e11b22", rimB: 0.55, rimBCol: "#8f9bff", exposure: 1.0 },
  night:    { top: "#010205", wall: "#0b1324", glow: "#2f56b0", floor: "#07090e", floorFar: "#030407", pool: "#dfe6ff", poolK: 0.3, reflect: 0.38,
              ring: 0.65, env: 0.9, envScene: { base: "#020306", panels: [[0, 7.5, 0, 3, 3, 1.6, "#ffffff"], [-6, 2, -3, 0.25, 4, 1.2, "#5d86ff"], [6, 2, 3, 0.25, 4, 1.2, "#5d86ff"]] },
              hemi: 0.12, hemiSky: "#6d86c7", hemiGround: "#020304", key: 1.3, keyCol: "#e8eeff", keyPos: [0.6, 7, 0.8], rimA: 0.3, rimACol: "#e11b22", rimB: 0.9, rimBCol: "#5d86ff", exposure: 1.05 }
};

/* contact shadow and light pool: soft radial gradients drawn once */
function radialTexture(stops) {
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var ctx = c.getContext("2d"), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* the ring set into the floor: a thin brand-red line and the name around it, kept quiet. The letters stand with their
   tops toward the car and run clockwise, so the arc nearest the camera reads the right way up (from the front, where the
   Studio opens; the far arc is behind the car). */
function ringTexture() {
  var S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
  var g = c.getContext("2d"), cx = S / 2, r = S * 0.455;
  g.strokeStyle = "rgba(225,27,34,0.9)"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cx, r - 14, 0, Math.PI * 2); g.stroke();
  var text = "CLASSIC AUTO · SINCE 1974 · MALAD WEST, MUMBAI · ";
  g.font = "700 21px Manrope, system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,0.5)"; g.textAlign = "center"; g.textBaseline = "middle";
  var rr = r + 22, full = text + text, step = (Math.PI * 2) / full.length;
  for (var k = 0; k < full.length; k++) {
    var a = Math.PI / 2 + (6 - k) * step;          // "CLASSIC AUTO" centred on the front arc (canvas bottom = the side facing the camera)
    g.save(); g.translate(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); g.rotate(a - Math.PI / 2); g.fillText(full[k], 0, 0); g.restore();
  }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* reflections: a dark room with soft-box strips (what a car photographer's studio looks like to the paint) */
function envScene(spec) {
  var s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.base), side: THREE.BackSide })));
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.base).multiplyScalar(0.5) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; s.add(floor);
  spec.panels.forEach(function (p) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), new THREE.MeshBasicMaterial({ color: new THREE.Color(p[6]).multiplyScalar(3) }));
    m.position.set(p[0], p[1], p[2]); s.add(m);
  });
  return s;
}

export function initStudio3D(car, model, ui) {
  /* ui: { $, bay, canvas, loadingEl, reduced, mobile, fmt, track, onReady(info), onFail(why), setPaintUi(bool), SITE } */
  var $ = ui.$, bay = ui.bay, canvas = ui.canvas, loadingEl = ui.loadingEl, reduced = ui.reduced, mobile = ui.mobile, fmt = ui.fmt, track = ui.track;
  var isScan = model.kind === "scan";

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { ui.onFail("webgl"); return null; }
  var dprNow = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dprNow);
  var canAdapt = mobile && navigator.vendor !== "Apple Computer, Inc.";
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1.6, 0.05, 120);
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envs = {};
  function envFor(m) { if (!envs[m] && MOODS[m].envScene) envs[m] = pmrem.fromScene(envScene(MOODS[m].envScene), 0.04).texture; return envs[m]; }
  envFor("studio");

  /* ---- the bay: a curved backdrop (cyclorama), the floor, the car's reflection, light pool, ring, contact shadow.
     Backdrop and floor are unlit shaders (no lights, no shadow pass, one draw each): they cost the same on a phone as on
     a laptop and a coloured rim light can never leave a hot spot on the floor. A tiny dither stops gradient banding. They skip tone mapping, so the bay shows the hex colours in MOODS as written. ---- */
  var DITHER = "float dith(){ return (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }";
  var backMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, wall: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
                view: { value: new THREE.Vector2(0, -1) }, k: { value: 1 } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: [
      "uniform vec3 top; uniform vec3 wall; uniform vec3 glow; uniform vec2 view; uniform float k; varying vec3 vDir;", DITHER,
      "void main(){ float y = vDir.y;",
      "  vec3 c = mix(wall, top, smoothstep(0.02, 0.75, y));",                                  // lit low on the curve, dark up high
      "  float behind = dot(normalize(vDir.xz + 1e-5), view);",                                   // 1 straight behind the car from where you stand
      "  float g = exp(-pow((max(y, 0.0) - 0.12) * 3.2, 2.0)) * smoothstep(-0.2, 1.0, behind);",  // the soft glow on the wall behind the car
      "  c = mix(c, wall, smoothstep(0.03, -0.03, y));",                                          // below the horizon: the floor's far edge, same colour
      "  c += glow * g * 0.3;",
      "  gl_FragColor = vec4(c * k + dith(), 1.0);",
      "  #include <tonemapping_fragment>",
      "  #include <colorspace_fragment>",
      "}"].join("\n"),
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false
  });
  var backdrop = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 24), backMat); backdrop.renderOrder = -10; scene.add(backdrop);

  /* the floor: a dark gloss. Next to the car it lets the mirrored car underneath show through (the reflection); further out it
     turns solid and lightens into the wall colour, which is also the backdrop's colour below the horizon, so floor and wall
     meet without a line, like a photographer's infinity cove. */
  var floorMat = new THREE.ShaderMaterial({
    uniforms: { fNear: { value: new THREE.Color() }, fFar: { value: new THREE.Color() }, wall: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, view: { value: new THREE.Vector2(0, -1) }, pool: { value: new THREE.Color() }, poolK: { value: 0.2 },
                refl: { value: 0.3 }, len: { value: CAR_LEN }, k: { value: 1 } },
    vertexShader: "varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: [
      "uniform vec3 fNear; uniform vec3 fFar; uniform vec3 wall; uniform vec3 glow; uniform vec2 view; uniform vec3 pool; uniform float poolK; uniform float refl; uniform float len; uniform float k; varying vec2 vXZ;", DITHER,
      "void main(){ float d = length(vXZ);",
      "  vec3 c = mix(fNear, fFar, smoothstep(len * 0.5, len * 2.0, d));",
      "  float behind = dot(normalize(vXZ + 1e-5), view);",
      "  vec3 cove = wall + glow * 0.3 * 0.863 * smoothstep(-0.2, 1.0, behind);",                // what the backdrop shows at the horizon
      "  c = mix(c, cove, smoothstep(len * 1.0, len * 6.5, d));",                                // the floor lightens into the curve of the wall (an infinity cove)
      "  vec2 q = vXZ / vec2(len * 0.42, len * 0.68);",                                           // an oval pool of light, longer than the car is wide
      "  c += pool * poolK * exp(-dot(q, q));",
      "  float a = mix(1.0 - refl, 1.0, smoothstep(len * 0.3, len * 1.1, d));",
      "  gl_FragColor = vec4(c * k + dith(), a);",
      "  #include <tonemapping_fragment>",
      "  #include <colorspace_fragment>",
      "}"].join("\n"),
    transparent: true, depthWrite: false, fog: false, toneMapped: false
  });
  var floor = new THREE.Mesh(new THREE.CircleGeometry(44, 96), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -2; scene.add(floor);
  var shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.4 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.003; shadowCatcher.receiveShadow = true; shadowCatcher.visible = !mobile; scene.add(shadowCatcher);
  var ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, opacity: 0.5 });
  var ring = new THREE.Mesh(new THREE.PlaneGeometry(CAR_LEN * 2.05, CAR_LEN * 2.05), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0025; ring.renderOrder = -1; scene.add(ring);
  var contact = new THREE.Mesh(new THREE.PlaneGeometry(CAR_LEN * 1.45, CAR_LEN * 1.45), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, "rgba(0,0,0,0.75)"], [0.55, "rgba(0,0,0,0.32)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.004; contact.scale.set(0.62, 1, 1); scene.add(contact);

  var hemi = new THREE.HemisphereLight(0xa9b9d8, 0x0b0d11, 0.35); scene.add(hemi);
  var key = new THREE.DirectionalLight(0xfff3e2, 2);
  key.position.set(3.4, 6, 3.2); key.castShadow = !mobile;
  key.shadow.mapSize.set(1536, 1536); key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0012; key.shadow.radius = 4; scene.add(key);
  var rimA = new THREE.DirectionalLight(0xe11b22, 0.5); rimA.position.set(-5, 3, -3); scene.add(rimA);
  var rimB = new THREE.DirectionalLight(0x9cb8ff, 0.7); rimB.position.set(3, 2.4, -5.5); scene.add(rimB);
  var spot = new THREE.SpotLight(0xffe2b8, 0, 14, 0.35, 0.7, 1.4);           // the entrance sweep
  spot.position.set(2.6, 4.2, 0.4); scene.add(spot); scene.add(spot.target);

  var mode = "studio", rig = 1;
  var C = function (hex) { return new THREE.Color(hex); };
  function applyRig() {
    var m = MOODS[mode];
    scene.environment = envs[mode] || envs.studio;
    scene.environmentIntensity = m.env * rig;
    scene.background = null;
    var U = backMat.uniforms, F = floorMat.uniforms;
    U.top.value.copy(C(m.top)); U.wall.value.copy(C(m.wall)); U.glow.value.copy(C(m.glow)); U.k.value = 0.12 + 0.88 * rig;
    F.fNear.value.copy(C(m.floor)); F.fFar.value.copy(C(m.floorFar)); F.wall.value.copy(C(m.wall)); F.glow.value.copy(C(m.glow)); F.pool.value.copy(C(m.pool)); F.poolK.value = m.poolK * rig; F.refl.value = m.reflect; F.k.value = U.k.value;
    ringMat.opacity = m.ring * (0.2 + 0.8 * rig);
    hemi.intensity = m.hemi * rig; hemi.color.copy(C(m.hemiSky)); hemi.groundColor.copy(C(m.hemiGround));
    key.intensity = m.key * rig; key.color.copy(C(m.keyCol)); key.position.set(m.keyPos[0], m.keyPos[1], m.keyPos[2]);
    rimA.intensity = m.rimA * rig; rimA.color.copy(C(m.rimACol)); rimB.intensity = m.rimB * rig; rimB.color.copy(C(m.rimBCol));
    renderer.toneMappingExposure = m.exposure;
    if (mirror) mirror.visible = true;
  }

  /* ---- orbit: camera = f(az, el, r, target) ---- */
  var orb = { az: 0.8, el: 0.4, r: 5.4, tx: 0, ty: 0.3, tz: 0 };
  var tgt = { az: 0.8, el: 0.4, r: 5.4 };
  var EL_MIN = 0.03, EL_MAX = 1.5, R_MIN = 0.22, R_MAX = 10;
  var tilt = { az: 0, el: 0, on: false };
  function applyCamera() {
    var az = orb.az + tilt.az, el = clamp(orb.el + tilt.el, EL_MIN, EL_MAX), r = orb.r;
    camera.position.set(orb.tx + r * Math.cos(el) * Math.sin(az), orb.ty + r * Math.sin(el), orb.tz + r * Math.cos(el) * Math.cos(az));
    camera.lookAt(orb.tx, orb.ty, orb.tz);
    backMat.uniforms.view.value.set(-Math.sin(az), -Math.cos(az)); floorMat.uniforms.view.value.copy(backMat.uniforms.view.value);
  }
  function fromView(pos, look) {
    var v = pos.clone().sub(look), r = v.length();
    return { az: Math.atan2(v.x, v.z), el: Math.asin(clamp(v.y / r, -1, 1)), r: r, tx: look.x, ty: look.y, tz: look.z };
  }

  var carGroup = new THREE.Group(); scene.add(carGroup);
  var mirror = null, paintMats = [], rimMats = [], root = null, finish = "gloss", paintMetal = false;
  var anchors = null, presets = null, selected = null;

  /* ---- render on demand ---- */
  var raf = 0, dirty = true, last = performance.now(), dragging = false, active3d = true;
  var tween = null, tour = null, intro = null, turntable = false, spinQA = false;
  function invalidate() { dirty = true; if (!raf && active3d) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  var gate = null;
  function frame(now) {
    raf = 0;
    if (gate || !active3d) return;
    dirty = false;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var active = false;
    if (intro) active = stepIntro(now) || active;
    if (tour) active = stepTour(now) || active;
    if (tween) {
      var t = Math.min(1, (now - tween.t0) / tween.ms), e = expoInOut(t), f = tween.from, g = tween.to;
      orb.az = f.az + (g.az - f.az) * e; orb.el = f.el + (g.el - f.el) * e; orb.r = f.r + (g.r - f.r) * e;
      orb.tx = f.tx + (g.tx - f.tx) * e; orb.ty = f.ty + (g.ty - f.ty) * e; orb.tz = f.tz + (g.tz - f.tz) * e;
      tgt.az = orb.az; tgt.el = orb.el; tgt.r = orb.r;
      if (t >= 1) { var done = tween.done; tween = null; if (done) done(); } else active = true;
    } else {
      if ((turntable || spinQA) && !dragging && !tour) { tgt.az -= (spinQA ? 1.2 : 0.35) * dt; active = true; }
      var k = 1 - Math.exp(-10 * dt);
      orb.az += (tgt.az - orb.az) * k; orb.el += (tgt.el - orb.el) * k; orb.r += (tgt.r - orb.r) * k;
      if (Math.abs(tgt.az - orb.az) > 1e-4 || Math.abs(tgt.el - orb.el) > 1e-4 || Math.abs(tgt.r - orb.r) > 1e-3) active = true;
    }
    if (dragging) active = true;
    applyCamera();
    renderer.render(scene, camera);
    if (canAdapt) adapt(now, active);
    placeOverlay();
    if ((active || dirty) && !raf) raf = requestAnimationFrame(frame);
  }
  /* Android phones: frames averaging over 22 ms twice in a row step the resolution down (1.5x, 1.25x, 1x) */
  var aPrev = 0, aAcc = 0, aN = 0, aWarm = 0, aSlow = 0;
  function adapt(now, active) {
    var dt = now - aPrev; aPrev = now;
    if (!active || !(dt > 0 && dt < 1000)) { aAcc = 0; aN = 0; aWarm = now + 400; return; }
    if (now < aWarm) return;
    aAcc += dt; aN++;
    if (aN < 24 && aAcc < 800) return;
    var avg = aAcc / aN; aAcc = 0; aN = 0;
    aSlow = avg > 22 ? aSlow + 1 : 0;
    if (aSlow >= 2 && dprNow > 1) { aSlow = 0; dprNow = avg > 40 ? 1 : Math.max(1, dprNow - 0.25); renderer.setPixelRatio(dprNow); resize(); }
  }
  var size = { w: 1, h: 1 };
  function resize() {
    var w = bay.clientWidth, h = bay.clientHeight;
    if (!w || !h) return;
    size.w = w; size.h = h;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    invalidate();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(bay);
  window.addEventListener("resize", resize);
  resize();

  function viewFit(close) { var a = camera.aspect || 1.6, f = Math.max(1, 1.2 / a); return close ? 1 + (f - 1) * 0.5 : f; }
  function flyTo(v, ms, done) {
    cancelTween();
    var to = { az: shortAngle(orb.az, v.az), el: v.el, r: v.r, tx: v.tx, ty: v.ty, tz: v.tz };
    if (reduced || ms <= 0) { Object.assign(orb, to); tgt.az = to.az; tgt.el = to.el; tgt.r = to.r; invalidate(); if (done) done(); return; }
    tween = { from: Object.assign({}, orb), to: to, t0: performance.now(), ms: ms, done: done };
    invalidate();
  }
  function cancelTween() { if (tween) { tween = null; tgt.az = orb.az; tgt.el = orb.el; tgt.r = orb.r; } }

  /* ------------------------------------------------------------------ model */
  var draco = new DRACOLoader(); draco.setDecoderPath("assets/vendor/three/examples/jsm/libs/draco/gltf/");
  draco.preload();
  var loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  var loadingText = loadingEl.querySelector("span");
  function onProgress(e) {
    if (!loadingText || !e || !e.total) return;
    var pct = Math.min(99, Math.floor(e.loaded / e.total * 100));
    loadingText.textContent = pct >= 99 ? "Preparing the 3D view…" : "Loading the 3D model… " + pct + "%";
  }
  function load(url) { return new Promise(function (res, rej) { loader.load(url, res, onProgress, rej); }); }
  var first = mobile && model.srcLite ? load(model.srcLite).catch(function () { return load(model.src); }) : load(model.src);
  var ready = first.then(onModel, function () { ui.onFail("load"); return false; });

  function onModel(gltf) {
    root = gltf.scene;
    root.traverse(function (n) {
      if (!n.isMesh) return;
      n.castShadow = true;
      if (isScan || !n.material) return;
      var mats = Array.isArray(n.material) ? n.material : [n.material];
      var nm = (n.name + " " + mats.map(function (x) { return x.name || ""; }).join(" ")).toLowerCase();
      /* paint and wheel previews work only on models whose paint and rims are named as such */
      if (/(^|[^a-z])(body|paint|carpaint|car_paint)/.test(nm) && !/glass|window|interior|seat|tyre|tire|rubber/.test(nm) && !Array.isArray(n.material)) {
        var old = n.material;
        var pm = new THREE.MeshPhysicalMaterial({ color: old.color ? old.color.clone() : new THREE.Color(car.paint), metalness: 0.05, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, side: old.side, map: old.map || null });
        n.material = pm; paintMats.push(pm);
      }
      if (/(^|[^a-z])(rim|alloy)/.test(nm) && !Array.isArray(n.material)) { n.material = n.material.clone(); rimMats.push(n.material); }
    });
    var box = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(); box.getSize(sz);
    if (sz.x > sz.z) root.rotation.y = Math.PI / 2;                       // nose (longest side) along z
    if (model.rotateY) root.rotation.y += model.rotateY * DEG;
    box.setFromObject(root); box.getSize(sz);
    root.scale.multiplyScalar(CAR_LEN / (Math.max(sz.x, sz.y, sz.z) || 1));
    box.setFromObject(root);
    var c = new THREE.Vector3(); box.getCenter(c);
    root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
    carGroup.add(root);
    /* the reflection in the floor: a mirrored copy under the translucent floor (cheaper than a reflection pass, same read for one object) */
    mirror = new THREE.Group(); mirror.scale.y = -1;
    var copy = root.clone(true); copy.traverse(function (n) { if (n.isMesh) n.castShadow = false; });
    mirror.add(copy); scene.add(mirror);
    ui.setPaintUi(!isScan && paintMats.length > 0, !isScan && rimMats.length > 0);
    if (paintMats.length) setPaint(car.paint, /silver|grey|gray|graphite|metallic/i.test(car.colour));
    root.updateMatrixWorld(true);
    buildAnchors(); buildPresets(); buildUi();
    applyRig();
    flyTo(preset("front34"), 0);
    draco.dispose();
    var compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function () {}) : Promise.resolve();
    gate = compiled;
    return compiled.then(function () {
      gate = null;
      loadingEl.classList.add("is-hidden"); setTimeout(function () { loadingEl.hidden = true; }, 420);
      arCheck();
      track("studio_open", { mode: "studio", model: isScan ? "scan" : "same-model" });
      invalidate();
      maybeIntro();
      ui.onReady();
      return true;
    });
  }

  /* ------------------------------------------------------------------ anchors, presets, hotspots */
  function named(re) { var hit = null; root.traverse(function (n) { if (!hit && re.test(n.name)) hit = n; }); return hit; }
  function surface(x, z) {
    var rc = new THREE.Raycaster(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
    var hit = rc.intersectObject(root, true).filter(function (h) { return h.object.visible; })[0];
    return hit ? hit.point.y : null;
  }
  function buildAnchors() {
    var box = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(), W, H, L;
    box.getSize(sz); W = sz.x; H = sz.y; L = sz.z;
    var wl = named(/wheel_?fl|front_?left_?wheel|wheel_?front_?left/i), wr = named(/wheel_?fr|front_?right_?wheel|wheel_?front_?right/i), sw = named(/steering/i);
    var lights = named(/^lights?$|headlight|head_light/i), lb = lights ? new THREE.Box3().setFromObject(lights) : null;
    var wp = [wl, wr].map(function (n) { return n ? n.getWorldPosition(new THREE.Vector3()) : null; });
    if (!wp[0] || !wp[1]) wp = [new THREE.Vector3(-W * 0.46, H * 0.2, L * 0.31), new THREE.Vector3(W * 0.46, H * 0.2, L * 0.31)];
    var headY = lb ? (lb.min.y + lb.max.y) / 2 : H * 0.48, headZ = lb ? lb.max.z : L / 2 - 0.05;
    var headX = lb ? Math.max(0.18, (lb.max.x - lb.min.x) * 0.3) : W * 0.32;
    var swp = sw ? sw.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-W * 0.2, H * 0.62, L * 0.04);
    var yEng = surface(0, L * 0.3), yBoot = surface(0, -L * 0.36);
    anchors = {
      W: W, H: H, L: L, wheelX: Math.max(Math.abs(wp[0].x), Math.abs(wp[1].x)), wheelY: wp[0].y, wheelZ: wp[0].z,
      head: new THREE.Vector3(headX, headY, headZ),
      interior: new THREE.Vector3(swp.x, Math.max(swp.y, H * 0.5), swp.z),
      engine: new THREE.Vector3(0, yEng == null ? H * 0.6 : yEng, L * 0.3),
      boot: new THREE.Vector3(0, yBoot == null ? H * 0.65 : yBoot, -L * 0.36),
      steer: swp
    };
  }
  function buildPresets() {
    var a = anchors, s = a.L / CAR_LEN, hs = Math.max(1, a.H / (CAR_LEN * 0.36)), V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    var mid = V(0, a.H * 0.4, 0), side = Math.sign(a.steer.x) || -1;
    var wheelP = V(a.wheelX, a.wheelY, a.wheelZ), headP = a.head.clone();
    presets = {
      front34:   { label: "Front ¾", pos: V(2.9 * s, 1.35 * s * hs, 3.2 * s), look: mid },
      rear34:    { label: "Rear ¾", pos: V(2.9 * s, 1.3 * s * hs, -3.2 * s), look: mid },
      side:      { label: "Side", pos: V(4.6 * s, 0.85 * s * hs, 0), look: mid },
      top:       { label: "Top", pos: V(0, 6.8 * s, -0.5 * s), look: V(0, 0, 0.1) },
      wheel:     { label: "Wheel", pos: wheelP.clone().add(V(1.15 * s, 0.3 * s, 0.9 * s)), look: wheelP, close: true },
      headlight: { label: "Headlight", pos: headP.clone().add(V(0.9 * s, 0.25 * s, 1.15 * s)), look: headP, close: true }
    };
    if (model.cabin) presets.interior = { label: "Cabin", pos: a.steer.clone().add(V(-side * 0.26 * s, 0.13 * s, -0.55 * s)), look: a.steer.clone().add(V(-side * 0.08 * s, -0.1 * s, 1.6 * s)), inside: true };
    Object.keys(presets).forEach(function (k) {
      var p = presets[k], v = fromView(p.pos, p.look);
      if (p.inside) {
        v.tx = p.pos.x + (p.look.x - p.pos.x) * 0.1; v.ty = p.pos.y + (p.look.y - p.pos.y) * 0.1; v.tz = p.pos.z + (p.look.z - p.pos.z) * 0.1;
        v.r = Math.max(R_MIN, p.pos.distanceTo(new THREE.Vector3(v.tx, v.ty, v.tz)));
      }
      p.v = v;
    });
  }
  function preset(k) { var p = presets[k] || presets.front34; return Object.assign({}, p.v, { r: p.v.r * (p.inside ? 1 : viewFit(p.close)) }); }

  var HOT = [
    { key: "headlights", label: "Headlights", n: "01", title: "Headlights and front end", view: "headlight", at: function () { return anchors.head.clone().setX(sideSign() * anchors.head.x); }, normal: function () { return new THREE.Vector3(0, 0.15, 1); },
      line: function () { return car.year + " " + car.make + " " + car.model + (car.reg_month ? ", registered " + car.reg_month + "." : "."); } },
    { key: "wheels", label: "Wheels", n: "02", title: "Wheels and tyres", view: "wheel", at: function () { return new THREE.Vector3(sideSign() * anchors.wheelX, anchors.wheelY, anchors.wheelZ); }, normal: function () { return new THREE.Vector3(sideSign(), 0.05, 0.1); },
      line: function () { return fmt.formatKm(car.kms) + " driven. Ask us for close-up wheel photos."; } },
    { key: "interior", label: "Interior", n: "03", title: "Cabin and seats", view: "interior", at: function () { return anchors.interior.clone(); }, normal: function () { return new THREE.Vector3(0, 1, 0); },
      line: function () { return car.owners + " owner" + (car.seats ? ", " + car.seats + " seats" : "") + ". " + fmt.transShort(car) + " gearbox."; } },
    { key: "engine", label: "Engine bay", n: "04", title: "Under the bonnet", view: null, at: function () { return anchors.engine.clone(); }, normal: function () { return new THREE.Vector3(0, 0.7, 0.5); },
      frame: function () { var a = anchors, s = a.L / CAR_LEN; return fromView(a.engine.clone().add(new THREE.Vector3(1.5 * s, 1.1 * s, 1.5 * s)), a.engine.clone()); },
      line: function () { return car.fuel + ", " + fmt.transShort(car) + " gearbox, " + fmt.formatKm(car.kms) + " driven."; } },
    { key: "boot", label: "Boot", n: "05", title: "Boot and papers", view: null, at: function () { return anchors.boot.clone(); }, normal: function () { return new THREE.Vector3(0, 0.7, -0.5); },
      frame: function () { var a = anchors, s = a.L / CAR_LEN; return fromView(a.boot.clone().add(new THREE.Vector3(1.5 * s, 1.1 * s, -1.5 * s)), a.boot.clone()); },
      line: function () { return "Insurance: " + fmt.insurance(car).short + "." + (car.rto ? " Registered " + car.rto + "." : ""); } }
  ];
  function sideSign() { return camera.position.x >= 0 ? 1 : -1; }

  var hotLayer = $("studioHotspots"), reticle = $("studioReticle");
  function buildHotspots() {
    HOT.forEach(function (h) {
      if (h.view === "interior" && !presets.interior) h.view = null, h.frame = function () { var a = anchors, s = a.L / CAR_LEN; return fromView(a.interior.clone().add(new THREE.Vector3(1.6 * s, 1.4 * s, 0.6 * s)), a.interior.clone()); };
      var b = document.createElement("button");
      b.type = "button"; b.className = "studio-hotspot"; b.setAttribute("data-hotspot", h.key);
      b.setAttribute("aria-label", h.label + ": show details for the listed car");
      b.setAttribute("aria-pressed", "false"); b.tabIndex = -1;
      b.addEventListener("click", function () { interrupt(); selectHotspot(h.key, true); });
      hotLayer.appendChild(b); h.el = b;
    });
  }
  var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function placeOverlay() {
    if (!anchors || !HOT[0].el) return;
    var w = size.w, h = size.h, calm = !intro && !tour;
    HOT.forEach(function (hs) {
      var p = hs.at(); tmp.copy(p).project(camera);
      var facing = tmp2.copy(camera.position).sub(p).normalize().dot(hs.normal().normalize()) > 0.08;
      hs.screen = { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
      var inside = tmp.z > -1 && tmp.z < 1 && hs.screen.x > 28 && hs.screen.x < w - 28 && hs.screen.y > 56 && hs.screen.y < h - 28;
      var show = calm && facing && inside;
      hs.inside = inside;
      hs.el.style.transform = "translate(" + hs.screen.x.toFixed(1) + "px," + hs.screen.y.toFixed(1) + "px)";
      hs.el.classList.toggle("is-on", show);
      hs.el.tabIndex = show ? 0 : -1;
      hs.el.setAttribute("aria-hidden", show ? "false" : "true");
      hs.visible = show;
    });
    if (selected) {
      var sel = HOT.filter(function (x) { return x.key === selected; })[0];
      if (sel && sel.screen) reticle.style.transform = "translate(" + sel.screen.x.toFixed(1) + "px," + sel.screen.y.toFixed(1) + "px)";
      reticle.classList.toggle("is-on", !!(sel && sel.inside && !intro && !tour));
    }
  }
  function selectHotspot(k, fly) {
    var h = HOT.filter(function (x) { return x.key === k; })[0]; if (!h) return;
    selected = k;
    HOT.forEach(function (x) { x.el.setAttribute("aria-pressed", String(x.key === k)); });
    if (fly) {
      var v = h.view ? preset(h.view) : h.frame();
      if (!h.view) v = Object.assign({}, v, { r: v.r * viewFit(true) });
      flyTo(v, TWEEN_MS);
      setPresetPressed(h.view || null);
    }
    reticle.hidden = false; reticle.classList.remove("is-on"); void reticle.offsetWidth; reticle.classList.add("is-on");
    $("cardKicker").textContent = h.n + " / " + h.label;
    $("cardTitle").textContent = h.title;
    $("cardLine").textContent = h.line();
    $("cardNote").textContent = "Details for the listed car · " + (isScan ? "from this car's 3D scan" : "3D model of the same make and model, not this car");
    $("studioCard").hidden = false;
    track("studio_hotspot", { hotspot: k });
    invalidate();
  }
  function closeCard() {
    selected = null; $("studioCard").hidden = true; reticle.classList.remove("is-on");
    HOT.forEach(function (x) { if (x.el) x.el.setAttribute("aria-pressed", "false"); });
    invalidate();
  }
  $("studioCardClose").addEventListener("click", closeCard);

  /* ------------------------------------------------------------------ UI: presets, moods, paint */
  function setPresetPressed(k) { document.querySelectorAll("[data-cam]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cam") === k)); }); }
  function buildUi() {
    var row = $("studioPresets");
    Object.keys(presets).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip-btn"; b.setAttribute("data-cam", k); b.setAttribute("aria-pressed", k === "front34" ? "true" : "false");
      b.textContent = presets[k].label;
      b.addEventListener("click", function () { interrupt(); closeCard(); setPresetPressed(k); flyTo(preset(k), TWEEN_MS); track("studio_preset", { preset: k }); });
      row.appendChild(b);
    });
    buildHotspots();
  }

  var rgbe = new RGBELoader(), texLoader = new THREE.TextureLoader(), prepared = {}, wanted = null, fadeEl = $("studioFade");
  function chip(m) { return document.querySelector('[data-light="' + m + '"].chip-btn'); }
  function prepare(m) {
    if (!MOODS[m].hdri) { return Promise.resolve(envFor(m)); }
    if (prepared[m]) return prepared[m];
    prepared[m] = new Promise(function (res, rej) {
      if (mobile && SKY_JPG[m]) texLoader.load(SKY_JPG[m], function (tex) { tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace; envs[m] = pmrem.fromEquirectangular(tex).texture; tex.dispose(); res(); }, undefined, rej);
      else rgbe.load(HDRI[m], function (tex) { tex.mapping = THREE.EquirectangularReflectionMapping; envs[m] = pmrem.fromEquirectangular(tex).texture; tex.dispose(); res(); }, undefined, rej);
    }).catch(function (e) { prepared[m] = null; throw e; });
    return prepared[m];
  }
  function pressChips(m) { document.querySelectorAll(".studio-lights [data-light]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-light") === m)); }); }
  function setLoading(m, on) { var b = chip(m); if (b) b.classList.toggle("is-loading", on); if (on) bay.setAttribute("aria-busy", "true"); else bay.removeAttribute("aria-busy"); }
  function setMode(m) {
    if (!MOODS[m]) return;
    wanted = m; pressChips(m);
    var p = prepare(m), slow = setTimeout(function () { if (wanted === m) setLoading(m, true); }, 120);
    p.then(function () {
      clearTimeout(slow); setLoading(m, false);
      if (wanted === m) swap(m);
    }, function () {
      clearTimeout(slow); setLoading(m, false);
      if (wanted !== m) return;
      wanted = mode; pressChips(mode);
      if (window.CA && window.CA.toast) window.CA.toast("Couldn't load that lighting. The current one stays on.");
    });
  }
  function swap(m) {
    function go() {
      mode = m; applyRig(); bay.setAttribute("data-light", m);
      var c = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function () {}) : Promise.resolve();
      gate = c;
      c.then(function () { if (gate === c) gate = null; invalidate(); requestAnimationFrame(function () { if (fadeEl) fadeEl.classList.remove("is-on"); }); });
    }
    if (m === mode) { applyRig(); invalidate(); return; }
    if (reduced || !fadeEl || !root) return go();
    fadeEl.classList.add("is-on");
    setTimeout(go, 160);
  }
  document.querySelectorAll(".studio-lights [data-light]").forEach(function (b) {
    b.addEventListener("click", function () { interrupt(); setMode(b.getAttribute("data-light")); });
  });

  function setPaint(hex, metal) {
    if (!paintMats.length) return;
    paintMats.forEach(function (m) { m.color.set(hex); });
    paintMetal = !!metal; applyFinish(); invalidate();
  }
  function applyFinish() {
    paintMats.forEach(function (m) {
      if (finish === "matte") { m.roughness = 0.85; m.clearcoat = 0; m.metalness = 0.15; }
      else { m.clearcoat = 1; m.clearcoatRoughness = 0.03; m.metalness = paintMetal ? 0.6 : 0.05; m.roughness = paintMetal ? 0.35 : 0.28; }
      m.needsUpdate = true;
    });
  }
  $("paintRow").addEventListener("click", function (e) {
    var b = e.target.closest(".paint-swatch"); if (!b) return;
    document.querySelectorAll("#paintRow .paint-swatch").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    b.setAttribute("aria-pressed", "true"); setPaint(b.getAttribute("data-hex"), b.getAttribute("data-metal") === "1");
    $("paintCustom").value = b.getAttribute("data-hex");
  });
  $("paintCustom").addEventListener("input", function (e) {
    document.querySelectorAll("#paintRow .paint-swatch").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    setPaint(e.target.value, false);
  });
  document.querySelectorAll("[data-finish]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("[data-finish]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true"); finish = b.getAttribute("data-finish"); applyFinish(); invalidate();
    });
  });
  $("wheelRow").addEventListener("click", function (e) {
    var b = e.target.closest(".paint-swatch"); if (!b) return;
    document.querySelectorAll("#wheelRow .paint-swatch").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    b.setAttribute("aria-pressed", "true");
    var hex = b.getAttribute("data-hex");
    rimMats.forEach(function (m) { m.color.set(hex); m.metalness = 0.75; m.roughness = hex === "#101113" ? 0.5 : 0.28; m.needsUpdate = true; });
    invalidate();
  });

  /* ------------------------------------------------------------------ spotlight entrance (once per car; any input skips) */
  var params = new URLSearchParams(window.location.search);
  function introSeen() { try { return sessionStorage.getItem("ca_studio_intro_" + car.id) === "1"; } catch (e) { return false; } }
  function markIntro() { try { sessionStorage.setItem("ca_studio_intro_" + car.id, "1"); } catch (e) { /* private mode */ } }
  function maybeIntro() {
    if (reduced || params.get("intro") === "0" || (introSeen() && params.get("intro") !== "1")) return;
    markIntro();
    intro = { t0: performance.now() };
    rig = 0.03; applyRig(); spot.intensity = 90;
    flyTo(preset("front34"), 0);
    invalidate();
  }
  var SWEEP = 2500, FADE = 900;
  function stepIntro(now) {
    var t = now - intro.t0, L = anchors.L, k = clamp(t / SWEEP, 0, 1), e = expoInOut(k);
    spot.target.position.set(0, 0.35, L * 0.5 - e * L);
    if (t < SWEEP) return true;
    var f = clamp((t - SWEEP) / FADE, 0, 1);
    rig = 0.03 + 0.97 * f; spot.intensity = 90 * (1 - f); applyRig();
    if (f >= 1) { intro = null; rig = 1; spot.intensity = 0; applyRig(); return false; }
    return true;
  }
  function skipIntro() { if (!intro) return; intro = null; rig = 1; spot.intensity = 0; applyRig(); invalidate(); }

  /* ------------------------------------------------------------------ the 20 second tour */
  var TOUR = [
    { k: "front34", t: "Front three-quarter" }, { k: "headlight", t: "Headlights" }, { k: "wheel", t: "Wheels" }, { k: "side", t: "Side profile" },
    { k: "interior", t: "Cabin" }, { k: "rear34", t: "Rear three-quarter" }, { k: "top", t: "From above" }, { k: "front34", t: "Back to the front" }
  ];
  var tourBtn = $("tourBtn");
  function startTour() {
    interrupt(true); closeCard(); hideEnd();
    tour = { t0: performance.now(), i: -1, stops: TOUR.filter(function (s) { return presets[s.k]; }) };
    tourBtn.setAttribute("aria-pressed", "true"); tourBtn.textContent = "Stop the tour";
    $("tourHud").hidden = false; $("tourChapter").hidden = false;
    setPresetPressed(null);
    invalidate();
  }
  function stepTour(now) {
    var stops = tour.stops, el = (now - tour.t0) / 1000, i = Math.min(stops.length - 1, Math.floor(el / TOUR_STEP)), total = stops.length * TOUR_STEP;
    if (i !== tour.i) {
      tour.i = i;
      flyTo(preset(stops[i].k), reduced ? 0 : Math.min(1500, TOUR_STEP * 1000 * 0.6));
      $("tourKicker").textContent = String(i + 1).padStart(2, "0") + " / " + String(stops.length).padStart(2, "0");
      $("tourTitle").textContent = stops[i].t;
      var ch = $("tourChapter"); ch.hidden = true; void ch.offsetWidth; ch.hidden = false;
    }
    $("tourFill").style.transform = "scaleX(" + clamp(el / total, 0, 1).toFixed(4) + ")";
    var clock = String(Math.min(Math.round(total), Math.round(el))).padStart(2, "0") + " / " + Math.round(total) + " s";
    if (clock !== tour.clock) { tour.clock = clock; $("tourClock").textContent = clock; }
    if (el >= total) { endTour(true); return false; }
    return true;
  }
  function endTour(finished) {
    if (!tour) return;
    tour = null;
    tourBtn.setAttribute("aria-pressed", "false"); tourBtn.textContent = "Take the 20 second tour";
    $("tourHud").hidden = true; $("tourChapter").hidden = true;
    track("studio_tour", { done: !!finished });
    if (finished) { $("tourEnd").hidden = false; setPresetPressed("front34"); }
    invalidate();
  }
  function hideEnd() { $("tourEnd").hidden = true; }
  tourBtn.addEventListener("click", function () { if (tour) endTour(false); else startTour(); });
  function interrupt(keepTour) { skipIntro(); if (!keepTour && tour) endTour(false); hideEnd(); }

  /* ------------------------------------------------------------------ turntable, tilt (touch), AR (scans only) */
  var turnBtn = $("turntableBtn");
  turnBtn.hidden = !!reduced;
  turnBtn.addEventListener("click", function () {
    interrupt(); turntable = !turntable; turnBtn.setAttribute("aria-pressed", String(turntable)); if (turntable) setPresetPressed(null); invalidate();
  });
  var tiltBtn = $("tiltBtn"), fa = new OneEuro(1, 0.007, 1), fb = new OneEuro(1, 0.007, 1);
  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    var g = clamp(e.gamma, -45, 45) / 45, b = clamp(e.beta - 55, -45, 45) / 45, t = performance.now();
    tilt.az = fa.filter(g * 15 * DEG, t); tilt.el = fb.filter(-b * 6 * DEG, t); invalidate();
  }
  if (typeof DeviceOrientationEvent !== "undefined" && window.matchMedia && matchMedia("(pointer: coarse)").matches && !reduced) {
    tiltBtn.hidden = false;
    tiltBtn.addEventListener("click", function () {
      if (tilt.on) { tilt.on = false; window.removeEventListener("deviceorientation", onOrient, true); tilt.az = tilt.el = 0; tiltBtn.setAttribute("aria-pressed", "false"); invalidate(); return; }
      var ask = typeof DeviceOrientationEvent.requestPermission === "function" ? DeviceOrientationEvent.requestPermission() : Promise.resolve("granted");
      ask.then(function (r) { if (r !== "granted") return; tilt.on = true; window.addEventListener("deviceorientation", onOrient, true); tiltBtn.setAttribute("aria-pressed", "true"); }, function () {});
    });
  }
  var arBtn = $("arBtn"), SITE = ui.SITE || {};
  function arCheck() { arBtn.hidden = !(SITE.features && SITE.features.ar && isScan); }
  arBtn.addEventListener("click", function () {
    import("../../vendor/model-viewer/model-viewer.min.js").then(function () {
      var mv = document.createElement("model-viewer");
      mv.setAttribute("src", model.src); mv.setAttribute("ar", ""); mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
      mv.setAttribute("ar-scale", "fixed"); mv.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px";
      document.body.appendChild(mv);
      mv.addEventListener("load", function () { if (mv.canActivateAR) mv.activateAR(); else if (window.CA) window.CA.toast("This phone can't open AR."); });
    }, function () { if (window.CA) window.CA.toast("AR isn't set up on this site yet."); });
  });

  /* ------------------------------------------------------------------ pointer, keyboard */
  var fx = new OneEuro(1, 0.007, 1), fy = new OneEuro(1, 0.007, 1);
  var pid = null, lastX = 0, lastY = 0, touchLike = false, pointers = {}, pinch = 0;
  canvas.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    interrupt(); cancelTween();
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pointers).length === 2) { var p = Object.keys(pointers).map(function (k) { return pointers[k]; }); pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); dragging = false; pid = null; return; }
    pid = e.pointerId; touchLike = e.pointerType !== "mouse"; lastX = e.clientX; lastY = e.clientY;
    fx.reset(); fy.reset(); fx.filter(e.clientX, e.timeStamp); fy.filter(e.clientY, e.timeStamp);
    dragging = true; canvas.classList.add("is-dragging");
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
    invalidate();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ks = Object.keys(pointers);
    if (ks.length === 2 && pinch) { var p = ks.map(function (k) { return pointers[k]; }), d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); tgt.r = clamp(tgt.r * (pinch / d), R_MIN, R_MAX); pinch = d; invalidate(); return; }
    if (!dragging || e.pointerId !== pid) return;
    var x = fx.filter(e.clientX, e.timeStamp), y = fy.filter(e.clientY, e.timeStamp);
    var dx = x - lastX, dy = y - lastY; lastX = x; lastY = y;
    tgt.az -= dx * 0.0062;
    /* a finger's vertical move scrolls the page, except in full screen where it tilts the view like a mouse */
    if (!touchLike || bay.closest(".is-full")) tgt.el = clamp(tgt.el + dy * 0.0035, EL_MIN, EL_MAX);
    setPresetPressed(null);
    invalidate();
  });
  function endDrag(e) { delete pointers[e.pointerId]; pinch = 0; if (e.pointerId !== pid) return; dragging = false; pid = null; canvas.classList.remove("is-dragging"); invalidate(); }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { canvas.addEventListener(n, endDrag); });
  canvas.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && !e.metaKey && !bay.closest(".is-full")) return;      // a plain wheel scrolls the page (zooms in full screen)
    e.preventDefault(); interrupt(); cancelTween(); tgt.r = clamp(tgt.r * Math.exp(e.deltaY * 0.002), R_MIN, R_MAX); invalidate();
  }, { passive: false });
  canvas.addEventListener("keydown", function (e) {
    var used = true;
    if (e.key === "ArrowLeft") tgt.az += 0.14; else if (e.key === "ArrowRight") tgt.az -= 0.14;
    else if (e.key === "ArrowUp") tgt.el = clamp(tgt.el + 0.08, EL_MIN, EL_MAX); else if (e.key === "ArrowDown") tgt.el = clamp(tgt.el - 0.08, EL_MIN, EL_MAX);
    else if (e.key === "+" || e.key === "=") tgt.r = clamp(tgt.r * 0.9, R_MIN, R_MAX); else if (e.key === "-") tgt.r = clamp(tgt.r * 1.1, R_MIN, R_MAX);
    else used = false;
    if (used) { e.preventDefault(); interrupt(); cancelTween(); setPresetPressed(null); invalidate(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (tour) endTour(false); closeCard(); hideEnd(); } });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) invalidate(); });

  applyRig();
  return {
    ready: ready,
    setActive: function (on) { active3d = !!on; if (!on) { if (tour) endTour(false); turntable = false; turnBtn.setAttribute("aria-pressed", "false"); } else { resize(); invalidate(); } },
    resize: resize,
    get state() {
      return { mode: mode, model: isScan ? "scan" : "same-model", tour: !!tour, intro: !!intro, tween: !!tween, turntable: turntable, selected: selected,
               envLoaded: Object.keys(envs), rig: rig, dpr: dprNow, shadows: renderer.shadowMap.enabled, paint: paintMats.length ? "#" + paintMats[0].color.getHexString() : null,
               rimHex: rimMats.map(function (m) { return "#" + m.color.getHexString(); }), rendering: !!raf, aspect: camera.aspect,
               hotspots: HOT.map(function (h) { return { key: h.key, visible: !!h.visible }; }), mirror: !!(mirror && mirror.visible), orbit: Object.assign({}, orb) };
    },
    preset: function (k) { setPresetPressed(k); flyTo(preset(k), TWEEN_MS); },
    select: function (k) { selectHotspot(k, true); },
    setMode: setMode, startTour: startTour,
    render: function () { applyCamera(); renderer.render(scene, camera); },
    cameraPosition: function () { return camera.position.toArray(); },
    skip: function () { interrupt(); },
    spin: function (on) { spinQA = !!on; invalidate(); }
  };
}
