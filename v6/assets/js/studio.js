/* =========================================================================
   Classic Auto v6 - The Studio (SPEC 5.1): the closest honest thing to
   seeing the car in person.

   Model:     models/cars/<id>.glb when the importer found a phone scan (car.scan),
              otherwise the illustrative Ferrari 458 (models/car.glb, CC BY 4.0) with the
              N4 label always on screen, badges removed, paint taken from the listed car.
   Light:     Studio (default, no download: RoomEnvironment + navy cyclorama), and three
              outdoor scenes on an asphalt road with lane lines: Day (CC0 sky HDRI fetched only
              when chosen), Evening (painted dusk sky over a city skyline) and Night (painted
              night sky, two street lamps, a wet road). The painted skies are drawn on a canvas,
              so Evening and Night never wait for a download; road textures are small (about
              100 KB on phones). A short fade hides each switch. A warm spotlight sweeps the car
              once per car on entry; any input skips it.
   Input:     one finger or mouse orbits through a One Euro filter, a vertical swipe always
              scrolls the page (touch-action: pan-y, rule N8), arrow keys orbit, any input
              cancels a camera move or the tour.
   Rendering: on demand. The loop stops once the camera settles and wakes on input,
              a tween, the tour or the turntable.
   Floor:     a contact shadow plus a faint mirrored copy of the car under a translucent
              floor on desktop (the Reflector addon is not vendored; for one object a
              mirrored clone gives the same read).
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { sanitizeCarModel } from "./carSanitize.js";
import { OneEuro } from "./oneEuro.js";

var ILLUSTRATIVE = "models/car.glb";
/* phones: the same model with each surface stored once (double-sided materials) instead of twice, no UVs and the badges
   cut out of the file; it renders the same, at 0.60 MB instead of 1.68 MB (tools/make_lite_model.mjs). studio.html
   starts this download early on non-Apple phones. */
var ILLUSTRATIVE_LITE = "models/car-lite.glb";
var HDRI ={ daylight: "assets/hdri/daylight.hdr" };
/* phones: the same sky, tone-mapped once to an 8-bit JPEG (44 KB instead of the 1.4 MB HDR; about 0.3 s on 3G instead of 6 s) */
var SKY_JPG = { daylight: "assets/hdri/daylight_sky_1k.jpg" };
var ROAD_DIR = "assets/textures/asphalt/";
var NAVY = 0x0a1633, BLACK_STAGE = 0x02040a;
var DEG = Math.PI / 180;
var CAR_LEN = 3.2;                       // the model is scaled so its longest side is this many units
var TWEEN_MS = 800;                      // camera presets: 700 to 900 ms
var TOUR_STEP = 2.5;                     // seconds per tour stop; 8 stops = 20 s

var $ = function (id) { return document.getElementById(id); };
var track = function (n, p) { if (window.CA_TRACK) window.CA_TRACK(n, p); };
var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
function expoInOut(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; }
function shortAngle(from, to) { var d = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return from + d; }

var params = new URLSearchParams(window.location.search);
var id = params.get("id");
var CARS_LIST = window.CARS || [];
var car = CARS_LIST.filter(function (c) { return c.id === id; })[0] || (!id ? CARS_LIST[0] : null);
var fmt = window.ClassicAuto;
var SITE = window.CA_SITE || {};
var scanUrl = car && typeof car.scan === "string" && /^models\/cars\/[a-z0-9-]+\.glb$/.test(car.scan) ? car.scan : null;


/* ------------------------------------------------------------------ side panel + CTAs */
var PAINTS = [
  { name: "Signal red", hex: "#e11b22", metal: false },
  { name: "Obsidian black", hex: "#101010", metal: true },
  { name: "Silver", hex: "#c9ccd0", metal: true },
  { name: "Navy blue", hex: "#2b3990", metal: true },
  { name: "Ivory", hex: "#f5f1e8", metal: false }
];
var WHEELS = [
  { name: "Silver", hex: "#b9bcc3" },
  { name: "Graphite", hex: "#3d4048" },
  { name: "Black", hex: "#101113" }
];

