/* =========================================================================
   Classic Auto v6: the live 3D showroom car (one WebGL context per page).

   A transparent canvas (alpha, no scene background) sits above the HTML
   wordmark, so the car's pixels occlude the letters. Same camera as the
   Blender render of the cloth frames: position (3.6, 1.7, 4.6), looking at
   (0, 0.6, 0), vertical FOV 32, via setViewOffset so the live car lines up
   with the baked poster at any aspect ratio.

   Input (drag, touch, gyro) goes through a One Euro filter. A horizontal
   swipe orbits; a vertical touch swipe is left to the browser, so the page
   always scrolls (touch-action: pan-y, rule N8).

   Illustrative model: Ferrari 458 Italia by vicent091036 (CC BY 4.0). The
   mesh named yellow_trim carries the shield badges and is always hidden (N4).
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OneEuro } from "./oneEuro.js";
import { sanitizeCarModel } from "./carSanitize.js";

var REF_W = 1280, REF_H = 720;
var TARGET = new THREE.Vector3(0, 0.6, 0);
var START = new THREE.Vector3(3.6, 1.7, 4.6);
var DEG = Math.PI / 180;
var EL_MIN = 5 * DEG, EL_MAX = 35 * DEG;
var AUTO_SPEED = 0.18;       // rad/s
var IDLE_MS = 3000;
var HIDDEN_MESHES = ["yellow_trim"];   // shield badges (rule N4)

export function createLiveCar(opts) {
  opts = opts || {};
  var mobile = !!opts.mobile;
  var reduced = !!opts.reducedMotion;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, REF_W / REF_H, 0.1, 100);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  /* Phones: start at 1.5x (never the device's 3x) and step down to 1x if frames run long (see adapt()). Desktop: unchanged. */
  var dprMax = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2), dprNow = dprMax;
  renderer.setPixelRatio(dprNow);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !mobile;            // phones: a baked contact shadow, no second shadow pass every frame
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var canvas = renderer.domElement;
  canvas.className = "live-car-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.touchAction = "pan-y";

  /* Studio reflections for free (no download): RoomEnvironment through PMREM. */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  /* Lighting: warm key, red + blue rims (the brand), soft fill. */
  scene.add(new THREE.AmbientLight(0x445088, 0.35));
  var key = new THREE.DirectionalLight(0xfff2e0, 2.4);
  key.position.set(4, 6, 4);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0008; key.shadow.radius = 4;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xe11b22, 1.5); rim.position.set(-5, 3, -3); scene.add(rim);
  var rim2 = new THREE.DirectionalLight(0x8fb4ff, 1.0); rim2.position.set(2, 2.4, -5.5); scene.add(rim2);

  /* Shadow catcher: transparent floor so the navy stage shows through. */
  var catcher = new THREE.Mesh(new THREE.CircleGeometry(11, 64), new THREE.ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  if (!mobile) scene.add(catcher);
  /* Phones: a soft elliptical contact shadow under the car (one textured quad, no shadow map). */
  var contact = null;
  if (mobile) {
    var sc = document.createElement("canvas"); sc.width = sc.height = 128;
    var sg = sc.getContext("2d"), grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.78)"); grad.addColorStop(0.55, "rgba(0,0,0,0.42)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
    contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.003; contact.renderOrder = -1;
    scene.add(contact);
  }

  var carGroup = new THREE.Group();
  scene.add(carGroup);

  /* ---- orbit state ---- */
  var rel = START.clone().sub(TARGET);
  var radius = rel.length();
  var azBase = Math.atan2(rel.x, rel.z);                // radians
  var elBase = Math.asin(rel.y / radius);
  var state = {
    az: azBase, el: elBase,          // current (rendered)
    azT: azBase, elT: elBase,        // target
    tiltAz: 0, tiltEl: 0,
    ready: false, visible: true, running: false, dragging: false, lastInput: -1e9,
    loaded: false
  };
  var fx = new OneEuro(1.0, 0.007, 1.0), fy = new OneEuro(1.0, 0.007, 1.0);
  var tiltFx = new OneEuro(1.0, 0.007, 1.0), tiltFy = new OneEuro(1.0, 0.007, 1.0);
  var bodyMaterial = null;
  var meshNames = [];

  function applyCamera() {
    var az = state.az + state.tiltAz, el = Math.min(EL_MAX, Math.max(EL_MIN, state.el + state.tiltEl));
    camera.position.set(
      TARGET.x + radius * Math.cos(el) * Math.sin(az),
      TARGET.y + radius * Math.sin(el),
      TARGET.z + radius * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(TARGET);
  }
  applyCamera();

  /* ---- sizing: the stage element has the same aspect as the baked frame crop ---- */
  var mountEl = null, cropRef = null;
  function coverCrop(aspect) {
    var refA = REF_W / REF_H;
    if (aspect < refA) { var w = REF_H * aspect; return { x: (REF_W - w) / 2, y: 0, w: w, h: REF_H }; }
    var h = REF_W / aspect; return { x: 0, y: (REF_H - h) / 2, w: REF_W, h: h };
  }
  function resize() {
    if (!mountEl) return;
    var w = mountEl.clientWidth, h = mountEl.clientHeight;
    if (!w || !h) return;
    var crop = cropRef || coverCrop(w / h);
    camera.aspect = REF_W / REF_H;
    camera.setViewOffset(REF_W, REF_H, crop.x, crop.y, crop.w, crop.h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    renderOnce();
  }
  var ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(function () { resize(); }) : null;

  function mount(el, crop) {
    if (mountEl && ro) ro.unobserve(mountEl);
    mountEl = el; cropRef = crop || null;
    el.appendChild(canvas);
    if (ro) ro.observe(el);
    resize();
  }

  /* ---- load the model ---- */
  var loading = null;
  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var draco = new DRACOLoader();
      draco.setDecoderPath(opts.dracoPath || "assets/vendor/three/examples/jsm/libs/draco/gltf/");
      var loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      loader.load(opts.modelUrl || "models/car.glb", function (gltf) {
        var root = gltf.scene;
        root.traverse(function (node) {
          if (node.isMesh) {
            meshNames.push(node.name);
            node.castShadow = !mobile;
            if (HIDDEN_MESHES.indexOf(node.name) !== -1) node.visible = false;
            if (node.name === "body" && node.material) {
              var old = node.material;
              /* phones: standard PBR paint (no clearcoat lobe) - same colour and gloss read, about a third less shading work */
              bodyMaterial = mobile
                ? new THREE.MeshStandardMaterial({ color: old.color ? old.color.clone() : new THREE.Color("#d9291c"), metalness: 0.55, roughness: 0.3 })
                : new THREE.MeshPhysicalMaterial({
                  color: old.color ? old.color.clone() : new THREE.Color("#d9291c"),
                  metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04
                });
              node.material = bodyMaterial;
            }
            /* match the baked Blender frames: graphite alloys and dark glass (the raw model has pale silver wheels and a pale screen) */
            if (/^wheel(_\d)?$/.test(node.name) && node.material && node.material.color) { node.material = node.material.clone(); node.material.color.multiplyScalar(0.4); }
            if (node.name === "glass" && node.material && node.material.color) { node.material = node.material.clone(); node.material.color.multiplyScalar(0.3); }
            /* the raw model's alloys (rim_*), carpet and carbon trim are near-white; the baked frames show graphite alloys and a dark cabin,
               so the live car would visibly change colour at the end of the cloth reveal without this */
            if (/^rim_/.test(node.name) && node.material && node.material.color) { node.material = node.material.clone(); node.material.color.setHex(0x3c3e44); node.material.metalness = 0.8; node.material.roughness = 0.4; }
            if ((node.name === "carpet" || /carbon/.test(node.name)) && node.material && node.material.color) { node.material = node.material.clone(); node.material.color.setHex(node.name === "carpet" ? 0x1b1b1d : 0x232428); }
            if ((node.name === "metal" || node.name === "interior_dark") && node.material && node.material.color) { node.material = node.material.clone(); node.material.color.setHex(node.name === "metal" ? 0x34363b : 0x2a2a2d); }
          }
        });
        sanitizeCarModel(root);   // no Ferrari badge anywhere (rule N4)
        var box = new THREE.Box3().setFromObject(root);
        var size = new THREE.Vector3(); box.getSize(size);
        root.scale.setScalar(3.1 / (Math.max(size.x, size.y, size.z) || 1));
        box.setFromObject(root);
        var c = new THREE.Vector3(); box.getCenter(c);
        root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
        carGroup.add(root);
        if (contact) { box.setFromObject(root); var sz = new THREE.Vector3(); box.getSize(sz); contact.scale.set(sz.x * 1.7, sz.z * 1.6, 1); }
        if (bodyMaterial && opts.bodyColor) bodyMaterial.color.set(opts.bodyColor);
        draco.dispose();
        /* compile every shader before the first visible frame, off the main thread where the browser allows it
           (KHR_parallel_shader_compile): the old synchronous compile was a 0.4 to 0.6 s long task on phones */
        var compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function () {}) : Promise.resolve();
        compiled.then(function () {
          state.loaded = true;
          renderOnce();
          resolve();
        });
      }, undefined, reject);
    });
    return loading;
  }

  /* ---- input ---- */
  var pointerId = null, lastX = 0, lastY = 0, isTouch = false;
  function noteInput() { state.lastInput = performance.now(); }
  canvas.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId = e.pointerId; isTouch = e.pointerType !== "mouse";
    lastX = e.clientX; lastY = e.clientY;
    fx.reset(); fy.reset();
    fx.filter(e.clientX, e.timeStamp); fy.filter(e.clientY, e.timeStamp);
    state.dragging = true; noteInput();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!state.dragging || e.pointerId !== pointerId) return;
    var x = fx.filter(e.clientX, e.timeStamp), y = fy.filter(e.clientY, e.timeStamp);
    var dx = x - lastX, dy = y - lastY; lastX = x; lastY = y;
    state.azT -= dx * 0.0062;                       // ~0.36 deg per px
    if (!isTouch) state.elT = Math.min(EL_MAX, Math.max(EL_MIN, state.elT + dy * 0.0035));
    noteInput();
    renderSoon();
  });
  function endDrag(e) {
    if (e && e.pointerId !== pointerId) return;
    state.dragging = false; pointerId = null; noteInput();
    canvas.classList.remove("is-dragging");
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);
  /* Keyboard orbit (the canvas wrapper is focusable in the page). */
  function nudge(dAz) { state.azT += dAz; noteInput(); renderSoon(); }

  /* ---- gyro (phone tilt) ---- */
  var tiltOn = false;
  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    var g = Math.max(-45, Math.min(45, e.gamma)) / 45;          // left/right
    var b = Math.max(-45, Math.min(45, (e.beta - 55))) / 45;    // forward/back around a held-phone neutral
    var t = performance.now();
    state.tiltAz = tiltFx.filter(g * 15 * DEG, t);
    state.tiltEl = tiltFy.filter(-b * 6 * DEG, t);
    renderSoon();
  }
  function enableTilt() {
    if (tiltOn || reduced) return Promise.resolve(false);
    tiltOn = true;
    window.addEventListener("deviceorientation", onOrient, true);
    return Promise.resolve(true);
  }
  function needsTiltPermission() {
    return typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  }
  function requestTilt() {
    if (needsTiltPermission()) {
      return DeviceOrientationEvent.requestPermission().then(function (r) { return r === "granted" ? enableTilt() : false; }, function () { return false; });
    }
    return enableTilt();
  }
  if (!needsTiltPermission() && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) enableTilt();

  /* ---- loop ---- */
  var last = performance.now(), raf = 0, dirty = false;
  var holdUntil = 0;
  function frame(now) {
    raf = 0;
    if (!state.running) return;
    /* phones, mid-swipe: skip the WebGL frame (the car is sliding with the page anyway) so the GPU is free for the scroll itself */
    if (now < holdUntil && !state.dragging) { last = now; prevNow = 0; raf = requestAnimationFrame(frame); return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var idle = now - state.lastInput > IDLE_MS;
    if (!reduced && !state.dragging && idle) state.azT += AUTO_SPEED * dt;
    // exponential smoothing toward the target (frame-rate independent)
    var k = 1 - Math.exp(-10 * dt);
    state.az += (state.azT - state.az) * k;
    state.el += (state.elT - state.el) * k;
    applyCamera();
    renderer.render(scene, camera);
    if (mobile) adapt(now, now - prevNow);
    prevNow = now;
    publish();
    raf = requestAnimationFrame(frame);
  }
  /* Phones: if the average frame over ~0.8 s runs longer than 22 ms (under ~45 fps), drop the canvas resolution one step (1.5x -> 1.25x -> 1x). */
  var prevNow = 0, acc = 0, n = 0, warmUntil = 0, slow = 0;
  function adapt(now, dtMs) {
    if (!(dtMs > 0 && dtMs < 1000)) return;
    if (now < warmUntil) return;                        // skip the first 0.6 s after (re)starting: load work, not rendering
    acc += dtMs; n++;
    if (n < 24 && acc < 800) return;                    // judge every ~24 frames or 0.8 s, whichever comes first
    var avg = acc / n; acc = 0; n = 0;
    slow = avg > 22 ? slow + 1 : 0;
    if (slow >= 2 && dprNow > 1) { slow = 0; dprNow = avg > 40 ? 1 : Math.max(1, dprNow - 0.25); renderer.setPixelRatio(dprNow); resize(); }
  }
  function publish() {
    window.__showroomState = {
      azimuth: state.az + state.tiltAz, azimuthTarget: state.azT, elevation: state.el + state.tiltEl,
      tilt: [state.tiltAz, state.tiltEl], dragging: state.dragging, autoRotating: !state.dragging && (performance.now() - state.lastInput > IDLE_MS),
      loaded: state.loaded, running: state.running, meshes: meshNames, dpr: dprNow, shadows: renderer.shadowMap.enabled, bodyHex: bodyMaterial ? "#" + bodyMaterial.color.getHexString() : null
    };
  }
  function renderOnce() { applyCamera(); renderer.render(scene, camera); publish(); }
  function renderSoon() { if (!state.running) { if (!dirty) { dirty = true; requestAnimationFrame(function () { dirty = false; renderOnce(); }); } } }

  function run() {
    if (state.running || document.hidden || !state.visible) return;
    state.running = true; last = performance.now(); prevNow = 0; acc = 0; n = 0; warmUntil = last + 600; slow = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { state.running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function setVisible(v) { state.visible = v; if (v) run(); else stop(); }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else run(); });
  /* Phones drop WebGL contexts under memory pressure or after a long time in the background. Show the baked poster instead of a
     blank stage until the browser gives the context back. */
  var wasLoaded = false;
  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault(); stop(); wasLoaded = state.loaded; state.loaded = false;
    canvas.classList.remove("is-ready"); document.dispatchEvent(new CustomEvent("ca:live-lost"));
  });
  canvas.addEventListener("webglcontextrestored", function () {
    state.loaded = wasLoaded; if (!wasLoaded) return;
    canvas.classList.add("is-ready"); renderOnce(); run(); document.dispatchEvent(new CustomEvent("ca:live-restored"));
  });

  return {
    canvas: canvas, mount: mount, load: load, setVisible: setVisible, nudge: nudge,
    hold: function (ms) { holdUntil = performance.now() + ms; },
    enableTilt: enableTilt, requestTilt: requestTilt, needsTiltPermission: needsTiltPermission,
    setOpacity: function (v) { canvas.style.opacity = String(v); },
    setBodyColor: function (hex) { if (bodyMaterial) { bodyMaterial.color.set(hex); renderOnce(); } },
    resetPose: function () { state.az = state.azT = azBase; state.el = state.elT = elBase; state.lastInput = performance.now(); renderOnce(); },
    scene: scene, camera: camera, state: state, renderOnce: renderOnce, resize: resize, renderer: renderer
  };
}
