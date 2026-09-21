/* =========================================================================
   Classic Auto — website-v5 — The Studio: a REAL road floor under a real
   sky. Image-based lighting from a captured HDRI (RGBELoader +
   PMREMGenerator), ACES tone mapping + sRGB output, a physically-based
   car paint (MeshPhysicalMaterial with clearcoat), and an asphalt PBR
   road with painted lane lines. See models/LICENSE.txt for every asset's
   source and licence (all Poly Haven, CC0).

   One shared model (models/car.glb — Ferrari 458 Italia, CC BY 4.0, see
   models/LICENSE.txt) is reused for every car; per-car distinction comes
   from the paint swatch (driven by each car's `paint` hex) applied to
   the "body" mesh's material only.
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

var MODEL_URL = "models/car.glb";
var HDRI = { daylight: "assets/hdri/daylight.hdr", evening: "assets/hdri/evening.hdr" };
var ROAD_TEX = {
  diff: "assets/textures/asphalt/asphalt_diff.jpg",
  nor: "assets/textures/asphalt/asphalt_nor.jpg",
  rough: "assets/textures/asphalt/asphalt_rough.jpg"
};

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

  var swatches = [car.paint, "#e11b22", "#101010", "#c9ccd0", "#2b3990", "#f5f1e8"];
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

function buildLaneLineTexture() {
  var c = document.createElement("canvas");
  c.width = 128; c.height = 512;
  var ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  var dashH = 70, gap = 46;
  for (var y = 0; y < c.height; y += dashH + gap) {
    ctx.fillRect(c.width / 2 - 6, y, 12, dashH);
  }
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

function buildContactShadowTexture() {
  var c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  var ctx = c.getContext("2d");
  var g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.7, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function initStudio(car) {
  var bay = document.getElementById("studioBay");
  var loadingEl = document.getElementById("studioLoading");
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(35, bay.clientWidth / Math.max(bay.clientHeight, 1), 0.05, 100);

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

  var pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // ---- Real road floor: asphalt PBR triplet + painted lane lines --------
  var texLoader = new THREE.TextureLoader();
  var diffMap = texLoader.load(ROAD_TEX.diff);
  var norMap = texLoader.load(ROAD_TEX.nor);
  var roughMap = texLoader.load(ROAD_TEX.rough);
  [diffMap, norMap, roughMap].forEach(function (t) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 5);
    t.colorSpace = t === diffMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  });

  var floorGeo = new THREE.CircleGeometry(11, 72);
  var floorMat = new THREE.MeshStandardMaterial({
    map: diffMap, normalMap: norMap, roughnessMap: roughMap,
    roughness: 1, metalness: 0
  });
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  var laneTex = buildLaneLineTexture();
  var laneLines = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 9),
    new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, depthWrite: false })
  );
  laneLines.rotation.x = -Math.PI / 2;
  laneLines.position.set(0, 0.003, -1.2);
  scene.add(laneLines);

  var ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.14, 64), new THREE.MeshBasicMaterial({ color: 0xe11b22, transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  scene.add(ring);

  var contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: buildContactShadowTexture(), transparent: true, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005;
  scene.add(contactShadow);

  // ---- Lighting rig — a directional "sun" matched roughly to each HDRI,
  // topped up by the HDRI itself via scene.environment for IBL. ------------
  var ambient = new THREE.AmbientLight(0x8fa8c9, 0.25);
  scene.add(ambient);

  var key = new THREE.DirectionalLight(0xfff1d8, 2.1);
  key.position.set(3.4, 5.6, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -6; key.shadow.camera.right = 6;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0015;
  scene.add(key);

  var rim = new THREE.DirectionalLight(0x8fd3ff, 1.1);
  rim.position.set(-3.5, 3, -4.5);
  scene.add(rim);

  // ---- HDRI environments (Daylight / Evening) ----------------------------
  var envMaps = {};
  var rgbeLoader = new RGBELoader();
  var lightingState = { evening: false, hdriReady: false };

  function applyLighting() {
    var envMap = lightingState.evening ? envMaps.evening : envMaps.daylight;
    if (envMap) {
      scene.environment = envMap;
      scene.background = envMap;
    }
    if (lightingState.evening) {
      ambient.intensity = 0.12;
      key.intensity = 0.55;
      key.color.set(0xffd8a0);
      key.position.set(-4, 2.4, -3);
      rim.intensity = 1.8;
      rim.color.set(0x5aa8ff);
      renderer.toneMappingExposure = 0.85;
    } else {
      ambient.intensity = 0.25;
      key.intensity = 2.1;
      key.color.set(0xfff1d8);
      key.position.set(3.4, 5.6, 3.2);
      rim.intensity = 1.1;
      rim.color.set(0x8fd3ff);
      renderer.toneMappingExposure = 1.05;
    }
  }

  function loadHDR(name, url) {
    return new Promise(function (resolve) {
      rgbeLoader.load(url, function (tex) {
        var envMap = pmrem.fromEquirectangular(tex).texture;
        tex.dispose();
        envMaps[name] = envMap;
        resolve();
      }, undefined, function () { resolve(); }); // never block the scene on a failed HDRI fetch
    });
  }
  Promise.all([loadHDR("daylight", HDRI.daylight), loadHDR("evening", HDRI.evening)]).then(function () {
    lightingState.hdriReady = true;
    applyLighting();
  });
  // Fallback flat background so the bay isn't black while the ~1.4MB HDRIs stream in.
  scene.background = new THREE.Color(0x0a1220);
  applyLighting();

  // ---- Controls ------------------------------------------------------------
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;      // gives the orbit drag its inertial "glide"
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.target.set(0, 0.55, 0);

  var CAM_PRESETS = {
    overview: { pos: [3.2, 2.0, 3.7], look: [0, 0.55, 0] },
    front: { pos: [0.01, 1.05, 4.3], look: [0, 0.6, 0] },
    profile: { pos: [4.5, 1.05, 0.01], look: [0, 0.6, 0] },
    rear: { pos: [0.01, 1.05, -4.3], look: [0, 0.6, 0] },
    above: { pos: [0.01, 5.6, 0.02], look: [0, 0, 0] },
    // Measured against this model's actual "steering_wheel"/"leather" node
    // positions (~x -0.25, y 0.56-0.6, z -0.24) — see the temp debug block
    // in the model-load callback below. Seated slightly behind/above the
    // wheel, looking forward (+z) through the windscreen.
    interior: { pos: [-0.15, 0.74, -0.18], look: [-0.1, 0.58, 3] }
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
    controls.minDistance = name === "interior" ? 0.02 : 1.2;
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
  var currentFinish = "gloss";
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
      // "body" carries the paintable "Body_Color" material. Everything
      // else (glass, wheels/rims, interior trim) keeps its own material.
      root.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
          if (node.name === "body" && node.material) {
            // Upgrade the flat Standard material to a physically-based
            // clearcoat paint so it actually reads as automotive paint
            // under the HDRI (brief: clearcoat 1, clearcoatRoughness 0.03,
            // metalness 0.55, roughness 0.35).
            var old = node.material;
            var physical = new THREE.MeshPhysicalMaterial({
              color: old.color ? old.color.clone() : new THREE.Color(car.paint),
              metalness: 0.55, roughness: 0.35,
              clearcoat: 1, clearcoatRoughness: 0.03
            });
            node.material = physical;
            bodyMaterial = physical;
          }
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
    bodyMaterial.color.set(hex);
  }

  document.getElementById("paintRow").addEventListener("click", function (e) {
    var btn = e.target.closest(".paint-swatch");
    if (!btn) return;
    document.querySelectorAll(".paint-swatch").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    btn.setAttribute("aria-pressed", "true");
    applyPaint(btn.getAttribute("data-hex"));
    var picker = document.getElementById("paintCustom");
    if (picker) picker.value = btn.getAttribute("data-hex");
  });

  // Native <input type="color"> — full custom colour, alongside the swatches.
  var paintCustom = document.getElementById("paintCustom");
  if (paintCustom) {
    paintCustom.addEventListener("input", function () {
      document.querySelectorAll(".paint-swatch").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      applyPaint(paintCustom.value);
    });
  }

  function setFinish(finish) {
    currentFinish = finish;
    if (!bodyMaterial) return;
    if (finish === "matte") {
      bodyMaterial.roughness = 0.85; bodyMaterial.clearcoat = 0; bodyMaterial.metalness = 0.2;
    } else {
      bodyMaterial.roughness = 0.35; bodyMaterial.clearcoat = 1; bodyMaterial.clearcoatRoughness = 0.03; bodyMaterial.metalness = 0.55;
    }
  }
  document.querySelectorAll("[data-finish]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-finish]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      setFinish(btn.getAttribute("data-finish"));
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

  // Exposed for the automated QA pass (Playwright) to confirm HDRI state
  // without needing to read pixels, and to snap the turntable back to a
  // canonical 0° heading before capturing the "Studio preview" card
  // renders (scripts/gen-studio-previews) so front/profile/rear line up
  // consistently across every car.
  window.__studioState = {
    get hdriReady() { return lightingState.hdriReady; },
    get evening() { return lightingState.evening; },
    get bodyColorHex() { return bodyMaterial ? "#" + bodyMaterial.color.getHexString() : null; },
    resetHeading: function () { carGroup.rotation.y = 0; },
    stopAutoRotate: function () { autoRotate = false; autoRotateBtn.setAttribute("aria-pressed", "false"); }
  };
}