function initSidePanel(car) {
  /* The headline never names the listed car: the model in the bay is an illustrative Ferrari, and the car's name, price and details sit in the side panel. */
  document.title = "Studio preview (illustrative model) | Classic Auto";
  $("studioTitle").textContent = "Studio preview (illustrative model)";
  $("studioBadge").textContent = fmt.bodyLabel(car.body) + (car.status === "SOLD" ? " · Sold" : "");
  $("studioCarName").textContent = car.make + " " + car.model;
  var onReq = car.price_on_request || car.price == null;
  $("studioPrice").textContent = onReq ? "Ask for price" : fmt.rupees(car.price);
  $("studioMeta").innerHTML = [["Owner", car.owners], ["Driven", fmt.formatKm(car.kms)], ["Gearbox", fmt.transShort(car)], ["Insurance", fmt.insurance(car).short]]
    .map(function (c) { return '<div class="chip"><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join("");
  $("studioEmi").textContent = onReq ? "-" : fmt.rupees(fmt.emi(car.price)) + "/mo*";
  $("backToCarLink").href = "cars/" + encodeURIComponent(car.id) + "/";

  /* one CTA pair per place it appears (side panel, under the bay on phones, end of tour) */
  var m = window.CA.messageCta();
  var msgText = "Hi Classic Auto, I just looked at the " + fmt.carFullLabel(car) + " in the Studio. Is it available for a visit?";
  var visitHref = "cars/" + encodeURIComponent(car.id) + "/#buy";
  [["studioVisitBtn", "studioMsgBtn"], ["barVisitBtn", "barMsgBtn"], ["endVisitBtn", "endMsgBtn"]].forEach(function (pair) {
    $(pair[0]).href = visitHref;
    var b = $(pair[1]);
    b.textContent = m.label; b.href = SITE.whatsapp ? window.CA.waLink(msgText) : m.href;
    b.target = "_blank"; b.rel = "noopener"; b.setAttribute("data-ca-msg", msgText); b.setAttribute("data-via", m.via);
  });
  if (window.CA.setStickyMessage) window.CA.setStickyMessage(msgText);

  /* paint: this car's own colour first, then brand colours */
  var own = { name: "This car: " + car.colour, hex: car.paint, metal: /silver|grey|gray|graphite|metallic/i.test(car.colour) };
  var list = [own].concat(PAINTS.filter(function (p) { return p.hex.toLowerCase() !== String(car.paint).toLowerCase(); }));
  var paintRow = $("paintRow");
  list.forEach(function (p, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "paint-swatch"; b.style.background = p.hex;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.setAttribute("aria-label", i === 0 ? p.name : "Preview paint: " + p.name);
    b.title = p.name; b.setAttribute("data-hex", p.hex); b.setAttribute("data-metal", p.metal ? "1" : "0");
    paintRow.appendChild(b);
  });
  var wheelRow = $("wheelRow");
  WHEELS.forEach(function (w, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "paint-swatch"; b.style.background = w.hex;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.setAttribute("aria-label", "Wheel finish: " + w.name); b.title = w.name; b.setAttribute("data-hex", w.hex);
    wheelRow.appendChild(b);
  });
}

/* ------------------------------------------------------------------ small canvas textures */
function contactShadowTexture() {
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var ctx = c.getContext("2d"), g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.7)"); g.addColorStop(0.6, "rgba(0,0,0,0.3)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ the studio */
function initStudio(car) {
  var bay = $("studioBay"), canvas = $("studioCanvas"), loadingEl = $("studioLoading");
  var reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var mobile = !!(window.matchMedia && matchMedia("(max-width: 767px), (pointer: coarse)").matches);
  var isScan = false;

  /* ---- renderer (no WebGL: show the listing photo instead of an empty box) ---- */
  var renderer;
  /* Probe first, as the home page does: three.js logs console errors before throwing when no context can be made. */
  var glOk = false;
  try { var probe = document.createElement("canvas"); glOk = !!(window.WebGLRenderingContext && (probe.getContext("webgl2") || probe.getContext("webgl"))); } catch (e) { glOk = false; }
  if (!glOk) { noWebGL(); return; }
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    noWebGL(); return;
  }
  function noWebGL() {
    loadingEl.innerHTML = "<span>3D isn't available on this device. The photos on the car's page show the listed car.</span>";
    $("studioPresets").hidden = true; $("tourBtn").hidden = true; $("turntableBtn").hidden = true;
  }
  /* Phones: 1.5x at most, stepping down to 1x if active frames run long (see adapt()); no shadow-map pass (the soft contact
     shadow under the car stays). Desktop is unchanged. */
  var dprNow = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dprNow);
  /* Safari / every iPhone browser (WebKit): no resolution step-down. Changing the pixel ratio after the first frame left the
     canvas blank there (checked in WebKit on 5 Oct), so Apple browsers keep the fixed 1.5x they had before. */
  var canAdapt = mobile && navigator.vendor !== "Apple Computer, Inc.";
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1.6, 0.05, 100);
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envs = { studio: pmrem.fromScene(new RoomEnvironment(), 0.04).texture };
  scene.background = new THREE.Color(NAVY);
  scene.fog = new THREE.Fog(NAVY, 6, 19);

  /* ---- floor, contact shadow, light rig ---- */
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x0f1d44, roughness: 0.42, metalness: 0.2, transparent: !mobile, opacity: mobile ? 1 : 0.87 });
  var shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
  var floor = new THREE.Mesh(new THREE.CircleGeometry(34, 96), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  var contact = new THREE.Mesh(new THREE.PlaneGeometry(CAR_LEN * 1.5, CAR_LEN * 1.5), new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.004; scene.add(contact);

  var hemi = new THREE.HemisphereLight(0x9db4e8, 0x0a1633, 0.3); scene.add(hemi);
  var key = new THREE.DirectionalLight(0xfff1d8, 2);
  key.position.set(3.4, 5.6, 3.2); key.castShadow = !mobile;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0012; scene.add(key);
  var rimRed = new THREE.DirectionalLight(0xe11b22, 0.9); rimRed.position.set(-5, 3, -3); scene.add(rimRed);
  var rimBlue = new THREE.DirectionalLight(0x8fb4ff, 0.8); rimBlue.position.set(3, 2.4, -5.5); scene.add(rimBlue);
  var spot = new THREE.SpotLight(0xffd9a0, 0, 14, 0.35, 0.7, 1.4);        // entrance sweep: angle .35, penumbra .7
  spot.position.set(2.6, 4.2, 0.4); scene.add(spot); scene.add(spot.target);

  /* ---- the outdoor set: an asphalt road with lane lines, fading out with distance into the sky's own ground tone ---- */
  var texLoader = new THREE.TextureLoader();
  function radialFade(inner) {                                              // white centre -> black edge, for alphaMap
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 128 * inner, 128, 128, 128);
    gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#000");
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  function laneTexture(dashed) {                                            // one strip, fading out at both ends
    var c = document.createElement("canvas"); c.width = 8; c.height = 1024;
    var g = c.getContext("2d");
    for (var y = 0; y < 1024; y++) {
      var d = Math.abs(y - 512) / 512, a = d < 0.45 ? 1 : Math.max(0, 1 - (d - 0.45) / 0.55);
      if (dashed && (Math.floor(y / 52) % 2)) a = 0;
      var v = Math.round(a * 255);
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(0, y, 8, 1);
    }
    return new THREE.CanvasTexture(c);
  }
  var ROAD_R = 40, ROAD_TILE = 4.5;
  var roadMat = new THREE.MeshStandardMaterial({ color: 0x7d7f84, roughness: 1, metalness: 0, transparent: true, depthWrite: false, alphaMap: radialFade(0.3) });
  var road = new THREE.Mesh(new THREE.CircleGeometry(ROAD_R, 96), roadMat);
  road.rotation.x = -Math.PI / 2; road.receiveShadow = !mobile; road.renderOrder = -2;
  var roadSet = new THREE.Group(); roadSet.visible = false; roadSet.add(road); scene.add(roadSet);
  var laneMat = new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.7, metalness: 0, transparent: true, depthWrite: false, alphaMap: laneTexture(false) });
  var dashMat = laneMat.clone(); dashMat.alphaMap = laneTexture(true);
  [[1.62, laneMat], [-1.62, dashMat], [-4.6, laneMat]].forEach(function (l) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 34), l[1]);
    m.rotation.x = -Math.PI / 2; m.position.set(l[0], 0.002, 0); m.renderOrder = -1; m.receiveShadow = !mobile;
    roadSet.add(m);
  });
  var roadTexState = null;                                                  // null | Promise
  function loadRoadTextures() {
    if (roadTexState) return roadTexState;
    var files = mobile ? { map: "road_diff_512.jpg", roughnessMap: "road_rough_512.jpg" }
                       : { map: "road_diff_1k.jpg", roughnessMap: "road_rough_512.jpg", normalMap: "road_nor_512.jpg" };
    roadTexState = Promise.all(Object.keys(files).map(function (k) {
      return new Promise(function (res) {
        texLoader.load(ROAD_DIR + files[k], function (t) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2 * ROAD_R / ROAD_TILE, 2 * ROAD_R / ROAD_TILE);
          t.colorSpace = k === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = mobile ? 2 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
          roadMat[k] = t; res();
        }, undefined, function () { res(); });                          // a missing texture never blocks: the plain asphalt colour stays
      });
    })).then(function () { roadMat.needsUpdate = true; applyRig(); });
    return roadTexState;
  }

  /* ---- street lamps (Night): two poles on the kerb side, each with a warm downlight. The spot lights stay in the scene at zero
     intensity in the other modes, so switching never changes the light count (no shader recompile, no hitch). ---- */
  var lamps = [];
  var poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.6, metalness: 0.6 });
  var headMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  var lampSet = new THREE.Group(); lampSet.visible = false; scene.add(lampSet);
  [-4.2, 4.6].forEach(function (z) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 5.4, 10), poleMat); pole.position.set(-5.5, 2.7, z); lampSet.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.08), poleMat); arm.position.set(-4.9, 5.35, z); lampSet.add(arm);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.22), headMat); head.position.set(-4.35, 5.3, z); lampSet.add(head);
    var sl = new THREE.SpotLight(0xffd9a6, 0, 18, 0.7, 0.75, 1.2);
    sl.position.set(-4.35, 5.25, z); sl.target.position.set(-0.6, 0, z * 0.5);
    scene.add(sl); scene.add(sl.target); lamps.push(sl);
  });

  /* ---- painted skies (equirectangular canvases, 1024 x 512: the same PMREM size as the studio room, so no recompile) ---- */
  var SKIES = {
    evening: { stops: [[0, "#141c3d"], [0.45, "#3a3566"], [0.72, "#9a5a72"], [0.9, "#f0915a"], [1, "#ffc27a"]], ground: "#2a2428", groundTop: "#5a3d3a",
               glow: { u: 0.074, h: 0.006, r: 0.14, c0: "rgba(255,214,150,0.95)", c1: "rgba(255,150,90,0.45)" }, city: { color: "#1a1424", lit: 0.05 } },
    night:   { stops: [[0, "#02040b"], [0.5, "#071230"], [0.82, "#13244f"], [0.95, "#3b3654"], [1, "#6b5048"]], ground: "#07090f", groundTop: "#1d1b24",
               glow: { u: 0.62, h: 0.0, r: 0.22, c0: "rgba(255,170,100,0.30)", c1: "rgba(160,110,120,0.12)" }, stars: 520, city: { color: "#05070d", lit: 0.22 } }
  };
  function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  /* the backdrop is painted at 2048 x 1024 on desktop (1024 x 512 on phones); the lighting copy is always 1024 x 512 */
  function paintSky(kind) {
    var W = mobile ? 1024 : 2048, H = W / 2, u = W / 2048;
    var P = SKIES[kind], half = H / 2, c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"), r = rand(kind === "night" ? 7 : 3);
    var lin = g.createLinearGradient(0, 0, 0, half);
    P.stops.forEach(function (st) { lin.addColorStop(st[0], st[1]); });
    g.fillStyle = lin; g.fillRect(0, 0, W, half + 1);
    var gl = g.createLinearGradient(0, half, 0, H);
    gl.addColorStop(0, P.groundTop); gl.addColorStop(0.1, P.ground); gl.addColorStop(1, P.ground);
    g.fillStyle = gl; g.fillRect(0, half, W, half);
    if (P.stars) for (var i = 0; i < P.stars; i++) {
      var sx = r() * W, sy = Math.pow(r(), 1.4) * half * 0.8, a = 0.25 + r() * 0.75;
      var sz = (r() < 0.12 ? 2.2 : 1.2) * u + 0.6;
      g.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; g.fillRect(sx, sy, sz, sz);
    }
    if (P.glow) for (var k = -1; k <= 1; k++) {
      var gx = P.glow.u * W + k * W, gy = half - P.glow.h * H, gr = P.glow.r * W, rg = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rg.addColorStop(0, P.glow.c0); rg.addColorStop(0.35, P.glow.c1); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg; g.fillRect(gx - gr, gy - gr, 2 * gr, gr + (half - gy) + 2);
    }
    if (P.city) {                                                           // a low skyline on the horizon, a few lit windows
      var x = 0, step = 3 * u + 1;
      while (x < W) {
        var bw = (4 + r() * 11) * u * 1.6, bh = (2 + Math.pow(r(), 2.4) * 14) * u * 1.6;
        g.fillStyle = P.city.color; g.fillRect(x, half - bh, bw, bh + 1);
        if (P.city.lit) for (var wy = half - bh + step; wy < half - 1; wy += step) for (var wx = x + 1; wx < x + bw - 1; wx += step) if (r() < P.city.lit) {
          g.fillStyle = r() < 0.7 ? "rgba(255,206,140,0.85)" : "rgba(200,220,255,0.75)"; g.fillRect(wx, wy, Math.max(1, u), Math.max(1, u));
        }
        x += bw + r() * 2 * u;
      }
    }
    var t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var skies = {};                                                           // backgrounds per outdoor mode

  /* each mode: base intensities (multiplied by rig while the entrance fades up) */
  var MODES = {
    studio:   { env: 0.55, hemi: 0.3,  key: 2.0,  keyCol: 0xfff1d8, keyPos: [3.4, 5.6, 3.2],  red: 0.2, blue: 0.5, exposure: 1.0 },
    daylight: { env: 1.0,  hemi: 0.45, key: 2.6,  keyCol: 0xfff3e0, keyPos: [3.4, 6.2, 3.0],  red: 0,   blue: 0.15, exposure: 1.0,
                outdoor: true, sky: 0xb7d0ec, ground: 0x6b6a66, road: 0xffffff, roadRough: 1, lamps: 0 },
    evening:  { env: 1.5,  hemi: 0.35, key: 2.3,  keyCol: 0xffa766, keyPos: [-5.5, 1.9, -2.6], red: 0,    blue: 0.55, exposure: 1.0,
                outdoor: true, sky: 0x8a6a9a, ground: 0x2a2428, road: 0xd9c4b8, roadRough: 0.9, lamps: 0 },
    night:    { env: 1.3,  hemi: 0.18, key: 0.45, keyCol: 0xa9bcff, keyPos: [-3, 6.5, -2],   red: 0,    blue: 0.3,  exposure: 1.1,
                outdoor: true, sky: 0x24305a, ground: 0x07090f, road: 0xbfc3cc, roadRough: 0.55, lamps: 38 }
  };
  var mode = "studio", rig = 1;
  function applyRig() {
    var m = MODES[mode], out = !!m.outdoor && !!envs[mode];
    scene.environment = envs[mode] || envs.studio;
    scene.environmentIntensity = m.env * rig;
    hemi.intensity = m.hemi * rig; key.intensity = m.key * rig; rimRed.intensity = m.red * rig; rimBlue.intensity = m.blue * rig;
    key.color.setHex(m.keyCol); key.position.set(m.keyPos[0], m.keyPos[1], m.keyPos[2]);
    if (out) { hemi.color.setHex(m.sky); hemi.groundColor.setHex(m.ground); } else { hemi.color.setHex(0x9db4e8); hemi.groundColor.setHex(0x0a1633); }
    renderer.toneMappingExposure = m.exposure;
    var navy = new THREE.Color(BLACK_STAGE).lerp(new THREE.Color(NAVY), rig);
    if (out) {
      scene.background = skies[mode] || envs[mode]; scene.backgroundBlurriness = 0; scene.backgroundIntensity = rig; scene.fog = null;
      roadMat.color.setHex(roadMat.map ? m.road : 0x7d7f84); roadMat.roughness = m.roadRough;
    } else { scene.background = navy; scene.backgroundBlurriness = 0; scene.fog = new THREE.Fog(navy.getHex(), 6, 19); }
    roadSet.visible = out; floor.visible = !out;
    lampSet.visible = out && m.lamps > 0;
    lamps.forEach(function (l) { l.intensity = out ? m.lamps * rig : 0; });
    floor.material = floorMat;
    floorMat.color.setHex(0x0f1d44).multiplyScalar(0.25 + 0.75 * rig);
    contact.visible = true;
    if (mirror) mirror.visible = !out;
  }

  /* ---- orbit state: camera = f(az, el, r, target); everything tweens in these terms ---- */
  var orb = { az: 0.8, el: 0.4, r: 5.4, tx: 0, ty: 0.3, tz: 0 };
  var tgt = { az: 0.8, el: 0.4, r: 5.4 };
  var EL_MIN = 0.03, EL_MAX = 1.5, R_MIN = 0.22, R_MAX = 10;
  var tilt = { az: 0, el: 0, on: false };
  function applyCamera() {
    var az = orb.az + tilt.az, el = clamp(orb.el + tilt.el, EL_MIN, EL_MAX), r = orb.r;
    camera.position.set(orb.tx + r * Math.cos(el) * Math.sin(az), orb.ty + r * Math.sin(el), orb.tz + r * Math.cos(el) * Math.cos(az));
    camera.lookAt(orb.tx, orb.ty, orb.tz);
  }
  function fromView(pos, look) {
    var v = pos.clone().sub(look), r = v.length();
    return { az: Math.atan2(v.x, v.z), el: Math.asin(clamp(v.y / r, -1, 1)), r: r, tx: look.x, ty: look.y, tz: look.z };
  }

  /* ---- scene content filled in when the model arrives ---- */
  var carGroup = new THREE.Group(); scene.add(carGroup);
  var mirror = null, bodyMat = null, rimMats = [], root = null;
  var finish = "gloss", paintMetal = false;
  var anchors = null, presets = null, hotspots = [];
  var glassMat = null;

  /* ---- render-on-demand loop ---- */
  var raf = 0, dirty = true, last = performance.now(), dragging = false;
  var tween = null, tour = null, intro = null, turntable = false, selected = null;
  function invalidate() { dirty = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  var gate = null;                                                          // a Promise while shaders compile; frames wait for it
  function frame(now) {
    raf = 0;
    if (gate) return;
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
      if (turntable && !dragging && !tour) { tgt.az -= 0.35 * dt; active = true; }
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

  /* Phones: over ~24 consecutive active frames (or 0.8 s), an average above 22 ms (under ~45 fps) drops the resolution a step (1.5x, 1.25x, 1x). */
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

  /* ---- camera tweens (interruptible: any drag cancels) ---- */
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
  draco.preload();                                                      // fetch the decoder while the model downloads, not after it
  var loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  /* The loading card counts up while the file downloads, then says what it is doing while the model is unpacked and the
     shaders compile. Hosts that gzip the file report its compressed size, so the count stops at 99 until it is done. */
  var loadingText = loadingEl.querySelector("span");
  function onProgress(e) {
    if (!loadingText || !e || !e.total) return;
    var pct = Math.min(99, Math.floor(e.loaded / e.total * 100));
    loadingText.textContent = pct >= 99 ? "Preparing the 3D view…" : "Loading the 3D model… " + pct + "%";
  }
  function load(url) { return new Promise(function (res, rej) { loader.load(url, res, onProgress, rej); }); }
  function loadIllustrative() { return mobile ? load(ILLUSTRATIVE_LITE).catch(function () { return load(ILLUSTRATIVE); }) : load(ILLUSTRATIVE); }
  (scanUrl ? load(scanUrl).then(function (g) { isScan = true; return g; }, loadIllustrative) : loadIllustrative())
    .then(onModel, function () { loadingEl.innerHTML = "<span>Couldn't load the 3D model. Please try again shortly.</span>"; });

  function onModel(gltf) {
    root = gltf.scene;
    var desktop = !mobile;
    root.traverse(function (n) {
      if (!n.isMesh) return;
      n.castShadow = true;
      if (isScan) return;
      if (n.name === "yellow_trim") n.visible = false;                    // shield badges (rule N4)
      if (n.name === "body" && n.material) {
        var old = n.material;
        bodyMat = new THREE.MeshPhysicalMaterial({ color: old.color ? old.color.clone() : new THREE.Color(car.paint), metalness: 0.05, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, side: old.side });   // the phone model is double-sided
        n.material = bodyMat;
      }
      if (/^rim_/.test(n.name) && n.material) { n.material = n.material.clone(); rimMats.push(n.material); }   // the base material is shared with tyres' hubs and brakes
      if (n.name === "glass" && n.material) {
        glassMat = desktop
          ? new THREE.MeshPhysicalMaterial({ color: 0x0b1018, metalness: 0, roughness: 0.04, transmission: 0.94, thickness: 0.06, ior: 1.45 })
          : new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.4, depthWrite: false, side: n.material.side });
        n.material = glassMat;
      }
    });
    if (!isScan) { sanitizeCarModel(root); root.rotation.y = Math.PI; }     // no Ferrari badge anywhere (rule N4); the model's nose points to -z, turn it to +z
    var box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3(); box.getSize(size);
    if (isScan && size.x > size.z) { root.rotation.y = Math.PI / 2; box.setFromObject(root); box.getSize(size); }   // scans: nose toward +z
    root.scale.multiplyScalar(CAR_LEN / (Math.max(size.x, size.y, size.z) || 1));
    box.setFromObject(root);
    var c = new THREE.Vector3(); box.getCenter(c);
    root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
    carGroup.add(root);
    if (!desktop) { /* phones: no mirrored copy */ } else {
      mirror = new THREE.Group(); mirror.scale.y = -1;
      var copy = root.clone(true); copy.traverse(function (n) { if (n.isMesh) n.castShadow = false; });
      mirror.add(copy); scene.add(mirror);
    }
    if (bodyMat) setPaint(car.paint, /silver|grey|gray|graphite|metallic/i.test(car.colour));
    root.updateMatrixWorld(true);
    buildAnchors(); buildPresets(); buildUi();
    applyRig();
    flyTo(preset("front34"), 0);
    draco.dispose();
    /* Compile every shader before the first frame, off the main thread where the browser supports it (KHR_parallel_shader_compile).
       The old synchronous first-frame compile froze the page for 0.9 to 1.1 s; the loading card stays up until this is done. */
    var compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function () {}) : Promise.resolve();
    gate = compiled;
    compiled.then(function () {
      gate = null;
      loadingEl.classList.add("is-hidden"); setTimeout(function () { loadingEl.hidden = true; }, 420);
      $("studioModelBadge").textContent = isScan ? "3D scan of this car" : "Illustrative 3D model";
      if (isScan) { $("studioCredit").hidden = true; scanLayout(); }
      arCheck();
      track("studio_open", { mode: "studio", model: isScan ? "scan" : "illustrative" });
      window.__studio.ready = true;
      invalidate();
      maybeIntro();
    });
  }

  function scanLayout() { $("paintPanel").hidden = true; $("finishPanel").hidden = true; $("scanNote").hidden = false; }

  /* ------------------------------------------------------------------ anchors, presets, hotspots */
  function meshBox(name) { var m = root.getObjectByName(name); return m ? new THREE.Box3().setFromObject(m) : null; }
  function surface(x, z) {                                                // y of the car's top surface at (x, z)
    var rc = new THREE.Raycaster(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
    var hit = rc.intersectObject(root, true).filter(function (h) { return h.object.visible; })[0];
    return hit ? hit.point.y : null;
  }
  function buildAnchors() {
    var box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3(), W, H, L;
    box.getSize(size); W = size.x; H = size.y; L = size.z;
    var wl = root.getObjectByName("wheel_fl"), wr = root.getObjectByName("wheel_fr"), sw = root.getObjectByName("steering_wheel");
    var lights = meshBox("lights");
    var wp = [wl, wr].map(function (n) { return n ? n.getWorldPosition(new THREE.Vector3()) : null; });
    if (!wp[0] || !wp[1]) wp = [new THREE.Vector3(-W * 0.46, H * 0.18, L * 0.3), new THREE.Vector3(W * 0.46, H * 0.18, L * 0.3)];
    var wheelY = wp[0].y, wheelZ = wp[0].z, wheelX = Math.max(Math.abs(wp[0].x), Math.abs(wp[1].x));
    var headY = lights ? (lights.min.y + lights.max.y) / 2 : H * 0.36, headZ = lights ? lights.max.z : L / 2 - 0.05;
    var headX = lights ? Math.max(0.18, (lights.max.x - lights.min.x) * 0.3) : W * 0.3;
    var swp = sw ? sw.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-W * 0.18, H * 0.62, L * 0.02);
    var yEng = surface(0, L * 0.3), yBoot = surface(0, -L * 0.34);
    anchors = {
      W: W, H: H, L: L, wheelX: wheelX, wheelY: wheelY, wheelZ: wheelZ,
      head: new THREE.Vector3(headX, headY, headZ),
      interior: new THREE.Vector3(swp.x, Math.max(swp.y, H * 0.5), swp.z),
      engine: new THREE.Vector3(0, yEng == null ? H * 0.5 : yEng, L * 0.3),
      boot: new THREE.Vector3(0, yBoot == null ? H * 0.55 : yBoot, -L * 0.34),
      steer: swp
    };
  }
  function buildPresets() {
    var a = anchors, s = a.L / CAR_LEN, V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    var mid = V(0, a.H * 0.34, 0), side = Math.sign(a.steer.x) || -1;
    var wheelP = V(a.wheelX, a.wheelY, a.wheelZ), headP = a.head.clone();
    presets = {
      front34:   { label: "Front ¾", pos: V(2.9 * s, 1.35 * s, 3.2 * s), look: mid },
      rear34:    { label: "Rear ¾", pos: V(2.9 * s, 1.3 * s, -3.2 * s), look: mid },
      side:      { label: "Side", pos: V(4.6 * s, 0.8 * s, 0), look: mid },
      top:       { label: "Top", pos: V(0, 6.8 * s, -0.5 * s), look: V(0, 0, 0.1) },
      wheel:     { label: "Wheel", pos: wheelP.clone().add(V(1.15 * s, 0.3 * s, 0.9 * s)), look: wheelP, close: true },
      headlight: { label: "Headlight", pos: headP.clone().add(V(0.9 * s, 0.25 * s, 1.15 * s)), look: headP, close: true },
      interior:  { label: "Interior", pos: a.steer.clone().add(V(-side * 0.26 * s, 0.13 * s, -0.55 * s)), look: a.steer.clone().add(V(-side * 0.08 * s, -0.1 * s, 1.6 * s)), inside: true }
    };
    Object.keys(presets).forEach(function (k) {
      var p = presets[k], v = fromView(p.pos, p.look);
      if (p.inside) {      // first-person: orbit around a point just ahead of the eyes, so a drag turns the head
        v.tx = p.pos.x + (p.look.x - p.pos.x) * 0.1; v.ty = p.pos.y + (p.look.y - p.pos.y) * 0.1; v.tz = p.pos.z + (p.look.z - p.pos.z) * 0.1;
        v.r = Math.max(R_MIN, p.pos.distanceTo(new THREE.Vector3(v.tx, v.ty, v.tz)));
      }
      p.v = v;
    });
  }
  /* a preset as an orbit view, with the distance re-fitted to the current aspect ratio */
  function preset(k) { var p = presets[k]; return Object.assign({}, p.v, { r: p.v.r * (p.inside ? 1 : viewFit(p.close)) }); }

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
      var b = document.createElement("button");
      b.type = "button"; b.className = "studio-hotspot"; b.setAttribute("data-hotspot", h.key);
      b.setAttribute("aria-label", h.label + ": show details for the listed car");
      b.setAttribute("aria-pressed", "false"); b.tabIndex = -1;
      b.addEventListener("click", function () { interrupt(); selectHotspot(h.key, true); });
      hotLayer.appendChild(b); h.el = b;
    });
  }

  /* world -> bay pixels, hotspot visibility, reticle follow */
  var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function placeOverlay() {
    if (!anchors) return;
    var w = size.w, h = size.h, calm = !intro && !tour;
    HOT.forEach(function (hs) {
      var p = hs.at(); tmp.copy(p).project(camera);
      var facing = tmp2.copy(camera.position).sub(p).normalize().dot(hs.normal().normalize()) > 0.08;
      hs.screen = { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
      var inside = tmp.z > -1 && tmp.z < 1 && hs.screen.x > 28 && hs.screen.x < w - 28 && hs.screen.y > 64 && hs.screen.y < h - 72;   // clear of the lighting chips and the camera chips
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

  function selectHotspot(key, fly) {
    var h = HOT.filter(function (x) { return x.key === key; })[0]; if (!h) return;
    selected = key;
    HOT.forEach(function (x) { x.el.setAttribute("aria-pressed", String(x.key === key)); });
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
    $("cardNote").textContent = "Details for the listed car · " + (isScan ? "from this car's 3D scan" : "3D model is illustrative");
    $("studioCard").hidden = false;
    track("studio_hotspot", { hotspot: key });
    invalidate();
  }
  function closeCard() {
    selected = null; $("studioCard").hidden = true; reticle.classList.remove("is-on");
    HOT.forEach(function (x) { x.el.setAttribute("aria-pressed", "false"); });
    invalidate();
  }
  $("studioCardClose").addEventListener("click", closeCard);

  /* ------------------------------------------------------------------ UI: presets, modes, paint */
  var presetKeys = ["front34", "rear34", "side", "top", "wheel", "headlight", "interior"];
  function setPresetPressed(k) { document.querySelectorAll("[data-cam]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cam") === k)); }); }
  function buildUi() {
    var row = $("studioPresets");
    presetKeys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip-btn"; b.setAttribute("data-cam", k); b.setAttribute("aria-pressed", k === "front34" ? "true" : "false");
      b.textContent = presets[k].label;
      b.addEventListener("click", function () { interrupt(); closeCard(); setPresetPressed(k); flyTo(preset(k), TWEEN_MS); track("studio_preset", { preset: k }); });
      row.appendChild(b);
    });
    buildHotspots();
  }

  /* lighting modes. Day's sky HDRI is fetched on first use only; Evening and Night are painted on the spot. The road textures
     are shared by all three. A pressed chip shows a loading shimmer until its scene is ready; the newest press wins. */
  var rgbe = new RGBELoader(), prepared = {}, wanted = null, fadeEl = $("studioFade");
  function chip(m) { return document.querySelector('.studio-lights [data-light="' + m + '"]'); }
  function prepare(m) {
    if (m === "studio") return Promise.resolve();
    if (prepared[m]) return prepared[m];
    var env;
    if (mobile && SKY_JPG[m]) {
      env = new Promise(function (res, rej) {
        texLoader.load(SKY_JPG[m], function (tex) {
          tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
          skies[m] = tex; envs[m] = pmrem.fromEquirectangular(tex).texture; res();
        }, undefined, rej);
      });
    } else if (HDRI[m]) {
      env = new Promise(function (res, rej) {
        rgbe.load(HDRI[m], function (tex) { tex.mapping = THREE.EquirectangularReflectionMapping; envs[m] = pmrem.fromEquirectangular(tex).texture; skies[m] = tex; res(); }, undefined, rej);
      });
    } else {
      env = new Promise(function (res) {
        requestAnimationFrame(function () {
          skies[m] = paintSky(m);
          var src = skies[m];
          if (src.image.width !== 1024) {                                   // lighting copy at 1024 x 512 (same PMREM size as the room)
            var lc = document.createElement("canvas"); lc.width = 1024; lc.height = 512; lc.getContext("2d").drawImage(src.image, 0, 0, 1024, 512);
            src = new THREE.CanvasTexture(lc); src.mapping = THREE.EquirectangularReflectionMapping; src.colorSpace = THREE.SRGBColorSpace;
          }
          envs[m] = pmrem.fromEquirectangular(src).texture;
          if (src !== skies[m]) src.dispose();
          res();
        });
      });
    }
    /* never wait more than 6 s for the road: without its textures it is plain asphalt colour, still a road */
    var roadReady = Promise.race([loadRoadTextures(), new Promise(function (res) { setTimeout(res, 6000); })]);
    prepared[m] = Promise.all([env, roadReady]).catch(function (e) { prepared[m] = null; throw e; });
    return prepared[m];
  }
  function pressChips(m) {
    document.querySelectorAll(".studio-lights [data-light]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-light") === m)); });
  }
  function setLoading(m, on) { var b = chip(m); if (b) b.classList.toggle("is-loading", on); if (on) bay.setAttribute("aria-busy", "true"); else bay.removeAttribute("aria-busy"); }
  function setMode(m) {
    if (!MODES[m]) return;
    wanted = m;
    pressChips(m);
    var p = prepare(m), slow = setTimeout(function () { if (wanted === m) setLoading(m, true); }, 120);
    p.then(function () {
      clearTimeout(slow); setLoading(m, false);
      if (wanted !== m) return;
      swap(m);
    }, function () {
      clearTimeout(slow); setLoading(m, false);
      if (wanted !== m) return;
      wanted = mode; pressChips(mode);
      if (window.CA && window.CA.toast) window.CA.toast("Couldn't load that scene. The current lighting stays on.");
    });
  }
  function swap(m) {
    function go() {
      mode = m; applyRig(); bay.setAttribute("data-light", m);
      /* compile any new shader before the first frame (off the main thread where supported), then show it */
      var c = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function () {}) : Promise.resolve();
      gate = c;
      c.then(function () { if (gate === c) gate = null; invalidate(); requestAnimationFrame(function () { if (fadeEl) fadeEl.classList.remove("is-on"); }); });
    }
    if (m === mode) { applyRig(); invalidate(); return; }
    if (reduced || !fadeEl || !window.__studio.ready) return go();
    fadeEl.classList.add("is-on");
    setTimeout(go, 160);
  }
  document.querySelectorAll(".studio-lights [data-light]").forEach(function (b) {
    b.addEventListener("click", function () { interrupt(); setMode(b.getAttribute("data-light")); });
  });
  /* a finger or pointer arriving on the lighting chips starts the small road download, so the first switch rarely waits */
  var lightsEl = document.querySelector(".studio-lights");
  if (lightsEl) ["pointerenter", "touchstart", "focusin"].forEach(function (ev) { lightsEl.addEventListener(ev, function () { loadRoadTextures(); }, { once: true, passive: true }); });

  function setPaint(hex, metal) {
    if (!bodyMat) return;
    bodyMat.color.set(hex); paintMetal = !!metal; applyFinish(); invalidate();
  }
  function applyFinish() {
    if (!bodyMat) return;
    if (finish === "matte") { bodyMat.roughness = 0.85; bodyMat.clearcoat = 0; bodyMat.metalness = 0.15; }
    else { bodyMat.clearcoat = 1; bodyMat.clearcoatRoughness = 0.03; bodyMat.metalness = paintMetal ? 0.6 : 0.05; bodyMat.roughness = paintMetal ? 0.35 : 0.28; }
    bodyMat.needsUpdate = true;
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

  /* ------------------------------------------------------------------ spotlight entrance (plays once per car; any input skips) */
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

  /* ------------------------------------------------------------------ cinematic tour (about 20 s) */
  var TOUR = [
    { k: "front34", t: "Front three-quarter" }, { k: "headlight", t: "Headlights" }, { k: "wheel", t: "Wheels" }, { k: "side", t: "Side profile" },
    { k: "interior", t: "Cabin" }, { k: "rear34", t: "Rear three-quarter" }, { k: "top", t: "From above" }, { k: "front34", t: "Back to the front" }
  ];
  var tourBtn = $("tourBtn");
  function startTour() {
    interrupt(true); closeCard(); hideEnd();
    tour = { t0: performance.now(), i: -1 };
    tourBtn.setAttribute("aria-pressed", "true"); tourBtn.textContent = "Stop the tour";
    $("tourHud").hidden = false; $("tourChapter").hidden = false;
    setPresetPressed(null);
    invalidate();
  }
  function stepTour(now) {
    var el = (now - tour.t0) / 1000, i = Math.min(TOUR.length - 1, Math.floor(el / TOUR_STEP));
    if (i !== tour.i) {
      tour.i = i;
      flyTo(preset(TOUR[i].k), reduced ? 0 : Math.min(1500, TOUR_STEP * 1000 * 0.6));
      $("tourKicker").textContent = String(i + 1).padStart(2, "0") + " / " + String(TOUR.length).padStart(2, "0");
      $("tourTitle").textContent = TOUR[i].t;
      var ch = $("tourChapter"); ch.hidden = true; void ch.offsetWidth; ch.hidden = false;
    }
    var total = TOUR.length * TOUR_STEP, p = clamp(el / total, 0, 1);
    $("tourFill").style.transform = "scaleX(" + p.toFixed(4) + ")";
    var clock = String(Math.min(20, Math.round(el))).padStart(2, "0") + " / 20 s";
    if (clock !== tour.clock) { tour.clock = clock; $("tourClock").textContent = clock; }       // text only when the second changes
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
  tourBtn.addEventListener("click", function () { if (tour) { endTour(false); } else startTour(); });

  /* any input: skip the entrance, stop the tour, hide the end card */
  function interrupt(keepTour) { skipIntro(); if (!keepTour && tour) endTour(false); hideEnd(); }

  /* ------------------------------------------------------------------ turntable, tilt (touch), AR */
  var turnBtn = $("turntableBtn");
  if (reduced) turnBtn.hidden = true;
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

  /* AR "view in your space": only for a real per-car scan, and only when the site turned AR on (an AR Ferrari beside a Kia listing would mislead) */
  var arBtn = $("arBtn");
  var arAllowed = !!(SITE.features && SITE.features.ar) && !!scanUrl;
  function arCheck() { arBtn.hidden = !(arAllowed && isScan); }
  arBtn.addEventListener("click", function () {
    import("../vendor/model-viewer/model-viewer.min.js").then(function () {
      var mv = document.createElement("model-viewer");
      mv.setAttribute("src", scanUrl); mv.setAttribute("ar", ""); mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
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
    if (Object.keys(pointers).length === 2) { var p = Object.keys(pointers).map(function (k) { return pointers[k]; }); pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); return; }
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
    if (!touchLike) tgt.el = clamp(tgt.el + dy * 0.0035, EL_MIN, EL_MAX);
    setPresetPressed(null);
    invalidate();
  });
  function endDrag(e) { delete pointers[e.pointerId]; pinch = 0; if (e.pointerId !== pid) return; dragging = false; pid = null; canvas.classList.remove("is-dragging"); invalidate(); }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { canvas.addEventListener(n, endDrag); });
  canvas.addEventListener("wheel", function (e) {            // zoom only with ctrl / pinch gesture: a plain wheel always scrolls the page
    if (!e.ctrlKey && !e.metaKey) return;
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

  /* ------------------------------------------------------------------ hooks for QA and the analytics */
  window.__studio = {
    ready: false,
    get state() {
      return { mode: mode, model: isScan ? "scan" : "illustrative", tour: !!tour, intro: !!intro, tween: !!tween, turntable: turntable, selected: selected,
               envLoaded: Object.keys(envs), rig: rig, outdoor: !!roadSet.visible, lamps: !!lampSet.visible, dpr: dprNow, shadows: renderer.shadowMap.enabled, bodyHex: bodyMat ? "#" + bodyMat.color.getHexString() : null,
               rimHex: rimMats.map(function (m) { return "#" + m.color.getHexString(); }), rendering: !!raf, aspect: camera.aspect, glass: glassMat ? glassMat.type : null,
               hotspots: HOT.map(function (h) { return { key: h.key, visible: !!h.visible }; }), mirror: !!(mirror && mirror.visible), orbit: Object.assign({}, orb) };
    },
    preset: function (k) { setPresetPressed(k); flyTo(preset(k), TWEEN_MS); },
    select: function (k) { selectHotspot(k, true); },
    setMode: setMode, startTour: startTour, render: function () { applyCamera(); renderer.render(scene, camera); },
    cameraPosition: function () { return camera.position.toArray(); },
    skip: function () { interrupt(); }
  };
  applyRig();
}

/* start (after every top-level table above has been assigned) */
if (!car) {
  $("studioShell").hidden = true;
  $("studioNotFound").hidden = false;
} else {
  initSidePanel(car);
  initStudio(car);
}
