/* =========================================================================
   Classic Auto — The Studio — dark reflective-floor 3D viewing bay.
   ES module (three.js r170 via jsdelivr + an import map in studio.html).
   One shared model (models/car.glb — see models/LICENSE.txt, CC BY 4.0)
   is reused for every car; per-car distinction comes from the paint
   swatch (driven by each car's `paint` hex) applied to the "body" mesh's
   material only.
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

var MODEL_URL = "models/car.glb";

var params = new URLSearchParams(window.location.search);
var id = params.get("id");
var CARS_LIST = window.CARS || [];
var car = CARS_LIST.filter(function (c) { return c.id === id; })[0];

var shellEl = document.getElementById("studioShell");
var notFoundEl = document.getElementById("studioNotFound");

if (!car) {
  if (shellEl) shellEl.style.display = "none";
  if (notFoundEl) notFoundEl.style.display = "block";
} else {
  initSidePanel(car);
  initStudio(car);
}

function initSidePanel(car) {
  var fmt = window.ClassicAuto;
  var bodyLabel = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", "luxury-sedan": "Luxury Sedan" }[car.body] || car.body;
  document.title = "Studio — " + fmt.carLabel(car) + " — Classic Auto";
  document.getElementById("studioTitle").textContent = "Private 3D viewing bay — " + fmt.carLabel(car);
  document.getElementById("studioBadge").textContent = bodyLabel + (car.status === "SOLD" ? " · Sold" : "");
  document.getElementById("studioCarName").textContent = car.make + " " + car.model;
  document.getElementById("studioPrice").textContent = fmt.money(car.price);
  document.getElementById("studioMeta").innerHTML = "<span>" + car.year + "</span><span>" + fmt.formatKm(car.kms) + "</span><span>" + car.fuel + "</span>";
  document.getElementById("studioEmi").textContent = fmt.rupees(fmt.emi(car.price)) + "/mo*";
  document.getElementById("backToCarLink").href = "car.html?id=" + encodeURIComponent(car.id);
  document.getElementById("studioVisitBtn").href = "car.html?id=" + encodeURIComponent(car.id) + "#visitSection";
  document.getElementById("studioWaBtn").href = fmt.waLink("Hi, I just looked at the " + fmt.carFullLabel(car) + " in the Studio — is it available for a visit?");

  var swatches = [car.paint, "#101010", "#c9ccd0", "#7a1f1f", "#1b3a6b", "#f5f1e8"];
  var seen = {};
  var paintRow = document.getElementById("paintRow");
  swatches.forEach(function (hex, i) {
    var key = hex.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "paint-swatch";
    btn.style.background = hex;
    btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    btn.setAttribute("aria-label", i === 0 ? "This car's colour, " + hex : "Preview paint " + hex);
    btn.setAttribute("data-hex", hex);
    paintRow.appendChild(btn);
  });
}

function initStudio(car) {
  var bay = document.getElementById("studioBay");
  var loadingEl = document.getElementById("studioLoading");
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a120d);
  scene.fog = new THREE.Fog(0x0a120d, 8, 22);

  var camera = new THREE.PerspectiveCamera(35, bay.clientWidth / Math.max(bay.clientHeight, 1), 0.1, 100);

  // preserveDrawingBuffer: true — a small cost, but it means the canvas can
  // be screenshotted/pixel-sampled from outside the render loop (devtools,
  // automated visual tests) instead of reading back an already-cleared buffer.
  var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(bay.clientWidth, bay.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  bay.insertBefore(renderer.domElement, bay.firstChild);

  // ---- Reflective floor -----------------------------------------------
  var floorGeo = new THREE.CircleGeometry(9, 64);
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x0c130f, roughness: 0.38, metalness: 0.5 });
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  var ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.14, 64), new THREE.MeshBasicMaterial({ color: 0xc9a667, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);

  // ---- Lighting rig ------------------------------------------------------
  var ambient = new THREE.AmbientLight(0x8fa89a, 0.55);
  scene.add(ambient);

  var key = new THREE.DirectionalLight(0xfff1d8, 2.3);
  key.position.set(3.2, 5.2, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 15;
  scene.add(key);

  var rim = new THREE.DirectionalLight(0x8fd3ff, 1.6);
  rim.position.set(-3.5, 3, -4.5);
  scene.add(rim);

  var fill = new THREE.PointLight(0x4f9a77, 0.35, 14, 2);
  fill.position.set(-2, 1.8, 2.5);
  scene.add(fill);

  var lightingState = { evening: false };

  function applyLighting() {
    if (lightingState.evening) {
      scene.background.set(0x05080a);
      scene.fog.color.set(0x05080a);
      ambient.intensity = 0.25;
      key.intensity = 1.3;
      key.color.set(0xffd8a0);
      rim.intensity = 2.0;
      rim.color.set(0x5aa8ff);
      fill.intensity = 0.45;
    } else {
      scene.background.set(0x0a120d);
      scene.fog.color.set(0x0a120d);
      ambient.intensity = 0.55;
      key.intensity = 1.7;
      key.color.set(0xfff1d8);
      rim.intensity = 1.6;
      rim.color.set(0x8fd3ff);
      fill.intensity = 0.35;
    }
  }
  applyLighting();

  // ---- Controls ------------------------------------------------------------
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.6;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.target.set(0, 0.55, 0);

  var CAM_PRESETS = {
    overview: { pos: [3.2, 2.0, 3.7], look: [0, 0.55, 0] },
    front: { pos: [0.01, 1.05, 4.3], look: [0, 0.6, 0] },
    profile: { pos: [4.5, 1.05, 0.01], look: [0, 0.6, 0] },
    rear: { pos: [0.01, 1.05, -4.3], look: [0, 0.6, 0] },
    above: { pos: [0.01, 5.6, 0.02], look: [0, 0, 0] }
  };
  camera.position.set.apply(camera.position, CAM_PRESETS.overview.pos);
  camera.lookAt(new THREE.Vector3(0, 0.55, 0));

  var camTween = null;
  function flyTo(name) {
    var preset = CAM_PRESETS[name];
    if (!preset) return;
    var fromPos = camera.position.clone();
    var fromTarget = controls.target.clone();
    var toPos = new THREE.Vector3(preset.pos[0], preset.pos[1], preset.pos[2]);
    var toTarget = new THREE.Vector3(preset.look[0], preset.look[1], preset.look[2]);
    var duration = prefersReducedMotion ? 1 : 700;
    var start = performance.now();
    controls.enabled = false;
    camTween = function (now) {
      var t = Math.min(1, (now - start) / duration);
      var e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      camera.position.lerpVectors(fromPos, toPos, e);
      controls.target.lerpVectors(fromTarget, toTarget, e);
      if (t >= 1) { camTween = null; controls.enabled = true; }
    };
  }

  document.querySelectorAll("[data-cam]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-cam]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      // Pause auto-rotate so a chosen preset (e.g. Profile) reliably shows
      // that actual angle instead of whatever angle the car has spun to.
      autoRotate = false;
      autoRotateBtn.setAttribute("aria-pressed", "false");
      flyTo(btn.getAttribute("data-cam"));
    });
  });

  // ---- Auto-rotate ------------------------------------------------------
  var carGroup = new THREE.Group();
  scene.add(carGroup);
  var autoRotate = !prefersReducedMotion;
  var autoRotateBtn = document.getElementById("autoRotateBtn");
  autoRotateBtn.setAttribute("aria-pressed", String(autoRotate));
  autoRotateBtn.addEventListener("click", function () {
    autoRotate = !autoRotate;
    autoRotateBtn.setAttribute("aria-pressed", String(autoRotate));
  });

  // ---- Evening/Daylight toggle -------------------------------------------
  var lightBtn = document.getElementById("lightToggleBtn");
  lightBtn.addEventListener("click", function () {
    lightingState.evening = !lightingState.evening;
    lightBtn.setAttribute("aria-pressed", String(lightingState.evening));
    lightBtn.textContent = lightingState.evening ? "Daylight" : "Evening";
    applyLighting();
  });

  // ---- Load model ---------------------------------------------------------
  var bodyMaterial = null;
  // The three.js example car.glb uses KHR_draco_mesh_compression — a
  // DRACOLoader (pointed at three.js's own hosted decoder) is required or
  // GLTFLoader fails to parse the (Draco-compressed) mesh geometry.
  var dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
  var loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    MODEL_URL,
    function (gltf) {
      var root = gltf.scene;
      // three.js's own "webgl_materials_car" example car: the mesh named
      // "body" carries the paintable "Body_Color" material; "glass",
      // "rim_fl"/"rim_fr"/"rim_rl"/"rim_rr" (wheels) and "trim" keep their
      // own materials untouched — only the body takes the paint swatch.
      root.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
          if (node.name === "body" && node.material) bodyMaterial = node.material;
        }
      });

      // Normalise scale/position: fit into a ~3.4-unit footprint, sit on floor.
      var box = new THREE.Box3().setFromObject(root);
      var size = new THREE.Vector3();
      box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var scale = 3.2 / maxDim;
      root.scale.setScalar(scale);

      box.setFromObject(root);
      var center = new THREE.Vector3();
      box.getCenter(center);
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= box.min.y;

      carGroup.add(root);
      if (bodyMaterial) applyPaint(car.paint);

      loadingEl.classList.add("is-hidden");
    },
    undefined,
    function () {
      loadingEl.innerHTML = "<span>Couldn't load the 3D model — please try again shortly.</span>";
    }
  );

  function applyPaint(hex) {
    if (!bodyMaterial) return;
    // Body_Color is a flat baseColorFactor with no texture map, so a
    // straight colour swap reads as true paint (matches three.js's own
    // webgl_materials_car example, which recolors this same material).
    bodyMaterial.color.set(hex);
  }

  document.getElementById("paintRow").addEventListener("click", function (e) {
    var btn = e.target.closest(".paint-swatch");
    if (!btn) return;
    document.querySelectorAll(".paint-swatch").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    btn.setAttribute("aria-pressed", "true");
    applyPaint(btn.getAttribute("data-hex"));
  });

  document.querySelectorAll("[data-finish]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-finish]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      if (!bodyMaterial) return;
      if (btn.getAttribute("data-finish") === "matte") {
        bodyMaterial.roughness = 0.85; bodyMaterial.clearcoat = 0;
      } else {
        bodyMaterial.roughness = 0.25; bodyMaterial.clearcoat = 1;
      }
    });
  });

  // ---- Resize -------------------------------------------------------------
  function onResize() {
    var w = bay.clientWidth, h = bay.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  if (window.ResizeObserver) { new ResizeObserver(onResize).observe(bay); }
  window.addEventListener("resize", onResize);

  // ---- Render loop ----------------------------------------------------------
  function animate(now) {
    requestAnimationFrame(animate);
    if (camTween) camTween(now);
    if (autoRotate && !camTween) carGroup.rotation.y += 0.0035;
    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}
